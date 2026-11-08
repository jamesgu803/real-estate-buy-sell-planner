import { createAdvisor } from "@/lib/accounts";
import { db } from "@/lib/db";
import { SignUp } from "@/lib/schema";
import { startSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = SignUp.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the form and try again." }, { status: 400 });
  }
  const advisor = await createAdvisor(await db(), parsed.data);
  if (!advisor) {
    return Response.json({ error: "An account with that email already exists. Sign in instead." }, { status: 409 });
  }
  await startSession(advisor.id);
  return Response.json({ advisor }, { status: 201 });
}
