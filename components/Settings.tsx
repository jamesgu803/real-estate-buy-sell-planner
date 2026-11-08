"use client";

import { useEffect } from "react";
import type { Assumptions, ClientProfile, FilingStatus } from "@/lib/types";
import { PercentField } from "./Fields";

const FILING: Record<FilingStatus, string> = {
  married_joint: "Married filing jointly",
  single: "Single",
  head_of_household: "Head of household",
  married_separate: "Married filing separately",
};

export function Settings({
  client,
  assumptions,
  onClient,
  onAssumptions,
  onClose,
}: {
  client: ClientProfile;
  assumptions: Assumptions;
  onClient: (patch: Partial<ClientProfile>) => void;
  onAssumptions: (patch: Partial<Assumptions>) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-label="Tax and assumptions" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2 className="card-title">Tax &amp; assumptions</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <h3 className="drawer-section">Client tax profile</h3>
        <div className="field">
          <label htmlFor="filing">Filing status</label>
          <select id="filing" value={client.filingStatus} onChange={(e) => onClient({ filingStatus: e.target.value as FilingStatus })}>
            {Object.entries(FILING).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="field-grid">
          <PercentField label="Ordinary rate" value={client.ordinaryRate} onChange={(ordinaryRate) => onClient({ ordinaryRate })} hint="Marginal federal" />
          <div className="field">
            <label htmlFor="ltcg">Capital gains rate</label>
            <select id="ltcg" value={client.capitalGainsRate} onChange={(e) => onClient({ capitalGainsRate: Number(e.target.value) })}>
              <option value={0}>0%</option>
              <option value={0.15}>15%</option>
              <option value={0.2}>20%</option>
            </select>
          </div>
          <PercentField label="State rate" value={client.stateRate} onChange={(stateRate) => onClient({ stateRate })} />
          <label className="check">
            <input type="checkbox" checked={client.niit} onChange={(e) => onClient({ niit: e.target.checked })} />
            Subject to 3.8% NIIT
          </label>
        </div>

        <h3 className="drawer-section">Market assumptions</h3>
        <div className="field">
          <label htmlFor="horizon">Horizon: {assumptions.horizonYears} years</label>
          <input
            id="horizon"
            type="range"
            min={3}
            max={30}
            value={assumptions.horizonYears}
            onChange={(e) => onAssumptions({ horizonYears: Number(e.target.value) })}
          />
        </div>
        <div className="field-grid">
          <PercentField label="Appreciation" value={assumptions.appreciation} onChange={(appreciation) => onAssumptions({ appreciation })} />
          <PercentField label="Income growth" value={assumptions.rentGrowth} onChange={(rentGrowth) => onAssumptions({ rentGrowth })} />
          <PercentField label="Selling costs" value={assumptions.sellingCostPct} onChange={(sellingCostPct) => onAssumptions({ sellingCostPct })} />
          <PercentField
            label="Reinvestment return"
            value={assumptions.reinvestReturn}
            onChange={(reinvestReturn) => onAssumptions({ reinvestReturn })}
            hint="After tax, on sale proceeds and cash flow"
          />
        </div>

        <h3 className="drawer-section">1031 exchange</h3>
        <div className="field-grid">
          <PercentField
            label="Replacement cap rate"
            value={assumptions.replacementCapRate}
            onChange={(replacementCapRate) => onAssumptions({ replacementCapRate })}
            hint="NOI yield on the new property"
          />
          <PercentField label="Exchange costs" value={assumptions.exchangeCostPct} onChange={(exchangeCostPct) => onAssumptions({ exchangeCostPct })} hint="Intermediary and closing" />
        </div>
      </aside>
    </div>
  );
}
