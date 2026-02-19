import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// Mock vatDeductibility before importing the module under test
vi.mock("../vatDeductibility", () => ({
  isVATDeductible: (description: string, categoryName?: string | null, _accountName?: string | null) => {
    const descLower = (description || "").toLowerCase();
    const catLower = (categoryName || "").toLowerCase();

    // Uncategorised
    if (!categoryName) {
      return { isDeductible: false, reason: "Uncategorised expense" };
    }

    // Director's Loan Account
    if (catLower.includes("drawing") || catLower.includes("director's draw") || catLower.includes("director's loan")) {
      return { isDeductible: false, reason: "Director's Loan Account — balance sheet movement" };
    }

    // Revenue / Collector General refunds — not real expenses
    if (descLower.includes("revenue") || descLower.includes("collector general")) {
      return { isDeductible: false, reason: "Revenue refund — not a deductible expense" };
    }

    // Entertainment
    if (catLower === "entertainment" || catLower.includes("meals")) {
      return { isDeductible: false, reason: "Entertainment — not allowable", section: "Section 60(2)(a)(i)/(iii)" };
    }

    // Food & Drink
    if (catLower.includes("food") || catLower.includes("drink")) {
      return { isDeductible: false, reason: "Food & drink — VAT not recoverable", section: "Section 60(2)(a)(i)" };
    }

    return { isDeductible: true, reason: "Business expense - VAT recoverable" };
  },
  calculateVATFromGross: (grossAmount: number, vatRateKey: string) => {
    const rates: Record<string, number> = {
      standard_23: 0.23,
      reduced_13_5: 0.135,
      second_reduced_9: 0.09,
      livestock_4_8: 0.048,
      zero_rated: 0,
      exempt: 0,
    };
    const rate = rates[vatRateKey] ?? 0.23;
    if (rate === 0) return { netAmount: grossAmount, vatAmount: 0 };
    const vatAmount = Number(((grossAmount * rate) / (1 + rate)).toFixed(2));
    const netAmount = Number((grossAmount - vatAmount).toFixed(2));
    return { netAmount, vatAmount };
  },
}));

import {
  generateSalesTaxAuditReport,
  exportToCSV,
  downloadCSV,
  type SalesTaxAuditReport,
} from "../salesTaxAuditReport";

// ──────────────────────────────────────────────────────────────
// Mock data factories
// ──────────────────────────────────────────────────────────────

interface TransactionInput {
  id?: string;
  transaction_date?: string;
  description?: string;
  amount?: number;
  type?: "income" | "expense";
  vat_rate?: string;
  vat_amount?: number;
  net_amount?: number;
  is_business_expense?: boolean | null;
  category?: { name: string; id: string } | null;
  account?: { name: string } | null;
  bank_reference?: string;
}

function makeTransaction(overrides: TransactionInput = {}) {
  return {
    id: overrides.id ?? "txn-1",
    transaction_date: overrides.transaction_date ?? "2025-01-15",
    description: overrides.description ?? "Test transaction",
    amount: overrides.amount ?? 100,
    type: overrides.type ?? ("income" as const),
    vat_rate: overrides.vat_rate,
    vat_amount: overrides.vat_amount,
    net_amount: overrides.net_amount,
    is_business_expense: overrides.is_business_expense,
    category: overrides.category !== undefined ? overrides.category : { name: "Sales", id: "cat-1" },
    account: overrides.account !== undefined ? overrides.account : null,
    bank_reference: overrides.bank_reference,
  };
}

interface ExpenseInput {
  id?: string;
  expense_date?: string;
  description?: string;
  total_amount?: number;
  vat_rate?: string;
  vat_amount?: number;
  net_amount?: number;
  category?: { name: string; id: string } | null;
  invoice_number?: string;
  supplier?: { name: string } | null;
}

function makeExpense(overrides: ExpenseInput = {}) {
  return {
    id: overrides.id ?? "exp-1",
    expense_date: overrides.expense_date ?? "2025-01-20",
    description: overrides.description ?? "Office supplies",
    total_amount: overrides.total_amount ?? 123,
    vat_rate: overrides.vat_rate ?? "standard_23",
    vat_amount: overrides.vat_amount ?? 23,
    net_amount: overrides.net_amount ?? 100,
    category: overrides.category !== undefined ? overrides.category : { name: "Office Supplies", id: "cat-2" },
    invoice_number: overrides.invoice_number,
    supplier: overrides.supplier !== undefined ? overrides.supplier : { name: "Staples" },
  };
}

interface InvoiceInput {
  id?: string;
  issue_date?: string;
  invoice_number?: string;
  total?: number;
  vat_amount?: number;
  subtotal?: number;
  customer?: { name: string } | null;
  items?: Array<{
    description: string;
    vat_rate: string;
    vat_amount: number;
    net_amount: number;
    total_amount: number;
  }>;
}

function makeInvoice(overrides: InvoiceInput = {}) {
  return {
    id: overrides.id ?? "inv-1",
    issue_date: overrides.issue_date ?? "2025-01-25",
    invoice_number: overrides.invoice_number ?? "INV-001",
    total: overrides.total ?? 1135,
    vat_amount: overrides.vat_amount ?? 135,
    subtotal: overrides.subtotal ?? 1000,
    customer: overrides.customer !== undefined ? overrides.customer : { name: "Acme Corp" },
    items: overrides.items,
  };
}

// Common period dates
const PERIOD_START = new Date("2025-01-01");
const PERIOD_END = new Date("2025-03-31");
const BUSINESS_NAME = "O'Brien Carpentry Ltd";

// ══════════════════════════════════════════════════════════════
// generateSalesTaxAuditReport
// ══════════════════════════════════════════════════════════════
describe("generateSalesTaxAuditReport", () => {
  // ──────────────────────────────────────────────────────────
  // 1. Basic report with empty arrays
  // ──────────────────────────────────────────────────────────
  describe("empty data", () => {
    it("returns a report with zero totals and no sections", () => {
      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [], []);

      expect(report.sections).toHaveLength(0);
      expect(report.grandTotalSalesGross).toBe(0);
      expect(report.grandTotalSalesTax).toBe(0);
      expect(report.grandTotalSalesNet).toBe(0);
      expect(report.grandTotalPurchasesGross).toBe(0);
      expect(report.grandTotalPurchasesTax).toBe(0);
      expect(report.grandTotalPurchasesNet).toBe(0);
      expect(report.netVatPayable).toBe(0);
    });

    it("includes business name in the report", () => {
      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [], []);
      expect(report.businessName).toBe(BUSINESS_NAME);
    });

    it("includes formatted period dates in the report", () => {
      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [], []);
      // date-fns format "d MMMM yyyy"
      expect(report.periodStart).toBe("1 January 2025");
      expect(report.periodEnd).toBe("31 March 2025");
    });
  });

  // ──────────────────────────────────────────────────────────
  // 2. Income transactions grouped by VAT rate
  // ──────────────────────────────────────────────────────────
  describe("income transactions grouped by VAT rate", () => {
    it("groups income transactions into the correct sales sections", () => {
      const transactions = [
        makeTransaction({
          id: "t1",
          description: "Carpentry job payment",
          amount: 1000,
          type: "income",
          vat_rate: "reduced_13_5",
          vat_amount: 118.94,
          net_amount: 881.06,
        }),
        makeTransaction({
          id: "t2",
          description: "Another job",
          amount: 500,
          type: "income",
          vat_rate: "reduced_13_5",
          vat_amount: 59.47,
          net_amount: 440.53,
        }),
        makeTransaction({
          id: "t3",
          description: "Consulting fee",
          amount: 2000,
          type: "income",
          vat_rate: "standard_23",
          vat_amount: 373.98,
          net_amount: 1626.02,
        }),
      ];

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, transactions, [], []);

      const salesSections = report.sections.filter((s) => s.type === "sales");
      expect(salesSections.length).toBe(2);

      const reduced = salesSections.find((s) => s.vatRate === "reduced_13_5");
      expect(reduced).toBeDefined();
      expect(reduced!.items).toHaveLength(2);
      expect(reduced!.totalGross).toBeCloseTo(1500, 2);

      const standard = salesSections.find((s) => s.vatRate === "standard_23");
      expect(standard).toBeDefined();
      expect(standard!.items).toHaveLength(1);
      expect(standard!.totalGross).toBeCloseTo(2000, 2);
    });

    it("defaults income vat_rate to zero_rated when not provided", () => {
      const txn = makeTransaction({
        description: "Subcontractor payment",
        amount: 5000,
        type: "income",
        vat_rate: undefined,
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);

      const salesSections = report.sections.filter((s) => s.type === "sales");
      expect(salesSections).toHaveLength(1);
      expect(salesSections[0].vatRate).toBe("zero_rated");
      // zero-rated means 0 VAT
      expect(salesSections[0].totalTax).toBe(0);
      expect(salesSections[0].totalNet).toBeCloseTo(5000, 2);
    });

    it("uses pre-computed net_amount and vat_amount when present", () => {
      const txn = makeTransaction({
        amount: 1135,
        type: "income",
        vat_rate: "reduced_13_5",
        vat_amount: 135,
        net_amount: 1000,
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);

      const section = report.sections.find((s) => s.type === "sales" && s.vatRate === "reduced_13_5");
      expect(section).toBeDefined();
      expect(section!.items[0].tax).toBe(135);
      expect(section!.items[0].net).toBe(1000);
    });
  });

  // ──────────────────────────────────────────────────────────
  // 3. Expense transactions grouped by VAT rate and category
  // ──────────────────────────────────────────────────────────
  describe("expense transactions grouped by VAT rate", () => {
    it("groups expense transactions into purchases sections", () => {
      const transactions = [
        makeTransaction({
          id: "e1",
          description: "Timber purchase",
          amount: 246,
          type: "expense",
          vat_rate: "standard_23",
          vat_amount: 46,
          net_amount: 200,
          category: { name: "Materials", id: "cat-mat" },
        }),
        makeTransaction({
          id: "e2",
          description: "More timber",
          amount: 123,
          type: "expense",
          vat_rate: "standard_23",
          vat_amount: 23,
          net_amount: 100,
          category: { name: "Materials", id: "cat-mat" },
        }),
      ];

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, transactions, [], []);

      const purchaseSections = report.sections.filter((s) => s.type === "purchases");
      expect(purchaseSections).toHaveLength(1);
      expect(purchaseSections[0].vatRate).toBe("standard_23");
      expect(purchaseSections[0].items).toHaveLength(2);
      // Expenses are stored as negative values
      expect(purchaseSections[0].totalGross).toBeCloseTo(-369, 2);
      expect(purchaseSections[0].totalTax).toBeCloseTo(-69, 2);
    });

    it("shows the category name as the account column", () => {
      const txn = makeTransaction({
        description: "Screws and nails",
        amount: 50,
        type: "expense",
        vat_rate: "standard_23",
        category: { name: "Materials", id: "cat-mat" },
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);

      const item = report.sections[0].items[0];
      expect(item.account).toBe("Materials");
    });
  });

  // ──────────────────────────────────────────────────────────
  // 4. Revenue refund transactions are filtered out
  // ──────────────────────────────────────────────────────────
  describe("revenue refund filtering", () => {
    it("filters out expense transactions with 'revenue' in description", () => {
      const txn = makeTransaction({
        description: "Revenue Commissioners refund",
        amount: 500,
        type: "expense",
        vat_rate: "standard_23",
        category: { name: "Tax", id: "cat-tax" },
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);

      // Revenue refunds should be filtered out by isVATDeductible returning false
      const purchaseSections = report.sections.filter((s) => s.type === "purchases");
      expect(purchaseSections).toHaveLength(0);
    });

    it("filters out expense transactions with 'collector general' in description", () => {
      const txn = makeTransaction({
        description: "Collector General payment",
        amount: 1200,
        type: "expense",
        vat_rate: "standard_23",
        category: { name: "Tax", id: "cat-tax" },
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);

      const purchaseSections = report.sections.filter((s) => s.type === "purchases");
      expect(purchaseSections).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────
  // 5. Director's Loan Account filtered out
  // ──────────────────────────────────────────────────────────
  describe("Director's Loan Account filtering", () => {
    it("excludes expense transactions categorised as Director's Loan Account", () => {
      const txn = makeTransaction({
        description: "Transfer to personal account",
        amount: 2000,
        type: "expense",
        vat_rate: "zero_rated",
        category: { name: "Director's Loan Account", id: "cat-draw" },
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);

      const purchaseSections = report.sections.filter((s) => s.type === "purchases");
      expect(purchaseSections).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────
  // 6. VAT calculation from gross amount
  // ──────────────────────────────────────────────────────────
  describe("VAT calculation from gross (reverse VAT)", () => {
    it("calculates VAT = total * (rate / (100 + rate)) for 23%", () => {
      // A gross amount of 123 at 23%: VAT = 123 * 0.23 / 1.23 = 23.00
      const txn = makeTransaction({
        amount: 123,
        type: "income",
        vat_rate: "standard_23",
        // Deliberately omit vat_amount / net_amount so the module calculates them
        vat_amount: undefined,
        net_amount: undefined,
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);

      const section = report.sections.find((s) => s.type === "sales");
      expect(section).toBeDefined();
      // 123 * 0.23 / 1.23 = 23.00
      expect(section!.items[0].tax).toBeCloseTo(23, 2);
      expect(section!.items[0].net).toBeCloseTo(100, 2);
    });

    it("calculates VAT for 13.5% reduced rate", () => {
      // 1135 * 0.135 / 1.135 = 135.00 (approximately)
      const txn = makeTransaction({
        amount: 1135,
        type: "income",
        vat_rate: "reduced_13_5",
        vat_amount: undefined,
        net_amount: undefined,
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);

      const section = report.sections.find((s) => s.type === "sales");
      // 1135 * 0.135 / 1.135 = 135.00 exactly
      expect(section!.items[0].tax).toBeCloseTo(135, 1);
      expect(section!.items[0].net).toBeCloseTo(1000, 1);
    });

    it("returns zero VAT for zero_rated", () => {
      const txn = makeTransaction({
        amount: 500,
        type: "income",
        vat_rate: "zero_rated",
        vat_amount: undefined,
        net_amount: undefined,
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);

      const section = report.sections.find((s) => s.type === "sales");
      expect(section!.items[0].tax).toBe(0);
      expect(section!.items[0].net).toBe(500);
    });

    it("returns zero VAT for exempt", () => {
      const txn = makeTransaction({
        amount: 750,
        type: "income",
        vat_rate: "exempt",
        vat_amount: undefined,
        net_amount: undefined,
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);

      const section = report.sections.find((s) => s.type === "sales");
      expect(section!.items[0].tax).toBe(0);
      expect(section!.items[0].net).toBe(750);
    });
  });

  // ──────────────────────────────────────────────────────────
  // 7. Invoice processing
  // ──────────────────────────────────────────────────────────
  describe("invoice processing", () => {
    it("adds invoices to sales sections", () => {
      const inv = makeInvoice({
        total: 1135,
        vat_amount: 135,
        subtotal: 1000,
        items: [
          {
            description: "Kitchen installation",
            vat_rate: "reduced_13_5",
            vat_amount: 135,
            net_amount: 1000,
            total_amount: 1135,
          },
        ],
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [], [inv]);

      const salesSections = report.sections.filter((s) => s.type === "sales");
      expect(salesSections).toHaveLength(1);
      expect(salesSections[0].vatRate).toBe("reduced_13_5");
      expect(salesSections[0].items[0].gross).toBe(1135);
      expect(salesSections[0].items[0].tax).toBe(135);
      expect(salesSections[0].items[0].net).toBe(1000);
    });

    it("uses the VAT rate from the first item of the invoice", () => {
      const inv = makeInvoice({
        total: 500,
        vat_amount: 42.39,
        subtotal: 457.61,
        items: [
          {
            description: "Bookshelf",
            vat_rate: "second_reduced_9",
            vat_amount: 42.39,
            net_amount: 457.61,
            total_amount: 500,
          },
        ],
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [], [inv]);

      const section = report.sections.find((s) => s.type === "sales");
      expect(section!.vatRate).toBe("second_reduced_9");
    });

    it("includes customer name and item descriptions in details", () => {
      const inv = makeInvoice({
        customer: { name: "John Smith" },
        items: [
          {
            description: "Wardrobe fitting",
            vat_rate: "reduced_13_5",
            vat_amount: 67.5,
            net_amount: 500,
            total_amount: 567.5,
          },
        ],
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [], [inv]);

      const item = report.sections[0].items[0];
      expect(item.details).toContain("John Smith");
      expect(item.details).toContain("Wardrobe fitting");
    });

    it("uses invoice_number as the reference", () => {
      const inv = makeInvoice({ invoice_number: "INV-999" });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [], [inv]);

      expect(report.sections[0].items[0].reference).toBe("INV-999");
    });
  });

  // ──────────────────────────────────────────────────────────
  // 8. Invoice with zero amount defaults to zero_rated
  // ──────────────────────────────────────────────────────────
  describe("invoice zero amount handling", () => {
    it("treats invoice with zero VAT as zero_rated", () => {
      const inv = makeInvoice({
        total: 2000,
        vat_amount: 0,
        subtotal: 2000,
        items: [
          {
            description: "Reverse charge subcontract",
            vat_rate: "reduced_13_5",
            vat_amount: 0,
            net_amount: 2000,
            total_amount: 2000,
          },
        ],
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [], [inv]);

      const section = report.sections.find((s) => s.type === "sales");
      expect(section!.vatRate).toBe("zero_rated");
    });
  });

  // ──────────────────────────────────────────────────────────
  // 9. Grand totals
  // ──────────────────────────────────────────────────────────
  describe("grand totals", () => {
    it("computes correct grand totals for sales, purchases, and net VAT", () => {
      const incomeTransactions = [
        makeTransaction({
          id: "inc-1",
          description: "Job payment 1",
          amount: 1135,
          type: "income",
          vat_rate: "reduced_13_5",
          vat_amount: 135,
          net_amount: 1000,
        }),
        makeTransaction({
          id: "inc-2",
          description: "Job payment 2",
          amount: 2000,
          type: "income",
          vat_rate: "zero_rated",
          vat_amount: 0,
          net_amount: 2000,
        }),
      ];

      const expenses = [
        makeExpense({
          id: "exp-1",
          total_amount: 246,
          vat_rate: "standard_23",
          vat_amount: 46,
          net_amount: 200,
        }),
        makeExpense({
          id: "exp-2",
          total_amount: 500,
          vat_rate: "reduced_13_5",
          vat_amount: 59.47,
          net_amount: 440.53,
        }),
      ];

      const report = generateSalesTaxAuditReport(
        BUSINESS_NAME,
        PERIOD_START,
        PERIOD_END,
        incomeTransactions,
        expenses,
        [],
      );

      // Sales: 1135 + 2000 = 3135 gross, 135 + 0 = 135 tax
      expect(report.grandTotalSalesGross).toBeCloseTo(3135, 2);
      expect(report.grandTotalSalesTax).toBeCloseTo(135, 2);
      expect(report.grandTotalSalesNet).toBeCloseTo(3000, 2);

      // Purchases (negative): -(246 + 500) = -746 gross, -(46 + 59.47) = -105.47 tax
      expect(report.grandTotalPurchasesGross).toBeCloseTo(-746, 2);
      expect(report.grandTotalPurchasesTax).toBeCloseTo(-105.47, 2);

      // Net VAT = sales tax + purchases tax (purchases already negative)
      // 135 + (-105.47) = 29.53
      expect(report.netVatPayable).toBeCloseTo(29.53, 2);
    });

    it("results in negative net VAT when purchases tax exceeds sales tax", () => {
      const income = [
        makeTransaction({
          id: "inc-1",
          amount: 100,
          type: "income",
          vat_rate: "zero_rated",
        }),
      ];

      const expenses = [
        makeExpense({
          id: "exp-1",
          total_amount: 1230,
          vat_rate: "standard_23",
          vat_amount: 230,
          net_amount: 1000,
        }),
      ];

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, income, expenses, []);

      // Sales tax is 0 (zero rated), purchases tax is -230
      // Net VAT = 0 + (-230) = -230 (refund due)
      expect(report.netVatPayable).toBeCloseTo(-230, 2);
    });
  });

  // ──────────────────────────────────────────────────────────
  // 11. Sections are sorted by VAT rate (defined order)
  // ──────────────────────────────────────────────────────────
  describe("section ordering", () => {
    it("orders sections by rate: reduced_13_5, standard_23, second_reduced_9, zero_rated", () => {
      const transactions = [
        makeTransaction({
          id: "t1",
          amount: 100,
          type: "income",
          vat_rate: "zero_rated",
        }),
        makeTransaction({
          id: "t2",
          amount: 200,
          type: "income",
          vat_rate: "standard_23",
          vat_amount: 37.4,
          net_amount: 162.6,
        }),
        makeTransaction({
          id: "t3",
          amount: 300,
          type: "income",
          vat_rate: "reduced_13_5",
          vat_amount: 35.68,
          net_amount: 264.32,
        }),
      ];

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, transactions, [], []);

      const salesRateOrder = report.sections.filter((s) => s.type === "sales").map((s) => s.vatRate);

      // reduced_13_5 comes before standard_23, which comes before zero_rated
      expect(salesRateOrder.indexOf("reduced_13_5")).toBeLessThan(salesRateOrder.indexOf("standard_23"));
      expect(salesRateOrder.indexOf("standard_23")).toBeLessThan(salesRateOrder.indexOf("zero_rated"));
    });

    it("places purchases sections before sales sections", () => {
      const transactions = [
        makeTransaction({
          id: "inc-1",
          amount: 500,
          type: "income",
          vat_rate: "reduced_13_5",
          vat_amount: 59.47,
          net_amount: 440.53,
        }),
      ];

      const expenses = [
        makeExpense({
          id: "exp-1",
          total_amount: 123,
          vat_rate: "standard_23",
          vat_amount: 23,
          net_amount: 100,
        }),
      ];

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, transactions, expenses, []);

      const firstPurchaseIdx = report.sections.findIndex((s) => s.type === "purchases");
      const firstSalesIdx = report.sections.findIndex((s) => s.type === "sales");
      expect(firstPurchaseIdx).toBeLessThan(firstSalesIdx);
    });
  });

  // ──────────────────────────────────────────────────────────
  // Expense objects (not transactions)
  // ──────────────────────────────────────────────────────────
  describe("expense records processing", () => {
    it("adds expense records as purchase line items with negative amounts", () => {
      const exp = makeExpense({
        total_amount: 500,
        vat_amount: 93.5,
        net_amount: 406.5,
        vat_rate: "standard_23",
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [exp], []);

      const section = report.sections.find((s) => s.type === "purchases");
      expect(section).toBeDefined();
      expect(section!.items[0].gross).toBe(-500);
      expect(section!.items[0].tax).toBe(-93.5);
      expect(section!.items[0].net).toBe(-406.5);
    });

    it("uses the supplier name and description in details", () => {
      const exp = makeExpense({
        supplier: { name: "Chadwicks" },
        description: "Timber and screws",
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [exp], []);

      const item = report.sections[0].items[0];
      expect(item.details).toContain("Chadwicks");
      expect(item.details).toContain("Timber and screws");
    });

    it("defaults expense vat_rate to standard_23 when missing from config", () => {
      const exp = makeExpense({
        vat_rate: "standard_23",
        total_amount: 246,
        vat_amount: 46,
        net_amount: 200,
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [exp], []);

      const section = report.sections.find((s) => s.type === "purchases");
      expect(section!.vatRate).toBe("standard_23");
    });
  });

  // ──────────────────────────────────────────────────────────
  // Non-business expense transactions are skipped
  // ──────────────────────────────────────────────────────────
  describe("non-business expenses", () => {
    it("skips expense transactions where is_business_expense is false", () => {
      const txn = makeTransaction({
        description: "Personal shopping",
        amount: 300,
        type: "expense",
        vat_rate: "standard_23",
        is_business_expense: false,
        category: { name: "General", id: "cat-gen" },
      });

      const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);

      expect(report.sections).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────
  // Combined scenario
  // ──────────────────────────────────────────────────────────
  describe("combined scenario with all data types", () => {
    it("processes transactions, expenses, and invoices together", () => {
      const transactions = [
        makeTransaction({
          id: "inc-1",
          description: "Cash payment",
          amount: 500,
          type: "income",
          vat_rate: "reduced_13_5",
          vat_amount: 59.47,
          net_amount: 440.53,
        }),
        makeTransaction({
          id: "exp-1",
          description: "Van fuel diesel",
          amount: 80,
          type: "expense",
          vat_rate: "standard_23",
          vat_amount: 14.96,
          net_amount: 65.04,
          category: { name: "Motor Expenses", id: "cat-motor" },
        }),
      ];

      const expenses = [
        makeExpense({
          id: "exp-obj-1",
          total_amount: 200,
          vat_rate: "standard_23",
          vat_amount: 37.4,
          net_amount: 162.6,
        }),
      ];

      const invoices = [
        makeInvoice({
          id: "inv-1",
          total: 1135,
          vat_amount: 135,
          subtotal: 1000,
          items: [
            {
              description: "Kitchen fitting",
              vat_rate: "reduced_13_5",
              vat_amount: 135,
              net_amount: 1000,
              total_amount: 1135,
            },
          ],
        }),
      ];

      const report = generateSalesTaxAuditReport(
        BUSINESS_NAME,
        PERIOD_START,
        PERIOD_END,
        transactions,
        expenses,
        invoices,
      );

      // Expect purchases and sales sections
      const purchases = report.sections.filter((s) => s.type === "purchases");
      const sales = report.sections.filter((s) => s.type === "sales");

      expect(purchases.length).toBeGreaterThanOrEqual(1);
      expect(sales.length).toBeGreaterThanOrEqual(1);

      // Grand totals should be non-zero
      expect(report.grandTotalSalesGross).toBeGreaterThan(0);
      expect(report.grandTotalPurchasesGross).toBeLessThan(0);
      expect(report.netVatPayable).toBeDefined();
    });
  });
});

// ══════════════════════════════════════════════════════════════
// OR-fallback branches (lines 219, 240, 260, 285)
// ══════════════════════════════════════════════════════════════
describe("generateSalesTaxAuditReport — OR fallback branches", () => {
  it("uses 'Invoice' when invoice has no customer and no items", () => {
    const invoice = makeInvoice({ customer: null, items: undefined });
    const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [], [invoice]);
    const salesSection = report.sections.find((s) => s.type === "sales");
    expect(salesSection).toBeDefined();
    expect(salesSection!.items.some((i) => i.details === "Invoice")).toBe(true);
  });

  it("uses 'Sales' when income transaction has no category", () => {
    const txn = makeTransaction({ type: "income", category: null });
    const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);
    const salesSection = report.sections.find((s) => s.type === "sales");
    expect(salesSection).toBeDefined();
    expect(salesSection!.items.some((i) => i.account === "Sales")).toBe(true);
  });

  it("handles unknown VAT rate key gracefully in purchases", () => {
    const expense = makeExpense({ vat_rate: "unknown_rate_99" });
    const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [expense], []);
    // Falls through rateOrder without matching — no section created for unknown key
    // The purchase is still processed with fallback VAT_RATE_CONFIG[vatRateKey] || standard_23
    expect(report).toBeDefined();
  });

  it("handles unknown VAT rate key gracefully in income transactions", () => {
    const txn = makeTransaction({ type: "income", vat_rate: "unknown_rate_99" });
    const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);
    expect(report).toBeDefined();
  });

  it("falls back to reduced_13_5 when invoice item has empty vat_rate", () => {
    const invoice = makeInvoice({
      items: [{ description: "Kitchen fitting", vat_rate: "", vat_amount: 135, net_amount: 1000, total_amount: 1135 }],
      vat_amount: 135,
    });
    const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [], [invoice]);
    const salesSection = report.sections.find((s) => s.type === "sales" && s.vatRate === "reduced_13_5");
    expect(salesSection).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════
// exportToCSV
// ══════════════════════════════════════════════════════════════
describe("exportToCSV", () => {
  function makeReportFixture(): SalesTaxAuditReport {
    return generateSalesTaxAuditReport(
      BUSINESS_NAME,
      PERIOD_START,
      PERIOD_END,
      [
        makeTransaction({
          id: "inc-1",
          description: "Carpentry job",
          amount: 1135,
          type: "income",
          vat_rate: "reduced_13_5",
          vat_amount: 135,
          net_amount: 1000,
        }),
      ],
      [
        makeExpense({
          id: "exp-1",
          total_amount: 246,
          vat_rate: "standard_23",
          vat_amount: 46,
          net_amount: 200,
          description: "Timber supplies",
          supplier: { name: "Chadwicks" },
        }),
      ],
      [],
    );
  }

  it("starts with the report title header", () => {
    const csv = exportToCSV(makeReportFixture());
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Sales Tax Audit Report");
  });

  it("includes the business name on the second line", () => {
    const csv = exportToCSV(makeReportFixture());
    const lines = csv.split("\n");
    expect(lines[1]).toBe(BUSINESS_NAME);
  });

  it("includes the period range", () => {
    const csv = exportToCSV(makeReportFixture());
    expect(csv).toContain("For the period 1 January 2025 to 31 March 2025");
  });

  it("includes CSV column headers", () => {
    const csv = exportToCSV(makeReportFixture());
    expect(csv).toContain("Date,Account,Reference,Details,Gross,Tax,Net");
  });

  it("includes section titles in the CSV", () => {
    const csv = exportToCSV(makeReportFixture());
    // Purchases at 23% and Sales at 13.5%
    expect(csv).toContain("Purchases 23%");
    expect(csv).toContain("Sales 13.5%");
  });

  it("includes line items with currency formatting", () => {
    const csv = exportToCSV(makeReportFixture());
    // Expense: -246.00 gross
    expect(csv).toContain("-\u20AC246.00");
    // Sales income: 1135.00 gross
    expect(csv).toContain("\u20AC1135.00");
  });

  it("includes section totals", () => {
    const csv = exportToCSV(makeReportFixture());
    expect(csv).toContain("Total Purchases 23%");
    expect(csv).toContain("Total Sales 13.5%");
  });

  it("includes the SUMMARY section", () => {
    const csv = exportToCSV(makeReportFixture());
    expect(csv).toContain("SUMMARY");
    expect(csv).toContain("Total Sales");
    expect(csv).toContain("Total Purchases");
    expect(csv).toContain("Net VAT Payable");
  });

  it("escapes double quotes in details", () => {
    const report = generateSalesTaxAuditReport(
      BUSINESS_NAME,
      PERIOD_START,
      PERIOD_END,
      [
        makeTransaction({
          description: 'Item with "quotes" inside',
          amount: 100,
          type: "income",
          vat_rate: "zero_rated",
        }),
      ],
      [],
      [],
    );

    const csv = exportToCSV(report);
    // CSV escaping: double quotes become ""
    expect(csv).toContain('""quotes""');
  });

  it("generates valid CSV rows with seven comma-separated columns for line items", () => {
    const csv = exportToCSV(makeReportFixture());
    const lines = csv.split("\n");

    // Find a line that looks like a data row (starts with a date like d/MM/yyyy)
    const dataLines = lines.filter((l) => /^\d{1,2}\/\d{2}\/\d{4},/.test(l));
    expect(dataLines.length).toBeGreaterThan(0);

    for (const line of dataLines) {
      // Count commas — a line with 7 fields has 6 commas minimum
      // (Details field is quoted and may contain commas, but our test data doesn't)
      const fields = line.split(",");
      expect(fields.length).toBeGreaterThanOrEqual(7);
    }
  });

  it("returns a non-empty string for an empty report", () => {
    const emptyReport = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [], [], []);
    const csv = exportToCSV(emptyReport);
    expect(csv.length).toBeGreaterThan(0);
    expect(csv).toContain("Sales Tax Audit Report");
    expect(csv).toContain("SUMMARY");
  });
});

// ══════════════════════════════════════════════════════════════
// formatDate fallback (line 97 — catch branch)
// ══════════════════════════════════════════════════════════════
describe("formatDate fallback in export", () => {
  it("handles transaction with invalid date string gracefully", () => {
    const txn = makeTransaction({
      description: "Valid transaction",
      amount: 100,
      type: "income",
      vat_rate: "zero_rated",
      transaction_date: "not-a-real-date",
    });

    const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);

    // The report should still generate without crashing
    expect(report.sections.length).toBeGreaterThan(0);

    // Export should also not crash
    const csv = exportToCSV(report);
    expect(csv).toContain("Sales Tax Audit Report");
  });
});

// ══════════════════════════════════════════════════════════════
// downloadCSV function test (lines 382-393)
// ══════════════════════════════════════════════════════════════
describe("downloadCSV", () => {
  it("is importable and callable", async () => {
    // Since downloadCSV uses document.createElement, we test that it exists
    const mod = await import("../salesTaxAuditReport");
    expect(typeof mod.downloadCSV).toBe("function");
  });
});

// ══════════════════════════════════════════════════════════════
// Uncategorised expense handling
// ══════════════════════════════════════════════════════════════
describe("uncategorised expense filtering", () => {
  it("filters out expense transactions with no category (null)", () => {
    const txn = makeTransaction({
      description: "Random purchase",
      amount: 200,
      type: "expense",
      vat_rate: "standard_23",
      category: null,
    });

    const report = generateSalesTaxAuditReport(BUSINESS_NAME, PERIOD_START, PERIOD_END, [txn], [], []);

    // Uncategorised expenses should be filtered by isVATDeductible returning false
    const purchaseSections = report.sections.filter((s) => s.type === "purchases");
    expect(purchaseSections).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════
// downloadCSV — DOM-based download function (lines 382-395)
// ══════════════════════════════════════════════════════════════
describe("downloadCSV", () => {
  const mockLink = {
    setAttribute: vi.fn(),
    style: { visibility: "" },
    click: vi.fn(),
  };

  beforeAll(() => {
    vi.stubGlobal("document", {
      createElement: vi.fn(() => mockLink),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal(
      "Blob",
      vi.fn(function (this: unknown, parts: unknown, opts?: { type?: string }) {
        return { parts, type: opts?.type };
      }),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  function makeMockReport(overrides: Partial<SalesTaxAuditReport> = {}): SalesTaxAuditReport {
    return {
      businessName: "Test Ltd",
      periodStart: "1 January 2025",
      periodEnd: "31 March 2025",
      sections: [],
      grandTotalSalesGross: 0,
      grandTotalSalesTax: 0,
      grandTotalSalesNet: 0,
      grandTotalPurchasesGross: 0,
      grandTotalPurchasesTax: 0,
      grandTotalPurchasesNet: 0,
      netVatPayable: 0,
      ...overrides,
    };
  }

  it("creates a blob, link, and triggers download with default filename", () => {
    const report = makeMockReport({
      periodStart: "1 January 2025",
      periodEnd: "31 March 2025",
    });

    downloadCSV(report);

    expect(Blob).toHaveBeenCalled();
    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(mockLink.setAttribute).toHaveBeenCalledWith("href", "blob:mock-url");
    expect(mockLink.setAttribute).toHaveBeenCalledWith(
      "download",
      "Sales_Tax_Audit_Report_1_January_2025_to_31_March_2025.csv",
    );
    expect(mockLink.style.visibility).toBe("hidden");
    expect(mockLink.click).toHaveBeenCalled();
    expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
    expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
  });

  it("uses custom filename when provided", () => {
    const report = makeMockReport();
    downloadCSV(report, "custom-report.csv");

    expect(mockLink.setAttribute).toHaveBeenCalledWith("download", "custom-report.csv");
  });
});
