import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { anthropic, describeError, FALLBACK, MODEL } from "@/lib/claude";
import { EXTRACTION_PROMPT, ExtractedReturn, toPortfolio } from "@/lib/extraction";
import { currentAdvisor, unauthorized } from "@/lib/session";
import { MAX_UPLOAD_BYTES } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;


/**
 * Reads a tax return and returns a portfolio. The PDF lives only in memory for
 * the length of this request: it is never written to disk or logged.
 */
export async function POST(request: Request) {
  // AI calls spend the API key, so they are for signed-in advisors only.
  if (!(await currentAdvisor())) return unauthorized();
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Attach a tax return PDF." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return Response.json({ error: "Only PDF files are supported." }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "That file is over 4 MB. Upload just the 1040 and Schedule E pages, or a compressed copy." }, { status: 413 });
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
