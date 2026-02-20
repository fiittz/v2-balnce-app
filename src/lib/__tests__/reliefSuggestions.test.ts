import { describe, it, expect } from "vitest";
import { getReliefSuggestions, RELIEF_SUGGESTIONS, type SuggestionContext } from "../reliefSuggestions";

// ── Helper: minimal context ────────────────────────────────────
function baseContext(overrides: Partial<SuggestionContext> = {}): SuggestionContext {
  return {
    industryGroup: "professional",
    maritalStatus: "single",
    hasBIK: false,
    hasPension: false,
    salary: 50_000,
    isVATRegistered: false,
    isRCTRegistered: false,
    companyAgeYears: 10,
    detectedReliefs: [],
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// Industry filtering
// ══════════════════════════════════════════════════════════════
describe("industry filtering", () => {
  it("construction gets flat rate expenses but NOT R&D", () => {
    const { company, personal } = getReliefSuggestions(baseContext({ industryGroup: "construction" }));
    const allIds = [...company, ...personal].map((s) => s.id);
    expect(allIds).toContain("flat_rate_expenses");
    expect(allIds).not.toContain("rd_tax_credit");
  });

  it("software_dev gets R&D + KDB but NOT flat rate expenses", () => {
    const { company, personal } = getReliefSuggestions(baseContext({ industryGroup: "software_dev" }));
    const companyIds = company.map((s) => s.id);
    const allIds = [...company, ...personal].map((s) => s.id);
    expect(companyIds).toContain("rd_tax_credit");
    expect(companyIds).toContain("knowledge_dev_box");
    expect(allIds).not.toContain("flat_rate_expenses");
  });

  it("professional gets neither R&D nor flat rate expenses", () => {
    const { company, personal } = getReliefSuggestions(baseContext({ industryGroup: "professional" }));
    const allIds = [...company, ...personal].map((s) => s.id);
    expect(allIds).not.toContain("rd_tax_credit");
    expect(allIds).not.toContain("flat_rate_expenses");
  });
});

// ══════════════════════════════════════════════════════════════
// Condition-based filtering
// ══════════════════════════════════════════════════════════════
describe("condition-based filtering", () => {
  it("user with pension already set up doesn't get pension suggestions", () => {
    const { company, personal } = getReliefSuggestions(baseContext({ hasPension: true }));
    const allIds = [...company, ...personal].map((s) => s.id);
    expect(allIds).not.toContain("personal_pension");
    expect(allIds).not.toContain("employer_pension");
    expect(allIds).not.toContain("employer_pension_both");
  });

  it("user without pension gets pension suggestions", () => {
    const { company, personal } = getReliefSuggestions(baseContext({ hasPension: false }));
    const companyIds = company.map((s) => s.id);
    const personalIds = personal.map((s) => s.id);
    expect(companyIds).toContain("employer_pension");
    expect(personalIds).toContain("personal_pension");
  });

  it("married user gets home carer credit", () => {
    const { personal } = getReliefSuggestions(baseContext({ maritalStatus: "married" }));
    const ids = personal.map((s) => s.id);
    expect(ids).toContain("home_carer");
  });

  it("single user does NOT get home carer credit", () => {
    const { personal } = getReliefSuggestions(baseContext({ maritalStatus: "single" }));
    const ids = personal.map((s) => s.id);
    expect(ids).not.toContain("home_carer");
  });

  it("company <= 5 years old gets startup relief", () => {
    const { company } = getReliefSuggestions(baseContext({ companyAgeYears: 3 }));
    const ids = company.map((s) => s.id);
    expect(ids).toContain("startup_relief");
  });

  it("company > 5 years old does NOT get startup relief", () => {
    const { company } = getReliefSuggestions(baseContext({ companyAgeYears: 6 }));
    const ids = company.map((s) => s.id);
    expect(ids).not.toContain("startup_relief");
  });

  it("user with BIK gets EV BIK exemption", () => {
    const { company } = getReliefSuggestions(baseContext({ hasBIK: true }));
    const ids = company.map((s) => s.id);
    expect(ids).toContain("ev_bik_exemption");
  });

  it("user without BIK does NOT get EV BIK exemption", () => {
    const { company } = getReliefSuggestions(baseContext({ hasBIK: false }));
    const ids = company.map((s) => s.id);
    expect(ids).not.toContain("ev_bik_exemption");
  });

  it("detected medical relief filters out medical suggestion", () => {
    const { personal } = getReliefSuggestions(baseContext({ detectedReliefs: ["medical"] }));
    const ids = personal.map((s) => s.id);
    expect(ids).not.toContain("medical_expenses");
  });

  it("detected rent relief filters out rent suggestion", () => {
    const { personal } = getReliefSuggestions(baseContext({ detectedReliefs: ["rent"] }));
    const ids = personal.map((s) => s.id);
    expect(ids).not.toContain("rent_tax_credit");
  });
});

// ══════════════════════════════════════════════════════════════
// Both-type suggestions
// ══════════════════════════════════════════════════════════════
describe("both-type suggestions", () => {
  it("'both' suggestions appear in both company and personal lists", () => {
    const { company, personal } = getReliefSuggestions(baseContext({ hasBIK: true }));
    const companyIds = company.map((s) => s.id);
    const personalIds = personal.map((s) => s.id);

    // small_benefit_exemption is "both" with no condition
    expect(companyIds).toContain("small_benefit_exemption");
    expect(personalIds).toContain("small_benefit_exemption");

    // ev_bik_exemption is "both" + condition (hasBIK)
    expect(companyIds).toContain("ev_bik_exemption");
    expect(personalIds).toContain("ev_bik_exemption");
  });
});

// ══════════════════════════════════════════════════════════════
// Master list integrity
// ══════════════════════════════════════════════════════════════
describe("master list integrity", () => {
  it("has no duplicate IDs", () => {
    const ids = RELIEF_SUGGESTIONS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("has 24 total suggestions", () => {
    expect(RELIEF_SUGGESTIONS).toHaveLength(24);
  });

  it("has 10 company, 10 personal, 4 both", () => {
    const company = RELIEF_SUGGESTIONS.filter((s) => s.taxBenefit === "company");
    const personal = RELIEF_SUGGESTIONS.filter((s) => s.taxBenefit === "personal");
    const both = RELIEF_SUGGESTIONS.filter((s) => s.taxBenefit === "both");
    expect(company).toHaveLength(10);
    expect(personal).toHaveLength(10);
    expect(both).toHaveLength(4);
  });
});
