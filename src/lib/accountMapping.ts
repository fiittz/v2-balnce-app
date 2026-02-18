/**
 * Account Mapping Engine
 * Maps auto-categorized transactions to Chart of Accounts entries
 */

import type { Database } from "@/integrations/supabase/types";

export type Account = Database["public"]["Tables"]["accounts"]["Row"];

export type AccountType =
  | "Income"
  | "Cost of Sales"
  | "Expense"
  | "VAT"
  | "Payroll"
  | "Fixed Assets"
  | "Current Assets"
  | "Current Liabilities"
  | "Equity"
  | "bank"; // Default from DB

export interface AccountSuggestion {
  account_name: string;
  account_code: string | null;
  account_type: AccountType;
  confidence: number;
}

// Map autocat categories to Chart of Accounts entries
// Format: { autocatCategory: { accountName, accountType, vatRateOverride? } }
const CATEGORY_TO_ACCOUNT_MAP: Record<
  string,
  {
    expense: { name: string; type: AccountType }[];
    income: { name: string; type: AccountType }[];
  }
> = {
  // === MATERIALS & SUPPLIES ===
  Materials: {
    expense: [
      { name: "Materials Purchased", type: "Cost of Sales" },
      { name: "Stock Purchases", type: "Cost of Sales" },
    ],
    income: [],
  },
  Tools: {
    expense: [
      { name: "Small Tools & Equipment", type: "Expense" },
      { name: "Tools & Machinery", type: "Fixed Assets" },
    ],
    income: [],
  },
  Equipment: {
    expense: [
      { name: "Computer Equipment", type: "Expense" },
      { name: "Office Equipment", type: "Fixed Assets" },
    ],
    income: [],
  },

  // === MOTOR/TRAVEL ===
  "Motor/travel": {
    expense: [
      { name: "Motor – Fuel", type: "Expense" },
      { name: "Motor Tax & Insurance", type: "Expense" },
    ],
    income: [],
  },
  Fuel: {
    expense: [{ name: "Motor – Fuel", type: "Expense" }],
    income: [],
  },
  "Motor Vehicle Expenses": {
    expense: [
      { name: "Motor – Fuel", type: "Expense" },
      { name: "Motor – Repairs", type: "Expense" },
    ],
    income: [],
  },
  "Repairs and Maintenance": {
    expense: [
      { name: "Repairs & Maintenance", type: "Expense" },
      { name: "Motor – Repairs", type: "Expense" },
    ],
    income: [],
  },
  "Tolls & Parking": {
    expense: [
      { name: "Motor Tax & Insurance", type: "Expense" },
      { name: "Travel & Subsistence", type: "Expense" },
    ],
    income: [],
  },
  Subsistence: {
    expense: [
      { name: "Travel & Subsistence", type: "Expense" },
      { name: "Accommodation", type: "Expense" },
    ],
    income: [],
  },

  // === SOFTWARE & TECH ===
  Software: {
    expense: [
      { name: "Software & Subscriptions", type: "Expense" },
      { name: "Computer Equipment", type: "Expense" },
    ],
    income: [],
  },
  Phone: {
    expense: [{ name: "Telephone & Internet", type: "Expense" }],
    income: [],
  },
  Marketing: {
    expense: [
      { name: "Website Hosting", type: "Expense" },
      { name: "Advertising", type: "Expense" },
    ],
    income: [],
  },

  // === PROFESSIONAL SERVICES ===
  "Consulting & Accounting": {
    expense: [
      { name: "Accountancy Fees", type: "Expense" },
      { name: "Consultancy Fees", type: "Expense" },
      { name: "Legal Fees", type: "Expense" },
    ],
    income: [],
  },
  Insurance: {
    expense: [{ name: "Insurance", type: "Expense" }],
    income: [],
  },

  // === BANK & FINANCE ===
  "Bank fees": {
    expense: [
      { name: "Bank Charges", type: "Expense" },
      { name: "Merchant Fees", type: "Expense" },
    ],
    income: [],
  },
  "Bank Fees": {
    expense: [
      { name: "Bank Charges", type: "Expense" },
      { name: "Merchant Fees", type: "Expense" },
    ],
    income: [],
  },

  // === LABOUR & WAGES ===
  "Labour costs": {
    expense: [
      { name: "Subcontractors", type: "Cost of Sales" },
      { name: "Direct Wages", type: "Cost of Sales" },
    ],
    income: [],
  },
  "Sub Con": {
    expense: [{ name: "Subcontractors", type: "Cost of Sales" }],
    income: [],
  },
  Wages: {
    expense: [
      { name: "Wages & Salaries", type: "Expense" },
      { name: "Employer PRSI", type: "Expense" },
    ],
    income: [],
  },

  // === OFFICE & GENERAL ===
  Office: {
    expense: [
      { name: "Office Supplies", type: "Expense" },
      { name: "Printing & Stationery", type: "Expense" },
    ],
    income: [],
  },
  Rent: {
    expense: [{ name: "Rent", type: "Expense" }],
    income: [],
  },
  Cleaning: {
    expense: [{ name: "Cleaning", type: "Expense" }],
    income: [],
  },
  Training: {
    expense: [{ name: "Staff Training", type: "Expense" }],
    income: [],
  },
  Workwear: {
    expense: [
      { name: "PPE / Protective Gear", type: "Expense" },
      { name: "Uniforms", type: "Expense" },
    ],
    income: [],
  },
  Advertising: {
    expense: [
      { name: "Advertising", type: "Expense" },
      { name: "Social Media Ads", type: "Expense" },
    ],
    income: [],
  },
  "General Expenses": {
    expense: [{ name: "General Expenses", type: "Expense" }],
    income: [],
  },
  other: {
    expense: [{ name: "General Expenses", type: "Expense" }],
    income: [{ name: "Other Income", type: "Income" }],
  },
  Drawings: {
    expense: [{ name: "Owner's Drawings", type: "Equity" }],
    income: [],
  },
  Medical: {
    expense: [{ name: "General Expenses", type: "Expense" }],
    income: [],
  },

  // === INTERNAL TRANSFERS ===
  "Internal Transfer": {
    expense: [{ name: "Internal Transfers", type: "Current Assets" }],
    income: [{ name: "Internal Transfers", type: "Current Assets" }],
  },

  // === INCOME CATEGORIES ===
  Sales: {
    expense: [],
    income: [
      { name: "Sales Ireland 23%", type: "Income" },
      { name: "Other Income", type: "Income" },
    ],
  },
  RCT: {
    expense: [],
    income: [{ name: "Sales Ireland 13.5%", type: "Income" }],
  },
  "Interest Income": {
    expense: [],
    income: [{ name: "Other Income", type: "Income" }],
  },
  "Subscription Income": {
    expense: [],
    income: [{ name: "Sales Ireland 23%", type: "Income" }],
  },
};

// VAT rate to income account mapping
const VAT_RATE_TO_INCOME_ACCOUNT: Record<string, string> = {
  "Standard 23%": "Sales Ireland 23%",
  standard_23: "Sales Ireland 23%",
  "Reduced 13.5%": "Sales Ireland 13.5%",
  reduced_13_5: "Sales Ireland 13.5%",
  "Second Reduced 9%": "Sales Ireland 9%",
  second_reduced_9: "Sales Ireland 9%",
  Zero: "Zero Rated Sales",
  zero_rated: "Zero Rated Sales",
  Exempt: "Exempt Sales",
  exempt: "Exempt Sales",
  "Reverse Charge": "Sales Ireland 13.5%", // RCT income
};

/**
 * Find the best matching account from the user's Chart of Accounts
 */
export function findMatchingAccount(
  autocatCategory: string,
  transactionType: "income" | "expense",
  vatRate: string | undefined,
  accounts: Account[],
): Account | null {
  // For income, try VAT rate mapping first
  if (transactionType === "income" && vatRate) {
    const vatAccountName = VAT_RATE_TO_INCOME_ACCOUNT[vatRate];
    if (vatAccountName) {
      const vatAccount = accounts.find((a) => a.name.toLowerCase() === vatAccountName.toLowerCase());
      if (vatAccount) return vatAccount;
    }
  }

  // Get mapping for this category
  const mapping = CATEGORY_TO_ACCOUNT_MAP[autocatCategory];
  if (!mapping) {
    // Try case-insensitive lookup
    const lowerCategory = autocatCategory.toLowerCase();
    for (const [key, value] of Object.entries(CATEGORY_TO_ACCOUNT_MAP)) {
      if (key.toLowerCase() === lowerCategory) {
        const candidates = transactionType === "income" ? value.income : value.expense;
        for (const candidate of candidates) {
          const match = accounts.find(
            (a) => a.name.toLowerCase() === candidate.name.toLowerCase() && a.account_type === candidate.type,
          );
          if (match) return match;
        }
      }
    }
    return null;
  }

  // Get candidates for the transaction type
  const candidates = transactionType === "income" ? mapping.income : mapping.expense;

  // Find first matching account
  for (const candidate of candidates) {
    const match = accounts.find(
      (a) => a.name.toLowerCase() === candidate.name.toLowerCase() && a.account_type === candidate.type,
    );
    if (match) return match;
  }

  // Fallback: try partial name matching
  for (const candidate of candidates) {
    const partialMatch = accounts.find(
      (a) =>
        (a.name.toLowerCase().includes(candidate.name.toLowerCase().split(" ")[0]) ||
          candidate.name.toLowerCase().includes(a.name.toLowerCase().split(" ")[0])) &&
        a.account_type === candidate.type,
    );
    if (partialMatch) return partialMatch;
  }

  return null;
}

/**
 * Get account suggestion from autocat result
 */
export function getAccountSuggestion(
  autocatCategory: string,
  transactionType: "income" | "expense",
  vatRate: string | undefined,
): AccountSuggestion | null {
  // For income, use VAT rate mapping
  if (transactionType === "income" && vatRate) {
    const accountName = VAT_RATE_TO_INCOME_ACCOUNT[vatRate];
    if (accountName) {
      return {
        account_name: accountName,
        account_code: null,
        account_type: "Income",
        confidence: 85,
      };
    }
  }

  // Get mapping for this category
  const mapping = CATEGORY_TO_ACCOUNT_MAP[autocatCategory];
  if (!mapping) return null;

  const candidates = transactionType === "income" ? mapping.income : mapping.expense;
  if (candidates.length === 0) return null;

  const first = candidates[0];
  return {
    account_name: first.name,
    account_code: null,
    account_type: first.type,
    confidence: 80,
  };
}

/**
 * Get default account for transaction type (fallback)
 */
export function getDefaultAccount(transactionType: "income" | "expense", accounts: Account[]): Account | null {
  if (transactionType === "income") {
    return (
      accounts.find((a) => a.name === "Other Income" && a.account_type === "Income") ||
      accounts.find((a) => a.account_type === "Income") ||
      null
    );
  } else {
    return (
      accounts.find((a) => a.name === "General Expenses" && a.account_type === "Expense") ||
      accounts.find((a) => a.account_type === "Expense") ||
      null
    );
  }
}
