import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Use vi.hoisted for all mocks referenced in vi.mock factories ──
const { mockDoc, mockAutoTable, mockLink } = vi.hoisted(() => {
  const mockDoc = {
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    text: vi.fn(),
    line: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
    internal: { pageSize: { getWidth: () => 210 } },
    lastAutoTable: { finalY: 100 },
  };
  const mockAutoTable = vi.fn();
  const mockLink = { href: "", download: "", click: vi.fn() };
  return { mockDoc, mockAutoTable, mockLink };
});

// ── Mock DOM APIs ────────────────────────────────────────────
vi.stubGlobal("document", {
  createElement: vi.fn((tag: string) =>
    tag === "a" ? mockLink : { textContent: "", innerHTML: "" }
  ),
  body: { appendChild: vi.fn(), removeChild: vi.fn() },
});
vi.stubGlobal("URL", {
  createObjectURL: vi.fn(() => "blob:mock"),
  revokeObjectURL: vi.fn(),
});

// Store Blob constructor calls for inspection
const blobInstances: Array<{ parts: unknown; type: string | undefined }> = [];
vi.stubGlobal(
  "Blob",
  vi.fn(function (this: unknown, parts: unknown, opts?: { type?: string }) {
    const instance = { parts, type: opts?.type };
    blobInstances.push(instance);
    return instance;
  })
);

// ── Mock jsPDF ───────────────────────────────────────────────
vi.mock("jspdf", () => ({
  default: function JsPDFMock() {
    return mockDoc;
  },
}));

vi.mock("jspdf-autotable", () => ({
  default: (...args: unknown[]) => mockAutoTable(...args),
}));

// ── Mock date-fns format ─────────────────────────────────────
vi.mock("date-fns", () => ({
  format: vi.fn((date: Date, fmt: string) => {
    if (fmt === "dd/MM/yyyy") return "15/06/2024";
    if (fmt === "yyyy-MM-dd") return "2024-06-15";
    if (fmt === "dd MMMM yyyy") return "15 June 2024";
    if (fmt.includes("'at'")) return "15 June 2024 at 12:00";
    if (fmt === "dd/MM/yyyy HH:mm:ss") return "15/06/2024 12:00:00";
    return "2024-06-15";
  }),
}));

// Type-only imports need no mock
vi.mock("@/components/export/BusinessBankExportQuestionnaire", () => ({}));
vi.mock("@/components/export/DirectorExportQuestionnaire", () => ({}));

import {
  exportToExcel,
  exportToPDF,
  exportDirectorToExcel,
  exportDirectorToPDF,
} from "@/lib/exportTransactions";
import type { PnlCt1Summary, CompanyInfo } from "@/lib/exportTransactions";

// ── Transaction factory ──────────────────────────────────────
interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  type: string;
  vat_rate?: string | null;
  vat_amount?: number | null;
  net_amount?: number | null;
  bank_reference?: string | null;
  receipt_url?: string | null;
  category?: { name: string } | null;
  account?: { name: string } | null;
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    transaction_date: "2024-06-15",
    description: "Test transaction",
    amount: -100,
    type: "expense",
    vat_rate: "23",
    vat_amount: -18.7,
    net_amount: -81.3,
    bank_reference: "REF001",
    receipt_url: null,
    category: { name: "Materials" },
    account: { name: "Business" },
    ...overrides,
  };
}

function makePnlCt1(overrides: Partial<PnlCt1Summary> = {}): PnlCt1Summary {
  return {
    incomeByCategory: { Sales: 100000 },
    totalIncome: 100000,
    directCostsByCategory: {},
    totalDirectCosts: 0,
    expensesByCategory: { Materials: 30000 },
    totalExpenses: 30000,
    revenueRefunds: 0,
    netExpenses: 30000,
    grossProfit: 100000,
    netProfit: 70000,
    ...overrides,
  };
}

function makeQuestionnaire() {
  return {
    automationNoChanges: true,
    automationChanges: {
      vatRegistration: false,
      incomeType: false,
      paymentMethods: false,
      businessActivities: false,
      personalSpending: false,
    },
    automationChangeDate: undefined,
    incomeComplete: true,
    incomeNotes: "",
    expensesCorrect: true,
    expenseNotes: "",
    vatStatus: "cash_basis" as const,
    vatStatusCorrect: true,
    vatStatusChangeDate: undefined,
    rctApplicable: false,
    rctDeductionsCorrect: false,
    rctTotalDeducted: 0,
    rctNotes: "",
    capitalTransactionsCorrect: true,
    capitalNotes: "",
    hasClosingStock: false,
    closingStockValue: 0,
    stockValuationMethod: "" as const,
    hasWip: false,
    wipValue: 0,
    hasTradeDebtors: false,
    tradeDebtorsTotal: 0,
    hasBadDebts: false,
    badDebtsWrittenOff: 0,
    hasTradeCreditorsOutstanding: false,
    tradeCreditorsTotal: 0,
    paymentsCorrect: true,
    paymentNotes: "",
    bankBalanceConfirmed: true,
    vatPositionConfirmed: true,
    fixedAssetsConfirmed: true,
    loansConfirmed: true,
    directorsLoanConfirmed: false,
    directorsLoanDirection: undefined,
    prepaymentsAmount: 0,
    accrualsAmount: 0,
    depreciationConfirmed: false,
    isCloseCompany: false,
    distributedProfitsSufficiently: false,
    hasRelatedPartyTransactions: false,
    relatedPartyNotes: "",
    hasLossesCarriedForward: false,
    lossesAmount: 0,
    finalDeclaration: true,
    preliminaryCTPaid: false,
    preliminaryCTAmount: 0,
    preliminaryCTDate: undefined,
    addBackDepreciation: 0,
    addBackEntertainment: 0,
    addBackOther: 0,
    addBackNotes: "",
    lessCapitalAllowances: 0,
    hasLossesBroughtForward: false,
    lossesBroughtForwardAmount: 0,
    lossesBroughtForwardYear: "",
    claimStartupExemption: false,
    startupExemptionAmount: 0,
    hasDividendsPaid: false,
    dividendsPaidAmount: 0,
    dwtDeducted: 0,
    hasAssetDisposals: false,
    disposals: [],
  };
}

function makeDirectorQuestionnaire() {
  return {
    noChanges: true,
    changes: {
      employmentStatus: false,
      incomeSources: false,
      assessmentStatus: false,
      pensionContributions: false,
      foreignIncome: false,
    },
    changeEffectiveDate: undefined,
    incomeComplete: true,
    incomeNotes: "",
    salaryCorrect: true,
    salaryAmount: 50000,
    dividendsReceived: false,
    dividendsAmount: 0,
    salaryDividendNotes: "",
    bikApplicable: false,
    bikCorrect: false,
    bikEstimatedValue: 0,
    bikNotes: "",
    businessLinksStatus: "yes" as const,
    businessLinkNotes: "",
    reliefsCorrect: true,
    reliefsNotes: "",
    medicalExpensesAmount: 0,
    pensionContributionsAmount: 0,
    rentReliefAmount: 0,
    charitableDonationsAmount: 0,
    remoteWorkingDays: 0,
    spouseHasIncome: false,
    spouseIncomeType: [],
    spouseIncomeAmount: 0,
    spouseReliefs: "",
    preliminaryTaxPaid: "yes" as const,
    preliminaryTaxAmount: "5000",
    preliminaryTaxDate: undefined,
    edgeCases: {
      capitalGains: false,
      foreignIncome: false,
      chargeableBenefits: false,
      none: true,
    },
    propertyDisposals: false,
    shareDisposals: false,
    cryptoDisposals: false,
    inheritanceReceived: false,
    rentalIncomeDetails: false,
    rentalIncomeAmount: 0,
    rentalExpensesAmount: 0,
    finalDeclaration: true,
  };
}

function makeCompanyInfo(overrides: Partial<CompanyInfo> = {}): CompanyInfo {
  return {
    companyName: "Test Company Ltd",
    registeredAddress: "123 Main St, Dublin",
    croNumber: "123456",
    incorporationDate: "2020-01-15",
    taxReference: "1234567T",
    directorNames: ["Alice Murphy"],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  blobInstances.length = 0;
  mockDoc.lastAutoTable = { finalY: 100 };
});

// ================================================================
// exportToExcel
// ================================================================
describe("exportToExcel", () => {
  it("creates CSV with headers", () => {
    exportToExcel([makeTx()]);
    expect(blobInstances.length).toBe(1);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Date,Description,Amount");
    expect(content).toContain("Category");
    expect(content).toContain("VAT Rate");
  });

  it("formats transaction data in CSV rows", () => {
    exportToExcel([makeTx({ description: "Test item", amount: -50 })]);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Test item");
    expect(content).toContain("-50.00");
  });

  it("includes BOM for Excel UTF-8 compatibility", () => {
    exportToExcel([makeTx()]);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content.startsWith("\uFEFF")).toBe(true);
  });

  it("triggers download via anchor element", () => {
    exportToExcel([makeTx()]);
    expect((document.createElement as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("a");
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
  });

  it("uses provided filename", () => {
    exportToExcel([makeTx()], "custom_export.csv");
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("includes P&L/CT1 summary when provided", () => {
    exportToExcel([makeTx()], undefined, undefined, makePnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("PROFIT & LOSS");
    expect(content).toContain("INCOME");
  });

  it("includes questionnaire section when provided", () => {
    exportToExcel([makeTx()], undefined, makeQuestionnaire());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("BUSINESS BANK ACCOUNT FINALISATION QUESTIONNAIRE");
  });
});

// ================================================================
// exportToPDF
// ================================================================
describe("exportToPDF", () => {
  it("creates a jsPDF document and saves", () => {
    exportToPDF([makeTx()]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("renders Transaction Report title", () => {
    exportToPDF([makeTx()]);
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Transaction Report",
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("calls autoTable for Sales Tax Audit groups", () => {
    exportToPDF([makeTx()]);
    expect(mockAutoTable).toHaveBeenCalled();
  });

  it("renders company header when companyInfo provided", () => {
    exportToPDF([makeTx()], undefined, undefined, undefined, makeCompanyInfo());
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Test Company Ltd",
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("renders registered address when companyInfo has it", () => {
    exportToPDF([makeTx()], undefined, undefined, undefined, makeCompanyInfo());
    expect(mockDoc.text).toHaveBeenCalledWith(
      "123 Main St, Dublin",
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("renders P&L section when pnlCt1 provided", () => {
    exportToPDF([makeTx()], undefined, undefined, makePnlCt1());
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Profit & Loss",
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("renders CT1 section when pnlCt1 has taxableProfit", () => {
    exportToPDF(
      [makeTx()],
      undefined,
      undefined,
      makePnlCt1({ taxableProfit: 70000, ctAt125: 8750, totalCT: 8750 })
    );
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Corporation Tax (CT1)",
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("renders questionnaire section when provided", () => {
    exportToPDF([makeTx()], undefined, makeQuestionnaire());
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Business Bank Account Finalisation",
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("renders single director + secretary signatures", () => {
    exportToPDF(
      [makeTx()],
      undefined,
      undefined,
      undefined,
      makeCompanyInfo({ directorNames: ["Alice Murphy"] })
    );
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Director",
      14,
      expect.any(Number)
    );
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Secretary",
      expect.any(Number),
      expect.any(Number)
    );
  });

  it("renders multiple director signatures without secretary", () => {
    exportToPDF(
      [makeTx()],
      undefined,
      undefined,
      undefined,
      makeCompanyInfo({ directorNames: ["Alice Murphy", "Bob Smith"] })
    );
    const directorCalls = mockDoc.text.mock.calls.filter(
      (call: unknown[]) => call[0] === "Director"
    );
    expect(directorCalls.length).toBe(2);
    const secretaryCalls = mockDoc.text.mock.calls.filter(
      (call: unknown[]) => call[0] === "Secretary"
    );
    expect(secretaryCalls.length).toBe(0);
  });

  it("forces income to 0% VAT when RCT option is set", () => {
    const incomeTx = makeTx({
      id: "tx-income",
      type: "income",
      amount: 1000,
      vat_rate: "23",
      vat_amount: 186.99,
      category: { name: "Sales" },
    });
    exportToPDF([incomeTx], undefined, undefined, undefined, undefined, { isRCT: true });
    expect(mockAutoTable).toHaveBeenCalled();
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("calls doc.save with filename", () => {
    exportToPDF([makeTx()], "test_report.pdf");
    expect(mockDoc.save).toHaveBeenCalledWith("test_report.pdf");
  });

  it("uses default filename when none provided", () => {
    exportToPDF([makeTx()]);
    expect(mockDoc.save).toHaveBeenCalledWith(expect.stringContaining("transactions_"));
  });

  it("renders Directors Current Account when pnlCt1 has drawings", () => {
    exportToPDF(
      [makeTx()],
      undefined,
      undefined,
      makePnlCt1({ directorsDrawings: 5000, netDirectorsLoan: -3000 })
    );
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Directors Current Account",
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("excludes Revenue Refund transactions from audit groups", () => {
    const refundTx = makeTx({
      id: "tx-refund",
      type: "expense",
      amount: -500,
      category: { name: "Tax Refund" },
      description: "Revenue refund",
    });
    const normalTx = makeTx({ id: "tx-normal" });
    exportToPDF([refundTx, normalTx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("excludes Director's Drawings from purchase audit groups", () => {
    const drawingsTx = makeTx({
      id: "tx-draw",
      type: "expense",
      amount: -2000,
      category: { name: "Director's Drawings" },
    });
    exportToPDF([drawingsTx, makeTx()]);
    expect(mockDoc.save).toHaveBeenCalled();
  });
});

// ================================================================
// exportDirectorToExcel
// ================================================================
describe("exportDirectorToExcel", () => {
  it("creates CSV with headers", () => {
    exportDirectorToExcel([makeTx()]);
    expect(blobInstances.length).toBe(1);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Date,Description,Amount");
  });

  it("formats transaction rows", () => {
    exportDirectorToExcel([makeTx({ description: "Salary payment" })]);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Salary payment");
  });

  it("includes BOM", () => {
    exportDirectorToExcel([makeTx()]);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content.startsWith("\uFEFF")).toBe(true);
  });

  it("includes director questionnaire when provided", () => {
    exportDirectorToExcel([makeTx()], undefined, makeDirectorQuestionnaire());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("DIRECTOR - PERSONAL ACCOUNT FINALISATION");
  });

  it("uses default filename with director prefix", () => {
    exportDirectorToExcel([makeTx()]);
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

// ================================================================
// exportDirectorToPDF
// ================================================================
describe("exportDirectorToPDF", () => {
  it("creates a jsPDF document", () => {
    exportDirectorToPDF([makeTx()]);
    expect(mockDoc.text).toHaveBeenCalled();
  });

  it("renders Director Personal Account Report title", () => {
    exportDirectorToPDF([makeTx()]);
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Director Personal Account Report",
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("renders company header when companyInfo provided", () => {
    exportDirectorToPDF([makeTx()], undefined, undefined, makeCompanyInfo());
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Test Company Ltd",
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("renders questionnaire section when provided", () => {
    exportDirectorToPDF([makeTx()], undefined, makeDirectorQuestionnaire());
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Personal Account Finalisation (Form 11)",
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("calls autoTable for transaction groups", () => {
    exportDirectorToPDF([makeTx()]);
    expect(mockAutoTable).toHaveBeenCalled();
  });

  it("calls doc.save with filename", () => {
    exportDirectorToPDF([makeTx()], "director_test.pdf");
    expect(mockDoc.save).toHaveBeenCalledWith("director_test.pdf");
  });

  it("uses default filename when none provided", () => {
    exportDirectorToPDF([makeTx()]);
    expect(mockDoc.save).toHaveBeenCalledWith(expect.stringContaining("director_report_"));
  });

  it("renders transaction count", () => {
    exportDirectorToPDF([makeTx(), makeTx({ id: "tx-2" })]);
    expect(mockDoc.text).toHaveBeenCalledWith(
      "2 transactions",
      14,
      expect.any(Number),
      expect.anything()
    );
  });
});
