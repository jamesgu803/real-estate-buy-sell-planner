"use client";

import { useState } from "react";
import { compareStrategies, currentCashFlow, equity, STRATEGY_LABEL } from "@/lib/engine";
import { money, percent } from "@/lib/format";
import { propertySignals } from "@/lib/signals";
import { PROPERTY_TYPE_LABEL, type Assumptions, type ClientProfile, type Property } from "@/lib/types";
import { STRATEGY_ORDER } from "./StrategyChart";

/**
 * The fields planning software asks for when you add a real estate asset,
 * in the order most of them ask for it.
 */
function planningFields(p: Property, client: ClientProfile, a: Assumptions): [string, string][] {
  const cf = currentCashFlow(p, client);
  const rate = p.loanBalance > 0 ? p.mortgageInterest / p.loanBalance : 0;
  return [
    ["Asset name", p.name],
    ["Asset type", `Investment real estate (${PROPERTY_TYPE_LABEL[p.type].toLowerCase()})`],
    ["Owner", client.household],
    ["Current market value", money(p.marketValue)],
    ["Cost basis", money(p.costBasis)],
    ["Accumulated depreciation", money(p.accumulatedDepreciation)],
    ["Adjusted basis", money(Math.max(0, p.costBasis - p.accumulatedDepreciation))],
    ["Mortgage balance", money(p.loanBalance)],
    ["Mortgage interest rate", rate ? percent(rate, 2) : "None"],
    ["Annual debt service", money(cf.debtService)],
    ["Annual rental income", money(p.rents)],
    ["Annual operating expenses", money(p.operatingExpenses)],
    ["Annual depreciation", money(p.depreciation)],
    ["Net operating income", money(cf.noi)],
    ["Appreciation rate", percent(a.appreciation)],
    ["Income growth rate", percent(a.rentGrowth)],
  ];
}

function toCsv(rows: [string, string][]): string {
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return ["Field,Value", ...rows.map(([k, v]) => `${cell(k)},${cell(v)}`)].join("\n");
}

export function FactSheet({
  property: p,
  client,
  assumptions,
  onBack,
}: {
  property: Property;
  client: ClientProfile;
  assumptions: Assumptions;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const rows = planningFields(p, client, assumptions);
  const comparison = compareStrategies(p, client, assumptions);
  const signals = propertySignals(p, client, assumptions);
  const last = assumptions.horizonYears;

  async function copy() {
    await navigator.clipboard.writeText(toCsv(rows));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="stack-lg">
      <div className="page-head no-print">
        <button className="btn ghost" onClick={onBack}>
          ← Back to property
        </button>
        <div className="row-gap">
          <button className="btn secondary" onClick={copy}>
            {copied ? "Copied" : "Copy as CSV"}
          </button>
          <button className="btn primary" onClick={() => window.print()}>
            Print or save PDF
          </button>
        </div>
      </div>

      <article className="sheet">
        <header className="sheet-head">
          <div>
            <p className="eyebrow">Real estate planning fact sheet</p>
            <h1 className="page-title">{p.name}</h1>
            <p className="muted">{p.address}</p>
          </div>
          <div className="sheet-meta">
            <p>{client.household}</p>
            <p className="muted small">Tax year {client.taxYear} return</p>
          </div>
        </header>

        <div className="sheet-cols">
          <div>
            <h2 className="sheet-h2">For the financial plan</h2>
            <p className="muted small">Enter as an investment real estate asset in eMoney, RightCapital or MoneyGuide.</p>
            <dl className="ledger">
              {rows.map(([k, v]) => (
                <div key={k} className="ledger-row">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h2 className="sheet-h2">Strategy comparison</h2>
            <p className="muted small">After-tax wealth in {last} years</p>
            <dl className="ledger">
              {STRATEGY_ORDER.map((k) => (
                <div key={k} className={`ledger-row${k === comparison.best ? " strong" : ""}`}>
                  <dt>{STRATEGY_LABEL[k]}</dt>
                  <dd>{money(comparison.series[k][last])}</dd>
                </div>
              ))}
            </dl>

            <h2 className="sheet-h2">Today</h2>
            <dl className="ledger">
              <div className="ledger-row">
                <dt>Equity</dt>
                <dd>{money(equity(p))}</dd>
              </div>
              <div className="ledger-row">
                <dt>After-tax cash flow</dt>
                <dd>{money(currentCashFlow(p, client).afterTax)}</dd>
              </div>
              <div className="ledger-row">
                <dt>Tax due on a sale</dt>
                <dd>{money(comparison.today.totalTax)}</dd>
              </div>
              <div className="ledger-row">
                <dt>Net proceeds on a sale</dt>
                <dd>{money(comparison.today.netProceeds)}</dd>
              </div>
            </dl>

            {signals.length > 0 && (
              <>
                <h2 className="sheet-h2">Discussion points</h2>
                <ul className="sheet-list">
                  {signals.map((s) => (
                    <li key={s.key}>
                      <strong>{s.title}.</strong> {s.detail}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        <footer className="sheet-foot muted small">
          {p.estimated.length > 0 && <p>Estimated, not from the return: {p.estimated.join(", ").replace(/([A-Z])/g, " $1").toLowerCase()}.</p>}
          <p>
            Model assumptions: {percent(assumptions.appreciation)} appreciation, {percent(assumptions.rentGrowth)} income growth,{" "}
            {percent(assumptions.sellingCostPct, 0)} selling costs, {percent(assumptions.reinvestReturn)} after-tax return on
            reinvested cash. Federal {percent(client.ordinaryRate, 0)} ordinary / {percent(client.capitalGainsRate, 0)} capital
            gains, state {percent(client.stateRate)}{client.niit ? ", NIIT applies" : ""}. For planning discussion only; not tax
            advice.
          </p>
        </footer>
      </article>
    </section>
  );
}
