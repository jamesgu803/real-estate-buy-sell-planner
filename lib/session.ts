import { cookies } from "next/headers";
import { type Advisor, advisorForSession, createSession, deleteSession } from "./accounts";
import { db } from "./db";

/** Cookie glue between route handlers and the session table. */

const COOKIE = "planner_session";

export async function currentAdvisor(): Promise<Advisor | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? await advisorForSession(await db(), token) : null;
}

export async function startSession(advisorId: string): Promise<void> {
  const { token, expiresAt } = await createSession(await db(), advisorId);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await deleteSession(await db(), token);
  store.delete(COOKIE);
}

export const unauthorized = () => Response.json({ error: "Sign in to continue." }, { status: 401 });
