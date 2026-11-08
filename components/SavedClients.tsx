"use client";

import { useEffect, useState } from "react";
import type { ClientSummary } from "@/lib/accounts";
import { api } from "@/lib/http";

const updated = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function SavedClients({ onOpen }: { onOpen: (id: string) => void }) {
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    api<{ clients: ClientSummary[] }>("/api/clients")
      .then((r) => setClients(r.clients))
      .catch((e: Error) => setError(e.message));
  }, []);

  async function remove(id: string) {
    try {
      await api(`/api/clients/${id}`, { method: "DELETE" });
      setClients((cs) => cs?.filter((c) => c.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that client.");
    } finally {
      setConfirming(null);
    }
  }

  return (
    <section className="saved" aria-labelledby="saved-title">
      <h2 id="saved-title" className="saved-title">
        Your clients
      </h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {clients === null && !error && <p className="muted small">Loading…</p>}
      {clients?.length === 0 && (
        <p className="muted small">No saved clients yet. Upload a return, or open the demo and save it.</p>
      )}
      {clients && clients.length > 0 && (
        <ul className="saved-list">
          {clients.map((c) => (
            <li key={c.id}>
              <button className="saved-open" onClick={() => onOpen(c.id)}>
                <span className="saved-name">{c.household}</span>
                <span className="muted small">
                  {c.propertyCount} {c.propertyCount === 1 ? "property" : "properties"} · updated {updated(c.updatedAt)}
                </span>
              </button>
              {confirming === c.id ? (
                <span className="saved-confirm">
                  <button className="btn danger" onClick={() => remove(c.id)}>
                    Delete
                  </button>
                  <button className="btn ghost" onClick={() => setConfirming(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button className="btn ghost" aria-label={`Delete ${c.household}`} onClick={() => setConfirming(c.id)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
