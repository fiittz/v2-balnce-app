import { describe, it, expect } from "vitest";
import { isVATDeductible, calculateVATFromGross } from "../vatDeductibility";

// ══════════════════════════════════════════════════════════════
// isVATDeductible
// ══════════════════════════════════════════════════════════════
describe("isVATDeductible", () => {
  // Section 60(2)(a)(i) — Food, drink, accommodation
  it("blocks food/restaurant VAT", () => {
    const result = isVATDeductible("Nandos restaurant Dublin");
    expect(result.isDeductible).toBe(false);
    expect(result.section).toBe("Section 60(2)(a)(i)");
  });

  it("blocks hotel/accommodation VAT", () => {
    const result = isVATDeductible("Maldron Hotel Galway");
    expect(result.isDeductible).toBe(false);
    expect(result.section).toBe("Section 60(2)(a)(i)");
  });

  it("blocks cafe VAT", () => {
    const result = isVATDeductible("Starbucks coffee");
    expect(result.isDeductible).toBe(false);
  });

  // Section 60(2)(a)(iii) — Entertainment
  it("blocks entertainment VAT", () => {
    const result = isVATDeductible("Netflix subscription");
    expect(result.isDeductible).toBe(false);
    expect(result.section).toBe("Section 60(2)(a)(iii)");
  });

  it("blocks cinema VAT", () => {
    const result = isVATDeductible("Cinema tickets");
    expect(result.isDeductible).toBe(false);
  });

  // Section 60(2)(a)(iv) — Passenger vehicles
  it("blocks car purchase VAT", () => {
    const result = isVATDeductible("Car purchase Toyota");
    expect(result.isDeductible).toBe(false);
    expect(result.section).toBe("Section 60(2)(a)(iv)");
  });

  it("blocks car lease VAT", () => {
    const result = isVATDeductible("Car lease monthly payment");
    expect(result.isDeductible).toBe(false);
  });

  // Section 60(2)(a)(v) — Petrol
  it("blocks petrol VAT", () => {
    const result = isVATDeductible("Petrol at Maxol");
    expect(result.isDeductible).toBe(false);
    expect(result.section).toBe("Section 60(2)(a)(v)");
  });

  it("allows diesel VAT", () => {
    const result = isVATDeductible("Diesel purchase");
    expect(result.isDeductible).toBe(true);
    expect(result.reason).toContain("Diesel");
  });

  // Mixed fuel retailers
  it("blocks mixed retailer without diesel keyword", () => {
    const result = isVATDeductible("Maxol payment");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Mixed retailer");
  });

  // Non-business
  it("blocks personal/non-business expenses", () => {
    const result = isVATDeductible("Personal shopping");
    expect(result.isDeductible).toBe(false);
    expect(result.section).toBe("Section 59");
  });

  // Bank charges (exempt)
  it("blocks bank fee VAT (exempt supply)", () => {
    const result = isVATDeductible("Bank fee quarterly charge");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("exempt");
  });

  // Insurance (exempt)
  it("blocks insurance VAT (exempt)", () => {
    const result = isVATDeductible("Insurance renewal premium");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("exempt");
  });

  // Default: business expense is deductible
  it("allows generic business expense VAT", () => {
    const result = isVATDeductible("Timber order Chadwicks");
    expect(result.isDeductible).toBe(true);
  });

  // Category/account name matching
  it("checks category name for keywords", () => {
    const result = isVATDeductible("Payment XYZ", "restaurant", null);
    expect(result.isDeductible).toBe(false);
  });

  it("checks account name for keywords", () => {
    const result = isVATDeductible("Payment ABC", null, "entertainment");
    expect(result.isDeductible).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateVATFromGross
// ══════════════════════════════════════════════════════════════
describe("calculateVATFromGross", () => {
  it("calculates 23% VAT from gross correctly", () => {
    const result = calculateVATFromGross(123, "standard_23");
    // VAT = 123 * 0.23 / 1.23 = 23.00
    expect(result.vatAmount).toBe(23);
    expect(result.netAmount).toBe(100);
  });

  it("calculates 13.5% VAT from gross correctly", () => {
    const result = calculateVATFromGross(113.5, "reduced_13_5");
    // VAT = 113.50 * 0.135 / 1.135 ≈ 13.50
    expect(result.vatAmount).toBeCloseTo(13.5, 1);
    expect(result.netAmount).toBeCloseTo(100, 0);
  });

  it("returns zero VAT for zero-rated", () => {
    const result = calculateVATFromGross(100, "zero_rated");
    expect(result.vatAmount).toBe(0);
    expect(result.netAmount).toBe(100);
  });

  it("returns zero VAT for exempt", () => {
    const result = calculateVATFromGross(100, "exempt");
    expect(result.vatAmount).toBe(0);
    expect(result.netAmount).toBe(100);
  });

  it("defaults to 23% for unknown rate key", () => {
    const result = calculateVATFromGross(123, "unknown_rate");
    expect(result.vatAmount).toBe(23);
  });

  it("calculates 9% VAT correctly", () => {
    const result = calculateVATFromGross(109, "second_reduced_9");
    // VAT = 109 * 0.09 / 1.09 = 9.00
    expect(result.vatAmount).toBe(9);
    expect(result.netAmount).toBe(100);
  });

  it("handles zero gross amount", () => {
    const result = calculateVATFromGross(0, "standard_23");
    expect(result.vatAmount).toBe(0);
    expect(result.netAmount).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// isVATDeductible — additional branch coverage
// ══════════════════════════════════════════════════════════════
describe("isVATDeductible — additional branch coverage", () => {
  it("allows fuel station purchase when description includes diesel", () => {
    const result = isVATDeductible("Circle K diesel purchase");
    expect(result.isDeductible).toBe(true);
    expect(result.reason).toContain("recoverable");
  });

  it("allows fuel station when 'fuel' keyword present without 'petrol'", () => {
    const result = isVATDeductible("Applegreen fuel");
    expect(result.isDeductible).toBe(true);
  });

  it("blocks meals category via category name", () => {
    const result = isVATDeductible("Some expense", "meals & entertainment");
    expect(result.isDeductible).toBe(false);
    expect(result.section).toContain("60");
  });

  it("blocks fines category via category name", () => {
    const result = isVATDeductible("Parking", "Fines & Penalties");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Fines");
  });

  it("blocks fines in description via regex", () => {
    const result = isVATDeductible("penalty charge notice");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Fines");
  });

  it("blocks director's drawings category", () => {
    const result = isVATDeductible("Transfer", "Director's Drawings");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Drawing");
  });
});
