"use client";

import { useEffect, useState } from "react";
import { DEFAULT_ASSUMPTIONS } from "@/lib/engine";
import { SAMPLE_PORTFOLIO } from "@/lib/sample";
import type { Assumptions, ClientProfile, EstimableField, Portfolio, Property } from "@/lib/types";
import { FactSheet } from "./FactSheet";
import { Intake } from "./Intake";
import { PortfolioView } from "./PortfolioView";
import { PropertyView } from "./PropertyView";
import { Settings } from "./Settings";

type View = { kind: "portfolio" } | { kind: "property"; id: string } | { kind: "factsheet"; id: string };

export function Workspace() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [view, setView] = useState<View>({ kind: "portfolio" });
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  if (!portfolio) {
    return (
      <Intake
        onLoaded={(p) => {
          setPortfolio(p);
          setView({ kind: "portfolio" });
        }}
      />
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
          <button className="btn ghost" onClick={() => setSettingsOpen(true)}>
            Tax &amp; assumptions
          </button>
          <button className="btn ghost" onClick={() => setPortfolio(null)}>
            New client
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
