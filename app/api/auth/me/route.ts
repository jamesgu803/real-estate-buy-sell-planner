import { currentAdvisor } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ advisor: await currentAdvisor() });
}
