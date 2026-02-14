import { describe, it, expect } from "vitest";
import {
  calculateVehicleDepreciation,
  type VehicleAsset,
} from "../vehicleDepreciation";

// ══════════════════════════════════════════════════════════════
// Helper: build a VehicleAsset with sensible defaults
// ══════════════════════════════════════════════════════════════
function makeVehicle(overrides: Partial<VehicleAsset> = {}): VehicleAsset {
  return {
    description: "Toyota Corolla",
    reg: "231-D-12345",
    purchaseCost: 20_000,
    dateAcquired: "2023-03-15",
    businessUsePct: 100,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// Basic calculation — vehicle under €24,000 cap
// ══════════════════════════════════════════════════════════════
describe("vehicle under €24,000 cap", () => {
  it("qualifying cost equals purchase cost when under cap", () => {
    const result = calculateVehicleDepreciation(makeVehicle({ purchaseCost: 20_000 }), 2023);
    expect(result.qualifyingCost).toBe(20_000);
    expect(result.cost).toBe(20_000);
  });

  it("calculates annual allowance at 12.5% of qualifying cost", () => {
    const result = calculateVehicleDepreciation(makeVehicle({ purchaseCost: 20_000 }), 2023);
    // 20,000 * 0.125 = 2,500
    expect(result.annualAllowanceFull).toBe(2_500);
  });

  it("returns correct net book value in year 1", () => {
    const result = calculateVehicleDepreciation(makeVehicle({ purchaseCost: 20_000 }), 2023);
    // NBV = 20,000 - (1 * 2,500) = 17,500
    expect(result.netBookValue).toBe(17_500);
  });
});

// ══════════════════════════════════════════════════════════════
// Vehicle over €24,000 cap (cost capped at €24,000)
// ══════════════════════════════════════════════════════════════
describe("vehicle over €24,000 cap", () => {
  it("caps qualifying cost at €24,000", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 45_000 }),
      2023,
    );
    expect(result.cost).toBe(45_000);
    expect(result.qualifyingCost).toBe(24_000);
  });

  it("calculates annual allowance on capped cost, not actual cost", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 45_000 }),
      2023,
    );
    // 24,000 * 0.125 = 3,000
    expect(result.annualAllowanceFull).toBe(3_000);
  });

  it("net book value is based on capped qualifying cost", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 45_000 }),
      2023,
    );
    // NBV = 24,000 - (1 * 3,000) = 21,000
    expect(result.netBookValue).toBe(21_000);
  });

  it("caps at exactly €24,000 boundary", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 24_000 }),
      2023,
    );
    expect(result.qualifyingCost).toBe(24_000);
    expect(result.annualAllowanceFull).toBe(3_000);
  });
});

// ══════════════════════════════════════════════════════════════
// 100% business use
// ══════════════════════════════════════════════════════════════
describe("100% business use", () => {
  it("annual allowance equals full allowance", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 20_000, businessUsePct: 100 }),
      2023,
    );
    expect(result.annualAllowance).toBe(result.annualAllowanceFull);
  });

  it("cumulative allowances equal full allowance * years at 100%", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 20_000, businessUsePct: 100 }),
      2025,
    );
    // 3 years owned (2023, 2024, 2025), annualFull = 2,500
    // Cumulative = 3 * 2,500 * 1.0 = 7,500
    expect(result.cumulativeAllowances).toBe(7_500);
  });

  it("businessUsePct is passed through", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ businessUsePct: 100 }),
      2023,
    );
    expect(result.businessUsePct).toBe(100);
  });
});

// ══════════════════════════════════════════════════════════════
// Partial business use — 80%
// ══════════════════════════════════════════════════════════════
describe("partial business use — 80%", () => {
  it("annual allowance is 80% of full allowance", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 20_000, businessUsePct: 80 }),
      2023,
    );
    // Full = 2,500; 80% = 2,000
    expect(result.annualAllowanceFull).toBe(2_500);
    expect(result.annualAllowance).toBe(2_000);
  });

  it("cumulative allowances reflect 80% business use", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 20_000, businessUsePct: 80 }),
      2025,
    );
    // 3 years, 2,500 * 0.80 * 3 = 6,000
    expect(result.cumulativeAllowances).toBe(6_000);
  });
});

// ══════════════════════════════════════════════════════════════
// Partial business use — 50%
// ══════════════════════════════════════════════════════════════
describe("partial business use — 50%", () => {
  it("annual allowance is 50% of full allowance", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 24_000, businessUsePct: 50 }),
      2023,
    );
    // Full = 3,000; 50% = 1,500
    expect(result.annualAllowanceFull).toBe(3_000);
    expect(result.annualAllowance).toBe(1_500);
  });

  it("cumulative allowances are halved vs 100% use", () => {
    const full = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 24_000, businessUsePct: 100 }),
      2026,
    );
    const half = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 24_000, businessUsePct: 50 }),
      2026,
    );
    expect(half.cumulativeAllowances).toBe(full.cumulativeAllowances / 2);
  });
});

// ══════════════════════════════════════════════════════════════
// Vehicle acquired same year as tax year (year 1)
// ══════════════════════════════════════════════════════════════
describe("vehicle acquired same year as tax year (year 1)", () => {
  it("yearsOwned is 1", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ dateAcquired: "2025-11-01" }),
      2025,
    );
    expect(result.yearsOwned).toBe(1);
  });

  it("grants a full year of capital allowance in acquisition year", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 16_000, dateAcquired: "2025-12-31" }),
      2025,
    );
    // 16,000 * 0.125 = 2,000
    expect(result.annualAllowanceFull).toBe(2_000);
    expect(result.cumulativeAllowances).toBe(2_000);
  });

  it("is not fully depreciated", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ dateAcquired: "2025-01-01" }),
      2025,
    );
    expect(result.fullyDepreciated).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// Vehicle in year 4 of 8
// ══════════════════════════════════════════════════════════════
describe("vehicle in year 4 of 8", () => {
  it("yearsOwned is 4", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ dateAcquired: "2022-06-01" }),
      2025,
    );
    expect(result.yearsOwned).toBe(4);
  });

  it("cumulative allowances = 4 * annual allowance at 100%", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 24_000, dateAcquired: "2022-06-01", businessUsePct: 100 }),
      2025,
    );
    // 4 * 3,000 = 12,000
    expect(result.cumulativeAllowances).toBe(12_000);
  });

  it("net book value = qualifying cost - (4 * annualAllowanceFull)", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 24_000, dateAcquired: "2022-06-01" }),
      2025,
    );
    // 24,000 - (4 * 3,000) = 12,000
    expect(result.netBookValue).toBe(12_000);
  });

  it("is not yet fully depreciated", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ dateAcquired: "2022-06-01" }),
      2025,
    );
    expect(result.fullyDepreciated).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// Fully depreciated vehicle (8+ years)
// ══════════════════════════════════════════════════════════════
describe("fully depreciated vehicle (8+ years)", () => {
  it("fullyDepreciated is true at exactly 8 years", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ dateAcquired: "2018-01-01" }),
      2025,
    );
    // 2025 - 2018 + 1 = 8
    expect(result.yearsOwned).toBe(8);
    expect(result.fullyDepreciated).toBe(true);
  });

  it("fullyDepreciated is true beyond 8 years", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ dateAcquired: "2010-01-01" }),
      2025,
    );
    expect(result.yearsOwned).toBe(16);
    expect(result.fullyDepreciated).toBe(true);
  });

  it("claimable years are capped at 8 even if owned longer", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 24_000, dateAcquired: "2010-01-01", businessUsePct: 100 }),
      2025,
    );
    // Cumulative should be capped: 8 * 3,000 = 24,000
    expect(result.cumulativeAllowances).toBe(24_000);
  });

  it("annual allowance figure remains the same (not zero)", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 24_000, dateAcquired: "2010-01-01", businessUsePct: 100 }),
      2025,
    );
    // The per-year amount is still reported as 3,000
    expect(result.annualAllowanceFull).toBe(3_000);
    expect(result.annualAllowance).toBe(3_000);
  });
});

// ══════════════════════════════════════════════════════════════
// Net book value goes to 0 after 8 years
// ══════════════════════════════════════════════════════════════
describe("net book value goes to 0 after 8 years", () => {
  it("NBV is 0 at exactly 8 years owned", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 24_000, dateAcquired: "2018-01-01" }),
      2025,
    );
    // 24,000 - (8 * 3,000) = 0
    expect(result.netBookValue).toBe(0);
  });

  it("NBV remains 0 beyond 8 years", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 24_000, dateAcquired: "2010-01-01" }),
      2025,
    );
    expect(result.netBookValue).toBe(0);
  });

  it("NBV is 0 for vehicle under cap after 8 years", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 16_000, dateAcquired: "2015-01-01" }),
      2025,
    );
    // 16,000 - (8 * 2,000) = 0 (capped at 8 claimable years)
    expect(result.netBookValue).toBe(0);
  });

  it("NBV never goes negative", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 10_000, dateAcquired: "2000-01-01" }),
      2025,
    );
    expect(result.netBookValue).toBeGreaterThanOrEqual(0);
  });
});

// ══════════════════════════════════════════════════════════════
// Edge case: 0% business use
// ══════════════════════════════════════════════════════════════
describe("edge case — 0% business use", () => {
  it("annual allowance is 0", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 20_000, businessUsePct: 0 }),
      2025,
    );
    expect(result.annualAllowance).toBe(0);
  });

  it("cumulative allowances are 0", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 20_000, businessUsePct: 0 }),
      2025,
    );
    expect(result.cumulativeAllowances).toBe(0);
  });

  it("annualAllowanceFull is still calculated (pre-apportionment)", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 20_000, businessUsePct: 0 }),
      2025,
    );
    expect(result.annualAllowanceFull).toBe(2_500);
  });

  it("businessUsePct is 0", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ businessUsePct: 0 }),
      2025,
    );
    expect(result.businessUsePct).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// Edge case: vehicle acquired in a future year
// ══════════════════════════════════════════════════════════════
describe("edge case — vehicle acquired in future year", () => {
  it("yearsOwned is 0 when tax year is before acquisition", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ dateAcquired: "2027-01-01" }),
      2025,
    );
    expect(result.yearsOwned).toBe(0);
  });

  it("cumulative allowances are 0", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 20_000, dateAcquired: "2027-01-01", businessUsePct: 100 }),
      2025,
    );
    expect(result.cumulativeAllowances).toBe(0);
  });

  it("net book value equals full qualifying cost (no depreciation yet)", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 20_000, dateAcquired: "2027-01-01" }),
      2025,
    );
    expect(result.netBookValue).toBe(20_000);
  });

  it("is not fully depreciated", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ dateAcquired: "2027-01-01" }),
      2025,
    );
    expect(result.fullyDepreciated).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// Additional edge cases and rounding
// ══════════════════════════════════════════════════════════════
describe("rounding and precision", () => {
  it("handles odd purchase costs that produce fractional allowances", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 19_999, businessUsePct: 100 }),
      2023,
    );
    // 19,999 * 0.125 = 2499.875 -> rounds to 2499.88
    expect(result.annualAllowanceFull).toBe(2499.88);
  });

  it("handles fractional business use percentages", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 24_000, businessUsePct: 33 }),
      2023,
    );
    // Full = 3,000; 33% = 990
    expect(result.annualAllowanceFull).toBe(3_000);
    expect(result.annualAllowance).toBe(990);
  });

  it("clamps negative business use to 0%", () => {
    const result = calculateVehicleDepreciation(
      makeVehicle({ businessUsePct: -10 }),
      2025,
    );
    expect(result.annualAllowance).toBe(0);
    expect(result.cumulativeAllowances).toBe(0);
  });

  it("clamps business use above 100% to 100%", () => {
    const result100 = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 20_000, businessUsePct: 100 }),
      2023,
    );
    const result150 = calculateVehicleDepreciation(
      makeVehicle({ purchaseCost: 20_000, businessUsePct: 150 }),
      2023,
    );
    expect(result150.annualAllowance).toBe(result100.annualAllowance);
    expect(result150.cumulativeAllowances).toBe(result100.cumulativeAllowances);
  });
});

// ══════════════════════════════════════════════════════════════
// Progression over 8 years — full lifecycle
// ══════════════════════════════════════════════════════════════
describe("full 8-year lifecycle at 100% business use", () => {
  const vehicle = makeVehicle({
    purchaseCost: 24_000,
    dateAcquired: "2020-01-01",
    businessUsePct: 100,
  });

  it("year 1: NBV 21,000, cumulative 3,000, not fully depreciated", () => {
    const r = calculateVehicleDepreciation(vehicle, 2020);
    expect(r.yearsOwned).toBe(1);
    expect(r.annualAllowanceFull).toBe(3_000);
    expect(r.cumulativeAllowances).toBe(3_000);
    expect(r.netBookValue).toBe(21_000);
    expect(r.fullyDepreciated).toBe(false);
  });

  it("year 4: NBV 12,000, cumulative 12,000", () => {
    const r = calculateVehicleDepreciation(vehicle, 2023);
    expect(r.yearsOwned).toBe(4);
    expect(r.cumulativeAllowances).toBe(12_000);
    expect(r.netBookValue).toBe(12_000);
    expect(r.fullyDepreciated).toBe(false);
  });

  it("year 7: NBV 3,000, cumulative 21,000", () => {
    const r = calculateVehicleDepreciation(vehicle, 2026);
    expect(r.yearsOwned).toBe(7);
    expect(r.cumulativeAllowances).toBe(21_000);
    expect(r.netBookValue).toBe(3_000);
    expect(r.fullyDepreciated).toBe(false);
  });

  it("year 8: NBV 0, cumulative 24,000, fully depreciated", () => {
    const r = calculateVehicleDepreciation(vehicle, 2027);
    expect(r.yearsOwned).toBe(8);
    expect(r.cumulativeAllowances).toBe(24_000);
    expect(r.netBookValue).toBe(0);
    expect(r.fullyDepreciated).toBe(true);
  });

  it("year 10: still fully depreciated, NBV still 0", () => {
    const r = calculateVehicleDepreciation(vehicle, 2029);
    expect(r.yearsOwned).toBe(10);
    expect(r.cumulativeAllowances).toBe(24_000);
    expect(r.netBookValue).toBe(0);
    expect(r.fullyDepreciated).toBe(true);
  });
});
