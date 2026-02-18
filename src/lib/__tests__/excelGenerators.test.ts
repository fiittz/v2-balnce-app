import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Use vi.hoisted for mock variables ────────────────────────
const {
  mockWorkbook,
  mockWorksheet,
  mockCreateWorkbook,
  mockAddHeaderRows,
  mockAddSectionRows,
  mockAddTableRows,
  mockStyleSheet,
  mockSaveWorkbook,
} = vi.hoisted(() => {
  const mockWorksheet = { name: "Sheet" };
  const mockWorkbook = {
    addWorksheet: vi.fn(() => mockWorksheet),
  };
  return {
    mockWorkbook,
    mockWorksheet,
    mockCreateWorkbook: vi.fn(() => mockWorkbook),
    mockAddHeaderRows: vi.fn(() => 5),
    mockAddSectionRows: vi.fn(() => 10),
    mockAddTableRows: vi.fn(() => 15),
    mockStyleSheet: vi.fn(),
    mockSaveWorkbook: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("@/lib/reports/excelHelpers", () => ({
  createWorkbook: (...args: unknown[]) => mockCreateWorkbook(...args),
  addHeaderRows: (...args: unknown[]) => mockAddHeaderRows(...args),
  addSectionRows: (...args: unknown[]) => mockAddSectionRows(...args),
  addTableRows: (...args: unknown[]) => mockAddTableRows(...args),
  styleSheet: (...args: unknown[]) => mockStyleSheet(...args),
  saveWorkbook: (...args: unknown[]) => mockSaveWorkbook(...args),
}));

import { generateCT1Excel } from "@/lib/reports/excel/ct1Excel";
import { generateForm11Excel } from "@/lib/reports/excel/form11Excel";
import { generateVATExcel } from "@/lib/reports/excel/vatExcel";
import { generateBalanceSheetExcel } from "@/lib/reports/excel/balanceSheetExcel";
import { generateAbridgedAccountsExcel } from "@/lib/reports/excel/abridgedAccountsExcel";
import type {
  ReportMeta,
  CT1ReportData,
  Form11ReportData,
  VATReportData,
  BalanceSheetReportData,
  AbridgedAccountsReportData,
} from "@/lib/reports/types";

// ── Shared helpers ───────────────────────────────────────────
function makeMeta(overrides: Partial<ReportMeta> = {}): ReportMeta {
  return {
    companyName: "Test Company Ltd",
    taxYear: "2024",
    generatedDate: new Date("2024-12-31"),
    preparer: "Balnce",
    directorNames: ["Alice Murphy"],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ================================================================
// CT1 Excel
// ================================================================
describe("generateCT1Excel", () => {
  function makeCT1Data(): CT1ReportData {
    return {
      meta: makeMeta(),
      sections: [
        { title: "Company Information", rows: [{ label: "Name", value: "Test" }] },
        { title: "Corporation Tax Computation", rows: [{ label: "CT", value: "8,750" }] },
        { title: "VAT Position", rows: [{ label: "Net", value: "5,000" }] },
        { title: "Allowable Deductions", rows: [{ label: "Materials", value: "30,000" }] },
        { title: "Trading Profit Adjustment", rows: [{ label: "Net", value: "70,000" }] },
        { title: "Losses Brought Forward", rows: [{ label: "Losses", value: "0" }] },
        { title: "Capital Allowances", rows: [{ label: "WDA", value: "2,500" }] },
      ],
      tables: [
        { title: "Trading Income", headers: ["Cat", "Amt"], rows: [["Sales", "100k"]] },
        { title: "Expense Breakdown", headers: ["Cat", "Amt"], rows: [["Mat", "30k"]] },
        { title: "Flagged Capital Items", headers: ["Item", "Amt"], rows: [["Van", "20k"]] },
      ],
      totalCTLiability: 8750,
      tradingProfit: 70000,
      totalIncome: 100000,
      totalDeductions: 30000,
    };
  }

  it("creates workbook with meta", async () => {
    await generateCT1Excel(makeCT1Data());
    expect(mockCreateWorkbook).toHaveBeenCalledWith(expect.objectContaining({ companyName: "Test Company Ltd" }));
  });

  it("creates Summary, Trading Profit, Capital Allowances, Tax Computation worksheets", async () => {
    await generateCT1Excel(makeCT1Data());
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Summary");
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Trading Profit");
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Capital Allowances");
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Tax Computation");
  });

  it("calls styleSheet for each worksheet", async () => {
    await generateCT1Excel(makeCT1Data());
    expect(mockStyleSheet).toHaveBeenCalledTimes(4);
  });

  it("saves with CT1 filename pattern", async () => {
    await generateCT1Excel(makeCT1Data());
    expect(mockSaveWorkbook).toHaveBeenCalledWith(mockWorkbook, "CT1_Test_Company_Ltd_2024.xlsx");
  });
});

// ================================================================
// Form 11 Excel
// ================================================================
describe("generateForm11Excel", () => {
  function makeForm11Data(): Form11ReportData {
    return {
      meta: makeMeta(),
      input: {
        directorName: "Alice Murphy",
        ppsNumber: "1234567T",
        dateOfBirth: "1985-01-01",
        maritalStatus: "single",
        assessmentBasis: "single",
        salary: 50000,
        dividends: 0,
        bik: 0,
        businessIncome: 100000,
        businessExpenses: 30000,
      } as Form11ReportData["input"],
      result: {} as Form11ReportData["result"],
      sections: [
        { title: "Personal Details", rows: [{ label: "PPS", value: "1234567T" }] },
        { title: "Tax Computation Summary", rows: [{ label: "Total Tax", value: "20,000" }] },
      ],
      tables: [
        { title: "Income Tax Calculation", headers: ["Band", "Rate"], rows: [["40k", "20%"]] },
        { title: "Tax Credits", headers: ["Credit", "Amt"], rows: [["Personal", "1,875"]] },
      ],
    };
  }

  it("creates workbook", async () => {
    await generateForm11Excel(makeForm11Data());
    expect(mockCreateWorkbook).toHaveBeenCalled();
  });

  it("creates Summary, Income Sources, Tax Computation, Credits worksheets", async () => {
    await generateForm11Excel(makeForm11Data());
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Summary");
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Income Sources");
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Tax Computation");
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Credits");
  });

  it("saves with director name in filename", async () => {
    await generateForm11Excel(makeForm11Data());
    expect(mockSaveWorkbook).toHaveBeenCalledWith(mockWorkbook, "Form11_Alice_Murphy_2024.xlsx");
  });
});

// ================================================================
// VAT Excel
// ================================================================
describe("generateVATExcel", () => {
  function makeVATData(): VATReportData {
    return {
      meta: makeMeta(),
      sections: [
        { title: "Registration Information", rows: [{ label: "VAT No", value: "IE123" }] },
        { title: "VAT Return Computation", rows: [{ label: "Net", value: "5,000" }] },
      ],
      tables: [
        { title: "Sales Analysis", headers: ["Rate", "Amt"], rows: [["23%", "10k"]] },
        { title: "Purchases Analysis", headers: ["Rate", "Amt"], rows: [["23%", "5k"]] },
      ],
      t1Sales: 100000,
      t2Vat: 23000,
      t3Purchases: 50000,
      t4InputVat: 11500,
      netVat: 11500,
    };
  }

  it("creates VAT Summary, Sales Detail, Purchases Detail worksheets", async () => {
    await generateVATExcel(makeVATData());
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("VAT Summary");
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Sales Detail");
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Purchases Detail");
  });

  it("calls styleSheet 3 times", async () => {
    await generateVATExcel(makeVATData());
    expect(mockStyleSheet).toHaveBeenCalledTimes(3);
  });

  it("saves with VAT filename pattern", async () => {
    await generateVATExcel(makeVATData());
    expect(mockSaveWorkbook).toHaveBeenCalledWith(mockWorkbook, "VAT_Return_Test_Company_Ltd_2024.xlsx");
  });
});

// ================================================================
// Balance Sheet Excel
// ================================================================
describe("generateBalanceSheetExcel", () => {
  function makeBSData(): BalanceSheetReportData {
    return {
      meta: makeMeta(),
      sections: [
        { title: "Net Assets", rows: [{ label: "Total", value: "60,000" }] },
        { title: "Capital & Reserves", rows: [{ label: "Equity", value: "60,000" }] },
        { title: "Fixed Assets", rows: [{ label: "Equipment", value: "20,000" }] },
        { title: "Current Assets", rows: [{ label: "Bank", value: "50,000" }] },
        { title: "Current Liabilities", rows: [{ label: "Creditors", value: "10,000" }] },
      ],
      fixedAssets: 20000,
      currentAssets: 50000,
      currentLiabilities: 10000,
      longTermLiabilities: 0,
      netAssets: 60000,
      capitalReserves: 60000,
    };
  }

  it("creates Balance Sheet, Assets, Liabilities worksheets", async () => {
    await generateBalanceSheetExcel(makeBSData());
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Balance Sheet");
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Assets");
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Liabilities");
  });

  it("calls styleSheet 3 times", async () => {
    await generateBalanceSheetExcel(makeBSData());
    expect(mockStyleSheet).toHaveBeenCalledTimes(3);
  });

  it("saves with Balance Sheet filename pattern", async () => {
    await generateBalanceSheetExcel(makeBSData());
    expect(mockSaveWorkbook).toHaveBeenCalledWith(mockWorkbook, "Balance_Sheet_Test_Company_Ltd_2024.xlsx");
  });
});

// ================================================================
// Abridged Accounts Excel
// ================================================================
describe("generateAbridgedAccountsExcel", () => {
  function makeAbridgedData(): AbridgedAccountsReportData {
    return {
      meta: makeMeta(),
      sections: [
        { title: "Company Information", rows: [{ label: "Name", value: "Test" }] },
        { title: "Directors' Responsibility Statement", rows: [{ label: "Stmt", value: "We..." }] },
        { title: "Abridged Balance Sheet", rows: [{ label: "Total", value: "100,000" }] },
        { title: "Capital and Reserves", rows: [{ label: "Share Capital", value: "100" }] },
        { title: "Notes to the Financial Statements", rows: [{ label: "Note 1", value: "..." }] },
        { title: "Audit Exemption Statement", rows: [{ label: "Exempt", value: "Yes" }] },
        { title: "Accounting Policies", rows: [{ label: "Basis", value: "Going concern" }] },
      ],
      directorNames: ["Alice Murphy"],
      croNumber: "123456",
      registeredAddress: "123 Main St, Dublin",
      accountingYearEnd: "2024-12-31",
      fixedAssets: 20000,
      currentAssets: 80000,
      currentLiabilities: 10000,
      netCurrentAssets: 70000,
      longTermLiabilities: 0,
      netAssets: 90000,
      shareCapital: 100,
      retainedProfits: 89900,
      shareholdersFunds: 90000,
    };
  }

  it("creates Cover, Balance Sheet, Notes, Accounting Policies worksheets", async () => {
    await generateAbridgedAccountsExcel(makeAbridgedData());
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Cover");
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Balance Sheet");
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Notes");
    expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("Accounting Policies");
  });

  it("calls styleSheet 4 times", async () => {
    await generateAbridgedAccountsExcel(makeAbridgedData());
    expect(mockStyleSheet).toHaveBeenCalledTimes(4);
  });

  it("saves with Abridged Accounts filename pattern", async () => {
    await generateAbridgedAccountsExcel(makeAbridgedData());
    expect(mockSaveWorkbook).toHaveBeenCalledWith(mockWorkbook, "Abridged_Accounts_Test_Company_Ltd_2024.xlsx");
  });
});
