import { currentCashFlow, equity, portfolioTotals, saleToday } from "@/lib/engine";
import { compact, money, percent } from "@/lib/format";
import { propertySignals } from "@/lib/signals";
import { PROPERTY_TYPE_LABEL, type Assumptions, type Portfolio } from "@/lib/types";
import { SignalChip } from "./SignalChip";

export function PortfolioView({
  portfolio,
  assumptions,
  onOpen,
}: {
  portfolio: Portfolio;
  assumptions: Assumptions;
  onOpen: (id: string) => void;
}) {
  const { client, properties } = portfolio;
  const totals = portfolioTotals(properties, client, assumptions);
  const signalCount = properties.reduce((n, p) => n + propertySignals(p, client, assumptions).length, 0);

  return (
    <section className="stack-lg">
      <div className="page-head">
        <div>
          <p className="eyebrow">Tax year {client.taxYear} · Schedule E</p>
          <h1 className="page-title">{client.household}</h1>
        </div>
        <p className="muted">
          {properties.length} {properties.length === 1 ? "property" : "properties"} · {signalCount} planning{" "}
          {signalCount === 1 ? "signal" : "signals"}
        </p>
      </div>

      <div className="tiles">
        <Tile label="Market value" value={compact(totals.value)} sub={`${compact(totals.debt)} debt`} />
        <Tile label="Equity" value={compact(totals.equity)} sub={`${percent(totals.equity / totals.value, 0)} of value`} />
        <Tile
          label="After-tax cash flow"
          value={compact(totals.afterTaxCashFlow)}
          sub={`${percent(totals.afterTaxCashFlow / totals.equity)} on equity`}
        />
        <Tile
          label="Tax if sold today"
          value={compact(totals.embeddedTax)}
          sub={`${percent(totals.embeddedTax / totals.equity, 0)} of equity`}
          emphasis
        />
      </div>

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Property</th>
              <th className="num">Value</th>
              <th className="num">Equity</th>
              <th className="num">Cash flow</th>
              <th className="num">Tax if sold</th>
              <th>Signals</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => {
              const cf = currentCashFlow(p, client);
              const sale = saleToday(p, client, assumptions);
              const signals = propertySignals(p, client, assumptions);
              return (
                <tr key={p.id} className="row-link" onClick={() => onOpen(p.id)}>
                  <td>
                    <button className="row-title" onClick={() => onOpen(p.id)}>
                      {p.name}
                    </button>
                    <div className="muted small">
                      {PROPERTY_TYPE_LABEL[p.type]} · since {p.yearPlacedInService}
                    </div>
                  </td>
                  <td className="num">
                    <Est on={p.estimated.includes("marketValue")}>{money(p.marketValue)}</Est>
                  </td>
                  <td className="num">{money(equity(p))}</td>
                  <td className={`num${cf.afterTax < 0 ? " negative" : ""}`}>
                    {money(cf.afterTax)}
                    <div className="muted small">after tax / yr</div>
                  </td>
                  <td className="num">
                    {money(sale.totalTax)}
                    <div className="muted small">{percent(sale.totalTax / p.marketValue, 0)} of value</div>
                  </td>
                  <td>
                    <div className="chips">
                      {signals.length === 0 ? (
                        <span className="muted small">None</span>
                      ) : (
                        signals.map((s) => <SignalChip key={s.key} signal={s} />)
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        <span className="est-sample">Underlined</span> figures are estimated, not read from the return. Open a property to
        confirm them with the client.
      </p>
    </section>
  );
}

function Tile({ label, value, sub, emphasis }: { label: string; value: string; sub: string; emphasis?: boolean }) {
  return (
    <div className={`tile${emphasis ? " tile-emphasis" : ""}`}>
      <p className="tile-label">{label}</p>
      <p className="tile-value">{value}</p>
      <p className="tile-sub">{sub}</p>
    </div>
  );
}

export function Est({ on, children }: { on: boolean; children: React.ReactNode }) {
  return on ? (
    <span className="est" title="Estimated: not on the return. Confirm with the client.">
      {children}
    </span>
  ) : (
    <>{children}</>
  );
}
