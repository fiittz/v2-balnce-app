import { describe, it, expect, vi } from "vitest";
import {
  PAGE_ROUTES,
  ROUTE_LABELS,
  getPageLabel,
  TOOL_DEFINITIONS,
  executeToolCall,
  type ToolContext,
} from "../chatTools";

// ── Helper: build a minimal ToolContext ────────────────────────
function makeCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    ct1: {
      detectedIncome: [{ category: "Sales", amount: 100000 }],
      expenseByCategory: [
        { category: "Materials", amount: 30000 },
        { category: "Fuel", amount: 5000 },
      ],
      expenseSummary: { allowable: 35000, disallowed: 2000, total: 37000 },
      vehicleAsset: null,
      directorsLoanTravel: 0,
      travelAllowance: 0,
      rctPrepayment: 0,
      isConstructionTrade: false,
      vatPosition: null,
      flaggedCapitalItems: [],
    } as unknown as ToolContext["ct1"],
    savedCT1: null,
    taxYear: 2025,
    navigate: vi.fn(),
    directorData: null,
    transactionCount: 50,
    invoiceCount: 10,
    transactions: [],
    invoices: [],
    incorporationDate: null,
    allForm11Data: [],
    ...overrides,
  };
}

// ================================================================
// 1 – PAGE_ROUTES
// ================================================================
describe("PAGE_ROUTES", () => {
  const expectedPages = [
    "dashboard",
    "bank",
    "invoices",
    "vat",
    "rct",
    "tax",
    "ct1",
    "form11",
    "balance_sheet",
    "reliefs",
    "trips",
    "pnl",
    "aged_debtors",
    "reports",
    "accounts",
    "settings",
  ];

  it("contains all expected page keys", () => {
    for (const key of expectedPages) {
      expect(PAGE_ROUTES).toHaveProperty(key);
    }
  });

  it("every entry has a path starting with /", () => {
    for (const [, value] of Object.entries(PAGE_ROUTES)) {
      expect(value.path).toMatch(/^\//);
    }
  });

  it("every entry has a non-empty label", () => {
    for (const [, value] of Object.entries(PAGE_ROUTES)) {
      expect(value.label.length).toBeGreaterThan(0);
    }
  });
});

// ================================================================
// 2 & 3 & 4 & 5 – getPageLabel
// ================================================================
describe("getPageLabel", () => {
  it("returns correct label for known paths", () => {
    expect(getPageLabel("/dashboard")).toBe("Dashboard");
    expect(getPageLabel("/bank")).toBe("Bank Feed — imported transactions");
    expect(getPageLabel("/tax/ct1")).toBe("CT1 Corporation Tax Return");
    expect(getPageLabel("/settings")).toBe("Settings");
  });

  it("returns Form 11 label with director number for /tax/form11/:num", () => {
    expect(getPageLabel("/tax/form11/2")).toBe(
      "Form 11 Income Tax Return — Director 2"
    );
    expect(getPageLabel("/tax/form11/99")).toBe(
      "Form 11 Income Tax Return — Director 99"
    );
  });

  it('returns "Account Detail" for /accounts/:id paths', () => {
    expect(getPageLabel("/accounts/abc123")).toBe("Account Detail");
    expect(getPageLabel("/accounts/some-account")).toBe("Account Detail");
  });

  it('returns "the app" for unknown paths', () => {
    expect(getPageLabel("/unknown")).toBe("the app");
    expect(getPageLabel("/foo/bar/baz")).toBe("the app");
  });
});

// ================================================================
// 6 – TOOL_DEFINITIONS
// ================================================================
describe("TOOL_DEFINITIONS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(TOOL_DEFINITIONS)).toBe(true);
    expect(TOOL_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it("every definition has type 'function'", () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(def.type).toBe("function");
    }
  });

  it("every definition has a function with name, description, and parameters", () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(def.function).toBeDefined();
      expect(typeof def.function.name).toBe("string");
      expect(def.function.name.length).toBeGreaterThan(0);
      expect(typeof def.function.description).toBe("string");
      expect(def.function.parameters).toBeDefined();
    }
  });

  it("contains the expected tool names", () => {
    const names = TOOL_DEFINITIONS.map((d) => d.function.name);
    expect(names).toContain("navigate_to_page");
    expect(names).toContain("show_tax_summary");
    expect(names).toContain("show_expense_breakdown");
    expect(names).toContain("calculate_pension_savings");
    expect(names).toContain("show_tax_deadlines");
    expect(names).toContain("what_if_buy_van");
    expect(names).toContain("what_if_hire_employee");
    expect(names).toContain("what_if_salary_vs_dividend");
    expect(names).toContain("search_transactions");
    expect(names).toContain("show_chart");
    expect(names).toContain("run_company_health_check");
    expect(names).toContain("run_director_health_check");
  });
});

// ================================================================
// 7 & 8 – navigate_to_page
// ================================================================
describe("executeToolCall — navigate_to_page", () => {
  it("calls navigate and returns navigated: true for a known page", () => {
    const ctx = makeCtx();
    const result = executeToolCall(
      "navigate_to_page",
      { page: "dashboard" },
      ctx
    );
    expect(ctx.navigate).toHaveBeenCalledWith("/dashboard");
    expect(result.navigated).toBe(true);
    expect(result.result).toContain("Dashboard");
  });

  it("returns an error string for an unknown page", () => {
    const ctx = makeCtx();
    const result = executeToolCall(
      "navigate_to_page",
      { page: "nonexistent_page" },
      ctx
    );
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(result.result).toContain("Unknown page");
    expect(result.navigated).toBeUndefined();
  });
});

// ================================================================
// 9 – show_tax_summary
// ================================================================
describe("executeToolCall — show_tax_summary", () => {
  it("returns a markdown table with CT1 data", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall("show_tax_summary", {}, ctx);

    // Should contain a markdown table
    expect(result).toContain("| Line | Amount |");
    expect(result).toContain("Total Income");
    expect(result).toContain("Allowable Expenses");
    expect(result).toContain("Trading Profit");
    expect(result).toContain("Taxable Profit");
    expect(result).toContain("CT @ 12.5%");
    expect(result).toContain("Total CT Liability");
    // Income = 100,000, expenses = 35,000, trading profit = 65,000
    // CT = 65000 * 0.125 = 8125
    expect(result).toContain("Balance Due");
  });

  it("includes sources footer when there are transactions", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall("show_tax_summary", {}, ctx);
    expect(result).toContain("Sources");
    expect(result).toContain("50 bank transactions");
  });

  it("shows RCT credit line when rctPrepayment > 0", () => {
    const ctx = makeCtx({
      ct1: {
        detectedIncome: [{ category: "Sales", amount: 100000 }],
        expenseByCategory: [{ category: "Materials", amount: 30000 }],
        expenseSummary: { allowable: 30000, disallowed: 0, total: 30000 },
        vehicleAsset: null,
        directorsLoanTravel: 0,
        travelAllowance: 0,
        rctPrepayment: 5000,
        isConstructionTrade: true,
        vatPosition: null,
        flaggedCapitalItems: [],
      } as unknown as ToolContext["ct1"],
    });
    const { result } = executeToolCall("show_tax_summary", {}, ctx);
    expect(result).toContain("RCT Credit");
  });
});

// ================================================================
// 10 & 11 – show_expense_breakdown
// ================================================================
describe("executeToolCall — show_expense_breakdown", () => {
  it("returns categories sorted by amount (highest first)", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall("show_expense_breakdown", {}, ctx);

    expect(result).toContain("| Category | Amount | % |");
    // Materials (30000) should appear before Fuel (5000)
    const materialsPos = result.indexOf("Materials");
    const fuelPos = result.indexOf("Fuel");
    expect(materialsPos).toBeLessThan(fuelPos);
    expect(result).toContain("Total");
  });

  it("respects a custom limit", () => {
    const ctx = makeCtx({
      ct1: {
        detectedIncome: [{ category: "Sales", amount: 100000 }],
        expenseByCategory: [
          { category: "Materials", amount: 30000 },
          { category: "Fuel", amount: 5000 },
          { category: "Insurance", amount: 4000 },
          { category: "Rent", amount: 12000 },
          { category: "Phone", amount: 1000 },
        ],
        expenseSummary: { allowable: 52000, disallowed: 0, total: 52000 },
        vehicleAsset: null,
        directorsLoanTravel: 0,
        travelAllowance: 0,
        rctPrepayment: 0,
        isConstructionTrade: false,
        vatPosition: null,
        flaggedCapitalItems: [],
      } as unknown as ToolContext["ct1"],
    });
    const { result } = executeToolCall(
      "show_expense_breakdown",
      { limit: 2 },
      ctx
    );

    // Only top 2 categories (Materials, Rent) should appear as data rows
    // The table header, separator, 2 data rows, total row = 5 lines with "|"
    const dataRows = result
      .split("\n")
      .filter((l) => l.startsWith("|") && !l.includes("Category") && !l.includes("---") && !l.includes("Total"));
    expect(dataRows.length).toBe(2);
  });
});

// ================================================================
// 12 – calculate_pension_savings
// ================================================================
describe("executeToolCall — calculate_pension_savings", () => {
  it("returns before/after comparison with CT and personal savings", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall(
      "calculate_pension_savings",
      { amount: 20000 },
      ctx
    );

    expect(result).toContain("Employer pension contribution");
    expect(result).toContain("Before");
    expect(result).toContain("After");
    expect(result).toContain("Saving");
    expect(result).toContain("Corporation Tax (12.5%)");
    expect(result).toContain("Director personal tax avoided");
    expect(result).toContain("Combined tax saving");
    // Personal saving = 20000 * 0.492 = 9840
    expect(result).toContain("pension fund");
  });
});

// ================================================================
// 13 – show_tax_deadlines
// ================================================================
describe("executeToolCall — show_tax_deadlines", () => {
  it("returns a deadlines table with expected columns", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall("show_tax_deadlines", {}, ctx);

    expect(result).toContain("| Deadline | Date | Status | Description |");
    expect(result).toContain("CT1 filing deadline");
    expect(result).toContain("Form 11");
    expect(result).toContain("VAT3 returns");
    expect(result).toContain("RCT returns");
    expect(result).toContain("Recurring");
    expect(result).toContain("Ongoing");
  });
});

// ================================================================
// 14 – what_if_buy_van
// ================================================================
describe("executeToolCall — what_if_buy_van", () => {
  it("returns capital allowances table over 8 years", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall(
      "what_if_buy_van",
      { cost: 40000 },
      ctx
    );

    expect(result).toContain("buys a van");
    expect(result).toContain("12.5% per year");
    expect(result).toContain("| Year | Allowance | CT Saved | Net Book Value |");

    // 40000 * 0.125 = 5000 annual allowance
    // 5000 * 0.125 = 625 CT saved per year
    expect(result).toContain("Year 1");
    expect(result).toContain("Year 8");
    expect(result).toContain("Total");
    expect(result).toContain("Impact on");
    expect(result).toContain("Effective cost after full tax relief");
  });
});

// ================================================================
// 15 – what_if_hire_employee
// ================================================================
describe("executeToolCall — what_if_hire_employee", () => {
  it("returns cost breakdown with employer PRSI and CT impact", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall(
      "what_if_hire_employee",
      { salary: 40000 },
      ctx
    );

    expect(result).toContain("hire an employee");
    expect(result).toContain("Gross Salary");
    expect(result).toContain("Employer PRSI");
    expect(result).toContain("Total Cost");
    expect(result).toContain("Employee Receives");
    expect(result).toContain("PAYE");
    expect(result).toContain("USC");
    expect(result).toContain("CT Impact");
  });

  it("includes start-up relief note when company is young", () => {
    const ctx = makeCtx({ incorporationDate: "2024-01-01" });
    const { result } = executeToolCall(
      "what_if_hire_employee",
      { salary: 40000 },
      ctx
    );
    expect(result).toContain("Start-up Company Relief");
  });
});

// ================================================================
// 16 – what_if_salary_vs_dividend
// ================================================================
describe("executeToolCall — what_if_salary_vs_dividend", () => {
  it("returns 3-way comparison: salary vs dividend vs pension", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall(
      "what_if_salary_vs_dividend",
      { amount: 50000 },
      ctx
    );

    expect(result).toContain("Salary");
    expect(result).toContain("Dividend");
    expect(result).toContain("Employer Pension");
    expect(result).toContain("Corporation Tax");
    expect(result).toContain("Total Tax");
    expect(result).toContain("You Receive");
    expect(result).toContain("Most tax-efficient");
  });
});

// ================================================================
// 17 & 18 – search_transactions
// ================================================================
describe("executeToolCall — search_transactions", () => {
  it("returns matching transactions in a table", () => {
    const ctx = makeCtx({
      transactions: [
        {
          date: "2025-03-01",
          description: "ACME Timber Supplies",
          category: "Materials",
          amount: -250,
          type: "expense",
          vendor_name: "ACME",
        },
        {
          date: "2025-03-05",
          description: "Shell Fuel",
          category: "Fuel",
          amount: -80,
          type: "expense",
          vendor_name: "Shell",
        },
        {
          date: "2025-03-10",
          description: "Stripe Payment",
          category: "Sales",
          amount: 5000,
          type: "income",
          vendor_name: "Stripe",
        },
      ],
    });

    const { result } = executeToolCall(
      "search_transactions",
      { query: "timber" },
      ctx
    );

    expect(result).toContain('Found 1 transaction matching "timber"');
    expect(result).toContain("ACME Timber Supplies");
    expect(result).toContain("Materials");
    expect(result).toContain("| Date | Description | Category | Amount |");
  });

  it("matches on category", () => {
    const ctx = makeCtx({
      transactions: [
        {
          date: "2025-04-01",
          description: "Purchase XYZ",
          category: "Fuel",
          amount: -120,
          type: "expense",
          vendor_name: "",
        },
      ],
    });
    const { result } = executeToolCall(
      "search_transactions",
      { query: "fuel" },
      ctx
    );
    expect(result).toContain("Found 1 transaction");
  });

  it("matches on vendor_name", () => {
    const ctx = makeCtx({
      transactions: [
        {
          date: "2025-04-01",
          description: "Payment",
          category: "Materials",
          amount: -500,
          type: "expense",
          vendor_name: "ToolStation",
        },
      ],
    });
    const { result } = executeToolCall(
      "search_transactions",
      { query: "toolstation" },
      ctx
    );
    expect(result).toContain("Found 1 transaction");
  });

  it("returns not-found message when no transactions match", () => {
    const ctx = makeCtx({
      transactions: [
        {
          date: "2025-01-01",
          description: "Unrelated",
          category: "Other",
          amount: -10,
          type: "expense",
          vendor_name: "",
        },
      ],
    });
    const { result } = executeToolCall(
      "search_transactions",
      { query: "nonexistent" },
      ctx
    );
    expect(result).toContain('No transactions found matching "nonexistent"');
  });
});

// ================================================================
// 19 & 20 – show_chart
// ================================================================
describe("executeToolCall — show_chart", () => {
  it("returns chart JSON for expenses_pie", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall(
      "show_chart",
      { chart_type: "expenses_pie" },
      ctx
    );

    expect(result).toContain("```chart");
    const jsonStr = result.match(/```chart\n([\s\S]+?)\n```/)?.[1];
    expect(jsonStr).toBeDefined();
    const chart = JSON.parse(jsonStr!);
    expect(chart.type).toBe("pie");
    expect(chart.title).toBe("Expenses by Category");
    expect(Array.isArray(chart.data)).toBe(true);
    expect(chart.data.length).toBeGreaterThan(0);
  });

  it("returns chart JSON for expenses_bar", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall(
      "show_chart",
      { chart_type: "expenses_bar" },
      ctx
    );

    const jsonStr = result.match(/```chart\n([\s\S]+?)\n```/)?.[1];
    const chart = JSON.parse(jsonStr!);
    expect(chart.type).toBe("bar");
  });

  it("returns chart JSON for income_vs_expenses", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall(
      "show_chart",
      { chart_type: "income_vs_expenses" },
      ctx
    );

    const jsonStr = result.match(/```chart\n([\s\S]+?)\n```/)?.[1];
    const chart = JSON.parse(jsonStr!);
    expect(chart.type).toBe("bar");
    expect(chart.title).toBe("Income vs Expenses vs Tax");
    const names = chart.data.map((d: Record<string, unknown>) => d.name);
    expect(names).toContain("Income");
    expect(names).toContain("Expenses");
    expect(names).toContain("CT Liability");
    expect(names).toContain("Net Profit");
  });

  it("returns chart JSON for monthly_spending", () => {
    const ctx = makeCtx({
      transactions: [
        { date: "2025-01-15", amount: -300, type: "expense" },
        { date: "2025-02-10", amount: -200, type: "expense" },
        { date: "2025-01-20", amount: -100, type: "expense" },
      ],
    });
    const { result } = executeToolCall(
      "show_chart",
      { chart_type: "monthly_spending" },
      ctx
    );

    const jsonStr = result.match(/```chart\n([\s\S]+?)\n```/)?.[1];
    const chart = JSON.parse(jsonStr!);
    expect(chart.type).toBe("bar");
    expect(chart.title).toBe("Monthly Spending");
    // Two months of data (Jan + Feb)
    expect(chart.data.length).toBe(2);
  });

  it("returns error for unknown chart type", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall(
      "show_chart",
      { chart_type: "unknown_chart" },
      ctx
    );
    expect(result).toContain("Unknown chart type");
    expect(result).toContain("expenses_pie");
  });
});

// ================================================================
// 21 – run_company_health_check
// ================================================================
describe("executeToolCall — run_company_health_check", () => {
  it("returns a health report with score", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall("run_company_health_check", {}, ctx);

    expect(result).toContain("# Company Health Check");
    expect(result).toContain("Score:");
    expect(result).toContain("/100");
    expect(result).toContain("CT1 Summary");
    expect(result).toContain("Income");
    expect(result).toContain("CT Liability");
  });

  it("detects uncategorized transactions and lowers score", () => {
    const ctx = makeCtx({
      transactions: [
        { category: "Uncategorized", type: "expense", amount: -100 },
        { category: "Uncategorized", type: "expense", amount: -200 },
        { category: "", type: "expense", amount: -150 },
      ],
    });
    const { result } = executeToolCall("run_company_health_check", {}, ctx);
    expect(result).toContain("Uncategorized Transactions");
    expect(result).toContain("Action Items");
  });

  it("flags capital items with no allowances claimed", () => {
    const ctx = makeCtx({
      ct1: {
        detectedIncome: [{ category: "Sales", amount: 100000 }],
        expenseByCategory: [{ category: "Materials", amount: 30000 }],
        expenseSummary: { allowable: 30000, disallowed: 0, total: 30000 },
        vehicleAsset: null,
        directorsLoanTravel: 0,
        travelAllowance: 0,
        rctPrepayment: 0,
        isConstructionTrade: false,
        vatPosition: null,
        flaggedCapitalItems: [
          { description: "Drill", amount: 2000 },
          { description: "Generator", amount: 5000 },
        ],
      } as unknown as ToolContext["ct1"],
    });
    const { result } = executeToolCall("run_company_health_check", {}, ctx);
    expect(result).toContain("Capital Allowances");
    expect(result).toContain("flagged items");
  });

  it("suggests employer pension when no pension contributions and profit > 10k", () => {
    const ctx = makeCtx({ allForm11Data: [] });
    const { result } = executeToolCall("run_company_health_check", {}, ctx);
    // Trading profit is 65000, so pension should be suggested
    expect(result).toContain("Employer Pension");
  });

  it("notes start-up relief when company is young", () => {
    const ctx = makeCtx({ incorporationDate: "2024-01-01" });
    const { result } = executeToolCall("run_company_health_check", {}, ctx);
    expect(result).toContain("Start-up Relief");
  });

  it("includes a tip about Director Health Check", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall("run_company_health_check", {}, ctx);
    expect(result).toContain("Director Health Check");
  });
});

// ================================================================
// 22 – run_director_health_check
// ================================================================
describe("executeToolCall — run_director_health_check", () => {
  it("returns a personal tax report with score", () => {
    const ctx = makeCtx({
      directorData: { name: "Jane Doe", salary: 60000 },
    });
    const { result } = executeToolCall("run_director_health_check", {}, ctx);

    expect(result).toContain("# Director Health Check");
    expect(result).toContain("Score:");
    expect(result).toContain("/100");
    expect(result).toContain("Jane Doe");
    expect(result).toContain("Director Salary & Tax");
    expect(result).toContain("Gross Salary");
    expect(result).toContain("PAYE");
    expect(result).toContain("USC");
    expect(result).toContain("Net Pay");
  });

  it("flags missing salary as an action item", () => {
    const ctx = makeCtx({ directorData: null });
    const { result } = executeToolCall("run_director_health_check", {}, ctx);
    expect(result).toContain("No salary recorded");
    expect(result).toContain("Action Items");
  });

  it("suggests pension when not contributing", () => {
    const ctx = makeCtx({
      directorData: { name: "Test", salary: 50000 },
      allForm11Data: [],
    });
    const { result } = executeToolCall("run_director_health_check", {}, ctx);
    expect(result).toContain("pension");
  });

  it("mentions Small Benefit Exemption when salary is set", () => {
    const ctx = makeCtx({
      directorData: { name: "Test", salary: 50000 },
    });
    const { result } = executeToolCall("run_director_health_check", {}, ctx);
    expect(result).toContain("Small Benefit Exemption");
  });

  it("recognises existing pension contributions as a win", () => {
    const ctx = makeCtx({
      directorData: { name: "Test", salary: 50000 },
      allForm11Data: [
        { directorNumber: 1, data: { pensionContributions: 10000 } },
      ],
    });
    const { result } = executeToolCall("run_director_health_check", {}, ctx);
    expect(result).toContain("Pension contributions active");
  });

  it("includes a tip about Company Health Check", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall("run_director_health_check", {}, ctx);
    expect(result).toContain("Company Health Check");
  });
});

// ================================================================
// 23 – unknown tool
// ================================================================
describe("executeToolCall — unknown tool", () => {
  it("returns an error message for an unrecognised tool name", () => {
    const ctx = makeCtx();
    const { result } = executeToolCall("totally_fake_tool", {}, ctx);
    expect(result).toBe("Unknown tool: totally_fake_tool");
  });
});

// ================================================================
// Edge-case / integration extras
// ================================================================
describe("ROUTE_LABELS", () => {
  it("has a label for every PAGE_ROUTES path that is not form11", () => {
    for (const [key, route] of Object.entries(PAGE_ROUTES)) {
      // form11 is a dynamic route, skip
      if (key === "form11") continue;
      expect(ROUTE_LABELS[route.path]).toBeDefined();
    }
  });
});

describe("executeToolCall — navigate_to_page (additional)", () => {
  it("navigates to each known page without error", () => {
    for (const page of Object.keys(PAGE_ROUTES)) {
      const ctx = makeCtx();
      const { result, navigated } = executeToolCall(
        "navigate_to_page",
        { page },
        ctx
      );
      expect(navigated).toBe(true);
      expect(ctx.navigate).toHaveBeenCalledWith(PAGE_ROUTES[page].path);
      expect(result).toContain(PAGE_ROUTES[page].label);
    }
  });
});

describe("executeToolCall — show_expense_breakdown with percentages", () => {
  it("calculates correct percentages", () => {
    const ctx = makeCtx({
      ct1: {
        detectedIncome: [{ category: "Sales", amount: 100000 }],
        expenseByCategory: [
          { category: "A", amount: 75 },
          { category: "B", amount: 25 },
        ],
        expenseSummary: { allowable: 100, disallowed: 0, total: 100 },
        vehicleAsset: null,
        directorsLoanTravel: 0,
        travelAllowance: 0,
        rctPrepayment: 0,
        isConstructionTrade: false,
        vatPosition: null,
        flaggedCapitalItems: [],
      } as unknown as ToolContext["ct1"],
    });
    const { result } = executeToolCall("show_expense_breakdown", {}, ctx);
    expect(result).toContain("75.0%");
    expect(result).toContain("25.0%");
    expect(result).toContain("100%");
  });
});

describe("executeToolCall — search_transactions respects limit", () => {
  it("returns at most `limit` results", () => {
    const txs = Array.from({ length: 30 }, (_, i) => ({
      date: "2025-01-01",
      description: `Payment ${i}`,
      category: "Test",
      amount: -10,
      type: "expense",
      vendor_name: "",
    }));
    const ctx = makeCtx({ transactions: txs });
    const { result } = executeToolCall(
      "search_transactions",
      { query: "payment", limit: 5 },
      ctx
    );

    // Count data rows (exclude header, separator, total)
    const dataRows = result
      .split("\n")
      .filter(
        (l) =>
          l.startsWith("|") &&
          !l.includes("Date") &&
          !l.includes("---") &&
          !l.includes("Total")
      );
    expect(dataRows.length).toBe(5);
  });
});
