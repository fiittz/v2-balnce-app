import { describe, it, expect } from "vitest";
import { autoCategorise, type TransactionInput } from "../autocat";

// ── Helper: build a minimal expense transaction ─────────────
function expense(description: string, overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    amount: -50,
    date: "2024-06-15",
    currency: "EUR",
    description,
    direction: "expense",
    user_industry: "carpentry_joinery",
    user_business_type: "Contractor",
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// Business expense detection on personal accounts
// ══════════════════════════════════════════════════════════════
describe("Business Expense Detection", () => {
  describe("looks_like_business_expense fires on directors_personal_tax", () => {
    it("flags trade supplier (Screwfix) on personal account", () => {
      const result = autoCategorise(
        expense("SCREWFIX 1234", { account_type: "directors_personal_tax" }),
        [],
        [],
      );
      expect(result.looks_like_business_expense).toBe(true);
    });

    it("flags trade supplier (Chadwicks) on personal account", () => {
      const result = autoCategorise(
        expense("CHADWICKS DUBLIN", { account_type: "directors_personal_tax" }),
        [],
        [],
      );
      expect(result.looks_like_business_expense).toBe(true);
    });

    it("flags tech supplier (GitHub) on personal account for tech industry", () => {
      const result = autoCategorise(
        expense("GITHUB.COM", {
          account_type: "directors_personal_tax",
          user_industry: "software_development",
          user_business_type: "LTD",
        }),
        [],
        [],
      );
      expect(result.looks_like_business_expense).toBe(true);
    });

    it("flags business-indicator category (Materials) on personal account", () => {
      const result = autoCategorise(
        expense("WOODIES DIY", { account_type: "directors_personal_tax" }),
        [],
        [],
      );
      // Woodies categorises as Tools — which is a business indicator category
      expect(result.looks_like_business_expense).toBe(true);
    });

    it("flags software subscription on personal account", () => {
      const result = autoCategorise(
        expense("ADOBE CREATIVE CLOUD", {
          account_type: "directors_personal_tax",
          user_industry: "software_development",
          user_business_type: "LTD",
        }),
        [],
        [],
      );
      // Software/subscriptions is a business indicator category
      expect(result.looks_like_business_expense).toBe(true);
    });
  });

  describe("does NOT fire on limited_company account", () => {
    it("Screwfix on company account — no flag", () => {
      const result = autoCategorise(
        expense("SCREWFIX 1234", { account_type: "limited_company" }),
        [],
        [],
      );
      expect(result.looks_like_business_expense).toBeFalsy();
    });

    it("GitHub on company account — no flag", () => {
      const result = autoCategorise(
        expense("GITHUB.COM", {
          account_type: "limited_company",
          user_industry: "software_development",
        }),
        [],
        [],
      );
      expect(result.looks_like_business_expense).toBeFalsy();
    });
  });

  describe("does NOT fire without account_type", () => {
    it("Screwfix without account_type — no flag", () => {
      const result = autoCategorise(expense("SCREWFIX 1234"), [], []);
      expect(result.looks_like_business_expense).toBeFalsy();
    });
  });

  describe("does NOT fire for personal categories", () => {
    it("groceries on personal account — no flag", () => {
      const result = autoCategorise(
        expense("TESCO EXPRESS", { account_type: "directors_personal_tax" }),
        [],
        [],
      );
      expect(result.looks_like_business_expense).toBeFalsy();
    });

    it("ATM withdrawal on personal account — no flag", () => {
      const result = autoCategorise(
        expense("ATM WITHDRAWAL", { account_type: "directors_personal_tax" }),
        [],
        [],
      );
      expect(result.looks_like_business_expense).toBeFalsy();
    });
  });

  describe("[PENDING_BUSINESS_REVIEW] marker logic", () => {
    it("marker should be appendable to notes string", () => {
      const notes = "Trade supplies for business";
      const withMarker = notes + " [PENDING_BUSINESS_REVIEW]";
      expect(withMarker).toContain("[PENDING_BUSINESS_REVIEW]");
    });

    it("marker can be stripped cleanly", () => {
      const notes = "Trade supplies for business [PENDING_BUSINESS_REVIEW]";
      const stripped = notes.replace(/\s*\[PENDING_BUSINESS_REVIEW\]/g, "").trim();
      expect(stripped).toBe("Trade supplies for business");
      expect(stripped).not.toContain("[PENDING_BUSINESS_REVIEW]");
    });

    it("stripping replaces with MOVED_FROM_PERSONAL correctly", () => {
      const notes = "Trade supplies for business [PENDING_BUSINESS_REVIEW]";
      const stripped = notes.replace(/\s*\[PENDING_BUSINESS_REVIEW\]/g, "").trim();
      const moved = stripped + " [MOVED_FROM_PERSONAL]";
      expect(moved).toContain("[MOVED_FROM_PERSONAL]");
      expect(moved).not.toContain("[PENDING_BUSINESS_REVIEW]");
    });
  });
});
