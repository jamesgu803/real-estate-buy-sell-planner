import { BUILDING_SHARE, currentCashFlow, equity, saleToday } from "./engine";
import type { Assumptions, ClientProfile, Property } from "./types";

export type SignalTone = "opportunity" | "watch" | "risk";

export interface Signal {
  key: string;
  tone: SignalTone;
  title: string;
  detail: string;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Conversation starters an advisor should raise with the client. */
export function propertySignals(p: Property, client: ClientProfile, a: Assumptions): Signal[] {
  const signals: Signal[] = [];
  const cf = currentCashFlow(p, client);
  const sale = saleToday(p, client, a);
  const eq = equity(p);

  if (sale.totalTax > 0.12 * p.marketValue) {
    signals.push({
      key: "embedded-tax",
      tone: "watch",
      title: "Large tax bill on sale",
      detail: `Selling today triggers about ${pct(sale.totalTax / p.marketValue)} of value in tax. Compare a 1031 exchange or holding for a basis step-up.`,
    });
  }

  if (eq > 0 && cf.preTax >= 0 && cf.afterTax / eq < 0.03) {
    signals.push({
      key: "lazy-equity",
      tone: "opportunity",
      title: "Low return on equity",
      detail: `${pct(Math.max(0, cf.afterTax) / eq)} after-tax cash yield on equity. That capital may work harder elsewhere: refinance, exchange or reallocate.`,
    });
  }

  if (cf.preTax < 0) {
    signals.push({
      key: "negative-cash-flow",
      tone: "risk",
      title: "Negative cash flow",
      detail: "The property costs the client money each year before tax. Confirm rents, reserves and whether the client is relying on appreciation.",
    });
  }

  const depreciableBasis = p.costBasis * BUILDING_SHARE;
  if (depreciableBasis > 0 && p.accumulatedDepreciation / depreciableBasis > 0.8) {
    signals.push({
      key: "depreciation-runway",
      tone: "watch",
      title: "Tax shelter running out",
      detail: `About ${pct(p.accumulatedDepreciation / depreciableBasis)} of the building basis is depreciated. Taxable income rises once it's exhausted.`,
    });
  }

  if (p.marketValue > 0 && p.loanBalance / p.marketValue > 0.75) {
    signals.push({
      key: "leverage",
      tone: "risk",
      title: "High leverage",
      detail: `Loan-to-value is ${pct(p.loanBalance / p.marketValue)}. Review rate resets, reserves and refinance risk.`,
    });
  }

  if (cf.taxableIncome < 0) {
    signals.push({
      key: "suspended-losses",
      tone: "opportunity",
      title: "Passive losses",
      detail: "Schedule E shows a tax loss. Check for suspended passive losses that would be released on a fully taxable sale.",
    });
  }

  return signals;
}
