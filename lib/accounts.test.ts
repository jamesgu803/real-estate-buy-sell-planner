import { describe, expect, it } from "vitest";
import {
  advisorForSession,
  authenticate,
  createAdvisor,
  createClient,
  createSession,
  deleteClient,
  deleteSession,
  getClient,
  hashPassword,
  listClients,
  updateClient,
  verifyPassword,
} from "./accounts";
import { openDatabase } from "./db";
import { DEFAULT_ASSUMPTIONS } from "./engine";
import { SAMPLE_PORTFOLIO } from "./sample";
import { PortfolioSchema, SignUp } from "./schema";

type Db = Awaited<ReturnType<typeof openDatabase>>;

const fresh = () => openDatabase(":memory:");
const signUp = async (db: Db, email = "ana@example.com") =>
  (await createAdvisor(db, { email, name: "Ana", password: "correct horse" }))!;

describe("passwords", () => {
  it("verifies the right password and rejects others", async () => {
    const stored = await hashPassword("correct horse");
    expect(stored).not.toContain("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
    expect(await verifyPassword("wrong horse", stored)).toBe(false);
    expect(await verifyPassword("correct horse", "garbage")).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });
});

describe("advisors and sessions", () => {
  it("rejects a duplicate email", async () => {
    const db = await fresh();
    expect(await signUp(db)).not.toBeNull();
    expect(await createAdvisor(db, { email: "ana@example.com", name: "Other", password: "another one" })).toBeNull();
  });

  it("normalizes email case at sign-up", () => {
    const parsed = SignUp.parse({ email: " Ana@Example.COM ", name: "Ana", password: "correct horse" });
    expect(parsed.email).toBe("ana@example.com");
  });

  it("authenticates only with the right password", async () => {
    const db = await fresh();
    const ana = await signUp(db);
    expect((await authenticate(db, "ana@example.com", "correct horse"))?.id).toBe(ana.id);
    expect(await authenticate(db, "ana@example.com", "wrong horse")).toBeNull();
    expect(await authenticate(db, "nobody@example.com", "correct horse")).toBeNull();
  });

  it("resolves a session token until it is deleted", async () => {
    const db = await fresh();
    const ana = await signUp(db);
    const { token } = await createSession(db, ana.id);
    expect((await advisorForSession(db, token))?.email).toBe("ana@example.com");
    expect(await advisorForSession(db, "not-a-token")).toBeNull();
    await deleteSession(db, token);
    expect(await advisorForSession(db, token)).toBeNull();
  });

  it("stores a hash of the token, not the token", async () => {
    const db = await fresh();
    const { token } = await createSession(db, (await signUp(db)).id);
    const { rows } = await db.execute("SELECT token_hash FROM sessions");
    expect(rows.map((r) => r.token_hash)).not.toContain(token);
  });

  it("ignores expired sessions", async () => {
    const db = await fresh();
    const { token } = await createSession(db, (await signUp(db)).id);
    await db.execute({ sql: "UPDATE sessions SET expires_at = ?", args: [Date.now() - 1] });
    expect(await advisorForSession(db, token)).toBeNull();
  });
});

describe("saved clients", () => {
  it("round-trips a portfolio and its assumptions", async () => {
    const db = await fresh();
    const ana = await signUp(db);
    const saved = await createClient(db, ana.id, SAMPLE_PORTFOLIO, { ...DEFAULT_ASSUMPTIONS, horizonYears: 15 });
    const loaded = (await getClient(db, ana.id, saved.id))!;
    expect(loaded.portfolio.properties).toEqual(SAMPLE_PORTFOLIO.properties);
    expect(loaded.portfolio.source).toBe("upload");
    expect(loaded.assumptions.horizonYears).toBe(15);
    expect(await listClients(db, ana.id)).toEqual([
      { id: saved.id, household: SAMPLE_PORTFOLIO.client.household, propertyCount: 4, updatedAt: saved.updatedAt },
    ]);
  });

  it("updates and deletes", async () => {
    const db = await fresh();
    const ana = await signUp(db);
    const saved = await createClient(db, ana.id, SAMPLE_PORTFOLIO, DEFAULT_ASSUMPTIONS);
    const renamed = { ...saved.portfolio, client: { ...saved.portfolio.client, household: "Renamed" } };
    expect(await updateClient(db, ana.id, saved.id, renamed, DEFAULT_ASSUMPTIONS)).not.toBeNull();
    expect((await listClients(db, ana.id))[0].household).toBe("Renamed");
    expect(await deleteClient(db, ana.id, saved.id)).toBe(true);
    expect(await getClient(db, ana.id, saved.id)).toBeNull();
  });

  it("never exposes one advisor's clients to another", async () => {
    const db = await fresh();
    const ana = await signUp(db);
    const ben = await signUp(db, "ben@example.com");
    const saved = await createClient(db, ana.id, SAMPLE_PORTFOLIO, DEFAULT_ASSUMPTIONS);
    expect(await listClients(db, ben.id)).toEqual([]);
    expect(await getClient(db, ben.id, saved.id)).toBeNull();
    expect(await updateClient(db, ben.id, saved.id, SAMPLE_PORTFOLIO, DEFAULT_ASSUMPTIONS)).toBeNull();
    expect(await deleteClient(db, ben.id, saved.id)).toBe(false);
    expect(await getClient(db, ana.id, saved.id)).not.toBeNull();
  });
});

describe("portfolio validation", () => {
  it("accepts the sample and rejects malformed data", () => {
    expect(PortfolioSchema.safeParse(SAMPLE_PORTFOLIO).success).toBe(true);
    const broken = { ...SAMPLE_PORTFOLIO, properties: [{ ...SAMPLE_PORTFOLIO.properties[0], rents: "lots" }] };
    expect(PortfolioSchema.safeParse(broken).success).toBe(false);
  });
});
