/**
 * Largest return the app accepts. Vercel rejects request bodies over 4.5 MB before
 * they reach the function, so the limit leaves room for the multipart envelope.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type PropertyType =
  | "single_family"
  | "multi_family"
  | "condo"
  | "short_term_rental"
  | "commercial"
  | "land"
  | "other";

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  single_family: "Single family",
  multi_family: "Multi-family",
  condo: "Condo / townhome",
  short_term_rental: "Short-term rental",
  commercial: "Commercial",
  land: "Land",
  other: "Other",
};

/** Fields the advisor estimated rather than reading off the return. */
export type EstimableField =
  | "marketValue"
  | "costBasis"
  | "loanBalance"
  | "annualPrincipal"
  | "accumulatedDepreciation";

export interface Property {
  id: string;
  name: string;
  address: string;
  type: PropertyType;
  yearPlacedInService: number;

  // Annual figures, straight from Schedule E
  rents: number;
  /** Schedule E expenses excluding mortgage interest and depreciation. */
  operatingExpenses: number;
  mortgageInterest: number;
  depreciation: number;

  // Balance-sheet figures the return doesn't carry
  marketValue: number;
  /** Purchase price plus capital improvements. */
  costBasis: number;
  accumulatedDepreciation: number;
  loanBalance: number;
  annualPrincipal: number;

  estimated: EstimableField[];
  /** Notes from extraction: anything ambiguous on the return. */
  notes: string[];
}

export type FilingStatus = "single" | "married_joint" | "married_separate" | "head_of_household";

export interface ClientProfile {
  household: string;
  taxYear: number;
  filingStatus: FilingStatus;
  /** Marginal federal ordinary-income rate. */
  ordinaryRate: number;
  /** Long-term capital gains rate: 0, 0.15 or 0.20. */
  capitalGainsRate: number;
  stateRate: number;
  /** Subject to the 3.8% net investment income tax. */
  niit: boolean;
}

export interface Assumptions {
  horizonYears: number;
  appreciation: number;
  /** Annual NOI growth. */
  rentGrowth: number;
  sellingCostPct: number;
  /** Additional intermediary / closing costs on a 1031 exchange. */
  exchangeCostPct: number;
  /** NOI yield on the replacement property in a 1031 exchange. */
  replacementCapRate: number;
  /** After-tax annual return on liquid, reinvested dollars. */
  reinvestReturn: number;
}

export interface Portfolio {
  client: ClientProfile;
  properties: Property[];
  warnings: string[];
  source: "demo" | "upload";
}
