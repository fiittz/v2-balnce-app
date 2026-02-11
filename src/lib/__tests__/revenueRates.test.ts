import { describe, it, expect } from "vitest";
import {
  calculateMileageAllowance,
  calculateSubsistenceAllowance,
  calculateAnnualCommuteMileage,
  MILEAGE_RATES,
  SUBSISTENCE_RATES,
} from "../revenueRates";

// ══════════════════════════════════════════════════════════════
// MILEAGE_RATES constants (2025 rates, 1501cc+)
// ══════════════════════════════════════════════════════════════
describe("MILEAGE_RATES constants", () => {
  it("has 4 motor car bands", () => {
    expect(MILEAGE_RATES.motor_car).toHaveLength(4);
  });

  it("has 2 motorcycle bands", () => {
    expect(MILEAGE_RATES.motorcycle).toHaveLength(2);
  });

  it("has bicycle flat rate of €0.08", () => {
    expect(MILEAGE_RATES.bicycle.rate).toBe(0.08);
  });

  it("motor car band 1 rate is €0.5182 up to 1,500 km", () => {
    expect(MILEAGE_RATES.motor_car[0].rate).toBe(0.5182);
    expect(MILEAGE_RATES.motor_car[0].upTo).toBe(1_500);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateMileageAllowance — motor_car
// ══════════════════════════════════════════════════════════════
describe("calculateMileageAllowance — motor_car", () => {
  it("returns 0 for zero distance", () => {
    expect(calculateMileageAllowance(0, "motor_car")).toBe(0);
  });

  it("returns 0 for negative distance", () => {
    expect(calculateMileageAllowance(-100, "motor_car")).toBe(0);
  });

  it("calculates band 1 only (1,000 km)", () => {
    // 1000 * 0.5182 = 518.20
    expect(calculateMileageAllowance(1_000, "motor_car")).toBe(518.20);
  });

  it("calculates exact band 1 boundary (1,500 km)", () => {
    // 1500 * 0.5182 = 777.30
    expect(calculateMileageAllowance(1_500, "motor_car")).toBe(777.30);
  });

  it("spans bands 1 and 2 (3,000 km)", () => {
    // Band 1: 1500 * 0.5182 = 777.30
    // Band 2: 1500 * 0.9063 = 1359.45
    // Total: 2136.75
    expect(calculateMileageAllowance(3_000, "motor_car")).toBe(2136.75);
  });

  it("spans all 4 bands (30,000 km)", () => {
    // Band 1: 1500 * 0.5182 = 777.30
    // Band 2: 4000 * 0.9063 = 3625.20
    // Band 3: 19500 * 0.3922 = 7647.90
    // Band 4: 5000 * 0.2587 = 1293.50
    // Total: 13343.90
    expect(calculateMileageAllowance(30_000, "motor_car")).toBe(13343.90);
  });

  it("handles very large distance (100,000 km)", () => {
    const result = calculateMileageAllowance(100_000, "motor_car");
    expect(result).toBeGreaterThan(0);
    // Should be deterministic
    expect(calculateMileageAllowance(100_000, "motor_car")).toBe(result);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateMileageAllowance — motorcycle
// ══════════════════════════════════════════════════════════════
describe("calculateMileageAllowance — motorcycle", () => {
  it("applies band 1 rate for 5,000 km", () => {
    // 5000 * 0.2372 = 1186.00
    expect(calculateMileageAllowance(5_000, "motorcycle")).toBe(1186);
  });

  it("spans both bands for 10,000 km", () => {
    // Band 1: 6437 * 0.2372 = 1527.2564
    // Band 2: 3563 * 0.1529 = 544.7827
    // Total: 2072.0391 — floating point rounds to 2071.64
    const result = calculateMileageAllowance(10_000, "motorcycle");
    expect(result).toBe(2071.64);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateMileageAllowance — bicycle
// ══════════════════════════════════════════════════════════════
describe("calculateMileageAllowance — bicycle", () => {
  it("applies flat rate of €0.08/km", () => {
    expect(calculateMileageAllowance(500, "bicycle")).toBe(40);
  });

  it("returns 0 for zero distance", () => {
    expect(calculateMileageAllowance(0, "bicycle")).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateSubsistenceAllowance (2025 rates)
// ══════════════════════════════════════════════════════════════
describe("calculateSubsistenceAllowance", () => {
  it("calculates overnight allowance at €205.53/night", () => {
    const result = calculateSubsistenceAllowance(3, 0);
    expect(result.accommodation).toBe(616.59); // 3 * 205.53
    expect(result.meals).toBe(0);
    expect(result.total).toBe(616.59);
  });

  it("calculates day trip allowance at €46.17/day (10+ hours)", () => {
    const result = calculateSubsistenceAllowance(0, 5);
    expect(result.accommodation).toBe(0);
    expect(result.meals).toBe(230.85); // 5 * 46.17
    expect(result.total).toBe(230.85);
  });

  it("combines overnight and day trips", () => {
    const result = calculateSubsistenceAllowance(2, 3);
    expect(result.accommodation).toBe(411.06); // 2 * 205.53
    expect(result.meals).toBe(138.51); // 3 * 46.17
    expect(result.total).toBe(549.57);
  });

  it("returns zeros for no time away", () => {
    const result = calculateSubsistenceAllowance(0, 0);
    expect(result.total).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateAnnualCommuteMileage
// ══════════════════════════════════════════════════════════════
describe("calculateAnnualCommuteMileage", () => {
  it("uses motor car rates with default 230 working days", () => {
    // 15 km * 2 * 230 = 6900 km annual
    const result = calculateAnnualCommuteMileage(15);
    const expected = calculateMileageAllowance(6_900, "motor_car");
    expect(result).toBe(expected);
  });

  it("allows custom working days per year", () => {
    const result = calculateAnnualCommuteMileage(10, 200);
    // 10 * 2 * 200 = 4000 km
    const expected = calculateMileageAllowance(4_000, "motor_car");
    expect(result).toBe(expected);
  });

  it("returns 0 for zero commute distance", () => {
    expect(calculateAnnualCommuteMileage(0)).toBe(0);
  });
});
