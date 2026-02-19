import { describe, it, expect } from "vitest";
import { isVATDeductible, calculateVATFromGross, isCTDeductible } from "../vatDeductibility";

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

  // Numeric rate inputs (line 171-173)
  it("accepts numeric rate 23 instead of string key", () => {
    const result = calculateVATFromGross(123, 23);
    expect(result.vatAmount).toBe(23);
    expect(result.netAmount).toBe(100);
  });

  it("accepts numeric rate 13.5", () => {
    const result = calculateVATFromGross(113.5, 13.5);
    expect(result.vatAmount).toBeCloseTo(13.5, 1);
    expect(result.netAmount).toBeCloseTo(100, 0);
  });

  it("accepts numeric rate 9", () => {
    const result = calculateVATFromGross(109, 9);
    expect(result.vatAmount).toBe(9);
    expect(result.netAmount).toBe(100);
  });

  it("accepts numeric rate 4.8 (livestock)", () => {
    const result = calculateVATFromGross(104.8, 4.8);
    expect(result.vatAmount).toBeCloseTo(4.8, 1);
    expect(result.netAmount).toBeCloseTo(100, 0);
  });

  it("accepts numeric rate 0 (zero-rated)", () => {
    const result = calculateVATFromGross(100, 0);
    expect(result.vatAmount).toBe(0);
    expect(result.netAmount).toBe(100);
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

  it("blocks Director's Loan Account category", () => {
    const result = isVATDeductible("Transfer", "Director's Loan Account");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Director's Loan Account");
  });

  it("blocks 'private' expense", () => {
    const result = isVATDeductible("Private use broadband");
    expect(result.isDeductible).toBe(false);
    expect(result.section).toBe("Section 59");
  });

  it("blocks 'non-business' expense", () => {
    const result = isVATDeductible("Non-business purchase");
    expect(result.isDeductible).toBe(false);
    expect(result.section).toBe("Section 59");
  });

  it("blocks bank charge (without 'fee' keyword)", () => {
    const result = isVATDeductible("Bank maintenance charge");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("exempt");
  });

  it("does not block motor tax as insurance", () => {
    const result = isVATDeductible("Motor tax renewal");
    expect(result.isDeductible).toBe(true);
  });

  it("blocks 'fines' (plural) in description via regex", () => {
    const result = isVATDeductible("Parking fines x2");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Fines");
  });

  it("blocks 'fine' (singular) in description via regex", () => {
    const result = isVATDeductible("Speeding fine payment");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Fines");
  });

  it("handles empty description with null category and account", () => {
    const result = isVATDeductible("", null, null);
    expect(result.isDeductible).toBe(true);
    expect(result.reason).toContain("Business expense");
  });

  it("blocks penalties in description via regex", () => {
    const result = isVATDeductible("Late filing penalties applied");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Fines");
  });
});

// ══════════════════════════════════════════════════════════════
// isCTDeductible
// ══════════════════════════════════════════════════════════════
describe("isCTDeductible", () => {
  // ── Non-deductible categories ──
  it("blocks entertainment category", () => {
    const result = isCTDeductible("Client drinks", "Entertainment");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Entertainment");
  });

  it("blocks meals category", () => {
    const result = isCTDeductible("Team lunch", "Meals & Entertainment");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Meals");
  });

  it("blocks fines category", () => {
    const result = isCTDeductible("Parking ticket", "Fines & Penalties");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Fines");
  });

  it("blocks penalties category", () => {
    const result = isCTDeductible("Late return", "Tax Penalties");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Fines");
  });

  it("blocks fines in description via regex", () => {
    const result = isCTDeductible("Parking fine paid", "Motor Expenses");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Fines");
  });

  it("blocks 'fines' (plural) in description via regex", () => {
    const result = isCTDeductible("Multiple fines issued", "Motor Expenses");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Fines");
  });

  it("blocks penalty in description via regex", () => {
    const result = isCTDeductible("Late filing penalty", "Admin");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Fines");
  });

  it("blocks penalties in description via regex", () => {
    const result = isCTDeductible("Revenue penalties applied", "Admin");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Fines");
  });

  it("blocks personal expenses", () => {
    const result = isCTDeductible("Groceries", "Personal");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Non-business");
  });

  it("blocks private expenses", () => {
    const result = isCTDeductible("Sky TV", "Private");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Non-business");
  });

  it("blocks non-business expenses", () => {
    const result = isCTDeductible("Holiday flights", "Non-Business");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("Non-business");
  });

  it("blocks depreciation (replaced by capital allowances)", () => {
    const result = isCTDeductible("Van depreciation", "Depreciation");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("capital allowances");
  });

  it("blocks uncategorised expenses (flags for review)", () => {
    const result = isCTDeductible("Mystery payment", "Uncategorised");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("needs review");
  });

  it("blocks uncategorized (US spelling)", () => {
    const result = isCTDeductible("Unknown debit", "Uncategorized");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("needs review");
  });

  it("blocks null category (conservative)", () => {
    const result = isCTDeductible("Random payment", null);
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("needs review");
  });

  it("blocks undefined category", () => {
    const result = isCTDeductible("Some debit");
    expect(result.isDeductible).toBe(false);
    expect(result.reason).toContain("needs review");
  });

  // ── Deductible categories ──
  it("allows travel expenses", () => {
    const result = isCTDeductible("Train to client site", "Travel");
    expect(result.isDeductible).toBe(true);
    expect(result.reason).toContain("Allowable");
  });

  it("allows bank charges", () => {
    const result = isCTDeductible("Monthly bank fee", "Bank Charges");
    expect(result.isDeductible).toBe(true);
  });

  it("allows insurance", () => {
    const result = isCTDeductible("Public liability insurance", "Insurance");
    expect(result.isDeductible).toBe(true);
  });

  it("allows materials", () => {
    const result = isCTDeductible("Timber from Chadwicks", "Materials");
    expect(result.isDeductible).toBe(true);
  });

  it("allows tools", () => {
    const result = isCTDeductible("Drill purchase", "Tools & Equipment");
    expect(result.isDeductible).toBe(true);
  });

  it("allows subscriptions", () => {
    const result = isCTDeductible("Xero subscription", "Software & Subscriptions");
    expect(result.isDeductible).toBe(true);
  });

  it("allows vehicle expenses (not vehicle purchase)", () => {
    const result = isCTDeductible("Diesel for van", "Vehicle Expenses");
    expect(result.isDeductible).toBe(true);
  });
});
