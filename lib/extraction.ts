import { z } from "zod";
import { BUILDING_SHARE } from "./engine";
import type { ClientProfile, EstimableField, Portfolio, Property, PropertyType } from "./types";

/** What Claude returns after reading a tax return. Mirrors Schedule E, Part I. */
export const ExtractedReturn = z.object({
  household: z.string().describe("Taxpayer name(s) as printed on Form 1040, e.g. 'Daniel & Maria Ramirez'"),
  taxYear: z.number().int(),
  filingStatus: z.enum(["single", "married_joint", "married_separate", "head_of_household"]).nullable(),
  properties: z.array(
    z.object({
      address: z.string().describe("Schedule E line 1a"),
      propertyType: z
        .enum(["single_family", "multi_family", "condo", "short_term_rental", "commercial", "land", "other"])
        .describe("From the line 1b type code: 1 single family, 2 multi-family, 3 vacation/short-term, 4 commercial, 5 land, 7 self-rental, 8 other"),
      rents: z.number().describe("Line 3, rents received"),
      totalExpenses: z.number().describe("Line 20, total expenses"),
      mortgageInterest: z.number().describe("Line 12, mortgage interest paid to banks"),
      depreciation: z.number().describe("Line 18, depreciation expense or depletion"),
      yearPlacedInService: z
        .number()
        .int()
        .nullable()
        .describe("From Form 4562 or a depreciation schedule if attached; null if not shown"),
      costBasis: z
        .number()
        .nullable()
        .describe("Depreciable cost or other basis from a depreciation schedule, if attached; null if not shown"),
      notes: z.string().describe("Anything ambiguous for this property; empty string if none"),
    }),
  ),
  warnings: z.array(z.string()).describe("Return-level issues: missing pages, illegible figures, schedules referenced but not attached"),
});

export type ExtractedReturn = z.infer<typeof ExtractedReturn>;

export const EXTRACTION_PROMPT = `You are reading a U.S. individual income tax return for a financial advisor.

Extract every rental or investment property reported on Schedule E, Part I (lines 1a through 21). There are three property columns (A, B, C) per page, and a return may include several Schedule E pages: capture all of them. Use the exact dollar amounts printed; do not round. Report expenses and depreciation as positive numbers.

If an attached depreciation schedule or Form 4562 shows a property's cost basis or placed-in-service date, include it; otherwise return null for those fields rather than guessing.

Do not include partnership/S-corp income from Part II, and do not invent properties. If the return has no Schedule E, return an empty properties array and explain in warnings.`;

/** Typical residential loan rate, used only to back into a loan balance from interest paid. */
const ASSUMED_LOAN_RATE = 0.055;
const ASSUMED_CAP_RATE = 0.06;
const RESIDENTIAL_RECOVERY_YEARS = 27.5;
const COMMERCIAL_RECOVERY_YEARS = 39;

function shortName(address: string, index: number): string {
  const street = address.split(",")[0]?.trim();
  return street || `Property ${String.fromCharCode(65 + index)}`;
}

/**
 * Turn raw Schedule E figures into a working property. Anything the return
 * can't tell us (market value, loan balance) is estimated and flagged so the
 * advisor knows to confirm it with the client.
 */
export function toProperty(
  raw: ExtractedReturn["properties"][number],
  taxYear: number,
  index: number,
): Property {
  const estimated: EstimableField[] = ["marketValue", "loanBalance", "annualPrincipal"];
  const operatingExpenses = Math.max(0, raw.totalExpenses - raw.mortgageInterest - raw.depreciation);
  const noi = raw.rents - operatingExpenses;
  const recoveryYears = raw.propertyType === "commercial" ? COMMERCIAL_RECOVERY_YEARS : RESIDENTIAL_RECOVERY_YEARS;

  // Straight-line depreciation implies the building basis: annual × recovery period.
  let costBasis = raw.costBasis;
  if (costBasis == null) {
    costBasis = Math.round((raw.depreciation * recoveryYears) / BUILDING_SHARE);
    estimated.push("costBasis");
  }

  const yearPlacedInService = raw.yearPlacedInService ?? taxYear - 7;
  const yearsDepreciated = Math.max(0.5, taxYear - yearPlacedInService + 0.5);
  const accumulatedDepreciation = Math.round(
    Math.min(costBasis * BUILDING_SHARE, raw.depreciation * yearsDepreciated),
  );
  if (raw.yearPlacedInService == null) estimated.push("accumulatedDepreciation");

  const loanBalance = Math.round(raw.mortgageInterest / ASSUMED_LOAN_RATE);
  const marketValue = Math.round(Math.max(noi / ASSUMED_CAP_RATE, costBasis, loanBalance * 1.25) / 1000) * 1000;

  return {
    id: `p${index}`,
    name: shortName(raw.address, index),
    address: raw.address,
    type: raw.propertyType as PropertyType,
    yearPlacedInService,
    rents: raw.rents,
    operatingExpenses,
    mortgageInterest: raw.mortgageInterest,
    depreciation: raw.depreciation,
    marketValue,
    costBasis,
    accumulatedDepreciation,
    loanBalance,
    annualPrincipal: Math.round(loanBalance * 0.02),
    estimated,
    notes: raw.notes ? [raw.notes] : [],
  };
}

export function toPortfolio(raw: ExtractedReturn): Portfolio {
  const client: ClientProfile = {
    household: raw.household,
    taxYear: raw.taxYear,
    filingStatus: raw.filingStatus ?? "married_joint",
    ordinaryRate: 0.35,
    capitalGainsRate: 0.2,
    stateRate: 0.05,
    niit: true,
  };
  return {
    client,
    properties: raw.properties.map((p, i) => toProperty(p, raw.taxYear, i)),
    warnings: raw.warnings,
    source: "upload",
  };
}
