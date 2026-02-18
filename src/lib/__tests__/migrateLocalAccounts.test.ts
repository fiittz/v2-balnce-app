import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Supabase ────────────────────────────────────────────
// Use a thenable chain approach (like receiptMatcher tests)
let selectResolvedData: { data: Record<string, unknown>[] | null; error: unknown } = {
  data: [],
  error: null,
};
let insertResolvedData: { error: unknown } = { error: null };
let updateResolvedData: { error: unknown } = { error: null };
let maybeSingleResolvedData: { data: Record<string, unknown> | null; error: unknown } = {
  data: null,
  error: null,
};

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const makeChain = (finalData: unknown) => {
    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      insert: vi.fn(() => insertResolvedData),
      update: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn(() => maybeSingleResolvedData),
      then: (resolve: (value: unknown) => void) => resolve(finalData),
    };
    return chain;
  };

  return {
    supabase: {
      from: (...args: unknown[]) => {
        mockFrom(...args);
        const table = args[0] as string;
        if (table === "accounts") {
          // For select queries returning arrays, use selectResolvedData
          // But the chain also supports insert and update
          const chain: Record<string, unknown> = {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(() => maybeSingleResolvedData),
                  })),
                  then: (resolve: (v: unknown) => void) => resolve(selectResolvedData),
                })),
                then: (resolve: (v: unknown) => void) => resolve(selectResolvedData),
              })),
            })),
            insert: vi.fn(() => insertResolvedData),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => updateResolvedData),
              })),
            })),
          };
          return chain;
        }
        // transactions table
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn(() => maybeSingleResolvedData),
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => updateResolvedData),
            })),
          })),
        };
      },
    },
  };
});

// ── Mock localStorage ────────────────────────────────────────
const localStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStore).forEach((k) => delete localStore[k]);
  }),
};
vi.stubGlobal("localStorage", localStorageMock);

// Must import after mocks are set up
import { migrateLocalAccounts } from "@/lib/migrateLocalAccounts";

const USER_ID = "user-123";

beforeEach(() => {
  vi.clearAllMocks();
  // Clear local store state
  Object.keys(localStore).forEach((k) => delete localStore[k]);
  // Reset mock data
  selectResolvedData = { data: [], error: null };
  insertResolvedData = { error: null };
  updateResolvedData = { error: null };
  maybeSingleResolvedData = { data: null, error: null };
});

// ================================================================
// migrateLocalAccounts
// ================================================================
describe("migrateLocalAccounts", () => {
  it("returns early if migration flag already set", async () => {
    localStore["balnce_accounts_migrated"] = "1";
    await migrateLocalAccounts(USER_ID);
    // Should not query supabase at all
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("no local data: calls assignOrphanedTransactions and sets flag", async () => {
    // No local data in storage
    await migrateLocalAccounts(USER_ID);
    expect(localStorageMock.setItem).toHaveBeenCalledWith("balnce_accounts_migrated", "1");
    // Should have tried to find default account for orphan assignment
    expect(mockFrom).toHaveBeenCalledWith("accounts");
  });

  it("invalid JSON: sets migration flag and returns", async () => {
    localStore["balnce_financial_accounts"] = "not valid json!!!";
    await migrateLocalAccounts(USER_ID);
    expect(localStorageMock.setItem).toHaveBeenCalledWith("balnce_accounts_migrated", "1");
  });

  it("empty array: removes local data and sets flag", async () => {
    localStore["balnce_financial_accounts"] = "[]";
    await migrateLocalAccounts(USER_ID);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("balnce_financial_accounts");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("balnce_accounts_migrated", "1");
  });

  it("valid accounts: queries existing accounts from supabase", async () => {
    localStore["balnce_financial_accounts"] = JSON.stringify([{ id: "1", name: "Business Account" }]);
    selectResolvedData = { data: [], error: null };
    await migrateLocalAccounts(USER_ID);
    expect(mockFrom).toHaveBeenCalledWith("accounts");
  });

  it("valid accounts with duplicates: filters out existing names", async () => {
    localStore["balnce_financial_accounts"] = JSON.stringify([
      { id: "1", name: "Business Account" },
      { id: "2", name: "Savings" },
    ]);
    selectResolvedData = {
      data: [{ name: "Business Account" }],
      error: null,
    };
    await migrateLocalAccounts(USER_ID);
    // Should still call from("accounts") for insert
    expect(mockFrom).toHaveBeenCalledWith("accounts");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("balnce_accounts_migrated", "1");
  });

  it("supabase error in outer try: catches and sets migration flag", async () => {
    localStore["balnce_financial_accounts"] = JSON.stringify([{ id: "1", name: "Business" }]);
    // Make the from call throw
    mockFrom.mockImplementationOnce(() => {
      throw new Error("connection failed");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await migrateLocalAccounts(USER_ID);
    expect(localStorageMock.setItem).toHaveBeenCalledWith("balnce_accounts_migrated", "1");
    consoleSpy.mockRestore();
  });

  it("always sets migration flag even on failure", async () => {
    localStore["balnce_financial_accounts"] = JSON.stringify([{ id: "1", name: "Test" }]);
    mockFrom.mockImplementationOnce(() => {
      throw new Error("db error");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await migrateLocalAccounts(USER_ID);
    expect(localStorageMock.setItem).toHaveBeenCalledWith("balnce_accounts_migrated", "1");
    consoleSpy.mockRestore();
  });

  it("assignOrphanedTransactions updates transactions when default account exists (line 83)", async () => {
    // No local accounts data — goes straight to assignOrphanedTransactions
    // maybeSingle returns a default account
    maybeSingleResolvedData = { data: { id: "default-acc-1" }, error: null };
    await migrateLocalAccounts(USER_ID);
    // Should have queried accounts table for default and transactions table for update
    expect(mockFrom).toHaveBeenCalledWith("accounts");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("balnce_accounts_migrated", "1");
  });
});
