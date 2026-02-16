import { describe, it, expect } from "vitest";
import {
  findMatchingAccount,
  getAccountSuggestion,
  getDefaultAccount,
  type Account,
} from "../accountMapping";

// ── Helper: build a mock Account row ─────────────────────────
function mockAccount(name: string, account_type: string, id = "acc-" + name.toLowerCase().replace(/\s+/g, "-")): Account {
  return {
    id,
    name,
    account_type,
    user_id: "user-1",
    account_number: null,
    balance: null,
    bic: null,
    created_at: null,
    currency: null,
    iban: null,
    is_default: null,
    sort_code: null,
    updated_at: null,
  };
}

// ── Shared test accounts ─────────────────────────────────────
const accounts: Account[] = [
  mockAccount("Materials Purchased", "Cost of Sales"),
  mockAccount("Stock Purchases", "Cost of Sales"),
  mockAccount("Small Tools & Equipment", "Expense"),
  mockAccount("Motor – Fuel", "Expense"),
  mockAccount("Motor Tax & Insurance", "Expense"),
  mockAccount("Software & Subscriptions", "Expense"),
  mockAccount("Telephone & Internet", "Expense"),
  mockAccount("Accountancy Fees", "Expense"),
  mockAccount("Bank Charges", "Expense"),
  mockAccount("Insurance", "Expense"),
  mockAccount("Subcontractors", "Cost of Sales"),
  mockAccount("Travel & Subsistence", "Expense"),
  mockAccount("General Expenses", "Expense"),
  mockAccount("Owner's Drawings", "Equity"),
  mockAccount("Sales Ireland 23%", "Income"),
  mockAccount("Sales Ireland 13.5%", "Income"),
  mockAccount("Zero Rated Sales", "Income"),
  mockAccount("Exempt Sales", "Income"),
  mockAccount("Other Income", "Income"),
  mockAccount("Internal Transfers", "Current Assets"),
];

// ══════════════════════════════════════════════════════════════
// findMatchingAccount — exact match
// ══════════════════════════════════════════════════════════════
describe("findMatchingAccount — exact match", () => {
  it("matches Materials → Materials Purchased (Cost of Sales)", () => {
    const result = findMatchingAccount("Materials", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Materials Purchased");
    expect(result!.account_type).toBe("Cost of Sales");
  });

  it("matches Tools → Small Tools & Equipment", () => {
    const result = findMatchingAccount("Tools", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Small Tools & Equipment");
  });

  it("matches Fuel → Motor – Fuel", () => {
    const result = findMatchingAccount("Fuel", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Motor – Fuel");
  });

  it("matches Software → Software & Subscriptions", () => {
    const result = findMatchingAccount("Software", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Software & Subscriptions");
  });

  it("matches Phone → Telephone & Internet", () => {
    const result = findMatchingAccount("Phone", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Telephone & Internet");
  });

  it("matches Bank Fees → Bank Charges", () => {
    const result = findMatchingAccount("Bank Fees", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Bank Charges");
  });

  it("matches Consulting & Accounting → Accountancy Fees", () => {
    const result = findMatchingAccount("Consulting & Accounting", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Accountancy Fees");
  });

  it("matches Labour costs → Subcontractors", () => {
    const result = findMatchingAccount("Labour costs", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Subcontractors");
  });

  it("matches Subsistence → Travel & Subsistence", () => {
    const result = findMatchingAccount("Subsistence", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Travel & Subsistence");
  });

  it("matches Drawings → Owner's Drawings", () => {
    const result = findMatchingAccount("Drawings", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Owner's Drawings");
    expect(result!.account_type).toBe("Equity");
  });

  it("matches Internal Transfer → Internal Transfers", () => {
    const result = findMatchingAccount("Internal Transfer", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Internal Transfers");
  });

  it("matches other expense → General Expenses", () => {
    const result = findMatchingAccount("other", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("General Expenses");
  });
});

// ══════════════════════════════════════════════════════════════
// findMatchingAccount — VAT rate income mapping
// ══════════════════════════════════════════════════════════════
describe("findMatchingAccount — income VAT rate mapping", () => {
  it("maps standard_23 income → Sales Ireland 23%", () => {
    const result = findMatchingAccount("Sales", "income", "standard_23", accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Sales Ireland 23%");
  });

  it("maps reduced_13_5 income → Sales Ireland 13.5%", () => {
    const result = findMatchingAccount("Sales", "income", "reduced_13_5", accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Sales Ireland 13.5%");
  });

  it("maps zero_rated income → Zero Rated Sales", () => {
    const result = findMatchingAccount("Sales", "income", "zero_rated", accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Zero Rated Sales");
  });

  it("maps exempt income → Exempt Sales", () => {
    const result = findMatchingAccount("Sales", "income", "exempt", accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Exempt Sales");
  });

  it("maps Standard 23% (label format) → Sales Ireland 23%", () => {
    const result = findMatchingAccount("Sales", "income", "Standard 23%", accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Sales Ireland 23%");
  });
});

// ══════════════════════════════════════════════════════════════
// findMatchingAccount — case-insensitive lookup
// ══════════════════════════════════════════════════════════════
describe("findMatchingAccount — case-insensitive", () => {
  it("matches 'materials' (lowercase) via case-insensitive lookup", () => {
    const result = findMatchingAccount("materials", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Materials Purchased");
  });

  it("matches 'BANK FEES' (uppercase) via case-insensitive lookup", () => {
    const result = findMatchingAccount("BANK FEES", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Bank Charges");
  });
});

// ══════════════════════════════════════════════════════════════
// findMatchingAccount — null / no match
// ══════════════════════════════════════════════════════════════
describe("findMatchingAccount — no match", () => {
  it("returns null for unknown category", () => {
    const result = findMatchingAccount("NonExistentXYZ", "expense", undefined, accounts);
    expect(result).toBeNull();
  });

  it("returns null for empty accounts array", () => {
    const result = findMatchingAccount("Materials", "expense", undefined, []);
    expect(result).toBeNull();
  });

  it("returns null when matching account type is missing from accounts", () => {
    // Only have Income accounts, looking for expense
    const incomeOnly = [mockAccount("Sales Ireland 23%", "Income")];
    const result = findMatchingAccount("Materials", "expense", undefined, incomeOnly);
    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// findMatchingAccount — partial matching
// ══════════════════════════════════════════════════════════════
describe("findMatchingAccount — partial matching", () => {
  it("falls back to partial name match when exact doesn't exist", () => {
    // "Motor/travel" maps to ["Motor – Fuel", "Motor Tax & Insurance"]
    // Exact match on "Motor – Fuel" should work
    const result = findMatchingAccount("Motor/travel", "expense", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Motor – Fuel");
  });
});

// ══════════════════════════════════════════════════════════════
// getDefaultAccount
// ══════════════════════════════════════════════════════════════
describe("getDefaultAccount", () => {
  it("returns Other Income for income type", () => {
    const result = getDefaultAccount("income", accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Other Income");
    expect(result!.account_type).toBe("Income");
  });

  it("returns General Expenses for expense type", () => {
    const result = getDefaultAccount("expense", accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("General Expenses");
    expect(result!.account_type).toBe("Expense");
  });

  it("falls back to any Income account if Other Income missing", () => {
    const noOtherIncome = accounts.filter((a) => a.name !== "Other Income");
    const result = getDefaultAccount("income", noOtherIncome);
    expect(result).not.toBeNull();
    expect(result!.account_type).toBe("Income");
  });

  it("falls back to any Expense account if General Expenses missing", () => {
    const noGeneral = accounts.filter((a) => a.name !== "General Expenses");
    const result = getDefaultAccount("expense", noGeneral);
    expect(result).not.toBeNull();
    expect(result!.account_type).toBe("Expense");
  });

  it("returns null for income when no Income accounts exist", () => {
    const expenseOnly = accounts.filter((a) => a.account_type === "Expense");
    const result = getDefaultAccount("income", expenseOnly);
    expect(result).toBeNull();
  });

  it("returns null for expense when no Expense accounts exist", () => {
    const incomeOnly = accounts.filter((a) => a.account_type === "Income");
    const result = getDefaultAccount("expense", incomeOnly);
    expect(result).toBeNull();
  });

  it("returns null for empty accounts", () => {
    expect(getDefaultAccount("income", [])).toBeNull();
    expect(getDefaultAccount("expense", [])).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// getAccountSuggestion
// ══════════════════════════════════════════════════════════════
describe("getAccountSuggestion", () => {
  it("suggests Materials Purchased for Materials expense", () => {
    const result = getAccountSuggestion("Materials", "expense", undefined);
    expect(result).not.toBeNull();
    expect(result!.account_name).toBe("Materials Purchased");
    expect(result!.account_type).toBe("Cost of Sales");
  });

  it("suggests Motor – Fuel for Fuel expense", () => {
    const result = getAccountSuggestion("Fuel", "expense", undefined);
    expect(result!.account_name).toBe("Motor – Fuel");
  });

  it("suggests Software & Subscriptions for Software expense", () => {
    const result = getAccountSuggestion("Software", "expense", undefined);
    expect(result!.account_name).toBe("Software & Subscriptions");
  });

  it("suggests Bank Charges for Bank Fees expense", () => {
    const result = getAccountSuggestion("Bank Fees", "expense", undefined);
    expect(result!.account_name).toBe("Bank Charges");
  });

  it("suggests Subcontractors for Labour costs expense", () => {
    const result = getAccountSuggestion("Labour costs", "expense", undefined);
    expect(result!.account_name).toBe("Subcontractors");
    expect(result!.account_type).toBe("Cost of Sales");
  });

  it("suggests General Expenses for 'other' expense", () => {
    const result = getAccountSuggestion("other", "expense", undefined);
    expect(result!.account_name).toBe("General Expenses");
  });

  it("suggests Owner's Drawings for Drawings expense", () => {
    const result = getAccountSuggestion("Drawings", "expense", undefined);
    expect(result!.account_name).toBe("Owner's Drawings");
    expect(result!.account_type).toBe("Equity");
  });

  it("suggests Sales Ireland 23% for income with standard_23 VAT", () => {
    const result = getAccountSuggestion("Sales", "income", "standard_23");
    expect(result!.account_name).toBe("Sales Ireland 23%");
    expect(result!.account_type).toBe("Income");
    expect(result!.confidence).toBe(85);
  });

  it("suggests Zero Rated Sales for income with zero_rated VAT", () => {
    const result = getAccountSuggestion("Sales", "income", "zero_rated");
    expect(result!.account_name).toBe("Zero Rated Sales");
  });

  it("returns null for unknown category", () => {
    expect(getAccountSuggestion("NonExistent123", "expense", undefined)).toBeNull();
  });

  it("returns null for expense category with no expense mappings", () => {
    expect(getAccountSuggestion("Sales", "expense", undefined)).toBeNull();
  });

  it("returns confidence 80 for category-based", () => {
    expect(getAccountSuggestion("Materials", "expense", undefined)!.confidence).toBe(80);
  });

  it("returns confidence 85 for VAT-based income", () => {
    expect(getAccountSuggestion("Sales", "income", "standard_23")!.confidence).toBe(85);
  });
});

// ══════════════════════════════════════════════════════════════
// findMatchingAccount — partial name matching fallback (lines 350-356)
// ══════════════════════════════════════════════════════════════
describe("findMatchingAccount — partial match fallback", () => {
  it("falls back to partial match when exact account name is missing", () => {
    // Create accounts that only partially match the mapping candidates
    const partialAccounts = [
      mockAccount("Motor Expenses", "Expense"),
    ];
    // "Motor/travel" maps to ["Motor – Fuel", "Motor Tax & Insurance"]
    // Neither exact match exists, but "Motor" is the first word of the candidate name
    // and "Motor Expenses" contains "Motor"
    const result = findMatchingAccount("Motor/travel", "expense", undefined, partialAccounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Motor Expenses");
  });
});

// ══════════════════════════════════════════════════════════════
// getAccountSuggestion — income with no VAT rate (line 373)
// ══════════════════════════════════════════════════════════════
describe("getAccountSuggestion — income without VAT rate", () => {
  it("returns category-based suggestion for income without VAT rate", () => {
    const result = getAccountSuggestion("Sales", "income", undefined);
    expect(result).not.toBeNull();
    expect(result!.account_name).toBe("Sales Ireland 23%");
    expect(result!.confidence).toBe(80);
  });

  it("returns null for income with unknown VAT rate and no category mapping", () => {
    const result = getAccountSuggestion("NonExistent123", "income", "unknown_vat");
    expect(result).toBeNull();
  });

  it("returns null for income with empty candidates", () => {
    // RCT has no expense mapping but has income mapping
    const result = getAccountSuggestion("RCT", "expense", undefined);
    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// findMatchingAccount — case-insensitive category with account type
// ══════════════════════════════════════════════════════════════
describe("findMatchingAccount — case-insensitive income lookup", () => {
  it("matches income category case-insensitively", () => {
    const result = findMatchingAccount("sales", "income", undefined, accounts);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Sales Ireland 23%");
  });
});

// ══════════════════════════════════════════════════════════════
// findMatchingAccount — VAT rate income mapping fallthrough (lines 309-313)
// ══════════════════════════════════════════════════════════════
describe("findMatchingAccount — VAT rate mapping miss then category fallback", () => {
  it("falls through VAT rate mapping when account not in user's list", () => {
    // Only have "General Expenses" — no income accounts at all
    const noIncomeAccounts = [mockAccount("General Expenses", "Expense")];
    const result = findMatchingAccount("Sales", "income", "standard_23", noIncomeAccounts);
    // vatAccountName = "Sales Ireland 23%" but it's not in noIncomeAccounts
    // Then falls to category mapping, but no matching account exists
    expect(result).toBeNull();
  });

  it("returns category-mapped income when VAT rate account is missing", () => {
    // Has "Other Income" but not "Sales Ireland 23%"
    const limitedAccounts = [mockAccount("Other Income", "Income")];
    const result = findMatchingAccount("other", "income", "unknown_vat_rate", limitedAccounts);
    // VAT rate lookup fails (unknown rate), falls to category mapping for "other"
    // "other" income candidates: [{ name: "Other Income", type: "Income" }]
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Other Income");
  });
});
