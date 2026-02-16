import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock supabase client ─────────────────────────────────────
// We control what candidates the query returns via mockResolvedData.
// The chainable mock simulates supabase's fluent query builder.
let mockResolvedData: { data: Record<string, unknown>[] | null; error: unknown } = {
  data: [],
  error: null,
};

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const chainable = () => {
    const chain: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return chain;
      },
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return chain;
      },
      eq: (...args: unknown[]) => {
        mockEq(...args);
        return chain;
      },
      is: (...args: unknown[]) => {
        mockIs(...args);
        return chain;
      },
      gte: (...args: unknown[]) => {
        mockGte(...args);
        return chain;
      },
      lte: (...args: unknown[]) => {
        mockLte(...args);
        return chain;
      },
      order: (...args: unknown[]) => {
        mockOrder(...args);
        return chain;
      },
      single: () => {
        mockSingle();
        return chain;
      },
      then: (resolve: (value: typeof mockResolvedData) => void) => resolve(mockResolvedData),
    };
    return chain;
  };
  return {
    supabase: {
      from: (...args: unknown[]) => {
        const result = mockFrom(...args);
        // If mockFrom has a custom implementation that returns a chain, use it
        if (result && typeof result === "object" && "then" in result) return result;
        return chainable();
      },
    },
  };
});

import {
  matchReceiptToTransaction,
  linkReceiptToTransaction,
} from "../receiptMatcher";

// ── Helpers ──────────────────────────────────────────────────
const USER_ID = "user-123";
const RECEIPT_ID = "receipt-456";

interface CandidateOverrides {
  id?: string;
  amount?: number;
  description?: string;
  transaction_date?: string;
  receipt_url?: string | null;
}

function candidate(overrides: CandidateOverrides = {}) {
  return {
    id: overrides.id ?? "tx-001",
    amount: overrides.amount ?? -42.5,
    description: overrides.description ?? "POS SCREWFIX IRELAND",
    transaction_date: overrides.transaction_date ?? "2024-06-15",
    receipt_url: overrides.receipt_url ?? null,
  };
}

function setCandidates(candidates: Record<string, unknown>[]) {
  mockResolvedData = { data: candidates, error: null };
}

function setError(message: string) {
  mockResolvedData = { data: null, error: { message } };
}

// ── Reset mocks before each test ─────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockResolvedData = { data: [], error: null };
});

// ==============================================================
// matchReceiptToTransaction — No candidates / error
// ==============================================================
describe("matchReceiptToTransaction — no candidates", () => {
  it("returns null match when no candidate transactions found", async () => {
    setCandidates([]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "Screwfix",
      "2024-06-15"
    );

    expect(result.receiptId).toBe(RECEIPT_ID);
    expect(result.transactionId).toBeNull();
    expect(result.score).toBe(0);
    expect(result.explanation).toBe("No candidate transactions found");
    expect(result.autoMatched).toBe(false);
  });

  it("returns null match with error message on query error", async () => {
    setError("connection refused");

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "Screwfix",
      "2024-06-15"
    );

    expect(result.transactionId).toBeNull();
    expect(result.score).toBe(0);
    expect(result.explanation).toContain("connection refused");
    expect(result.autoMatched).toBe(false);
  });
});

// ==============================================================
// matchReceiptToTransaction — Amount scoring (0.50)
// ==============================================================
describe("matchReceiptToTransaction — amount scoring", () => {
  it("scores 0.50 for exact amount match", async () => {
    setCandidates([
      candidate({
        amount: -42.5,
        description: "UNKNOWN VENDOR",
        transaction_date: "2024-01-01",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5, // receipt amount
      null, // no vendor
      null // no date
    );

    expect(result.score).toBe(0.5);
    expect(result.transactionId).toBe("tx-001");
    expect(result.explanation).toContain("Amount exact match");
  });

  it("scores 0.50 when amounts match to the cent (within 0.005 tolerance)", async () => {
    setCandidates([
      candidate({
        amount: -99.994, // abs = 99.994, diff from 99.99 = 0.004 < 0.005
        description: "SHOP",
        transaction_date: "2024-01-01",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      99.99,
      null,
      null
    );

    expect(result.score).toBe(0.5);
  });

  it("scores 0 for amount mismatch", async () => {
    setCandidates([
      candidate({
        amount: -100.0,
        description: "NO MATCH VENDOR",
        transaction_date: "2024-01-01",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5, // different amount
      null,
      null
    );

    expect(result.score).toBe(0);
    // When score=0, the `score > bestScore` check (strict >) never triggers,
    // so bestExplanation stays as the initial empty string.
    expect(result.explanation).toBe("");
  });

  it("uses absolute values for amount comparison (negative transaction vs positive receipt)", async () => {
    setCandidates([
      candidate({
        amount: -75.0, // negative in DB (expense)
        description: "VENDOR",
        transaction_date: "2024-01-01",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      75.0, // positive receipt amount
      null,
      null
    );

    expect(result.score).toBe(0.5);
    expect(result.explanation).toContain("Amount exact match: 75.00");
  });
});

// ==============================================================
// matchReceiptToTransaction — Vendor scoring (0.30)
// ==============================================================
describe("matchReceiptToTransaction — vendor scoring", () => {
  it("scores 0.30 for full vendor name found in description", async () => {
    setCandidates([
      candidate({
        amount: -999.0, // no amount match
        description: "POS SCREWFIX IRELAND",
        transaction_date: "2024-01-01",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "Screwfix Ireland", // full vendor
      null
    );

    expect(result.score).toBe(0.3);
    expect(result.explanation).toContain("Vendor full match");
  });

  it("scores 0.30 for case-insensitive vendor match", async () => {
    setCandidates([
      candidate({
        amount: -999.0,
        description: "POS CHADWICKS DUBLIN",
        transaction_date: "2024-01-01",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "chadwicks dublin", // lowercase
      null
    );

    expect(result.score).toBe(0.3);
    expect(result.explanation).toContain("Vendor full match");
  });

  it("scores 0.30 for partial vendor match (first word >= 3 chars)", async () => {
    setCandidates([
      candidate({
        amount: -999.0,
        description: "POS CHADWICKS BUILDERS PROVIDERS",
        transaction_date: "2024-01-01",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "Chadwicks Dublin", // "chadwicks" is found in description
      null
    );

    expect(result.score).toBe(0.3);
    // Could match full or partial depending on whether full string is in description
    expect(result.explanation).toMatch(/Vendor (full|partial) match/);
  });

  it("scores 0 for vendor when first word is too short (< 3 chars)", async () => {
    setCandidates([
      candidate({
        amount: -999.0,
        description: "SOME DESCRIPTION AB COMPANY",
        transaction_date: "2024-01-01",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "AB Something", // "ab" is only 2 chars
      null
    );

    expect(result.score).toBe(0);
  });

  it("scores 0 when vendor is null", async () => {
    setCandidates([
      candidate({
        amount: -999.0,
        description: "POS SCREWFIX IRELAND",
        transaction_date: "2024-01-01",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      null, // no vendor
      null
    );

    expect(result.score).toBe(0);
  });

  it("scores 0 when vendor is empty string", async () => {
    setCandidates([
      candidate({
        amount: -999.0,
        description: "POS SCREWFIX IRELAND",
        transaction_date: "2024-01-01",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "  ", // whitespace only
      null
    );

    // After trim, vendorLower is empty, so the `if (vendorLower && ...)` check fails
    expect(result.score).toBe(0);
  });
});

// ==============================================================
// matchReceiptToTransaction — Date scoring (0.20 / 0.15)
// ==============================================================
describe("matchReceiptToTransaction — date scoring", () => {
  it("scores 0.20 for same-day date match", async () => {
    setCandidates([
      candidate({
        amount: -999.0,
        description: "NO VENDOR MATCH",
        transaction_date: "2024-06-15",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      null,
      "2024-06-15" // same day
    );

    expect(result.score).toBe(0.2);
    expect(result.explanation).toContain("Date: same day");
  });

  it("scores 0.15 for +/-1 day date match", async () => {
    setCandidates([
      candidate({
        amount: -999.0,
        description: "NO VENDOR MATCH",
        transaction_date: "2024-06-16", // next day
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      null,
      "2024-06-15"
    );

    expect(result.score).toBe(0.15);
    expect(result.explanation).toContain("Date: within +/-1 day");
  });

  it("scores 0.15 for -1 day date match", async () => {
    setCandidates([
      candidate({
        amount: -999.0,
        description: "NO VENDOR MATCH",
        transaction_date: "2024-06-14", // previous day
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      null,
      "2024-06-15"
    );

    expect(result.score).toBe(0.15);
    expect(result.explanation).toContain("Date: within +/-1 day");
  });

  it("scores 0 for date more than 1 day apart", async () => {
    setCandidates([
      candidate({
        amount: -999.0,
        description: "NO VENDOR MATCH",
        transaction_date: "2024-06-20", // 5 days away
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      null,
      "2024-06-15"
    );

    expect(result.score).toBe(0);
  });

  it("scores 0 for date when receiptDate is null", async () => {
    setCandidates([
      candidate({
        amount: -999.0,
        description: "NO VENDOR MATCH",
        transaction_date: "2024-06-15",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      null,
      null // no receipt date
    );

    expect(result.score).toBe(0);
  });
});

// ==============================================================
// matchReceiptToTransaction — Combined scoring
// ==============================================================
describe("matchReceiptToTransaction — combined scoring", () => {
  it("perfect match: amount + vendor + same day = 1.0 and autoMatched", async () => {
    setCandidates([
      candidate({
        amount: -42.5,
        description: "POS SCREWFIX IRELAND",
        transaction_date: "2024-06-15",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "Screwfix",
      "2024-06-15"
    );

    expect(result.score).toBe(1.0);
    expect(result.autoMatched).toBe(true);
    expect(result.transactionId).toBe("tx-001");
    expect(result.explanation).toContain("Amount exact match");
    expect(result.explanation).toContain("Vendor");
    expect(result.explanation).toContain("Date: same day");
  });

  it("amount + vendor + near day = 0.95 and autoMatched (meets threshold)", async () => {
    setCandidates([
      candidate({
        amount: -42.5,
        description: "POS SCREWFIX IRELAND",
        transaction_date: "2024-06-16", // +1 day
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "Screwfix",
      "2024-06-15"
    );

    expect(result.score).toBe(0.95); // 0.50 + 0.30 + 0.15
    expect(result.autoMatched).toBe(true);
  });

  it("amount + date but no vendor = 0.70 and NOT autoMatched", async () => {
    setCandidates([
      candidate({
        amount: -42.5,
        description: "POS SOME OTHER SHOP",
        transaction_date: "2024-06-15",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "Screwfix", // vendor not in description
      "2024-06-15"
    );

    expect(result.score).toBe(0.7); // 0.50 + 0.20
    expect(result.autoMatched).toBe(false);
  });

  it("vendor + date but no amount = 0.50 and NOT autoMatched", async () => {
    setCandidates([
      candidate({
        amount: -999.0,
        description: "POS SCREWFIX IRELAND",
        transaction_date: "2024-06-15",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "Screwfix",
      "2024-06-15"
    );

    expect(result.score).toBe(0.5); // 0.30 + 0.20
    expect(result.autoMatched).toBe(false);
  });

  it("amount + vendor but no date = 0.80 and NOT autoMatched", async () => {
    setCandidates([
      candidate({
        amount: -42.5,
        description: "POS SCREWFIX IRELAND",
        transaction_date: "2024-06-15",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "Screwfix",
      null // no date provided
    );

    expect(result.score).toBe(0.8); // 0.50 + 0.30
    expect(result.autoMatched).toBe(false);
  });
});

// ==============================================================
// matchReceiptToTransaction — Best candidate selection
// ==============================================================
describe("matchReceiptToTransaction — best candidate selection", () => {
  it("selects the candidate with the highest score from multiple", async () => {
    setCandidates([
      candidate({
        id: "tx-bad",
        amount: -100.0, // wrong amount
        description: "UNRELATED STORE",
        transaction_date: "2024-06-20",
      }),
      candidate({
        id: "tx-good",
        amount: -42.5, // exact amount
        description: "POS SCREWFIX IRELAND", // vendor match
        transaction_date: "2024-06-15", // date match
      }),
      candidate({
        id: "tx-partial",
        amount: -42.5, // exact amount
        description: "RANDOM PURCHASE",
        transaction_date: "2024-06-18",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "Screwfix",
      "2024-06-15"
    );

    expect(result.transactionId).toBe("tx-good");
    expect(result.score).toBe(1.0);
    expect(result.autoMatched).toBe(true);
  });

  it("picks first highest-scoring candidate when scores tie", async () => {
    setCandidates([
      candidate({
        id: "tx-first",
        amount: -42.5,
        description: "SHOP A",
        transaction_date: "2024-01-01",
      }),
      candidate({
        id: "tx-second",
        amount: -42.5,
        description: "SHOP B",
        transaction_date: "2024-01-01",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      null,
      null
    );

    // Both score 0.50 (amount only). First one wins because score > bestScore
    // uses strict >, so the first candidate keeps the lead.
    expect(result.transactionId).toBe("tx-first");
    expect(result.score).toBe(0.5);
  });
});

// ==============================================================
// matchReceiptToTransaction — autoMatched threshold
// ==============================================================
describe("matchReceiptToTransaction — autoMatched threshold", () => {
  it("autoMatched is true when score >= 0.95", async () => {
    setCandidates([
      candidate({
        amount: -42.5,
        description: "POS SCREWFIX IRELAND",
        transaction_date: "2024-06-16", // +1 day => 0.15
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "Screwfix",
      "2024-06-15"
    );

    // 0.50 + 0.30 + 0.15 = 0.95
    expect(result.score).toBe(0.95);
    expect(result.autoMatched).toBe(true);
  });

  it("autoMatched is false when score < 0.95", async () => {
    setCandidates([
      candidate({
        amount: -42.5,
        description: "POS SOME OTHER SHOP",
        transaction_date: "2024-06-15",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "Screwfix", // no vendor match
      "2024-06-15"
    );

    // 0.50 + 0.20 = 0.70
    expect(result.score).toBe(0.7);
    expect(result.autoMatched).toBe(false);
  });
});

// ==============================================================
// matchReceiptToTransaction — Supabase query construction
// ==============================================================
describe("matchReceiptToTransaction — query construction", () => {
  it("queries 'transactions' table", async () => {
    setCandidates([]);

    await matchReceiptToTransaction(USER_ID, RECEIPT_ID, 42.5, null, null);

    expect(mockFrom).toHaveBeenCalledWith("transactions");
  });

  it("filters by user_id and null receipt_url", async () => {
    setCandidates([]);

    await matchReceiptToTransaction(USER_ID, RECEIPT_ID, 42.5, null, null);

    expect(mockEq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(mockIs).toHaveBeenCalledWith("receipt_url", null);
  });

  it("applies date window filter when receiptDate is provided", async () => {
    setCandidates([]);

    await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      null,
      "2024-06-15"
    );

    expect(mockGte).toHaveBeenCalledWith("transaction_date", "2024-06-13");
    expect(mockLte).toHaveBeenCalledWith("transaction_date", "2024-06-17");
  });

  it("does NOT apply date window filter when receiptDate is null", async () => {
    setCandidates([]);

    await matchReceiptToTransaction(USER_ID, RECEIPT_ID, 42.5, null, null);

    expect(mockGte).not.toHaveBeenCalled();
    expect(mockLte).not.toHaveBeenCalled();
  });
});

// ==============================================================
// matchReceiptToTransaction — Edge cases
// ==============================================================
describe("matchReceiptToTransaction — edge cases", () => {
  it("handles candidate with empty description gracefully", async () => {
    setCandidates([
      candidate({
        amount: -42.5,
        description: "",
        transaction_date: "2024-06-15",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "Screwfix",
      "2024-06-15"
    );

    // Amount 0.50 + Date 0.20 = 0.70 (no vendor match on empty description)
    expect(result.score).toBe(0.7);
  });

  it("handles zero amount receipt correctly", async () => {
    setCandidates([
      candidate({
        amount: 0,
        description: "ADJUSTMENT",
        transaction_date: "2024-06-15",
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      0, // zero amount
      null,
      "2024-06-15"
    );

    // Amount match (0.50) + date match (0.20) = 0.70
    expect(result.score).toBe(0.7);
  });

  it("score is rounded to 2 decimal places", async () => {
    setCandidates([
      candidate({
        amount: -42.5,
        description: "POS SCREWFIX IRELAND",
        transaction_date: "2024-06-16", // +1 day
      }),
    ]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      "Screwfix",
      "2024-06-15"
    );

    // 0.50 + 0.30 + 0.15 = 0.95 (no floating point weirdness)
    expect(result.score).toBe(0.95);
    expect(Number.isInteger(result.score * 100)).toBe(true);
  });

  it("returns receiptId in result regardless of match", async () => {
    setCandidates([]);

    const result = await matchReceiptToTransaction(
      USER_ID,
      RECEIPT_ID,
      42.5,
      null,
      null
    );

    expect(result.receiptId).toBe(RECEIPT_ID);
  });
});

// ==============================================================
// linkReceiptToTransaction
// ==============================================================
describe("linkReceiptToTransaction", () => {
  it("updates both receipts and transactions tables", async () => {
    await linkReceiptToTransaction(
      "receipt-1",
      "tx-1",
      "https://example.com/receipt.jpg"
    );

    // First call: update receipts table
    expect(mockFrom).toHaveBeenCalledWith("receipts");
    expect(mockUpdate).toHaveBeenCalledWith({ transaction_id: "tx-1" });

    // Second call: update transactions table
    expect(mockFrom).toHaveBeenCalledWith("transactions");
    expect(mockUpdate).toHaveBeenCalledWith({
      receipt_url: "https://example.com/receipt.jpg",
    });
  });

  it("includes VAT data in transaction update when provided", async () => {
    await linkReceiptToTransaction(
      "receipt-1",
      "tx-1",
      "https://example.com/receipt.jpg",
      23.5, // vatAmount
      0.23 // vatRate
    );

    // The transaction update should include VAT fields
    expect(mockUpdate).toHaveBeenCalledWith({
      receipt_url: "https://example.com/receipt.jpg",
      vat_amount: 23.5,
      vat_rate: 0.23,
    });
  });

  it("omits VAT fields when they are null/undefined", async () => {
    await linkReceiptToTransaction(
      "receipt-1",
      "tx-1",
      "https://example.com/receipt.jpg",
      null,
      null
    );

    // Transaction update should only have receipt_url
    expect(mockUpdate).toHaveBeenCalledWith({
      receipt_url: "https://example.com/receipt.jpg",
    });
  });

  it("throws when receipt update fails (line 187)", async () => {
    // Make the chain return an error for the receipt update
    mockResolvedData = { data: null, error: { message: "receipt update failed" } };

    await expect(
      linkReceiptToTransaction("r-1", "t-1", "https://example.com/img.jpg")
    ).rejects.toThrow("Failed to link receipt: receipt update failed");
  });

  it("throws when transaction update fails (line 201)", async () => {
    // First call (receipts) succeeds, second call (transactions) fails
    // Use table name to differentiate the two supabase calls
    mockFrom.mockImplementation((table: string) => {
      const isReceipts = table === "receipts";
      const chain: Record<string, unknown> = {
        select: (...a: unknown[]) => { mockSelect(...a); return chain; },
        update: (...a: unknown[]) => { mockUpdate(...a); return chain; },
        eq: (...a: unknown[]) => { mockEq(...a); return chain; },
        is: (...a: unknown[]) => { mockIs(...a); return chain; },
        gte: (...a: unknown[]) => { mockGte(...a); return chain; },
        lte: (...a: unknown[]) => { mockLte(...a); return chain; },
        order: (...a: unknown[]) => { mockOrder(...a); return chain; },
        single: () => { mockSingle(); return chain; },
        then: (resolve: (value: unknown) => void) => {
          if (isReceipts) {
            resolve({ error: null });
          } else {
            resolve({ error: { message: "tx update failed" } });
          }
        },
      };
      return chain;
    });

    await expect(
      linkReceiptToTransaction("r-1", "t-1", "https://example.com/img.jpg")
    ).rejects.toThrow("Failed to update transaction: tx update failed");
  });
});
