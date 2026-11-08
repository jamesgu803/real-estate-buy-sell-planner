"use client";

import { useRef, useState } from "react";
import type { Advisor } from "@/lib/accounts";
import { SAMPLE_PORTFOLIO } from "@/lib/sample";
import { MAX_UPLOAD_BYTES, type Portfolio } from "@/lib/types";
import { AuthForm } from "./AuthForm";
import { SavedClients } from "./SavedClients";

const STEPS = [
  "Reading the return",
  "Finding Schedule E",
  "Pulling income, expenses and depreciation",
  "Building the portfolio",
];

export function Intake({
  advisor,
  onAuthed,
  onSignOut,
  onLoaded,
  onOpenSaved,
}: {
  /** undefined while the session is still being checked. */
  advisor: Advisor | null | undefined;
  onAuthed: (a: Advisor) => void;
  onSignOut: () => void;
  onLoaded: (p: Portfolio) => void;
  onOpenSaved: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (file.type !== "application/pdf") {
      setError("That isn't a PDF. Upload the client's Form 1040 with Schedule E.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That PDF is over 4 MB. Upload just the 1040 and Schedule E pages, or a compressed copy.");
      return;
    }
    setBusy(true);
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 6000);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed.");
      const portfolio = json as Portfolio;
      if (portfolio.properties.length === 0) {
        throw new Error(portfolio.warnings[0] ?? "No rental properties were found on this return.");
      }
      onLoaded(portfolio);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  return (
    <div className="intake">
      <div className="intake-copy">
        <p className="eyebrow">
          <span className="wordmark-mark" aria-hidden>◆</span> Buy/Sell Planner
        </p>
        <h1>
          Every rental on the return,
          <br />
          <em>ready for the plan.</em>
        </h1>
        <p className="lede">
          Drop in a client&rsquo;s tax return. The planner reads Schedule E, builds the property portfolio, and models
          hold, sell, 1031 exchange and step-up for each property, so you walk into the meeting with the numbers.
        </p>
        <ul className="intake-points">
          <li>
            <strong>No data entry.</strong> Rents, expenses and depreciation come straight off the return.
          </li>
          <li>
            <strong>After-tax answers.</strong> Depreciation recapture, capital gains, NIIT and state tax for every
            path.
          </li>
          <li>
            <strong>Saved per advisor.</strong> Each client&rsquo;s plan is kept in your account. The PDF itself is read
            in memory and never stored.
          </li>
        </ul>
      </div>

      <div className="intake-side">
        <div className="intake-card">
          {advisor && (
            <p className="account-line muted small">
              Signed in as <strong>{advisor.name}</strong>
              <button className="link" onClick={onSignOut}>
                Sign out
              </button>
            </p>
          )}
          {advisor === null && <AuthForm onAuthed={onAuthed} />}
          {advisor && (
            <div
              className={`dropzone${dragging ? " dragging" : ""}${busy ? " busy" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file && !busy) upload(file);
              }}
            >
              {busy ? (
                <div className="progress" aria-live="polite">
                  <div className="spinner" aria-hidden />
                  <p className="progress-step">{STEPS[step]}&hellip;</p>
                  <p className="muted small">Usually 20–60 seconds for a full return.</p>
                </div>
              ) : (
                <>
                  <svg className="dropzone-icon" viewBox="0 0 48 48" aria-hidden>
                    <path
                      d="M14 6h14l10 10v26a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M28 6v10h10M24 22v14m-6-6 6 6 6-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="dropzone-title">Drop a tax return PDF</p>
                  <p className="muted small">Form 1040 with Schedule E · up to 4 MB</p>
                  <button className="btn primary" onClick={() => input.current?.click()}>
                    Choose file
                  </button>
                  <input
                    ref={input}
                    type="file"
                    accept="application/pdf"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) upload(file);
                      e.target.value = "";
                    }}
                  />
                </>
              )}
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="divider">
            <span>or</span>
          </div>
          <button className="btn secondary wide" disabled={busy} onClick={() => onLoaded(SAMPLE_PORTFOLIO)}>
            Explore a demo client
            <span className="muted small"> · 4 properties, Los Angeles</span>
          </button>
        </div>
        {advisor && <SavedClients onOpen={onOpenSaved} />}
      </div>
    </div>
  );
}
