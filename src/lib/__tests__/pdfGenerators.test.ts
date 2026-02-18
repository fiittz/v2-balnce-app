import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Use vi.hoisted for mock variables ────────────────────────
const {
  mockDoc,
  mockCreatePdfDoc,
  mockAddHeader,
  mockAddSection,
  mockAddTable,
  mockAddFooter,
  mockAddSignatures,
  mockSavePdf,
} = vi.hoisted(() => {
  const mockDoc = {
    fake: "doc",
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    setFillColor: vi.fn(),
    text: vi.fn(),
    line: vi.fn(),
    rect: vi.fn(),
    addPage: vi.fn(),
    setPage: vi.fn(),
    save: vi.fn(),
    getNumberOfPages: vi.fn(() => 1),
    internal: { pageSize: { getWidth: () => 210 } },
    lastAutoTable: { finalY: 100 },
    splitTextToSize: vi.fn((text: string) => [text]),
  };
  return {
    mockDoc,
    mockCreatePdfDoc: vi.fn(() => mockDoc),
    mockAddHeader: vi.fn(() => 50),
    mockAddSection: vi.fn((_doc: unknown, _section: unknown, y: number) => y + 20),
    mockAddTable: vi.fn((_doc: unknown, _table: unknown, y: number) => y + 30),
    mockAddFooter: vi.fn(),
    mockAddSignatures: vi.fn((_doc: unknown, _meta: unknown, y: number) => y + 40),
    mockSavePdf: vi.fn(),
  };
});

vi.mock("@/lib/reports/pdfHelpers", () => ({
  createPdfDoc: (...args: unknown[]) => mockCreatePdfDoc(...args),
  addHeader: (...args: unknown[]) => mockAddHeader(...args),
  addSection: (...args: unknown[]) => mockAddSection(...args),
  addTable: (...args: unknown[]) => mockAddTable(...args),
  addFooter: (...args: unknown[]) => mockAddFooter(...args),
  addSignatures: (...args: unknown[]) => mockAddSignatures(...args),
  savePdf: (...args: unknown[]) => mockSavePdf(...args),
}));

vi.mock("@/lib/reports/formatters", () => ({
  fmtDate: vi.fn((d: Date) => d.toISOString().slice(0, 10)),
  fmtTaxYear: vi.fn((y: string) => `Year ended 31 December ${y}`),
}));

import { generateCT1Pdf } from "@/lib/reports/pdf/ct1Pdf";
import { generateForm11Pdf } from "@/lib/reports/pdf/form11Pdf";
import { generateVATPdf } from "@/lib/reports/pdf/vatPdf";
import { generateBalanceSheetPdf } from "@/lib/reports/pdf/balanceSheetPdf";
import { generateAbridgedAccountsPdf } from "@/lib/reports/pdf/abridgedAccountsPdf";
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
// CT1 PDF
// ================================================================
describe("generateCT1Pdf", () => {
  function makeCT1Data(): CT1ReportData {
    return {
      meta: makeMeta(),
      sections: [
        { title: "Company Information", rows: [{ label: "Name", value: "Test Company" }] },
        { title: "Allowable Deductions", rows: [{ label: "Materials", value: "30,000" }] },
        { title: "Trading Profit Adjustment", rows: [{ label: "Net", value: "70,000" }] },
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

  it("calls createPdfDoc", () => {
    generateCT1Pdf(makeCT1Data());
    expect(mockCreatePdfDoc).toHaveBeenCalled();
  });

  it("calls addHeader with CT1 title", () => {
    generateCT1Pdf(makeCT1Data());
    expect(mockAddHeader).toHaveBeenCalledWith(
      mockDoc,
      expect.objectContaining({ companyName: "Test Company Ltd" }),
      "CT1 \u2014 Corporation Tax Return",
    );
  });

  it("calls addSection for each section", () => {
    generateCT1Pdf(makeCT1Data());
    expect(mockAddSection).toHaveBeenCalledTimes(3);
  });

  it("renders Trading Income table before Allowable Deductions section", () => {
    generateCT1Pdf(makeCT1Data());
    const tableCallOrder = mockAddTable.mock.invocationCallOrder;
    const sectionCallOrder = mockAddSection.mock.invocationCallOrder;
    // First addTable (Trading Income) should be before second addSection (Allowable Deductions)
    expect(tableCallOrder[0]).toBeLessThan(sectionCallOrder[1]);
  });

  it("calls addFooter", () => {
    generateCT1Pdf(makeCT1Data());
    expect(mockAddFooter).toHaveBeenCalledWith(mockDoc);
  });

  it("calls savePdf with CT1 filename pattern", () => {
    generateCT1Pdf(makeCT1Data());
    expect(mockSavePdf).toHaveBeenCalledWith(mockDoc, "CT1_Test_Company_Ltd_2024.pdf");
  });
});

// ================================================================
// Form 11 PDF
// ================================================================
describe("generateForm11Pdf", () => {
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
        { title: "Schedule D \u2014 Business Income", rows: [{ label: "Income", value: "100,000" }] },
        { title: "Total Income", rows: [{ label: "Total", value: "150,000" }] },
        { title: "PRSI (Class S)", rows: [{ label: "Rate", value: "4%" }] },
      ],
      tables: [
        { title: "Business Income Breakdown", headers: ["Cat", "Amt"], rows: [["Sales", "100k"]] },
        { title: "Business Expense Breakdown", headers: ["Cat", "Amt"], rows: [["Mat", "30k"]] },
        { title: "Income Tax Calculation", headers: ["Band", "Rate"], rows: [["40k", "20%"]] },
        { title: "Tax Credits", headers: ["Credit", "Amt"], rows: [["Personal", "1,875"]] },
        { title: "Universal Social Charge", headers: ["Band", "Rate"], rows: [["12,012", "0.5%"]] },
      ],
    };
  }

  it("calls createPdfDoc", () => {
    generateForm11Pdf(makeForm11Data());
    expect(mockCreatePdfDoc).toHaveBeenCalled();
  });

  it("calls addHeader with Form 11 title", () => {
    generateForm11Pdf(makeForm11Data());
    expect(mockAddHeader).toHaveBeenCalledWith(mockDoc, expect.anything(), "Form 11 \u2014 Income Tax Return");
  });

  it("calls addSection for each section", () => {
    generateForm11Pdf(makeForm11Data());
    expect(mockAddSection).toHaveBeenCalledTimes(4);
  });

  it("calls addFooter", () => {
    generateForm11Pdf(makeForm11Data());
    expect(mockAddFooter).toHaveBeenCalledWith(mockDoc);
  });

  it("saves with director name in filename", () => {
    generateForm11Pdf(makeForm11Data());
    expect(mockSavePdf).toHaveBeenCalledWith(mockDoc, "Form11_Alice_Murphy_2024.pdf");
  });
});

// ================================================================
// VAT PDF
// ================================================================
describe("generateVATPdf", () => {
  function makeVATData(): VATReportData {
    return {
      meta: makeMeta(),
      sections: [
        { title: "Registration Information", rows: [{ label: "VAT No", value: "IE1234567T" }] },
        { title: "VAT Return Computation", rows: [{ label: "Net VAT", value: "5,000" }] },
      ],
      tables: [
        { title: "Sales Analysis", headers: ["Rate", "Amt"], rows: [["23%", "10,000"]] },
        { title: "Purchases Analysis", headers: ["Rate", "Amt"], rows: [["23%", "5,000"]] },
      ],
      t1Sales: 100000,
      t2Vat: 23000,
      t3Purchases: 50000,
      t4InputVat: 11500,
      netVat: 11500,
    };
  }

  it("calls createPdfDoc", () => {
    generateVATPdf(makeVATData());
    expect(mockCreatePdfDoc).toHaveBeenCalled();
  });

  it("calls addHeader with VAT Return title", () => {
    generateVATPdf(makeVATData());
    expect(mockAddHeader).toHaveBeenCalledWith(mockDoc, expect.anything(), "VAT Return");
  });

  it("renders Registration Information section", () => {
    generateVATPdf(makeVATData());
    expect(mockAddSection).toHaveBeenCalledWith(
      mockDoc,
      expect.objectContaining({ title: "Registration Information" }),
      expect.any(Number),
    );
  });

  it("renders tables for sales and purchases", () => {
    generateVATPdf(makeVATData());
    expect(mockAddTable).toHaveBeenCalledTimes(2);
  });

  it("calls addSignatures", () => {
    generateVATPdf(makeVATData());
    expect(mockAddSignatures).toHaveBeenCalledWith(mockDoc, expect.anything(), expect.any(Number));
  });

  it("saves with VAT filename pattern", () => {
    generateVATPdf(makeVATData());
    expect(mockSavePdf).toHaveBeenCalledWith(mockDoc, "VAT_Return_Test_Company_Ltd_2024.pdf");
  });
});

// ================================================================
// Balance Sheet PDF
// ================================================================
describe("generateBalanceSheetPdf", () => {
  function makeBSData(): BalanceSheetReportData {
    return {
      meta: makeMeta(),
      sections: [
        { title: "Fixed Assets", rows: [{ label: "Equipment", value: "20,000" }] },
        { title: "Current Assets", rows: [{ label: "Bank", value: "50,000" }] },
      ],
      fixedAssets: 20000,
      currentAssets: 50000,
      currentLiabilities: 10000,
      longTermLiabilities: 0,
      netAssets: 60000,
      capitalReserves: 60000,
    };
  }

  it("calls createPdfDoc", () => {
    generateBalanceSheetPdf(makeBSData());
    expect(mockCreatePdfDoc).toHaveBeenCalled();
  });

  it("calls addHeader with Balance Sheet title", () => {
    generateBalanceSheetPdf(makeBSData());
    expect(mockAddHeader).toHaveBeenCalledWith(mockDoc, expect.anything(), "Balance Sheet");
  });

  it("renders all sections", () => {
    generateBalanceSheetPdf(makeBSData());
    expect(mockAddSection).toHaveBeenCalledTimes(2);
  });

  it("calls addSignatures", () => {
    generateBalanceSheetPdf(makeBSData());
    expect(mockAddSignatures).toHaveBeenCalled();
  });

  it("saves with Balance Sheet filename pattern", () => {
    generateBalanceSheetPdf(makeBSData());
    expect(mockSavePdf).toHaveBeenCalledWith(mockDoc, "Balance_Sheet_Test_Company_Ltd_2024.pdf");
  });
});

// ================================================================
// Abridged Accounts PDF
// ================================================================
describe("generateAbridgedAccountsPdf", () => {
  function makeAbridgedData(): AbridgedAccountsReportData {
    return {
      meta: makeMeta(),
      sections: [
        { title: "Directors' Responsibility Statement", rows: [{ label: "Statement", value: "We acknowledge..." }] },
        { title: "Accounting Policies", rows: [{ label: "Basis", value: "Going concern" }] },
        { title: "Abridged Balance Sheet", rows: [{ label: "Total Assets", value: "100,000" }] },
        { title: "Capital and Reserves", rows: [{ label: "Share Capital", value: "100" }] },
        { title: "Notes to the Financial Statements", rows: [{ label: "Note 1", value: "..." }] },
        { title: "Audit Exemption Statement", rows: [{ label: "Exemption", value: "Exempt" }] },
      ],
      directorNames: ["Alice Murphy"],
      companySecretaryName: "Bob Secretary",
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

  it("calls createPdfDoc", () => {
    generateAbridgedAccountsPdf(makeAbridgedData());
    expect(mockCreatePdfDoc).toHaveBeenCalled();
  });

  it("calls addFooter", () => {
    generateAbridgedAccountsPdf(makeAbridgedData());
    expect(mockAddFooter).toHaveBeenCalledWith(mockDoc);
  });

  it("calls addSection for balance sheet sections", () => {
    generateAbridgedAccountsPdf(makeAbridgedData());
    // addSection is called for "Abridged Balance Sheet" and "Capital and Reserves"
    expect(mockAddSection).toHaveBeenCalledWith(
      mockDoc,
      expect.objectContaining({ title: "Abridged Balance Sheet" }),
      expect.any(Number),
    );
  });

  it("saves with Abridged Accounts filename pattern", () => {
    generateAbridgedAccountsPdf(makeAbridgedData());
    expect(mockSavePdf).toHaveBeenCalledWith(mockDoc, "Abridged_Accounts_Test_Company_Ltd_2024.pdf");
  });
});
