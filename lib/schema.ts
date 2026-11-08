import { z } from "zod";
import { PROPERTY_TYPE_LABEL, type Assumptions, type Portfolio, type PropertyType } from "./types";

/** Runtime validation for anything the browser sends back to be saved. */

const money = z.number().min(-1e10).max(1e10);
const rate = z.number().min(-1).max(1);

const PROPERTY_TYPES = Object.keys(PROPERTY_TYPE_LABEL) as [PropertyType, ...PropertyType[]];

const PropertySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(200),
  address: z.string().max(400),
  type: z.enum(PROPERTY_TYPES),
  yearPlacedInService: z.number().int().min(1900).max(2100),
  rents: money,
  operatingExpenses: money,
  mortgageInterest: money,
  depreciation: money,
  marketValue: money,
  costBasis: money,
  accumulatedDepreciation: money,
  loanBalance: money,
  annualPrincipal: money,
  estimated: z.array(z.enum(["marketValue", "costBasis", "loanBalance", "annualPrincipal", "accumulatedDepreciation"])),
  notes: z.array(z.string().max(1000)).max(50),
});

export const PortfolioSchema = z.object({
  client: z.object({
    household: z.string().min(1).max(200),
    taxYear: z.number().int().min(1990).max(2100),
    filingStatus: z.enum(["single", "married_joint", "married_separate", "head_of_household"]),
    ordinaryRate: rate,
    capitalGainsRate: rate,
    stateRate: rate,
    niit: z.boolean(),
  }),
  properties: z.array(PropertySchema).max(100),
  warnings: z.array(z.string().max(1000)).max(50),
  source: z.enum(["demo", "upload"]),
}) satisfies z.ZodType<Portfolio>;

export const AssumptionsSchema = z.object({
  horizonYears: z.number().int().min(1).max(50),
  appreciation: rate,
  rentGrowth: rate,
  sellingCostPct: rate,
  exchangeCostPct: rate,
  replacementCapRate: rate,
  reinvestReturn: rate,
}) satisfies z.ZodType<Assumptions>;

export const SavedClientBody = z.object({ portfolio: PortfolioSchema, assumptions: AssumptionsSchema });
export type SavedClientBody = z.infer<typeof SavedClientBody>;

export const Credentials = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email.")),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

export const SignUp = Credentials.extend({ name: z.string().trim().min(1, "Enter your name.").max(100) });
