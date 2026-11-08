import type { Assumptions, ClientProfile, Property } from "./types";

/** Share of cost basis assumed to be building (depreciable) rather than land. */
export const BUILDING_SHARE = 0.8;
export const NIIT_RATE = 0.038;
/** Unrecaptured §1250 gain is taxed at ordinary rates, capped at 25%. */
export const RECAPTURE_CAP = 0.25;

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  horizonYears: 10,
  appreciation: 0.035,
  rentGrowth: 0.03,
  sellingCostPct: 0.06,
  exchangeCostPct: 0.015,
  replacementCapRate: 0.055,
  reinvestReturn: 0.05,
};

export interface SaleBreakdown {
  value: number;
  sellingCosts: number;
  amountRealized: number;
  adjustedBasis: number;
  gain: number;
  recapture: number;
  capitalGain: number;
  recaptureTax: number;
  capitalGainsTax: number;
  niitTax: number;
  stateTax: number;
  totalTax: number;
  loanPayoff: number;
  netProceeds: number;
}

export function saleBreakdown(
  value: number,
  costBasis: number,
  accumulatedDepreciation: number,
  loanBalance: number,
  client: ClientProfile,
  sellingCostPct: number,
): SaleBreakdown {
  const sellingCosts = value * sellingCostPct;
  const amountRealized = value - sellingCosts;
  const adjustedBasis = Math.max(0, costBasis - accumulatedDepreciation);
  const gain = Math.max(0, amountRealized - adjustedBasis);
  const recapture = Math.min(gain, accumulatedDepreciation);
  const capitalGain = gain - recapture;
  const recaptureTax = recapture * Math.min(RECAPTURE_CAP, client.ordinaryRate);
  const capitalGainsTax = capitalGain * client.capitalGainsRate;
  const niitTax = client.niit ? gain * NIIT_RATE : 0;
  const stateTax = gain * client.stateRate;
  const totalTax = recaptureTax + capitalGainsTax + niitTax + stateTax;
  return {
    value,
    sellingCosts,
    amountRealized,
    adjustedBasis,
    gain,
    recapture,
    capitalGain,
    recaptureTax,
    capitalGainsTax,
    niitTax,
    stateTax,
    totalTax,
    loanPayoff: loanBalance,
    netProceeds: amountRealized - loanBalance - totalTax,
  };
}

export function saleToday(p: Property, client: ClientProfile, a: Assumptions): SaleBreakdown {
  return saleBreakdown(p.marketValue, p.costBasis, p.accumulatedDepreciation, p.loanBalance, client, a.sellingCostPct);
}

export interface CashFlow {
  noi: number;
  debtService: number;
  preTax: number;
  taxableIncome: number;
  incomeTax: number;
  afterTax: number;
}

/** Tax rate applied to positive net rental income. */
export function rentalIncomeRate(client: ClientProfile): number {
  return client.ordinaryRate + client.stateRate + (client.niit ? NIIT_RATE : 0);
}

/**
 * Losses are treated as suspended passive losses (no current benefit), which is
 * the conservative read for most high-income clients.
 */
export function cashFlow(
  noi: number,
  interest: number,
  principal: number,
  depreciation: number,
  client: ClientProfile,
): CashFlow {
  const debtService = interest + principal;
  const preTax = noi - debtService;
  const taxableIncome = noi - interest - depreciation;
  const incomeTax = Math.max(0, taxableIncome) * rentalIncomeRate(client);
  return { noi, debtService, preTax, taxableIncome, incomeTax, afterTax: preTax - incomeTax };
}

export function currentCashFlow(p: Property, client: ClientProfile): CashFlow {
  return cashFlow(p.rents - p.operatingExpenses, p.mortgageInterest, p.annualPrincipal, p.depreciation, client);
}

/** A real-estate position rolled forward year by year. */
interface Holding {
  value: number;
  noi: number;
  costBasis: number;
  accumulatedDepreciation: number;
  annualDepreciation: number;
  loanBalance: number;
  interestRate: number;
  annualPrincipal: number;
}

interface HoldingYear {
  liquidated: number;
  steppedUp: number;
}

function projectHolding(start: Holding, client: ClientProfile, a: Assumptions): HoldingYear[] {
  const depreciableBasis = start.costBasis * BUILDING_SHARE;
  let { value, noi, accumulatedDepreciation, loanBalance } = start;
  let cash = 0;
  const out: HoldingYear[] = [];

  for (let year = 0; year <= a.horizonYears; year++) {
    if (year > 0) {
      const interest = loanBalance * start.interestRate;
      const principal = Math.min(start.annualPrincipal, loanBalance);
      const depreciation = Math.min(start.annualDepreciation, Math.max(0, depreciableBasis - accumulatedDepreciation));
      const cf = cashFlow(noi, interest, principal, depreciation, client);

      cash = cash * (1 + a.reinvestReturn) + cf.afterTax;
      accumulatedDepreciation += depreciation;
      loanBalance -= principal;
      value *= 1 + a.appreciation;
      noi *= 1 + a.rentGrowth;
    }
    const sale = saleBreakdown(value, start.costBasis, accumulatedDepreciation, loanBalance, client, a.sellingCostPct);
    out.push({
      liquidated: cash + sale.netProceeds,
      // Basis steps up to fair market value at death: the gain is never taxed.
      steppedUp: cash + sale.amountRealized - loanBalance,
    });
  }
  return out;
}

export type StrategyKey = "hold" | "sell" | "exchange" | "stepUp";

export const STRATEGY_LABEL: Record<StrategyKey, string> = {
  hold: "Hold, then sell",
  sell: "Sell today",
  exchange: "1031 exchange",
  stepUp: "Hold for step-up",
};

export interface StrategyComparison {
  years: number[];
  series: Record<StrategyKey, number[]>;
  today: SaleBreakdown;
  exchange: { replacementValue: number; deferredTax: number; replacementNoi: number };
  best: StrategyKey;
}

/** Terminal after-tax wealth for each path, in nominal dollars. */
export function compareStrategies(p: Property, client: ClientProfile, a: Assumptions): StrategyComparison {
  const interestRate = p.loanBalance > 0 ? p.mortgageInterest / p.loanBalance : 0;
  const today = saleToday(p, client, a);

  const hold = projectHolding(
    {
      value: p.marketValue,
      noi: p.rents - p.operatingExpenses,
      costBasis: p.costBasis,
      accumulatedDepreciation: p.accumulatedDepreciation,
      annualDepreciation: p.depreciation,
      loanBalance: p.loanBalance,
      interestRate,
      annualPrincipal: p.annualPrincipal,
    },
    client,
    a,
  );

  // Equal-value exchange: the debt carries over and the replacement inherits
  // the relinquished property's basis, so the deferred gain rides along.
  const replacementValue = today.amountRealized - p.marketValue * a.exchangeCostPct;
  const replacementNoi = replacementValue * a.replacementCapRate;
  const exchange = projectHolding(
    {
      value: replacementValue,
      noi: replacementNoi,
      costBasis: p.costBasis,
      accumulatedDepreciation: p.accumulatedDepreciation,
      annualDepreciation: p.depreciation,
      loanBalance: p.loanBalance,
      interestRate,
      annualPrincipal: p.annualPrincipal,
    },
    client,
    a,
  );

  const years = hold.map((_, i) => i);
  const series: Record<StrategyKey, number[]> = {
    hold: hold.map((h) => h.liquidated),
    sell: years.map((y) => today.netProceeds * Math.pow(1 + a.reinvestReturn, y)),
    exchange: exchange.map((h) => h.liquidated),
    stepUp: hold.map((h) => h.steppedUp),
  };

  const last = a.horizonYears;
  // Step-up depends on the client's estate plan, so it is shown but never "best".
  const ranked = (["hold", "sell", "exchange"] as const).toSorted((x, y) => series[y][last] - series[x][last]);

  return {
    years,
    series,
    today,
    exchange: { replacementValue, deferredTax: today.totalTax, replacementNoi },
    best: ranked[0],
  };
}

export function equity(p: Property): number {
  return p.marketValue - p.loanBalance;
}

export interface PortfolioTotals {
  value: number;
  debt: number;
  equity: number;
  noi: number;
  preTaxCashFlow: number;
  afterTaxCashFlow: number;
  embeddedTax: number;
}

export function portfolioTotals(properties: Property[], client: ClientProfile, a: Assumptions): PortfolioTotals {
  const totals: PortfolioTotals = {
    value: 0,
    debt: 0,
    equity: 0,
    noi: 0,
    preTaxCashFlow: 0,
    afterTaxCashFlow: 0,
    embeddedTax: 0,
  };
  for (const p of properties) {
    const cf = currentCashFlow(p, client);
    totals.value += p.marketValue;
    totals.debt += p.loanBalance;
    totals.equity += equity(p);
    totals.noi += cf.noi;
    totals.preTaxCashFlow += cf.preTax;
    totals.afterTaxCashFlow += cf.afterTax;
    totals.embeddedTax += saleToday(p, client, a).totalTax;
  }
  return totals;
}
