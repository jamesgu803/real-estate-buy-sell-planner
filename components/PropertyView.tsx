"use client";

import { useState } from "react";
import { compareStrategies, currentCashFlow, equity, STRATEGY_LABEL } from "@/lib/engine";
import { compact, money, percent } from "@/lib/format";
import { propertySignals } from "@/lib/signals";
import { PROPERTY_TYPE_LABEL, type Assumptions, type ClientProfile, type Property } from "@/lib/types";
import { MoneyField } from "./Fields";
import { MeetingBrief } from "./MeetingBrief";
import { SignalChip } from "./SignalChip";
import { STRATEGY_ORDER, StrategyChart } from "./StrategyChart";

export function PropertyView({
  property: p,
  client,
  assumptions,
  onChange,
  onFactSheet,
}: {
  property: Property;
  client: ClientProfile;
  assumptions: Assumptions;
  onChange: (patch: Partial<Property>) => void;
  onFactSheet: () => void;
}) {
  const cf = currentCashFlow(p, client);
  const comparison = compareStrategies(p, client, assumptions);
  const signals = propertySignals(p, client, assumptions);
  const { today } = comparison;
  const last = assumptions.horizonYears;
  const bestValue = comparison.series[comparison.best][last];
  const est = (f: Property["estimated"][number]) => p.estimated.includes(f);
  const [tab, setTab] = useState<"chart" | "table">("chart");

  return (
    <section className="stack-lg">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {PROPERTY_TYPE_LABEL[p.type]} · placed in service {p.yearPlacedInService}
          </p>
          <h1 className="page-title">{p.name}</h1>
          <p className="muted">{p.address}</p>
        </div>
        <button className="btn secondary" onClick={onFactSheet}>
          Planning fact sheet →
        </button>
      </div>

      {signals.length > 0 && (
        <div className="signal-list">
          {signals.map((s) => (
            <div key={s.key} className={`signal signal-${s.tone}`}>
              <SignalChip signal={s} />
              <p>{s.detail}</p>
            </div>
          ))}
        </div>
      )}

      <div className="property-grid">
        <div className="stack">
          <div className="card">
            <h2 className="card-title">This year, from Schedule E</h2>
            <dl className="ledger">
              <Row label="Rents received" value={p.rents} />
              <Row label="Operating expenses" value={-p.operatingExpenses} />
              <Row label="Net operating income" value={cf.noi} total />
              <Row label="Debt service" value={-cf.debtService} hint="Interest from the return plus estimated principal" />
              <Row label="Cash flow before tax" value={cf.preTax} total />
              <Row label="Income tax on rental profit" value={-cf.incomeTax} hint={cf.taxableIncome < 0 ? "Tax loss: treated as suspended passive loss" : undefined} />
              <Row label="Cash flow after tax" value={cf.afterTax} total strong />
            </dl>
            <p className="muted small">
              Depreciation of {money(p.depreciation)} shelters rental income without costing cash. Cash yield on equity:{" "}
              <strong>{equity(p) > 0 ? percent(cf.afterTax / equity(p)) : "n/a"}</strong>.
            </p>
          </div>

          <div className="card">
            <h2 className="card-title">Confirm with the client</h2>
            <p className="muted small">The return doesn&rsquo;t show these. Edits update every model on the page.</p>
            <div className="field-grid">
              <MoneyField label="Market value" value={p.marketValue} estimated={est("marketValue")} onChange={(marketValue) => onChange({ marketValue })} />
              <MoneyField label="Loan balance" value={p.loanBalance} estimated={est("loanBalance")} onChange={(loanBalance) => onChange({ loanBalance })} />
              <MoneyField
                label="Cost basis"
                value={p.costBasis}
                estimated={est("costBasis")}
                hint="Purchase price plus improvements"
                onChange={(costBasis) => onChange({ costBasis })}
              />
              <MoneyField
                label="Depreciation taken"
                value={p.accumulatedDepreciation}
                estimated={est("accumulatedDepreciation")}
                hint="All years to date"
                onChange={(accumulatedDepreciation) => onChange({ accumulatedDepreciation })}
              />
              <MoneyField
                label="Annual principal"
                value={p.annualPrincipal}
                estimated={est("annualPrincipal")}
                onChange={(annualPrincipal) => onChange({ annualPrincipal })}
              />
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Hold, sell or exchange</h2>
                <p className="muted small">
                  After-tax wealth over {last} years. Highest without relying on the estate plan:{" "}
                  <strong>{STRATEGY_LABEL[comparison.best]}</strong> at {compact(bestValue)}.
                </p>
              </div>
              <div className="segmented" role="tablist" aria-label="View">
                <button role="tab" aria-selected={tab === "chart"} onClick={() => setTab("chart")}>
                  Chart
                </button>
                <button role="tab" aria-selected={tab === "table"} onClick={() => setTab("table")}>
                  Table
                </button>
              </div>
            </div>
            {tab === "chart" ? (
              <StrategyChart comparison={comparison} />
            ) : (
              <div className="table-wrap">
                <table className="grid compact">
                  <thead>
                    <tr>
                      <th>Year</th>
                      {STRATEGY_ORDER.map((k) => (
                        <th key={k} className="num">
                          {STRATEGY_LABEL[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.years.map((yr) => (
                      <tr key={yr}>
                        <td>{yr === 0 ? "Today" : yr}</td>
                        {STRATEGY_ORDER.map((k) => (
                          <td key={k} className="num">
                            {money(comparison.series[k][yr])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="strategy-cards">
            {STRATEGY_ORDER.map((k) => {
              const v = comparison.series[k][last];
              const delta = v - bestValue;
              return (
                <div key={k} className={`strategy-card${k === comparison.best ? " is-best" : ""}`}>
                  <p className="strategy-name">
                    <span className={`swatch swatch-${k}`} /> {STRATEGY_LABEL[k]}
                  </p>
                  <p className="strategy-value">{compact(v)}</p>
                  <p className="muted small">
                    {k === comparison.best ? "Highest" : k === "stepUp" ? "If held for heirs" : `${compact(delta)} vs. best`}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="card">
            <h2 className="card-title">If sold today</h2>
            <dl className="ledger">
              <Row label="Sale price" value={today.value} />
              <Row label={`Selling costs (${percent(assumptions.sellingCostPct, 0)})`} value={-today.sellingCosts} />
              <Row label="Loan payoff" value={-today.loanPayoff} />
              <Row label="Depreciation recapture (§1250)" value={-today.recaptureTax} hint={`${money(today.recapture)} at up to 25%`} />
              <Row label="Federal capital gains" value={-today.capitalGainsTax} hint={`${money(today.capitalGain)} at ${percent(client.capitalGainsRate, 0)}`} />
              {client.niit && <Row label="Net investment income tax" value={-today.niitTax} hint="3.8%" />}
              {client.stateRate > 0 && <Row label="State tax" value={-today.stateTax} hint={percent(client.stateRate)} />}
              <Row label="Net cash to the client" value={today.netProceeds} total strong />
            </dl>
            <p className="muted small">
              Taxable gain of {money(today.gain)}: {money(today.amountRealized)} realized less an adjusted basis of{" "}
              {money(today.adjustedBasis)} ({money(p.costBasis)} cost, {money(p.accumulatedDepreciation)} depreciation
              taken). Total tax: <strong>{money(today.totalTax)}</strong>.
            </p>
            <p className="muted small">
              A 1031 exchange into a {compact(comparison.exchange.replacementValue)} replacement at a{" "}
              {percent(assumptions.replacementCapRate)} cap rate defers the {compact(comparison.exchange.deferredTax)} tax
              bill.
            </p>
          </div>
        </div>
      </div>

      <MeetingBrief property={p} client={client} assumptions={assumptions} />
    </section>
  );
}

function Row({ label, value, hint, total, strong }: { label: string; value: number; hint?: string; total?: boolean; strong?: boolean }) {
  return (
    <div className={`ledger-row${total ? " total" : ""}${strong ? " strong" : ""}`}>
      <dt>
        {label}
        {hint && <span className="ledger-hint">{hint}</span>}
      </dt>
      <dd className={value < 0 ? "negative" : undefined}>{value < 0 ? `(${money(-value)})` : money(value)}</dd>
    </div>
  );
}
