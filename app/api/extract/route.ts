import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { anthropic, describeError, FALLBACK, MODEL } from "@/lib/claude";
import { EXTRACTION_PROMPT, ExtractedReturn, toPortfolio } from "@/lib/extraction";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 32 * 1024 * 1024;

/**
 * Reads a tax return and returns a portfolio. The PDF lives only in memory for
 * the length of this request: it is never written to disk or logged.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Attach a tax return PDF." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return Response.json({ error: "Only PDF files are supported." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "That file is over 32 MB." }, { status: 413 });
  }

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const message = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(ExtractedReturn) },
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return Response.json({ error: "The AI service declined to process this document." }, { status: 422 });
    }
    if (!message.parsed_output) {
      return Response.json({ error: "Couldn't read the property figures from that return." }, { status: 422 });
    }
    return Response.json(toPortfolio(message.parsed_output));
  } catch (error) {
    const { status, message } = describeError(error);
    return Response.json({ error: message }, { status });
  }
}
