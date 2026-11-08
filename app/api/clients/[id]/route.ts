import { deleteClient, getClient, updateClient } from "@/lib/accounts";
import { db } from "@/lib/db";
import { SavedClientBody } from "@/lib/schema";
import { currentAdvisor, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

// Another advisor's client gets the same 404 as a missing one.
const notFound = () => Response.json({ error: "Client not found." }, { status: 404 });

export async function GET(_request: Request, { params }: Context) {
  const advisor = await currentAdvisor();
  if (!advisor) return unauthorized();
  const saved = await getClient(await db(), advisor.id, (await params).id);
  return saved ? Response.json(saved) : notFound();
}

export async function PUT(request: Request, { params }: Context) {
  const advisor = await currentAdvisor();
  if (!advisor) return unauthorized();
  const parsed = SavedClientBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That client data isn't valid." }, { status: 400 });
  const updatedAt = await updateClient(await db(), advisor.id, (await params).id, parsed.data.portfolio, parsed.data.assumptions);
  return updatedAt === null ? notFound() : Response.json({ updatedAt });
}

export async function DELETE(_request: Request, { params }: Context) {
  const advisor = await currentAdvisor();
  if (!advisor) return unauthorized();
  const deleted = await deleteClient(await db(), advisor.id, (await params).id);
  return deleted ? Response.json({ ok: true }) : notFound();
}
