import { describe, it, expect } from "vitest";
import {
  VAT_RATES,
  VAT_THRESHOLDS,
  DISALLOWED_VAT_CREDITS,
  applyTwoThirdsRule,
  determineVatTreatment,
} from "../irishVatRules";

// ══════════════════════════════════════════════════════════════
// VAT_RATES
// ══════════════════════════════════════════════════════════════
describe("VAT_RATES", () => {
  it("standard rate is 23%", () => {
    expect(VAT_RATES.STANDARD_23.rate).toBe(0.23);
  });

  it("reduced rate is 13.5%", () => {
    expect(VAT_RATES.REDUCED_13_5.rate).toBe(0.135);
  });

  it("second reduced rate is 9%", () => {
    expect(VAT_RATES.SECOND_REDUCED_9.rate).toBe(0.09);
  });

  it("livestock rate is 4.8%", () => {
    expect(VAT_RATES.LIVESTOCK_4_8.rate).toBe(0.048);
  });

  it("zero-rated is 0%", () => {
    expect(VAT_RATES.ZERO_RATED.rate).toBe(0);
  });

  it("exempt is 0%", () => {
    expect(VAT_RATES.EXEMPT.rate).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// VAT_THRESHOLDS
// ══════════════════════════════════════════════════════════════
describe("VAT_THRESHOLDS", () => {
  it("goods threshold is €85,000", () => {
    expect(VAT_THRESHOLDS.GOODS).toBe(85_000);
  });

  it("services threshold is €42,500", () => {
    expect(VAT_THRESHOLDS.SERVICES).toBe(42_500);
  });
});

// ══════════════════════════════════════════════════════════════
// applyTwoThirdsRule
// ══════════════════════════════════════════════════════════════
describe("applyTwoThirdsRule", () => {
  it("returns 13.5% service rate when parts < 2/3 of total", () => {
    const result = applyTwoThirdsRule(200, 1_000); // 20%
    expect(result.applicableRate).toBe("reduced_13_5");
    expect(result.isServiceSupply).toBe(true);
    expect(result.explanation).toContain("less than 2/3");
  });

  it("returns 23% goods rate when parts >= 2/3 of total", () => {
    const result = applyTwoThirdsRule(700, 1_000); // 70%
    expect(result.applicableRate).toBe("standard_23");
    expect(result.isServiceSupply).toBe(false);
    expect(result.explanation).toContain("2/3 or more");
  });

  it("returns 23% when parts exactly 2/3", () => {
    const result = applyTwoThirdsRule(666.67, 1_000); // ≈ 66.67%
    expect(result.applicableRate).toBe("standard_23");
  });

  it("returns 13.5% when parts just under 2/3", () => {
    const result = applyTwoThirdsRule(666, 1_000); // 66.6%
    expect(result.applicableRate).toBe("reduced_13_5");
  });
});

// ══════════════════════════════════════════════════════════════
// determineVatTreatment — expenses
// ══════════════════════════════════════════════════════════════
describe("determineVatTreatment — expenses", () => {
  it("blocks VAT recovery for food/restaurant", () => {
    const result = determineVatTreatment("McDonald's lunch", 15, "construction", "expense");
    expect(result.isVatRecoverable).toBe(false);
    expect(result.explanation).toContain("Section 60");
  });

  it("blocks VAT recovery for hotel/accommodation", () => {
    const result = determineVatTreatment("Hotel booking", 150, "construction", "expense");
    expect(result.isVatRecoverable).toBe(false);
  });

  it("blocks VAT recovery for entertainment", () => {
    const result = determineVatTreatment("Cinema tickets", 25, "construction", "expense");
    expect(result.isVatRecoverable).toBe(false);
    expect(result.explanation).toContain("Section 60");
  });

  it("blocks VAT recovery for petrol", () => {
    const result = determineVatTreatment("Petrol purchase", 80, "construction", "expense");
    expect(result.isVatRecoverable).toBe(false);
    expect(result.explanation).toContain("Section 60");
  });

  it("allows VAT recovery for diesel", () => {
    const result = determineVatTreatment("Diesel fuel", 90, "construction", "expense");
    expect(result.isVatRecoverable).toBe(true);
    expect(result.explanation).toContain("Diesel");
  });

  it("flags fuel station as needing receipt", () => {
    const result = determineVatTreatment("Circle K payment", 60, "construction", "expense");
    expect(result.needsReceipt).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("allows VAT for generic business expense", () => {
    const result = determineVatTreatment("Office supplies order", 200, "construction", "expense");
    expect(result.isVatRecoverable).toBe(true);
    expect(result.needsReceipt).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// determineVatTreatment — income
// ══════════════════════════════════════════════════════════════
describe("determineVatTreatment — income", () => {
  it("uses industry default output rate for construction (13.5%)", () => {
    const result = determineVatTreatment("Kitchen installation", 5_000, "construction", "income");
    expect(result.suggestedRate).toBe("reduced_13_5");
  });

  it("uses 23% for professional services income", () => {
    const result = determineVatTreatment("Consulting fee", 3_000, "professional_services", "income");
    expect(result.suggestedRate).toBe("standard_23");
  });

  it("uses 9% for hospitality income", () => {
    const result = determineVatTreatment("Room booking", 200, "hospitality", "income");
    expect(result.suggestedRate).toBe("second_reduced_9");
  });

  it("defaults to 23% for unknown industry", () => {
    const result = determineVatTreatment("Sale", 100, "unknown_industry", "income");
    expect(result.suggestedRate).toBe("standard_23");
  });
});

// ══════════════════════════════════════════════════════════════
// DISALLOWED_VAT_CREDITS keywords
// ══════════════════════════════════════════════════════════════
describe("DISALLOWED_VAT_CREDITS keywords", () => {
  it("food/drink/accommodation includes common keywords", () => {
    const keywords = DISALLOWED_VAT_CREDITS.FOOD_DRINK_ACCOMMODATION.keywords;
    expect(keywords).toContain("restaurant");
    expect(keywords).toContain("hotel");
    expect(keywords).toContain("airbnb");
  });

  it("entertainment includes streaming services", () => {
    const keywords = DISALLOWED_VAT_CREDITS.ENTERTAINMENT.keywords;
    expect(keywords).toContain("netflix");
    expect(keywords).toContain("spotify");
  });

  it("petrol keywords do not include diesel", () => {
    const keywords = DISALLOWED_VAT_CREDITS.PETROL.keywords;
    expect(keywords).not.toContain("diesel");
  });
});

// ══════════════════════════════════════════════════════════════
// determineVatTreatment — wordBoundary food keywords (line 341)
// ══════════════════════════════════════════════════════════════
describe("determineVatTreatment — word-boundary keyword matching", () => {
  it("matches word-boundary food keyword (e.g. 'bar') as standalone word", () => {
    const result = determineVatTreatment("The bar tab", 50, "construction", "expense");
    expect(result.isVatRecoverable).toBe(false);
    expect(result.explanation).toContain("Section 60");
  });

  it("does not match word-boundary keyword as substring (e.g. 'barna' should not match 'bar')", () => {
    const result = determineVatTreatment("Barna recycling", 100, "construction", "expense");
    // "barna" should NOT trigger the food/drink word-boundary match for "bar"
    expect(result.isVatRecoverable).toBe(true);
  });
});
