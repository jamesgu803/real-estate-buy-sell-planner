import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Client } from "@libsql/client";
import type { Assumptions, Portfolio } from "./types";

/** Data access for advisors, sessions and saved clients. Every query takes the db, so tests can use :memory:. */

export const SESSION_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export interface Advisor {
  id: string;
  email: string;
  name: string;
}

// ---------- Passwords ----------

const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEYLEN = 32;
const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: typeof SCRYPT) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN, SCRYPT);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64url"), expected.length, SCRYPT);
  return timingSafeEqual(actual, expected);
}

// Compared against when the email is unknown, so a miss takes as long as a wrong password.
const DUMMY_HASH = hashPassword(randomUUID());

// ---------- Advisors ----------

export async function createAdvisor(
  db: Client,
  input: { email: string; name: string; password: string },
): Promise<Advisor | null> {
  const advisor = { id: randomUUID(), email: input.email, name: input.name };
  const result = await db.execute({
    sql: "INSERT INTO advisors (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING",
    args: [advisor.id, advisor.email, advisor.name, await hashPassword(input.password), Date.now()],
  });
  return result.rowsAffected === 1 ? advisor : null;
}

export async function authenticate(db: Client, email: string, password: string): Promise<Advisor | null> {
  const { rows } = await db.execute({
    sql: "SELECT id, email, name, password_hash FROM advisors WHERE email = ?",
    args: [email],
  });
  const row = rows[0];
  const ok = await verifyPassword(password, row ? String(row.password_hash) : await DUMMY_HASH);
  return row && ok ? { id: String(row.id), email: String(row.email), name: String(row.name) } : null;
}

// ---------- Sessions ----------

// The cookie carries a random token; only its hash is stored, so a leaked database can't be replayed as sessions.
const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

export async function createSession(db: Client, advisorId: string): Promise<{ token: string; expiresAt: number }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_DAYS * DAY;
  await db.batch(
    [
      { sql: "DELETE FROM sessions WHERE expires_at < ?", args: [Date.now()] },
      { sql: "INSERT INTO sessions (token_hash, advisor_id, expires_at) VALUES (?, ?, ?)", args: [hashToken(token), advisorId, expiresAt] },
    ],
    "write",
  );
  return { token, expiresAt };
}

export async function advisorForSession(db: Client, token: string): Promise<Advisor | null> {
  const { rows } = await db.execute({
    sql: `SELECT a.id, a.email, a.name FROM sessions s JOIN advisors a ON a.id = s.advisor_id
          WHERE s.token_hash = ? AND s.expires_at > ?`,
    args: [hashToken(token), Date.now()],
  });
  const row = rows[0];
  return row ? { id: String(row.id), email: String(row.email), name: String(row.name) } : null;
}

export async function deleteSession(db: Client, token: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM sessions WHERE token_hash = ?", args: [hashToken(token)] });
}

// ---------- Saved clients ----------

export interface ClientSummary {
  id: string;
  household: string;
  propertyCount: number;
  updatedAt: number;
}

export interface SavedClient {
  id: string;
  portfolio: Portfolio;
  assumptions: Assumptions;
  updatedAt: number;
}

export async function listClients(db: Client, advisorId: string): Promise<ClientSummary[]> {
  const { rows } = await db.execute({
    sql: `SELECT id, household, json_array_length(portfolio, '$.properties') AS property_count, updated_at
          FROM clients WHERE advisor_id = ? ORDER BY updated_at DESC`,
    args: [advisorId],
  });
  return rows.map((r) => ({
    id: String(r.id),
    household: String(r.household),
    propertyCount: Number(r.property_count),
    updatedAt: Number(r.updated_at),
  }));
}

export async function getClient(db: Client, advisorId: string, id: string): Promise<SavedClient | null> {
  const { rows } = await db.execute({
    sql: "SELECT id, portfolio, assumptions, updated_at FROM clients WHERE id = ? AND advisor_id = ?",
    args: [id, advisorId],
  });
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    portfolio: JSON.parse(String(row.portfolio)),
    assumptions: JSON.parse(String(row.assumptions)),
    updatedAt: Number(row.updated_at),
  };
}

export async function createClient(
  db: Client,
  advisorId: string,
  portfolio: Portfolio,
  assumptions: Assumptions,
): Promise<SavedClient> {
  const id = randomUUID();
  const now = Date.now();
  // Saved clients are real records, not the demo.
  const saved: Portfolio = { ...portfolio, source: "upload" };
  await db.execute({
    sql: "INSERT INTO clients (id, advisor_id, household, portfolio, assumptions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [id, advisorId, saved.client.household, JSON.stringify(saved), JSON.stringify(assumptions), now, now],
  });
  return { id, portfolio: saved, assumptions, updatedAt: now };
}

/** Returns the new updatedAt, or null when the client doesn't exist or belongs to another advisor. */
export async function updateClient(
  db: Client,
  advisorId: string,
  id: string,
  portfolio: Portfolio,
  assumptions: Assumptions,
): Promise<number | null> {
  const now = Date.now();
  const result = await db.execute({
    sql: "UPDATE clients SET household = ?, portfolio = ?, assumptions = ?, updated_at = ? WHERE id = ? AND advisor_id = ?",
    args: [portfolio.client.household, JSON.stringify(portfolio), JSON.stringify(assumptions), now, id, advisorId],
  });
  return result.rowsAffected === 1 ? now : null;
}

export async function deleteClient(db: Client, advisorId: string, id: string): Promise<boolean> {
  const result = await db.execute({ sql: "DELETE FROM clients WHERE id = ? AND advisor_id = ?", args: [id, advisorId] });
  return result.rowsAffected === 1;
}
