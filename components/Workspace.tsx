"use client";

import { useEffect, useRef, useState } from "react";
import type { Advisor, SavedClient } from "@/lib/accounts";
import { DEFAULT_ASSUMPTIONS } from "@/lib/engine";
import { api } from "@/lib/http";
import { SAMPLE_PORTFOLIO } from "@/lib/sample";
import type { Assumptions, ClientProfile, EstimableField, Portfolio, Property } from "@/lib/types";
import { FactSheet } from "./FactSheet";
import { Intake } from "./Intake";
import { PortfolioView } from "./PortfolioView";
import { PropertyView } from "./PropertyView";
import { Settings } from "./Settings";

type View = { kind: "portfolio" } | { kind: "property"; id: string } | { kind: "factsheet"; id: string };
type SaveState = "saved" | "saving" | "error";

const AUTOSAVE_MS = 800;

export function Workspace() {
  const [advisor, setAdvisor] = useState<Advisor | null | undefined>(undefined);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [view, setView] = useState<View>({ kind: "portfolio" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The saved record this workspace is editing; null for the demo or an unsaved upload.
  const [clientId, setClientId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastSaved = useRef<string | null>(null);

  useEffect(() => {
    api<{ advisor: Advisor | null }>("/api/auth/me")
      .then((r) => setAdvisor(r.advisor))
      .catch(() => setAdvisor(null));
  }, []);

  // ?demo opens the sample client directly; ?demo&property=p0 opens one of its properties.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("demo")) return;
    setPortfolio(SAMPLE_PORTFOLIO);
    const id = params.get("property");
    if (id && SAMPLE_PORTFOLIO.properties.some((p) => p.id === id)) {
      setView(params.has("factsheet") ? { kind: "factsheet", id } : { kind: "property", id });
    }
  }, []);

  // Autosave edits to a saved client, debounced so typing in a field doesn't send a request per keystroke.
  useEffect(() => {
    if (!clientId || !portfolio) return;
    const body = JSON.stringify({ portfolio, assumptions });
    if (body === lastSaved.current) return;
    setSaveState("saving");
    const timer = setTimeout(() => {
      api(`/api/clients/${clientId}`, { method: "PUT", body: { portfolio, assumptions } })
        .then(() => {
          lastSaved.current = body;
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [clientId, portfolio, assumptions]);

  function open(saved: SavedClient) {
    lastSaved.current = JSON.stringify({ portfolio: saved.portfolio, assumptions: saved.assumptions });
    setPortfolio(saved.portfolio);
    setAssumptions(saved.assumptions);
    setClientId(saved.id);
    setSaveState("saved");
  }

  async function save(p: Portfolio, a: Assumptions) {
    setSaveState("saving");
    try {
      open(await api<SavedClient>("/api/clients", { method: "POST", body: { portfolio: p, assumptions: a } }));
    } catch {
      setSaveState("error");
    }
  }

  function close() {
    setPortfolio(null);
    setClientId(null);
    setAssumptions(DEFAULT_ASSUMPTIONS);
    setSaveState("saved");
    lastSaved.current = null;
  }

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setAdvisor(null);
    close();
  }

  if (!portfolio) {
    return (
      <>
        {loadError && (
          <p className="notice floating" role="alert">
            {loadError}
          </p>
        )}
        <Intake
          advisor={advisor}
          onAuthed={setAdvisor}
          onSignOut={signOut}
          onLoaded={(p) => {
            setLoadError(null);
            setView({ kind: "portfolio" });
            setPortfolio(p);
            // A return read for a signed-in advisor is saved straight away; the demo stays a scratchpad.
            if (advisor && p.source === "upload") save(p, DEFAULT_ASSUMPTIONS);
          }}
          onOpenSaved={(id) => {
            setLoadError(null);
            api<SavedClient>(`/api/clients/${id}`)
              .then((saved) => {
                open(saved);
                setView({ kind: "portfolio" });
              })
              .catch((e: Error) => setLoadError(e.message));
          }}
        />
      </>
    );
  }

  const { client, properties } = portfolio;

  const updateProperty = (id: string, patch: Partial<Property>) =>
    setPortfolio({
      ...portfolio,
      properties: properties.map((p) =>
        p.id === id
          ? {
              ...p,
              ...patch,
              // An advisor-entered figure is no longer an estimate.
              estimated: p.estimated.filter((f) => !(f in patch)) as EstimableField[],
            }
          : p,
      ),
    });

  const updateClient = (patch: Partial<ClientProfile>) =>
    setPortfolio({ ...portfolio, client: { ...client, ...patch } });

  const selected = view.kind === "portfolio" ? undefined : properties.find((p) => p.id === view.id);

  return (
    <div className="shell">
      <header className="topbar no-print">
        <button className="wordmark" onClick={() => setView({ kind: "portfolio" })}>
          <span className="wordmark-mark" aria-hidden>◆</span> Buy/Sell Planner
        </button>
        <nav className="crumbs" aria-label="Breadcrumb">
          <button onClick={() => setView({ kind: "portfolio" })}>{client.household}</button>
          {selected && (
            <>
              <span aria-hidden>/</span>
              <button onClick={() => setView({ kind: "property", id: selected.id })}>{selected.name}</button>
            </>
          )}
          {view.kind === "factsheet" && (
            <>
              <span aria-hidden>/</span>
              <span>Fact sheet</span>
            </>
          )}
        </nav>
        <div className="topbar-actions">
          {portfolio.source === "demo" && <span className="badge">Demo client</span>}
          {clientId ? (
            <span className={`save-state${saveState === "error" ? " negative" : ""}`} role="status">
              {saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved, will retry on next edit" : "Saved"}
            </span>
          ) : (
            advisor && (
              <button
                className="btn secondary"
                disabled={saveState === "saving"}
                onClick={() => save(portfolio, assumptions)}
              >
                {saveState === "error" ? "Save failed, retry" : "Save client"}
              </button>
            )
          )}
          <button className="btn ghost" onClick={() => setSettingsOpen(true)}>
            Tax &amp; assumptions
          </button>
          <button className="btn ghost" onClick={close}>
            {advisor ? "All clients" : "New client"}
          </button>
        </div>
      </header>

      <main className="main">
        {portfolio.warnings.length > 0 && view.kind === "portfolio" && (
          <div className="notice no-print" role="status">
            <strong>From the return:</strong>
            <ul>
              {portfolio.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {view.kind === "portfolio" && (
          <PortfolioView
            portfolio={portfolio}
            assumptions={assumptions}
            onOpen={(id) => setView({ kind: "property", id })}
          />
        )}
        {view.kind === "property" && selected && (
          <PropertyView
            property={selected}
            client={client}
            assumptions={assumptions}
            onChange={(patch) => updateProperty(selected.id, patch)}
            onFactSheet={() => setView({ kind: "factsheet", id: selected.id })}
          />
        )}
        {view.kind === "factsheet" && selected && (
          <FactSheet property={selected} client={client} assumptions={assumptions} onBack={() => setView({ kind: "property", id: selected.id })} />
        )}
      </main>

      {settingsOpen && (
        <Settings
          client={client}
          assumptions={assumptions}
          onClient={updateClient}
          onAssumptions={(patch) => setAssumptions({ ...assumptions, ...patch })}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
