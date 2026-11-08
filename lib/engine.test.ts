import { describe, expect, it } from "vitest";
import { cashFlow, compareStrategies, DEFAULT_ASSUMPTIONS, saleBreakdown } from "./engine";
import { toProperty } from "./extraction";
import { SAMPLE_PORTFOLIO } from "./sample";
import type { ClientProfile } from "./types";

const client: ClientProfile = {
  household: "Test",
  taxYear: 2025,
  filingStatus: "married_joint",
  ordinaryRate: 0.35,
  capitalGainsRate: 0.2,
  stateRate: 0,
  niit: true,
};

describe("saleBreakdown", () => {
  it("splits gain into §1250 recapture and capital gain", () => {
    // $1M sale, 6% costs, $500K basis, $200K depreciation taken
    const s = saleBreakdown(1_000_000, 500_000, 200_000, 100_000, client, 0.06);
    expect(s.amountRealized).toBe(940_000);
    expect(s.adjustedBasis).toBe(300_000);
    expect(s.gain).toBe(640_000);
    expect(s.recapture).toBe(200_000);
    expect(s.recaptureTax).toBe(50_000); // capped at 25%
    expect(s.capitalGainsTax).toBe(88_000); // 440K × 20%
    expect(s.niitTax).toBeCloseTo(24_320); // 640K × 3.8%
    expect(s.netProceeds).toBeCloseTo(940_000 - 100_000 - 162_320);
  });

  it("only recaptures depreciation up to the gain", () => {
    const s = saleBreakdown(400_000, 500_000, 200_000, 0, client, 0.06);
    expect(s.gain).toBe(76_000);
    expect(s.recapture).toBe(76_000);
    expect(s.capitalGain).toBe(0);
  });

  it("taxes recapture at the ordinary rate when it is below 25%", () => {
    const s = saleBreakdown(1_000_000, 500_000, 100_000, 0, { ...client, ordinaryRate: 0.22 }, 0);
    expect(s.recaptureTax).toBeCloseTo(22_000);
  });
});

describe("cashFlow", () => {
  it("does not credit passive losses against other income", () => {
    const cf = cashFlow(20_000, 15_000, 5_000, 30_000, client);
    expect(cf.taxableIncome).toBe(-25_000);
    expect(cf.incomeTax).toBe(0);
    expect(cf.afterTax).toBe(0);
  });
});

describe("compareStrategies", () => {
  const property = SAMPLE_PORTFOLIO.properties[0];
  const result = compareStrategies(property, SAMPLE_PORTFOLIO.client, DEFAULT_ASSUMPTIONS);

  it("starts every path from today's position", () => {
    expect(result.series.sell[0]).toBeCloseTo(result.today.netProceeds);
    expect(result.series.hold[0]).toBeCloseTo(result.today.netProceeds);
  });

  it("never taxes the gain on the step-up path", () => {
    for (let y = 0; y < result.years.length; y++) {
      expect(result.series.stepUp[y]).toBeGreaterThanOrEqual(result.series.hold[y]);
    }
  });

  it("defers tax today on an exchange", () => {
    // Day one, the exchange position is worth less than holding (costs paid)
    // but the deferred tax hasn't been paid either.
    expect(result.exchange.deferredTax).toBeGreaterThan(0);
    expect(result.exchange.replacementValue).toBeLessThan(property.marketValue);
  });

  it("projects one point per year including today", () => {
    expect(result.years).toHaveLength(DEFAULT_ASSUMPTIONS.horizonYears + 1);
  });
});

describe("toProperty", () => {
  it("backs into cost basis from straight-line depreciation and flags estimates", () => {
    const p = toProperty(
      {
        address: "1 Main St, Springfield, IL",
        propertyType: "single_family",
        rents: 30_000,
        totalExpenses: 25_000,
        mortgageInterest: 11_000,
        depreciation: 8_000,
        yearPlacedInService: null,
        costBasis: null,
        notes: "",
      },
      2025,
      0,
    );
    expect(p.operatingExpenses).toBe(6_000);
    expect(p.costBasis).toBe(275_000); // 8K × 27.5 / 0.8
    expect(p.loanBalance).toBe(200_000);
    expect(p.estimated).toContain("costBasis");
    expect(p.estimated).toContain("accumulatedDepreciation");
    expect(p.name).toBe("1 Main St");
  });
});
