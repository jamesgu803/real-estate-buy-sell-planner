import { createClient, listClients } from "@/lib/accounts";
import { db } from "@/lib/db";
import { SavedClientBody } from "@/lib/schema";
import { currentAdvisor, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const advisor = await currentAdvisor();
  if (!advisor) return unauthorized();
  return Response.json({ clients: await listClients(await db(), advisor.id) });
}

export async function POST(request: Request) {
  const advisor = await currentAdvisor();
  if (!advisor) return unauthorized();
  const parsed = SavedClientBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That client data isn't valid." }, { status: 400 });
  const saved = await createClient(await db(), advisor.id, parsed.data.portfolio, parsed.data.assumptions);
  return Response.json(saved, { status: 201 });
}
