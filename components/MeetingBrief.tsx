"use client";

import { useEffect, useState } from "react";
import type { Brief } from "@/lib/brief";
import type { Assumptions, ClientProfile, Property } from "@/lib/types";

export function MeetingBrief({
  property,
  client,
  assumptions,
}: {
  property: Property;
  client: ClientProfile;
  assumptions: Assumptions;
}) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  // A brief written against old numbers shouldn't be read as current.
  useEffect(() => {
    if (brief) setStale(true);
  }, [property, client, assumptions]);

  useEffect(() => {
    setBrief(null);
    setError(null);
  }, [property.id]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property, client, assumptions }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't draft the brief.");
      setBrief(json as Brief);
      setStale(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't draft the brief.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card brief">
      <div className="card-head">
        <div>
          <h2 className="card-title">Meeting brief</h2>
          <p className="muted small">Talking points drafted by Claude from the numbers above. It explains the model; it doesn&rsquo;t change it.</p>
        </div>
        <button className="btn primary" onClick={generate} disabled={busy}>
          {busy ? "Drafting…" : brief ? "Redraft" : "Draft brief"}
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {stale && brief && <p className="notice small">Figures changed since this brief was drafted. Redraft to update it.</p>}

      {brief && (
        <div className="brief-body">
          <p className="brief-headline">{brief.headline}</p>
          <div className="brief-points">
            {brief.talkingPoints.map((t) => (
              <div key={t.title}>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </div>
            ))}
          </div>
          <div className="brief-columns">
            <div>
              <h3>Ask the client</h3>
              <ul>
                {brief.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Confirm before advising</h3>
              <ul>
                {brief.caveats.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
