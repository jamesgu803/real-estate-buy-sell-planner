"use client";

import { useState } from "react";
import type { Advisor } from "@/lib/accounts";
import { api } from "@/lib/http";

export function AuthForm({ onAuthed }: { onAuthed: (a: Advisor) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { advisor } = await api<{ advisor: Advisor }>(`/api/auth/${mode}`, {
        method: "POST",
        body: Object.fromEntries(form),
      });
      onAuthed(advisor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const signup = mode === "signup";
  return (
    <form className="auth" onSubmit={submit}>
      <div>
        <p className="dropzone-title">{signup ? "Create your advisor account" : "Sign in to your workspace"}</p>
        <p className="muted small">Upload returns, draft briefs and keep every client&rsquo;s plan saved.</p>
      </div>
      {signup && (
        <div className="field">
          <label htmlFor="auth-name">Name</label>
          <input id="auth-name" name="name" className="text-input" autoComplete="name" required maxLength={100} />
        </div>
      )}
      <div className="field">
        <label htmlFor="auth-email">Email</label>
        <input id="auth-email" name="email" type="email" className="text-input" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          name="password"
          type="password"
          className="text-input"
          autoComplete={signup ? "new-password" : "current-password"}
          required
          minLength={signup ? 8 : undefined}
        />
        {signup && <p className="field-hint">At least 8 characters.</p>}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary wide" disabled={busy}>
        {busy ? "One moment…" : signup ? "Create account" : "Sign in"}
      </button>
      <p className="muted small auth-switch">
        {signup ? "Already have an account?" : "New here?"}{" "}
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(signup ? "login" : "signup");
            setError(null);
          }}
        >
          {signup ? "Sign in" : "Create an account"}
        </button>
      </p>
    </form>
  );
}
