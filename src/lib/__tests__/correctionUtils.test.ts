import { describe, it, expect } from "vitest";
import { extractVendorPattern, getCorrectionConfidence, PROMOTION_THRESHOLD, type UserCorrection } from "../correctionUtils";

// ══════════════════════════════════════════════════════════════
// extractVendorPattern
// ══════════════════════════════════════════════════════════════
describe("extractVendorPattern", () => {
  it("lowercases and takes first 3 meaningful tokens", () => {
    expect(extractVendorPattern("ACME Software Inc")).toBe("acme software inc");
  });

  it("strips non-alphanumeric characters", () => {
    // O' → "o" (short, skipped), Brien → "brien", 's → "s" (short, skipped)
    expect(extractVendorPattern("O'Brien's Plumbing Ltd.")).toBe("obriens plumbing ltd");
  });

  it("skips short tokens (< 2 chars)", () => {
    expect(extractVendorPattern("A B CD Big Company")).toBe("cd big company");
  });

  it("returns at most 3 tokens", () => {
    expect(extractVendorPattern("One Two Three Four Five")).toBe("one two three");
  });

  it("handles empty string", () => {
    expect(extractVendorPattern("")).toBe("");
  });

  it("handles single word", () => {
    expect(extractVendorPattern("Screwfix")).toBe("screwfix");
  });

  it("handles multiple spaces", () => {
    expect(extractVendorPattern("  Shell   Fuel   Station  ")).toBe("shell fuel station");
  });
});

// ══════════════════════════════════════════════════════════════
// getCorrectionConfidence
// ══════════════════════════════════════════════════════════════
describe("getCorrectionConfidence", () => {
  const makeCorrection = (count: number): UserCorrection => ({
    id: "1",
    user_id: "u1",
    vendor_pattern: "test",
    original_category: null,
    corrected_category: "Test",
    corrected_category_id: "cat-1",
    corrected_vat_rate: null,
    transaction_count: count,
    promoted_to_cache: false,
  });

  it("returns 0 for 1 correction (not enough confidence)", () => {
    expect(getCorrectionConfidence(makeCorrection(1))).toBe(0);
  });

  it("returns 80 for 2 corrections", () => {
    expect(getCorrectionConfidence(makeCorrection(2))).toBe(80);
  });

  it("returns 90 for 3+ corrections (promotion threshold)", () => {
    expect(getCorrectionConfidence(makeCorrection(3))).toBe(90);
    expect(getCorrectionConfidence(makeCorrection(10))).toBe(90);
  });

  it("PROMOTION_THRESHOLD is 3", () => {
    expect(PROMOTION_THRESHOLD).toBe(3);
  });
});
