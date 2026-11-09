import { mkdirSync } from "node:fs";
import type { Client } from "@libsql/client";

/**
 * libSQL speaks SQLite to either a local file (development) or a hosted Turso
 * database (Vercel, where the filesystem is read-only and not shared between instances).
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS advisors (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  advisor_id TEXT NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_advisor ON sessions(advisor_id);

CREATE TABLE IF NOT EXISTS clients (
  id          TEXT PRIMARY KEY,
  advisor_id  TEXT NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  household   TEXT NOT NULL,
  portfolio   TEXT NOT NULL,
  assumptions TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS clients_advisor ON clients(advisor_id, updated_at DESC);
`;

export async function openDatabase(url: string, authToken?: string): Promise<Client> {
  const local = url.startsWith("file:") || url === ":memory:";
  if (url.startsWith("file:")) mkdirSync("data", { recursive: true });
  // The default entry loads libSQL's native engine even for remote URLs, and serverless
  // bundles (Netlify, Vercel) may not ship that binary. Turso only needs the fetch-based client.
  const { createClient } = local ? await import("@libsql/client") : await import("@libsql/client/web");
  const client = createClient({ url, authToken });
  await client.executeMultiple(SCHEMA);
  return client;
}

function databaseUrl(): string {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return url;
  if (process.env.VERCEL || process.env.NETLIFY) {
    throw new Error("TURSO_DATABASE_URL is not set. Serverless hosts have no persistent disk, so saved clients need a hosted database.");
  }
  return "file:data/planner.db";
}

// One client per server instance; survives dev-server hot reloads.
const globalDb = globalThis as { __plannerDb?: Promise<Client> };

export function db(): Promise<Client> {
  globalDb.__plannerDb ??= openDatabase(databaseUrl(), process.env.TURSO_AUTH_TOKEN).catch((error) => {
    globalDb.__plannerDb = undefined; // let the next request retry
    throw error;
  });
  return globalDb.__plannerDb;
}
