import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Brief } from "@/lib/brief";
import { anthropic, describeError, FALLBACK, MODEL } from "@/lib/claude";
import { compareStrategies, currentCashFlow, equity, STRATEGY_LABEL } from "@/lib/engine";
import { propertySignals } from "@/lib/signals";
import type { Assumptions, ClientProfile, Property } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM = `You help financial advisors prepare for client meetings about investment real estate.

You'll get one property's figures and a deterministic model comparing holding, selling, a 1031 exchange, and holding until a basis step-up at death. The numbers are already computed: use them as given and never recompute or invent figures.

Write for the advisor, not the client. Be specific and plain-spoken, cite dollar amounts from the data, and keep each talking point under 60 words. Don't make a final recommendation: the advisor owns that. Note where the client's goals (liquidity, estate plans, appetite for being a landlord) would change the answer.`;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    property?: Property;
    client?: ClientProfile;
    assumptions?: Assumptions;
  } | null;
  if (!body?.property || !body.client || !body.assumptions) {
    return Response.json({ error: "Missing property, client or assumptions." }, { status: 400 });
  }
  const { property, client, assumptions } = body;

  const comparison = compareStrategies(property, client, assumptions);
  const last = assumptions.horizonYears;
  const facts = {
    client: { household: client.household, filingStatus: client.filingStatus },
    property: {
      name: property.name,
      type: property.type,
      yearPlacedInService: property.yearPlacedInService,
      marketValue: property.marketValue,
      loanBalance: property.loanBalance,
      equity: equity(property),
      fieldsEstimatedNotFromReturn: property.estimated,
    },
    currentYear: currentCashFlow(property, client),
    sellToday: comparison.today,
    terminalWealthAfterTax: Object.fromEntries(
      Object.entries(comparison.series).map(([k, v]) => [STRATEGY_LABEL[k as keyof typeof STRATEGY_LABEL], Math.round(v[last])]),
    ),
    horizonYears: last,
    assumptions,
    signals: propertySignals(property, client, assumptions).map((s) => s.title),
  };

  try {
    const message = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      system: SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(Brief) },
      messages: [{ role: "user", content: `Prepare a meeting brief.\n\n${JSON.stringify(facts, null, 2)}` }],
    });

    if (message.stop_reason === "refusal" || !message.parsed_output) {
      return Response.json({ error: "Couldn't generate a brief for this property." }, { status: 422 });
    }
    return Response.json(message.parsed_output);
  } catch (error) {
    const { status, message } = describeError(error);
    return Response.json({ error: message }, { status });
  }
}
