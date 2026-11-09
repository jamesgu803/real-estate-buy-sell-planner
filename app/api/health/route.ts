import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deployment check: is the database configured and reachable? Reports no secrets. */
export async function GET() {
  const database = process.env.TURSO_DATABASE_URL ? "turso" : "local file";
  try {
    await (await db()).execute("SELECT 1");
    return Response.json({ ok: true, database });
  } catch (error) {
    console.error("Health check failed:", error);
    const reason = error instanceof Error && /TURSO_DATABASE_URL/.test(error.message)
      ? "TURSO_DATABASE_URL is not set on this deployment."
      : "The database is configured but not reachable. Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN, then redeploy.";
    return Response.json({ ok: false, database, reason, anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY) }, { status: 503 });
  }
}
