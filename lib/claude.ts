import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParams } from "@anthropic-ai/sdk/resources/beta/messages";

export const MODEL = "claude-opus-5-5";

/** If a request is declined, the API re-runs it on Anthropic's recommended fallback model. */
export const FALLBACK: Pick<MessageCreateParams, "betas" | "fallbacks"> = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

let client: Anthropic | undefined;

export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

/** Map SDK errors to a status and a message safe to show an advisor. */
export function describeError(error: unknown): { status: number; message: string } {
  if (error instanceof Anthropic.AuthenticationError) {
    return { status: 401, message: "No valid Anthropic API key is configured. Set ANTHROPIC_API_KEY, or try the demo client." };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { status: 429, message: "The AI service is busy. Try again in a minute." };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { status: 400, message: "The AI service couldn't read that file. Make sure it's a text-based or scanned PDF under 32 MB." };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { status: 502, message: "Couldn't reach the AI service." };
  }
  if (error instanceof Anthropic.APIError) {
    return { status: 502, message: `AI service error (${error.status}).` };
  }
  if (error instanceof Error && /credentials|api key/i.test(error.message)) {
    return { status: 401, message: "No Anthropic API key is configured. Set ANTHROPIC_API_KEY, or try the demo client." };
  }
  return { status: 500, message: "Something went wrong." };
}
