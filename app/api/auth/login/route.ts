import { authenticate } from "@/lib/accounts";
import { db } from "@/lib/db";
import { Credentials } from "@/lib/schema";
import { startSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = Credentials.safeParse(await request.json().catch(() => null));
  // Same message for a bad form, unknown email and wrong password, so the response doesn't reveal which accounts exist.
  const denied = Response.json({ error: "That email and password don't match an account." }, { status: 401 });
  if (!parsed.success) return denied;
  const advisor = await authenticate(await db(), parsed.data.email, parsed.data.password);
  if (!advisor) return denied;
  await startSession(advisor.id);
  return Response.json({ advisor });
}
