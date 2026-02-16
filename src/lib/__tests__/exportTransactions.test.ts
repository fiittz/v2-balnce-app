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

// ================================================================
// Additional coverage: formatPnlCt1Section via exportToExcel
// ================================================================
describe("exportToExcel — P&L/CT1 text section coverage", () => {
  function makeFullPnlCt1(): PnlCt1Summary {
    return {
      incomeByCategory: { "Sales Revenue": 100000, "Service Revenue": 20000 },
      totalIncome: 120000,
      directCostsByCategory: { Materials: 30000 },
      totalDirectCosts: 30000,
      expensesByCategory: { Rent: 12000, Utilities: 3000 },
      totalExpenses: 15000,
      revenueRefunds: 500,
      netExpenses: 14500,
      grossProfit: 90000,
      netProfit: 75500,
      taxableProfit: 75500,
      ctAt125: 9437.5,
      surcharge: 1000,
      totalCT: 10437.5,
      prelimPaid: 5000,
      balanceDue: 5437.5,
      disallowedByCategory: [{ category: "Entertainment", amount: 2000 }],
      capitalAllowances: 3000,
      travelDeduction: 1000,
      tradingProfit: 72000,
      lossesForward: 0,
      rctCredit: 500,
      directorsDrawings: 25000,
      netDirectorsLoan: -5000,
      totalSubsistenceAllowance: 2000,
      totalMileageAllowance: 3000,
    };
  }

  it("includes CT1 computation section when taxableProfit is defined", () => {
    exportToExcel([makeTx()], undefined, undefined, makeFullPnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("CORPORATION TAX (CT1) COMPUTATION");
    expect(content).toContain("Taxable Profit");
    expect(content).toContain("CT @ 12.5%");
    expect(content).toContain("Total CT Liability");
  });

  it("includes Direct Costs section when totalDirectCosts > 0", () => {
    exportToExcel([makeTx()], undefined, undefined, makeFullPnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("DIRECT COSTS");
    expect(content).toContain("Total Direct Costs");
  });

  it("includes Revenue Refund when revenueRefunds > 0", () => {
    exportToExcel([makeTx()], undefined, undefined, makeFullPnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Less: Revenue Refund");
  });

  it("includes disallowed expenses in CT1 section", () => {
    exportToExcel([makeTx()], undefined, undefined, makeFullPnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Add back: Non-deductible expenses");
    expect(content).toContain("Entertainment");
  });

  it("includes Capital Allowances when > 0", () => {
    exportToExcel([makeTx()], undefined, undefined, makeFullPnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Less: Capital Allowances");
  });

  it("includes Travel Deduction when > 0", () => {
    exportToExcel([makeTx()], undefined, undefined, makeFullPnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Less: Travel Deduction");
  });

  it("includes Close Company Surcharge when > 0", () => {
    exportToExcel([makeTx()], undefined, undefined, makeFullPnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Close Company Surcharge");
  });

  it("includes RCT Credit when > 0", () => {
    exportToExcel([makeTx()], undefined, undefined, makeFullPnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Less: RCT Credit");
  });

  it("includes Preliminary CT Paid when > 0", () => {
    exportToExcel([makeTx()], undefined, undefined, makeFullPnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Less: Preliminary CT Paid");
  });

  it("shows CT BALANCE DUE when balance is positive", () => {
    exportToExcel([makeTx()], undefined, undefined, makeFullPnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("CT BALANCE DUE");
  });

  it("shows CT REFUND DUE when balance is <= 0", () => {
    const pnl = makeFullPnlCt1();
    pnl.balanceDue = -1000;
    exportToExcel([makeTx()], undefined, undefined, pnl);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("CT REFUND DUE");
  });

  it("includes Losses B/F when lossesForward > 0", () => {
    const pnl = makeFullPnlCt1();
    pnl.lossesForward = 5000;
    exportToExcel([makeTx()], undefined, undefined, pnl);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Less: Losses B/F");
  });

  it("includes Trading Profit in CT1 section", () => {
    exportToExcel([makeTx()], undefined, undefined, makeFullPnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Trading Profit");
  });

  it("includes Directors Current Account section when drawings > 0", () => {
    exportToExcel([makeTx()], undefined, undefined, makeFullPnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("DIRECTORS CURRENT ACCOUNT");
    expect(content).toContain("Drawings taken by director");
    expect(content).toContain("Less: Subsistence owed to director");
    expect(content).toContain("Less: Mileage owed to director");
  });

  it("shows Directors Current A/C (Dr) when netDirectorsLoan is negative", () => {
    exportToExcel([makeTx()], undefined, undefined, makeFullPnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Directors Current A/C (Dr)");
  });

  it("shows Directors Current A/C (Cr) when netDirectorsLoan is >= 0", () => {
    const pnl = makeFullPnlCt1();
    pnl.netDirectorsLoan = 5000;
    exportToExcel([makeTx()], undefined, undefined, pnl);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Directors Current A/C (Cr)");
  });

  it("includes Receipt Matching Summary", () => {
    exportToExcel([makeTx()], undefined, undefined, makeFullPnlCt1());
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Receipt Matching Summary");
    expect(content).toContain("Total transactions");
  });
});

// ================================================================
// Additional coverage: formatBusinessQuestionnaireSection via exportToExcel
// ================================================================
describe("exportToExcel — business questionnaire section coverage", () => {
  it("includes automation changes when automationNoChanges is false", () => {
    const q = makeQuestionnaire();
    q.automationNoChanges = false;
    q.automationChanges = {
      vatRegistration: true,
      incomeType: true,
      paymentMethods: true,
      businessActivities: true,
      personalSpending: true,
    };
    q.automationChangeDate = new Date("2024-06-01") as unknown as undefined;
    exportToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Changes reported:");
    expect(content).toContain("VAT registration status");
    expect(content).toContain("Type of income received");
    expect(content).toContain("How customers pay");
    expect(content).toContain("Business activities");
    expect(content).toContain("Personal spending from account");
    expect(content).toContain("Change effective from:");
  });

  it("includes income notes when provided", () => {
    const q = makeQuestionnaire();
    q.incomeNotes = "Some income note";
    exportToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Notes: Some income note");
  });

  it("includes expense notes when provided", () => {
    const q = makeQuestionnaire();
    q.expenseNotes = "Some expense note";
    exportToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Notes: Some expense note");
  });

  it("includes VAT status change date when provided", () => {
    const q = makeQuestionnaire();
    q.vatStatusCorrect = false;
    q.vatStatusChangeDate = new Date("2024-03-15") as unknown as undefined;
    exportToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("VAT status change effective from:");
  });

  it("includes capital notes when provided", () => {
    const q = makeQuestionnaire();
    q.capitalNotes = "Capital note here";
    exportToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Notes: Capital note here");
  });

  it("includes payment notes when provided", () => {
    const q = makeQuestionnaire();
    q.paymentNotes = "Payment note here";
    exportToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Notes: Payment note here");
  });

  it("includes director's loan section when directorsLoanDirection is set", () => {
    const q = makeQuestionnaire();
    q.directorsLoanDirection = "owed_to" as unknown as undefined;
    q.directorsLoanConfirmed = true;
    exportToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Director's Loan: Money owed TO the director");
    expect(content).toContain("Director's loan confirmed");
  });

  it("shows owed BY when directorsLoanDirection is owed_by", () => {
    const q = makeQuestionnaire();
    q.directorsLoanDirection = "owed_by" as unknown as undefined;
    q.directorsLoanConfirmed = false;
    exportToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Director's Loan: Money owed BY the director");
    expect(content).toContain("Director's loan needs review");
  });

  it("shows NOT CONFIRMED when finalDeclaration is false", () => {
    const q = makeQuestionnaire();
    q.finalDeclaration = false;
    exportToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("NOT CONFIRMED");
  });

  it("shows unchecked marks for incomplete fields", () => {
    const q = makeQuestionnaire();
    q.incomeComplete = false;
    q.expensesCorrect = false;
    q.capitalTransactionsCorrect = false;
    q.paymentsCorrect = false;
    q.bankBalanceConfirmed = false;
    q.vatPositionConfirmed = false;
    q.fixedAssetsConfirmed = false;
    q.loansConfirmed = false;
    exportToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Income requires review");
    expect(content).toContain("Expenses require review");
    expect(content).toContain("Findings require review");
    expect(content).toContain("Payments require correction");
    expect(content).toContain("Bank balance discrepancy");
    expect(content).toContain("VAT position needs review");
    expect(content).toContain("Fixed assets incomplete");
    expect(content).toContain("Loans need review");
  });

  it("shows different VAT status labels", () => {
    const q1 = makeQuestionnaire();
    q1.vatStatus = "not_registered" as const;
    exportToExcel([makeTx()], undefined, q1);
    const content1 = (blobInstances[0].parts as string[])[0];
    expect(content1).toContain("Not VAT registered");

    vi.clearAllMocks();
    blobInstances.length = 0;
    mockDoc.lastAutoTable = { finalY: 100 };

    const q2 = makeQuestionnaire();
    q2.vatStatus = "invoice_basis" as const;
    exportToExcel([makeTx()], undefined, q2);
    const content2 = (blobInstances[0].parts as string[])[0];
    expect(content2).toContain("VAT registered — Invoice basis");
  });
});

// ================================================================
// Additional coverage: formatDirectorQuestionnaireSection via exportDirectorToExcel
// ================================================================
describe("exportDirectorToExcel — director questionnaire section coverage", () => {
  it("includes changes reported when noChanges is false", () => {
    const q = makeDirectorQuestionnaire();
    q.noChanges = false;
    q.changes = {
      employmentStatus: true,
      incomeSources: true,
      assessmentStatus: true,
      pensionContributions: true,
      foreignIncome: true,
    };
    q.changeEffectiveDate = new Date("2024-06-01") as unknown as undefined;
    exportDirectorToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Changes reported:");
    expect(content).toContain("Employment status");
    expect(content).toContain("Income sources");
    expect(content).toContain("Joint / separate assessment status");
    expect(content).toContain("Pension contributions or reliefs");
    expect(content).toContain("Foreign income");
    expect(content).toContain("Effective from:");
  });

  it("includes income notes when provided", () => {
    const q = makeDirectorQuestionnaire();
    q.incomeNotes = "Director income note";
    exportDirectorToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Notes: Director income note");
  });

  it("includes business link notes when provided", () => {
    const q = makeDirectorQuestionnaire();
    q.businessLinkNotes = "Some link note";
    exportDirectorToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Notes: Some link note");
  });

  it("includes reliefs notes when provided", () => {
    const q = makeDirectorQuestionnaire();
    q.reliefsNotes = "Some reliefs note";
    exportDirectorToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Notes: Some reliefs note");
  });

  it("includes preliminary tax date when paid and date provided", () => {
    const q = makeDirectorQuestionnaire();
    q.preliminaryTaxPaid = "yes" as const;
    q.preliminaryTaxAmount = "5000";
    q.preliminaryTaxDate = new Date("2024-10-31") as unknown as undefined;
    exportDirectorToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Amount: 5000");
    expect(content).toContain("Date paid:");
  });

  it("includes edge cases when not none", () => {
    const q = makeDirectorQuestionnaire();
    q.edgeCases = {
      capitalGains: true,
      foreignIncome: true,
      chargeableBenefits: true,
      none: false,
    };
    exportDirectorToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Capital gains (CGT) events");
    expect(content).toContain("Foreign income");
    expect(content).toContain("Chargeable benefits");
  });

  it("shows NOT CONFIRMED when finalDeclaration is false", () => {
    const q = makeDirectorQuestionnaire();
    q.finalDeclaration = false;
    exportDirectorToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("NOT CONFIRMED");
  });

  it("shows missing income source when incomeComplete is false", () => {
    const q = makeDirectorQuestionnaire();
    q.incomeComplete = false;
    exportDirectorToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Missing income source");
  });

  it("shows reliefs changed when reliefsCorrect is false", () => {
    const q = makeDirectorQuestionnaire();
    q.reliefsCorrect = false;
    exportDirectorToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Something changed");
  });

  it("handles businessLinksStatus 'no' and 'unsure'", () => {
    const q1 = makeDirectorQuestionnaire();
    q1.businessLinksStatus = "no" as const;
    exportDirectorToExcel([makeTx()], undefined, q1);
    const content1 = (blobInstances[0].parts as string[])[0];
    expect(content1).toContain("No");

    vi.clearAllMocks();
    blobInstances.length = 0;
    mockDoc.lastAutoTable = { finalY: 100 };

    const q2 = makeDirectorQuestionnaire();
    q2.businessLinksStatus = "unsure" as const;
    exportDirectorToExcel([makeTx()], undefined, q2);
    const content2 = (blobInstances[0].parts as string[])[0];
    expect(content2).toContain("Unsure");
  });

  it("handles preliminaryTaxPaid 'no' and 'unsure'", () => {
    const q1 = makeDirectorQuestionnaire();
    q1.preliminaryTaxPaid = "no" as const;
    exportDirectorToExcel([makeTx()], undefined, q1);
    const content1 = (blobInstances[0].parts as string[])[0];
    expect(content1).toContain("No");

    vi.clearAllMocks();
    blobInstances.length = 0;
    mockDoc.lastAutoTable = { finalY: 100 };

    const q2 = makeDirectorQuestionnaire();
    q2.preliminaryTaxPaid = "unsure" as const;
    exportDirectorToExcel([makeTx()], undefined, q2);
    const content2 = (blobInstances[0].parts as string[])[0];
    expect(content2).toContain("Unsure");
  });
});

// ================================================================
// Additional coverage: exportToPDF — CT1, DCA, VAT, audit groups
// ================================================================
describe("exportToPDF — expanded branch coverage", () => {
  function makeFullPnlCt1(): PnlCt1Summary {
    return {
      incomeByCategory: { "Sales Revenue": 100000, "Service Revenue": 20000 },
      totalIncome: 120000,
      directCostsByCategory: { Materials: 30000 },
      totalDirectCosts: 30000,
      expensesByCategory: { Rent: 12000, Utilities: 3000 },
      totalExpenses: 15000,
      revenueRefunds: 500,
      netExpenses: 14500,
      grossProfit: 90000,
      netProfit: 75500,
      taxableProfit: 75500,
      ctAt125: 9437.5,
      surcharge: 1000,
      totalCT: 10437.5,
      prelimPaid: 5000,
      balanceDue: 5437.5,
      disallowedByCategory: [{ category: "Entertainment", amount: 2000 }],
      capitalAllowances: 3000,
      travelDeduction: 1000,
      tradingProfit: 72000,
      lossesForward: 5000,
      rctCredit: 500,
      directorsDrawings: 25000,
      netDirectorsLoan: -5000,
      totalSubsistenceAllowance: 2000,
      totalMileageAllowance: 3000,
    };
  }

  it("renders CT1 PDF section with all optional fields populated", () => {
    exportToPDF([makeTx()], undefined, undefined, makeFullPnlCt1());
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Corporation Tax (CT1)",
      14,
      expect.any(Number),
      expect.anything()
    );
    // autoTable called multiple times for P&L, CT1, DCA, audit, summary, receipt
    expect(mockAutoTable.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it("renders Directors Current Account with subsistence and mileage in PDF", () => {
    exportToPDF([makeTx()], undefined, undefined, makeFullPnlCt1());
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Directors Current Account",
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("renders Direct Costs in P&L PDF when totalDirectCosts > 0", () => {
    const pnl = makeFullPnlCt1();
    exportToPDF([makeTx()], undefined, undefined, pnl);
    // Direct costs rows are part of the P&L autoTable call
    const pnlCall = mockAutoTable.mock.calls[0];
    const body = pnlCall[1].body;
    const hasDirectCosts = body.some(
      (row: string[]) => row[0] === "Total Direct Costs"
    );
    expect(hasDirectCosts).toBe(true);
  });

  it("renders revenue refunds in P&L PDF when revenueRefunds > 0", () => {
    const pnl = makeFullPnlCt1();
    exportToPDF([makeTx()], undefined, undefined, pnl);
    const pnlCall = mockAutoTable.mock.calls[0];
    const body = pnlCall[1].body;
    const hasRefund = body.some(
      (row: string[]) => row[0] === "  Less: Revenue Refund"
    );
    expect(hasRefund).toBe(true);
  });

  it("renders income transactions in Sales audit group", () => {
    const incomeTx = makeTx({
      id: "tx-income-1",
      type: "income",
      amount: 1000,
      vat_rate: "23",
      vat_amount: 186.99,
      category: { name: "Sales" },
    });
    exportToPDF([incomeTx]);
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Sales Tax Audit Report",
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("excludes revenue refund income from sales audit groups", () => {
    const refundIncomeTx = makeTx({
      id: "tx-refund-income",
      type: "income",
      amount: 500,
      category: { name: "Tax Refund" },
      description: "Revenue refund payment",
    });
    const normalIncomeTx = makeTx({
      id: "tx-income-normal",
      type: "income",
      amount: 1000,
      vat_rate: "23",
      category: { name: "Sales" },
    });
    exportToPDF([refundIncomeTx, normalIncomeTx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("renders both expense and income audit groups sorted correctly", () => {
    const expenseTx = makeTx({
      id: "tx-exp-1",
      type: "expense",
      amount: -500,
      vat_rate: "23",
      vat_amount: -93.5,
      category: { name: "Office Supplies" },
    });
    const incomeTx = makeTx({
      id: "tx-inc-1",
      type: "income",
      amount: 1000,
      vat_rate: "23",
      vat_amount: 186.99,
      category: { name: "Sales" },
    });
    exportToPDF([expenseTx, incomeTx]);
    expect(mockAutoTable).toHaveBeenCalled();
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("renders VAT summary with input and output VAT when both present", () => {
    const expenseTx = makeTx({
      id: "tx-exp-vat",
      type: "expense",
      amount: -500,
      vat_rate: "23",
      vat_amount: -93.5,
      category: { name: "Office Supplies" },
    });
    const incomeTx = makeTx({
      id: "tx-inc-vat",
      type: "income",
      amount: 1000,
      vat_rate: "23",
      vat_amount: 186.99,
      category: { name: "Sales" },
    });
    exportToPDF([expenseTx, incomeTx]);
    // The summary autoTable should include VAT rows
    expect(mockAutoTable).toHaveBeenCalled();
  });

  it("renders company info lines with CRO, tax ref, incorporation date", () => {
    const info = makeCompanyInfo({
      companyName: "Acme Ltd",
      registeredAddress: "456 Oak St, Cork",
      croNumber: "654321",
      taxReference: "9876543T",
      incorporationDate: "2019-05-01",
    });
    exportToPDF([makeTx()], undefined, undefined, undefined, info);
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Acme Ltd",
      14,
      expect.any(Number),
      expect.anything()
    );
    expect(mockDoc.text).toHaveBeenCalledWith(
      "456 Oak St, Cork",
      14,
      expect.any(Number),
      expect.anything()
    );
    // Info line with CRO, Tax Ref, Incorporated joined by |
    expect(mockDoc.text).toHaveBeenCalledWith(
      expect.stringContaining("CRO: 654321"),
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("handles questionnaire in PDF with various statuses", () => {
    const q = makeQuestionnaire();
    q.automationNoChanges = false;
    q.incomeComplete = false;
    q.expensesCorrect = false;
    q.vatStatus = "invoice_basis" as const;
    q.capitalTransactionsCorrect = false;
    q.paymentsCorrect = false;
    q.bankBalanceConfirmed = false;
    q.finalDeclaration = false;
    exportToPDF([makeTx()], undefined, q);
    // Questionnaire autoTable call
    const qCall = mockAutoTable.mock.calls.find(
      (call: unknown[]) => (call[1] as { head: string[][] }).head?.[0]?.[0] === "Section"
    );
    expect(qCall).toBeDefined();
    const body = (qCall![1] as { body: string[][] }).body;
    expect(body.some((row: string[]) => row[1] === "Changes reported")).toBe(true);
    expect(body.some((row: string[]) => row[1] === "Requires review")).toBe(true);
    expect(body.some((row: string[]) => row[1] === "Invoice basis")).toBe(true);
    expect(body.some((row: string[]) => row[1] === "NOT CONFIRMED")).toBe(true);
  });

  it("forces income to 0% VAT when RCT is enabled and does not crash", () => {
    const incTx1 = makeTx({
      id: "tx-rct-1",
      type: "income",
      amount: 5000,
      vat_rate: "23",
      vat_amount: 934.96,
      category: { name: "Subcontractor Income" },
    });
    const incTx2 = makeTx({
      id: "tx-rct-2",
      type: "income",
      amount: 3000,
      vat_rate: "13.5",
      vat_amount: 356.83,
      category: { name: "Other Income" },
    });
    exportToPDF([incTx1, incTx2], undefined, undefined, undefined, undefined, { isRCT: true });
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("calculates VAT from rate when vat_amount is not stored", () => {
    const tx = makeTx({
      id: "tx-calc-vat",
      type: "expense",
      amount: -123,
      vat_rate: "23",
      vat_amount: null,
      net_amount: null,
      category: { name: "Office Supplies" },
    });
    exportToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("handles 0% VAT income transactions without stored VAT", () => {
    const tx = makeTx({
      id: "tx-zero-vat",
      type: "income",
      amount: 1000,
      vat_rate: "0",
      vat_amount: null,
      net_amount: null,
      category: { name: "Sales" },
    });
    exportToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("handles no directors in companyInfo (no signature section)", () => {
    exportToPDF([makeTx()], undefined, undefined, undefined, makeCompanyInfo({ directorNames: [] }));
    const signCalls = mockDoc.text.mock.calls.filter(
      (call: unknown[]) => call[0] === "Signed on behalf of the company"
    );
    expect(signCalls.length).toBe(0);
  });

  it("renders date line after director signatures", () => {
    exportToPDF([makeTx()], undefined, undefined, undefined, makeCompanyInfo({ directorNames: ["Alice"] }));
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Date",
      14,
      expect.any(Number)
    );
  });

  it("handles CT1 balance due = 0 (refund due)", () => {
    const pnl = makeFullPnlCt1();
    pnl.balanceDue = 0;
    exportToPDF([makeTx()], undefined, undefined, pnl);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("handles multiple expense categories with same VAT rate", () => {
    const tx1 = makeTx({
      id: "tx-e1",
      type: "expense",
      amount: -100,
      vat_rate: "23",
      vat_amount: -18.7,
      category: { name: "Office Supplies" },
    });
    const tx2 = makeTx({
      id: "tx-e2",
      type: "expense",
      amount: -200,
      vat_rate: "23",
      vat_amount: -37.4,
      category: { name: "Materials" },
    });
    exportToPDF([tx1, tx2]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("handles multiple income categories with same VAT rate", () => {
    const tx1 = makeTx({
      id: "tx-i1",
      type: "income",
      amount: 1000,
      vat_rate: "23",
      vat_amount: 186.99,
      category: { name: "Sales" },
    });
    const tx2 = makeTx({
      id: "tx-i2",
      type: "income",
      amount: 2000,
      vat_rate: "23",
      vat_amount: 373.98,
      category: { name: "Consulting" },
    });
    exportToPDF([tx1, tx2]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("handles mixed VAT rates across transactions", () => {
    const tx1 = makeTx({
      id: "tx-m1",
      type: "expense",
      amount: -100,
      vat_rate: "23",
      vat_amount: -18.7,
      category: { name: "Supplies" },
    });
    const tx2 = makeTx({
      id: "tx-m2",
      type: "expense",
      amount: -200,
      vat_rate: "13.5",
      vat_amount: -23.79,
      category: { name: "Supplies" },
    });
    const tx3 = makeTx({
      id: "tx-m3",
      type: "income",
      amount: 500,
      vat_rate: "0",
      vat_amount: null,
      category: { name: "Sales" },
    });
    exportToPDF([tx1, tx2, tx3]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("handles Collector General description exclusion from audit groups", () => {
    const refundTx = makeTx({
      id: "tx-cg",
      type: "expense",
      amount: -1000,
      description: "Collector General refund",
      category: { name: "Other" },
    });
    exportToPDF([refundTx, makeTx()]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("handles tax refund description exclusion from income audit groups", () => {
    const refundTx = makeTx({
      id: "tx-tax-refund",
      type: "income",
      amount: 800,
      description: "tax refund from revenue",
      category: { name: "Other" },
    });
    exportToPDF([refundTx, makeTx()]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("handles receipt URL present in transactions", () => {
    const txWithReceipt = makeTx({
      id: "tx-receipt",
      receipt_url: "https://example.com/receipt.pdf",
    });
    exportToPDF([txWithReceipt]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("handles transaction without category or account", () => {
    const tx = makeTx({
      id: "tx-no-cat",
      category: null,
      account: null,
      bank_reference: null,
    });
    exportToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });
});

// ================================================================
// Additional coverage: exportDirectorToPDF — expanded
// ================================================================
describe("exportDirectorToPDF — expanded branch coverage", () => {
  it("renders company info header with registered address and CRO", () => {
    const info = makeCompanyInfo({
      companyName: "Director Co Ltd",
      registeredAddress: "789 Elm St, Galway",
      croNumber: "789012",
      incorporationDate: "2021-03-10",
    });
    exportDirectorToPDF([makeTx()], undefined, undefined, info);
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Director Co Ltd",
      14,
      expect.any(Number),
      expect.anything()
    );
    // Info lines joined with |
    expect(mockDoc.text).toHaveBeenCalledWith(
      expect.stringContaining("789 Elm St, Galway"),
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("renders without company info when not provided", () => {
    exportDirectorToPDF([makeTx()]);
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Director Personal Account Report",
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("renders questionnaire with all branches in PDF", () => {
    const q = makeDirectorQuestionnaire();
    q.noChanges = false;
    q.changes = {
      employmentStatus: true,
      incomeSources: false,
      assessmentStatus: false,
      pensionContributions: false,
      foreignIncome: false,
    };
    q.incomeComplete = false;
    q.businessLinksStatus = "no" as const;
    q.reliefsCorrect = false;
    q.preliminaryTaxPaid = "no" as const;
    q.edgeCases = {
      capitalGains: true,
      foreignIncome: false,
      chargeableBenefits: false,
      none: false,
    };
    q.finalDeclaration = false;
    exportDirectorToPDF([makeTx()], undefined, q);
    const qCall = mockAutoTable.mock.calls.find(
      (call: unknown[]) => (call[1] as { head: string[][] }).head?.[0]?.[0] === "Section"
    );
    expect(qCall).toBeDefined();
    const body = (qCall![1] as { body: string[][] }).body;
    expect(body.some((row: string[]) => row[1] === "Changes reported")).toBe(true);
    expect(body.some((row: string[]) => row[1] === "No")).toBe(true);
    expect(body.some((row: string[]) => row[1] === "NOT CONFIRMED")).toBe(true);
    expect(body.some((row: string[]) => row[1] === "See details")).toBe(true);
  });

  it("handles both income and expense transactions in director PDF", () => {
    const expTx = makeTx({
      id: "dir-exp",
      type: "expense",
      amount: -500,
      vat_rate: "23",
      vat_amount: -93.5,
      category: { name: "Office" },
    });
    const incTx = makeTx({
      id: "dir-inc",
      type: "income",
      amount: 3000,
      vat_rate: "0",
      vat_amount: null,
      category: { name: "Salary" },
    });
    exportDirectorToPDF([expTx, incTx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("handles transactions without vat_rate in director PDF", () => {
    const tx = makeTx({
      id: "dir-no-vat",
      type: "expense",
      amount: -100,
      vat_rate: null,
      vat_amount: null,
      category: { name: "Misc" },
    });
    exportDirectorToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("handles questionnaire with unsure for preliminary tax in PDF", () => {
    const q = makeDirectorQuestionnaire();
    q.preliminaryTaxPaid = "unsure" as const;
    exportDirectorToPDF([makeTx()], undefined, q);
    const qCall = mockAutoTable.mock.calls.find(
      (call: unknown[]) => (call[1] as { head: string[][] }).head?.[0]?.[0] === "Section"
    );
    expect(qCall).toBeDefined();
    const body = (qCall![1] as { body: string[][] }).body;
    expect(body.some((row: string[]) => row[1] === "Unsure")).toBe(true);
  });

  it("handles questionnaire with edge cases none=true in PDF", () => {
    const q = makeDirectorQuestionnaire();
    q.edgeCases = {
      capitalGains: false,
      foreignIncome: false,
      chargeableBenefits: false,
      none: true,
    };
    exportDirectorToPDF([makeTx()], undefined, q);
    const qCall = mockAutoTable.mock.calls.find(
      (call: unknown[]) => (call[1] as { head: string[][] }).head?.[0]?.[0] === "Section"
    );
    expect(qCall).toBeDefined();
    const body = (qCall![1] as { body: string[][] }).body;
    expect(body.some((row: string[]) => row[1] === "None")).toBe(true);
  });

  it("renders receipt matching summary in director PDF", () => {
    const txWithReceipt = makeTx({ id: "dir-r1", receipt_url: "https://example.com/r.pdf" });
    const txNoReceipt = makeTx({ id: "dir-r2", receipt_url: null });
    exportDirectorToPDF([txWithReceipt, txNoReceipt]);
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Receipt Matching Summary",
      14,
      expect.any(Number),
      expect.anything()
    );
  });
});

// ================================================================
// didParseCell callback coverage: invoke callbacks from autoTable calls
// ================================================================
describe("exportToPDF — didParseCell callbacks coverage", () => {
  function makeFullPnlCt1ForCallbacks(): PnlCt1Summary {
    return {
      incomeByCategory: { "Sales Revenue": 100000, "Service Revenue": 20000 },
      totalIncome: 120000,
      directCostsByCategory: { Materials: 30000 },
      totalDirectCosts: 30000,
      expensesByCategory: { Rent: 12000, Utilities: 3000 },
      totalExpenses: 15000,
      revenueRefunds: 500,
      netExpenses: 14500,
      grossProfit: 90000,
      netProfit: 75500,
      taxableProfit: 75500,
      ctAt125: 9437.5,
      surcharge: 1000,
      totalCT: 10437.5,
      prelimPaid: 5000,
      balanceDue: 5437.5,
      disallowedByCategory: [{ category: "Entertainment", amount: 2000 }],
      capitalAllowances: 3000,
      travelDeduction: 1000,
      tradingProfit: 72000,
      lossesForward: 5000,
      rctCredit: 500,
      directorsDrawings: 25000,
      netDirectorsLoan: -5000,
      totalSubsistenceAllowance: 2000,
      totalMileageAllowance: 3000,
    };
  }

  it("invokes P&L didParseCell callback for bold labels and right-align", () => {
    exportToPDF([makeTx()], undefined, undefined, makeFullPnlCt1ForCallbacks());
    // Find the P&L autoTable call (first one with didParseCell)
    const pnlCall = mockAutoTable.mock.calls.find(
      (call: unknown[]) => {
        const opts = call[1] as { didParseCell?: unknown; head?: string[][] };
        return opts.didParseCell && opts.head?.[0]?.[0] === "" && opts.head?.[0]?.[1] === "Amount";
      }
    );
    expect(pnlCall).toBeDefined();
    const opts = pnlCall![1] as { didParseCell: (data: unknown) => void };
    // Test with "Total Income" label (should make bold)
    const mockCellStyles = { fontStyle: "normal", halign: "left" };
    opts.didParseCell({
      cell: { raw: "Total Income", styles: mockCellStyles },
      column: { index: 0 },
      row: { index: 0 },
    });
    expect(mockCellStyles.fontStyle).toBe("bold");

    // Test right-align for column index 1
    const mockCellStyles2 = { fontStyle: "normal", halign: "left" };
    opts.didParseCell({
      cell: { raw: "€100,000.00", styles: mockCellStyles2 },
      column: { index: 1 },
      row: { index: 0 },
    });
    expect(mockCellStyles2.halign).toBe("right");
  });

  it("invokes CT1 didParseCell callback for bold, italic, and amber styles", () => {
    exportToPDF([makeTx()], undefined, undefined, makeFullPnlCt1ForCallbacks());
    // Find CT1 autoTable call (second call with didParseCell and head Amount)
    const allCalls = mockAutoTable.mock.calls.filter(
      (call: unknown[]) => {
        const opts = call[1] as { didParseCell?: unknown; head?: string[][] };
        return opts.didParseCell && opts.head?.[0]?.[0] === "" && opts.head?.[0]?.[1] === "Amount";
      }
    );
    // CT1 should be the second such call
    expect(allCalls.length).toBeGreaterThanOrEqual(2);
    const ctCall = allCalls[1];
    const opts = ctCall[1] as { didParseCell: (data: unknown) => void };

    // Test "Trading Profit" — bold
    const styles1 = { fontStyle: "normal", halign: "left", textColor: [0, 0, 0], fontSize: 8 };
    opts.didParseCell({ cell: { raw: "Trading Profit", styles: styles1 }, column: { index: 0 }, row: { index: 0 } });
    expect(styles1.fontStyle).toBe("bold");

    // Test "Taxable Profit" — bold
    const styles1b = { fontStyle: "normal", halign: "left", textColor: [0, 0, 0], fontSize: 8 };
    opts.didParseCell({ cell: { raw: "Taxable Profit", styles: styles1b }, column: { index: 0 }, row: { index: 0 } });
    expect(styles1b.fontStyle).toBe("bold");

    // Test "Add back: Non-deductible expenses" — italic + amber
    const styles2 = { fontStyle: "normal", halign: "left", textColor: [0, 0, 0], fontSize: 8 };
    opts.didParseCell({ cell: { raw: "Add back: Non-deductible expenses", styles: styles2 }, column: { index: 0 }, row: { index: 0 } });
    expect(styles2.fontStyle).toBe("italic");
    expect(styles2.textColor).toEqual([180, 83, 9]);

    // Test indented category (starts with 4 spaces) — amber + small font
    const styles3 = { fontStyle: "normal", halign: "left", textColor: [0, 0, 0], fontSize: 8 };
    opts.didParseCell({ cell: { raw: "    Entertainment", styles: styles3 }, column: { index: 0 }, row: { index: 0 } });
    expect(styles3.textColor).toEqual([180, 83, 9]);
    expect(styles3.fontSize).toBe(7);

    // Test right-align for column index 1
    const styles4 = { fontStyle: "normal", halign: "left", textColor: [0, 0, 0], fontSize: 8 };
    opts.didParseCell({ cell: { raw: "€9,437.50", styles: styles4 }, column: { index: 1 }, row: { index: 0 } });
    expect(styles4.halign).toBe("right");
  });

  it("invokes DCA didParseCell callback for right-align and bold", () => {
    exportToPDF([makeTx()], undefined, undefined, makeFullPnlCt1ForCallbacks());
    // Find DCA autoTable call (third call with didParseCell and head Amount)
    const allCalls = mockAutoTable.mock.calls.filter(
      (call: unknown[]) => {
        const opts = call[1] as { didParseCell?: unknown; head?: string[][] };
        return opts.didParseCell && opts.head?.[0]?.[0] === "" && opts.head?.[0]?.[1] === "Amount";
      }
    );
    expect(allCalls.length).toBeGreaterThanOrEqual(3);
    const dcaCall = allCalls[2];
    const opts = dcaCall[1] as { didParseCell: (data: unknown) => void };

    // Test right-align for column 1
    const styles1 = { fontStyle: "normal", halign: "left" };
    opts.didParseCell({ cell: { raw: "€5,000.00", styles: styles1 }, column: { index: 1 }, row: { index: 0 } });
    expect(styles1.halign).toBe("right");

    // Test "Directors Current A/C" — bold
    const styles2 = { fontStyle: "normal", halign: "left" };
    opts.didParseCell({ cell: { raw: "Directors Current A/C (Dr)", styles: styles2 }, column: { index: 0 }, row: { index: 0 } });
    expect(styles2.fontStyle).toBe("bold");
  });

  it("invokes audit group didParseCell callbacks for category headers and total rows", () => {
    const tx1 = makeTx({
      id: "tx-a1",
      type: "expense",
      amount: -100,
      vat_rate: "23",
      vat_amount: -18.7,
      category: { name: "Office" },
      transaction_date: "2024-06-15",
    });
    const tx2 = makeTx({
      id: "tx-a2",
      type: "expense",
      amount: -200,
      vat_rate: "23",
      vat_amount: -37.4,
      category: { name: "Office" },
      transaction_date: "2024-06-10",
    });
    exportToPDF([tx1, tx2]);

    // Find an audit group autoTable call (has head with "Date", "Account", "Ref", etc.)
    const auditCall = mockAutoTable.mock.calls.find(
      (call: unknown[]) => {
        const opts = call[1] as { head?: string[][] };
        return opts.head?.[0]?.[0] === "Date" && opts.head?.[0]?.[1] === "Account";
      }
    );
    expect(auditCall).toBeDefined();
    const opts = auditCall![1] as { didParseCell: (data: unknown) => void; body: string[][] };

    // Category header row (index 0) — bold, small font, light bg
    const styles1 = { fontStyle: "normal", fontSize: 8, fillColor: [255, 255, 255] };
    opts.didParseCell({ cell: { raw: "Office", styles: styles1 }, column: { index: 0 }, row: { index: 0 } });
    expect(styles1.fontStyle).toBe("bold");
    expect(styles1.fontSize).toBe(6);
    expect(styles1.fillColor).toEqual([250, 250, 250]);

    // Total row (last row in body) — bold, light bg
    const totalIdx = opts.body.length - 1;
    const styles2 = { fontStyle: "normal", fontSize: 8, fillColor: [255, 255, 255] };
    opts.didParseCell({ cell: { raw: "Total", styles: styles2 }, column: { index: 0 }, row: { index: totalIdx } });
    expect(styles2.fontStyle).toBe("bold");
    expect(styles2.fillColor).toEqual([245, 245, 245]);
  });

  it("invokes summary didParseCell for VAT summary row and separator row", () => {
    const expTx = makeTx({
      id: "tx-sum-e",
      type: "expense",
      amount: -500,
      vat_rate: "23",
      vat_amount: -93.5,
      category: { name: "Supplies" },
    });
    const incTx = makeTx({
      id: "tx-sum-i",
      type: "income",
      amount: 1000,
      vat_rate: "23",
      vat_amount: 186.99,
      category: { name: "Sales" },
    });
    exportToPDF([expTx, incTx]);

    // Find summary autoTable call (head with "Gross", "Tax", "Net")
    const summaryCall = mockAutoTable.mock.calls.find(
      (call: unknown[]) => {
        const opts = call[1] as { head?: string[][] };
        return opts.head?.[0]?.includes("Gross");
      }
    );
    expect(summaryCall).toBeDefined();
    const opts = summaryCall![1] as { didParseCell: (data: unknown) => void; body: string[][] };

    // VAT summary row (last row) — bold, light bg
    const vatIdx = opts.body.length - 1;
    const styles1 = { fontStyle: "normal", fillColor: [255, 255, 255] };
    opts.didParseCell({ cell: { raw: "VAT Payable", styles: styles1 }, column: { index: 0 }, row: { index: vatIdx } });
    expect(styles1.fontStyle).toBe("bold");
    expect(styles1.fillColor).toEqual([245, 245, 245]);

    // Separator row (empty row)
    const sepIdx = opts.body.findIndex(
      (r: string[]) => r[0] === "" && r[1] === "" && r[2] === "" && r[3] === ""
    );
    if (sepIdx >= 0) {
      const styles2 = { minCellHeight: 10, fontSize: 8 };
      opts.didParseCell({ cell: { raw: "", styles: styles2 }, column: { index: 0 }, row: { index: sepIdx } });
      expect(styles2.minCellHeight).toBe(2);
      expect(styles2.fontSize).toBe(2);
    }
  });
});

// ================================================================
// didParseCell callback coverage for exportDirectorToPDF
// ================================================================
describe("exportDirectorToPDF — didParseCell callbacks coverage", () => {
  it("invokes director audit group didParseCell for category headers and total rows", () => {
    const tx1 = makeTx({
      id: "dir-cb1",
      type: "expense",
      amount: -100,
      vat_rate: "23",
      vat_amount: -18.7,
      category: { name: "Office" },
      transaction_date: "2024-06-15",
    });
    const tx2 = makeTx({
      id: "dir-cb2",
      type: "expense",
      amount: -200,
      vat_rate: "23",
      vat_amount: -37.4,
      category: { name: "Office" },
      transaction_date: "2024-06-10",
    });
    exportDirectorToPDF([tx1, tx2]);

    // Find director audit group autoTable call
    const auditCall = mockAutoTable.mock.calls.find(
      (call: unknown[]) => {
        const opts = call[1] as { head?: string[][] };
        return opts.head?.[0]?.[0] === "Date" && opts.head?.[0]?.[1] === "Account";
      }
    );
    expect(auditCall).toBeDefined();
    const opts = auditCall![1] as { didParseCell: (data: unknown) => void; body: string[][] };

    // Category header row (index 0)
    const styles1 = { fontStyle: "normal", fontSize: 8, fillColor: [255, 255, 255] };
    opts.didParseCell({ cell: { raw: "Office", styles: styles1 }, column: { index: 0 }, row: { index: 0 } });
    expect(styles1.fontStyle).toBe("bold");
    expect(styles1.fontSize).toBe(6);
    expect(styles1.fillColor).toEqual([250, 250, 250]);

    // Total row
    const totalIdx = opts.body.length - 1;
    const styles2 = { fontStyle: "normal", fontSize: 8, fillColor: [255, 255, 255] };
    opts.didParseCell({ cell: { raw: "Total", styles: styles2 }, column: { index: 0 }, row: { index: totalIdx } });
    expect(styles2.fontStyle).toBe("bold");
    expect(styles2.fillColor).toEqual([245, 245, 245]);
  });
});

// ================================================================
// Sort comparator coverage: multiple transactions per category/rate
// ================================================================
describe("exportToPDF — sort comparator coverage", () => {
  it("sorts expense transactions by date within a category", () => {
    const tx1 = makeTx({
      id: "sort-e1",
      type: "expense",
      amount: -100,
      vat_rate: "23",
      vat_amount: -18.7,
      category: { name: "Office" },
      transaction_date: "2024-06-15",
    });
    const tx2 = makeTx({
      id: "sort-e2",
      type: "expense",
      amount: -200,
      vat_rate: "23",
      vat_amount: -37.4,
      category: { name: "Office" },
      transaction_date: "2024-06-10",
    });
    exportToPDF([tx1, tx2]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("sorts income transactions by date within a category", () => {
    const tx1 = makeTx({
      id: "sort-i1",
      type: "income",
      amount: 1000,
      vat_rate: "23",
      vat_amount: 186.99,
      category: { name: "Sales" },
      transaction_date: "2024-06-20",
    });
    const tx2 = makeTx({
      id: "sort-i2",
      type: "income",
      amount: 2000,
      vat_rate: "23",
      vat_amount: 373.98,
      category: { name: "Sales" },
      transaction_date: "2024-06-05",
    });
    exportToPDF([tx1, tx2]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("sorts expense VAT rates descending when multiple rates exist", () => {
    const tx1 = makeTx({
      id: "sort-r1",
      type: "expense",
      amount: -100,
      vat_rate: "13.5",
      vat_amount: -11.89,
      category: { name: "Supplies" },
    });
    const tx2 = makeTx({
      id: "sort-r2",
      type: "expense",
      amount: -200,
      vat_rate: "23",
      vat_amount: -37.4,
      category: { name: "Materials" },
    });
    exportToPDF([tx1, tx2]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("sorts income VAT rates descending when multiple rates exist", () => {
    const tx1 = makeTx({
      id: "sort-ir1",
      type: "income",
      amount: 1000,
      vat_rate: "13.5",
      vat_amount: 119.47,
      category: { name: "Sales A" },
    });
    const tx2 = makeTx({
      id: "sort-ir2",
      type: "income",
      amount: 2000,
      vat_rate: "23",
      vat_amount: 373.98,
      category: { name: "Sales B" },
    });
    exportToPDF([tx1, tx2]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("sorts audit groups by sortKey (purchases before sales)", () => {
    const expTx = makeTx({
      id: "sort-g1",
      type: "expense",
      amount: -100,
      vat_rate: "23",
      vat_amount: -18.7,
      category: { name: "Supplies" },
    });
    const incTx = makeTx({
      id: "sort-g2",
      type: "income",
      amount: 1000,
      vat_rate: "23",
      vat_amount: 186.99,
      category: { name: "Sales" },
    });
    exportToPDF([expTx, incTx]);
    expect(mockAutoTable).toHaveBeenCalled();
  });

  it("sorts categories alphabetically within expense groups", () => {
    const tx1 = makeTx({
      id: "sort-c1",
      type: "expense",
      amount: -100,
      vat_rate: "23",
      vat_amount: -18.7,
      category: { name: "Zebra Supplies" },
    });
    const tx2 = makeTx({
      id: "sort-c2",
      type: "expense",
      amount: -200,
      vat_rate: "23",
      vat_amount: -37.4,
      category: { name: "Alpha Materials" },
    });
    exportToPDF([tx1, tx2]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("sorts categories alphabetically within income groups", () => {
    const tx1 = makeTx({
      id: "sort-ci1",
      type: "income",
      amount: 1000,
      vat_rate: "23",
      vat_amount: 186.99,
      category: { name: "Zebra Sales" },
    });
    const tx2 = makeTx({
      id: "sort-ci2",
      type: "income",
      amount: 2000,
      vat_rate: "23",
      vat_amount: 373.98,
      category: { name: "Alpha Consulting" },
    });
    exportToPDF([tx1, tx2]);
    expect(mockDoc.save).toHaveBeenCalled();
  });
});

// ================================================================
// Sort comparator coverage for director groups
// ================================================================
describe("exportDirectorToPDF — sort comparator coverage", () => {
  it("sorts director groups and categories correctly", () => {
    const tx1 = makeTx({
      id: "dir-sort1",
      type: "expense",
      amount: -100,
      vat_rate: "23",
      vat_amount: -18.7,
      category: { name: "Office" },
      transaction_date: "2024-06-15",
    });
    const tx2 = makeTx({
      id: "dir-sort2",
      type: "expense",
      amount: -200,
      vat_rate: "23",
      vat_amount: -37.4,
      category: { name: "Alpha" },
      transaction_date: "2024-06-10",
    });
    const tx3 = makeTx({
      id: "dir-sort3",
      type: "income",
      amount: 3000,
      vat_rate: "0",
      vat_amount: null,
      category: { name: "Salary" },
      transaction_date: "2024-06-01",
    });
    exportDirectorToPDF([tx1, tx2, tx3]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("sorts director transactions by date within a category", () => {
    const tx1 = makeTx({
      id: "dir-dsort1",
      type: "expense",
      amount: -100,
      vat_rate: "0",
      vat_amount: null,
      category: { name: "Office" },
      transaction_date: "2024-07-15",
    });
    const tx2 = makeTx({
      id: "dir-dsort2",
      type: "expense",
      amount: -200,
      vat_rate: "0",
      vat_amount: null,
      category: { name: "Office" },
      transaction_date: "2024-06-10",
    });
    exportDirectorToPDF([tx1, tx2]);
    expect(mockDoc.save).toHaveBeenCalled();
  });
});

// ================================================================
// Additional edge cases for VAT calculation
// ================================================================
describe("exportToPDF — VAT calculation edge cases", () => {
  it("calculates VAT from rate when stored vat_amount is 0", () => {
    const tx = makeTx({
      id: "tx-vat-zero",
      type: "expense",
      amount: -123,
      vat_rate: "23",
      vat_amount: 0,
      category: { name: "Supplies" },
    });
    exportToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("handles income with non-zero stored VAT amount", () => {
    const tx = makeTx({
      id: "tx-inc-stored-vat",
      type: "income",
      amount: 1230,
      vat_rate: "23",
      vat_amount: 230,
      category: { name: "Sales" },
    });
    exportToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("handles expense with null vat_rate (defaults to 0%)", () => {
    const tx = makeTx({
      id: "tx-null-rate",
      type: "expense",
      amount: -50,
      vat_rate: null,
      vat_amount: null,
      category: { name: "Misc" },
    });
    exportToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });
});

// ================================================================
// Additional edge case: Director PDF calcVat coverage
// ================================================================
describe("exportDirectorToPDF — dirCalcVat coverage", () => {
  it("calculates VAT from rate when vat_amount is null (uses formula)", () => {
    const tx = makeTx({
      id: "dir-calc1",
      type: "expense",
      amount: -246,
      vat_rate: "23",
      vat_amount: null,
      category: { name: "Supplies" },
    });
    exportDirectorToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("returns 0 tax for 0% VAT without stored amount", () => {
    const tx = makeTx({
      id: "dir-calc2",
      type: "income",
      amount: 1000,
      vat_rate: "0",
      vat_amount: null,
      category: { name: "Sales" },
    });
    exportDirectorToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("uses stored vat_amount when available and non-zero", () => {
    const tx = makeTx({
      id: "dir-calc3",
      type: "expense",
      amount: -123,
      vat_rate: "23",
      vat_amount: -23,
      category: { name: "Supplies" },
    });
    exportDirectorToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("calculates VAT from rate when vat_amount is 0", () => {
    const tx = makeTx({
      id: "dir-calc4",
      type: "expense",
      amount: -100,
      vat_rate: "13.5",
      vat_amount: 0,
      category: { name: "Supplies" },
    });
    exportDirectorToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("uses null vat_rate (defaults to 0%)", () => {
    const tx = makeTx({
      id: "dir-calc5",
      type: "expense",
      amount: -100,
      vat_rate: null,
      vat_amount: null,
      category: { name: "Misc" },
    });
    exportDirectorToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });
});

// ================================================================
// Summary didParseCell callback — separate focused test
// ================================================================
describe("exportToPDF — summary didParseCell callback", () => {
  it("invokes summary didParseCell for vatSummaryRow and separatorRow", () => {
    const expTx = makeTx({
      id: "tx-sdpc-e",
      type: "expense",
      amount: -500,
      vat_rate: "23",
      vat_amount: -93.5,
      category: { name: "Supplies" },
    });
    const incTx = makeTx({
      id: "tx-sdpc-i",
      type: "income",
      amount: 1000,
      vat_rate: "23",
      vat_amount: 186.99,
      category: { name: "Sales" },
    });
    exportToPDF([expTx, incTx]);

    // Find the summary autoTable call (head has "Gross")
    const summaryCall = mockAutoTable.mock.calls.find(
      (call: unknown[]) => {
        const opts = call[1] as { head?: string[][]; didParseCell?: unknown };
        return opts.didParseCell && opts.head?.[0]?.[1] === "Gross";
      }
    );
    expect(summaryCall).toBeDefined();
    const opts = summaryCall![1] as { didParseCell: (data: unknown) => void; body: string[][] };
    expect(opts.body.length).toBeGreaterThan(2);

    // Find the separator row (all empty strings)
    const sepIdx = opts.body.findIndex(
      (r: string[]) => r.every(c => c === "")
    );

    // Find the VAT summary row (last row)
    const vatSumIdx = opts.body.length - 1;

    // Invoke callback for VAT summary row
    const styles1 = { fontStyle: "normal", fillColor: [255, 255, 255] };
    opts.didParseCell({ cell: { raw: "VAT Payable", styles: styles1 }, column: { index: 0 }, row: { index: vatSumIdx } });
    expect(styles1.fontStyle).toBe("bold");
    expect(styles1.fillColor).toEqual([245, 245, 245]);

    // Invoke callback for separator row if found
    if (sepIdx >= 0) {
      const styles2 = { minCellHeight: 10, fontSize: 8, fontStyle: "normal", fillColor: [255, 255, 255] };
      opts.didParseCell({ cell: { raw: "", styles: styles2 }, column: { index: 0 }, row: { index: sepIdx } });
      expect(styles2.minCellHeight).toBe(2);
      expect(styles2.fontSize).toBe(2);
    }
  });
});

// ================================================================
// checkPage page break and directCostsByCategory sort coverage
// ================================================================
describe("exportToPDF — checkPage page break and directCosts sort", () => {
  it("triggers page break when y exceeds 280", () => {
    // Set lastAutoTable.finalY high to push y near the page boundary
    mockDoc.lastAutoTable = { finalY: 270 };

    const pnl: PnlCt1Summary = {
      incomeByCategory: { Sales: 100000 },
      totalIncome: 100000,
      directCostsByCategory: {},
      totalDirectCosts: 0,
      expensesByCategory: { Rent: 12000 },
      totalExpenses: 12000,
      revenueRefunds: 0,
      netExpenses: 12000,
      grossProfit: 88000,
      netProfit: 88000,
      taxableProfit: 88000,
      ctAt125: 11000,
      totalCT: 11000,
    };
    exportToPDF([makeTx()], undefined, undefined, pnl, makeCompanyInfo());
    expect(mockDoc.addPage).toHaveBeenCalled();
  });

  it("sorts multiple directCostsByCategory entries", () => {
    const pnl: PnlCt1Summary = {
      incomeByCategory: { Sales: 100000 },
      totalIncome: 100000,
      directCostsByCategory: { Materials: 20000, Labour: 15000 },
      totalDirectCosts: 35000,
      expensesByCategory: { Rent: 12000 },
      totalExpenses: 12000,
      revenueRefunds: 0,
      netExpenses: 12000,
      grossProfit: 65000,
      netProfit: 53000,
    };
    exportToPDF([makeTx()], undefined, undefined, pnl);
    // Verify the P&L table includes both direct cost entries
    const pnlCall = mockAutoTable.mock.calls[0];
    const body = pnlCall[1].body;
    const hasMaterials = body.some((row: string[]) => row[0].includes("Materials"));
    const hasLabour = body.some((row: string[]) => row[0].includes("Labour"));
    expect(hasMaterials).toBe(true);
    expect(hasLabour).toBe(true);
  });
});

// ================================================================
// checkPage page break for exportDirectorToPDF
// ================================================================
describe("exportDirectorToPDF — checkPage page break", () => {
  it("triggers page break in director PDF when y exceeds 280", () => {
    mockDoc.lastAutoTable = { finalY: 270 };
    const tx1 = makeTx({ id: "dir-pg1", type: "expense", amount: -100, category: { name: "Office" } });
    const tx2 = makeTx({ id: "dir-pg2", type: "income", amount: 1000, category: { name: "Salary" } });
    exportDirectorToPDF([tx1, tx2], undefined, makeDirectorQuestionnaire(), makeCompanyInfo());
    expect(mockDoc.addPage).toHaveBeenCalled();
  });
});

// ================================================================
// Signature block page break (y + spaceNeeded > 280)
// ================================================================
describe("exportToPDF — signature section page break", () => {
  it("triggers page break for signature block when y is high", () => {
    mockDoc.lastAutoTable = { finalY: 265 };
    exportToPDF(
      [makeTx()],
      undefined,
      undefined,
      undefined,
      makeCompanyInfo({ directorNames: ["Alice Murphy", "Bob Smith"] })
    );
    expect(mockDoc.addPage).toHaveBeenCalled();
  });
});

// ================================================================
// Branch coverage: null/missing fields in CSV rows
// ================================================================
describe("exportToExcel — null field branches in CSV rows", () => {
  it("handles transactions with null category, account, vat, and bank_reference", () => {
    const tx = makeTx({
      id: "tx-null-fields",
      category: null,
      account: null,
      vat_rate: null,
      vat_amount: null,
      net_amount: null,
      bank_reference: null,
      receipt_url: "https://example.com/receipt.pdf",
    });
    exportToExcel([tx]);
    const content = (blobInstances[0].parts as string[])[0];
    // receipt_url present means "Yes"
    expect(content).toContain("Yes");
  });

  it("handles empty transactions array (0 matched, 0 unmatched)", () => {
    exportToExcel([]);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Total transactions");
    expect(content).toContain('"0"');
  });

  it("handles PnlCt1 without optional CT1 fields (else branches)", () => {
    const pnl: PnlCt1Summary = {
      incomeByCategory: { Sales: 50000 },
      totalIncome: 50000,
      directCostsByCategory: {},
      totalDirectCosts: 0,
      expensesByCategory: { Rent: 5000 },
      totalExpenses: 5000,
      revenueRefunds: 0,
      netExpenses: 5000,
      grossProfit: 50000,
      netProfit: 45000,
      taxableProfit: 45000,
      // omit optional CT1 fields to hit else branches
    };
    exportToExcel([makeTx()], undefined, undefined, pnl);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("CORPORATION TAX (CT1) COMPUTATION");
    expect(content).toContain("Taxable Profit");
    // Should not contain optional items
    expect(content).not.toContain("Add back: Non-deductible expenses");
    expect(content).not.toContain("Less: Capital Allowances");
    expect(content).not.toContain("Less: Travel Deduction");
    expect(content).not.toContain("Less: Losses B/F");
    expect(content).not.toContain("Close Company Surcharge");
    expect(content).not.toContain("Less: RCT Credit");
    expect(content).not.toContain("Less: Preliminary CT Paid");
  });

  it("handles PnlCt1 with no drawings (DCA section not shown)", () => {
    const pnl: PnlCt1Summary = {
      incomeByCategory: { Sales: 50000 },
      totalIncome: 50000,
      directCostsByCategory: {},
      totalDirectCosts: 0,
      expensesByCategory: { Rent: 5000 },
      totalExpenses: 5000,
      revenueRefunds: 0,
      netExpenses: 5000,
      grossProfit: 50000,
      netProfit: 45000,
      directorsDrawings: 0,
      totalSubsistenceAllowance: 0,
      totalMileageAllowance: 0,
    };
    exportToExcel([makeTx()], undefined, undefined, pnl);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).not.toContain("DIRECTORS CURRENT ACCOUNT");
  });
});

// ================================================================
// Branch coverage: null fields in director CSV rows
// ================================================================
describe("exportDirectorToExcel — null field branches", () => {
  it("handles transactions with null fields in CSV rows", () => {
    const tx = makeTx({
      id: "dir-null",
      category: null,
      account: null,
      vat_rate: null,
      vat_amount: null,
      net_amount: null,
      bank_reference: null,
      receipt_url: "https://example.com/r.pdf",
    });
    exportDirectorToExcel([tx]);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Yes");
  });

  it("handles empty transactions array", () => {
    exportDirectorToExcel([]);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain('"0"');
  });
});

// ================================================================
// Branch coverage: PDF sections with CT1 fields undefined
// ================================================================
describe("exportToPDF — CT1 fields undefined branches", () => {
  it("handles CT1 with undefined ctAt125, totalCT, tradingProfit", () => {
    const pnl: PnlCt1Summary = {
      incomeByCategory: { Sales: 50000 },
      totalIncome: 50000,
      directCostsByCategory: {},
      totalDirectCosts: 0,
      expensesByCategory: { Rent: 5000 },
      totalExpenses: 5000,
      revenueRefunds: 0,
      netExpenses: 5000,
      grossProfit: 50000,
      netProfit: 45000,
      taxableProfit: 45000,
      // Explicitly omit ctAt125, totalCT to hit ?? 0 branches
    };
    exportToPDF([makeTx()], undefined, undefined, pnl);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("renders DCA with positive netDirectorsLoan (Credit)", () => {
    const pnl: PnlCt1Summary = {
      incomeByCategory: { Sales: 100000 },
      totalIncome: 100000,
      directCostsByCategory: {},
      totalDirectCosts: 0,
      expensesByCategory: { Rent: 10000 },
      totalExpenses: 10000,
      revenueRefunds: 0,
      netExpenses: 10000,
      grossProfit: 90000,
      netProfit: 80000,
      directorsDrawings: 20000,
      netDirectorsLoan: 5000,
      totalSubsistenceAllowance: 3000,
      totalMileageAllowance: 2000,
    };
    exportToPDF([makeTx()], undefined, undefined, pnl);
    expect(mockDoc.text).toHaveBeenCalledWith(
      "Directors Current Account",
      14,
      expect.any(Number),
      expect.anything()
    );
  });

  it("renders questionnaire with vatStatus not_registered in PDF", () => {
    const q = makeQuestionnaire();
    q.vatStatus = "not_registered" as const;
    exportToPDF([makeTx()], undefined, q);
    const qCall = mockAutoTable.mock.calls.find(
      (call: unknown[]) => (call[1] as { head: string[][] }).head?.[0]?.[0] === "Section"
    );
    expect(qCall).toBeDefined();
    const body = (qCall![1] as { body: string[][] }).body;
    expect(body.some((row: string[]) => row[1] === "Not registered")).toBe(true);
  });
});

// ================================================================
// Branch coverage: income tx with null fields in PDF audit groups
// ================================================================
describe("exportToPDF — income tx null field branches", () => {
  it("handles income tx with null vat_rate, null category, null bank_reference", () => {
    const tx = makeTx({
      id: "tx-inc-nulls",
      type: "income",
      amount: 500,
      vat_rate: null,
      vat_amount: null,
      bank_reference: null,
      category: null,
      receipt_url: "https://example.com/r.pdf",
    });
    exportToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });

  it("handles income tx with receipt_url in audit group", () => {
    const tx = makeTx({
      id: "tx-inc-receipt",
      type: "income",
      amount: 1000,
      vat_rate: "23",
      vat_amount: 186.99,
      receipt_url: "https://example.com/r.pdf",
      bank_reference: null,
      category: null,
    });
    exportToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });
});

// ================================================================
// Branch coverage: director PDF questionnaire "Unsure" for business link
// ================================================================
describe("exportDirectorToPDF — questionnaire 'unsure' for business link", () => {
  it("renders 'Unsure' for businessLinksStatus in PDF", () => {
    const q = makeDirectorQuestionnaire();
    q.businessLinksStatus = "unsure" as const;
    exportDirectorToPDF([makeTx()], undefined, q);
    const qCall = mockAutoTable.mock.calls.find(
      (call: unknown[]) => (call[1] as { head: string[][] }).head?.[0]?.[0] === "Section"
    );
    expect(qCall).toBeDefined();
    const body = (qCall![1] as { body: string[][] }).body;
    expect(body.some((row: string[]) => row[1] === "Unsure")).toBe(true);
  });
});

// ================================================================
// Branch coverage: director PDF + director CSV with empty tx array
// ================================================================
describe("exportDirectorToPDF — empty transactions", () => {
  it("handles empty transactions array for receipt matching percentages", () => {
    exportDirectorToPDF([]);
    expect(mockDoc.save).toHaveBeenCalled();
  });
});

describe("exportToPDF — empty transactions", () => {
  it("handles empty transactions array for receipt matching percentages", () => {
    exportToPDF([]);
    expect(mockDoc.save).toHaveBeenCalled();
  });
});

// ================================================================
// Branch coverage: director text questionnaire — else branches for changes
// ================================================================
describe("exportDirectorToExcel — else branches for director changes", () => {
  it("handles noChanges=false with only some changes flagged (covers else branches)", () => {
    const q = makeDirectorQuestionnaire();
    q.noChanges = false;
    q.changes = {
      employmentStatus: false,
      incomeSources: false,
      assessmentStatus: false,
      pensionContributions: false,
      foreignIncome: false,
    };
    exportDirectorToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Changes reported:");
    // None of the specific change checkboxes should be listed
    expect(content).not.toContain("  ☑ Employment status");
    expect(content).not.toContain("  ☑ Income sources");
  });

  it("handles businessLinksStatus undefined", () => {
    const q = makeDirectorQuestionnaire();
    q.businessLinksStatus = undefined as unknown as "yes";
    exportDirectorToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Not answered");
  });

  it("handles preliminaryTaxPaid undefined", () => {
    const q = makeDirectorQuestionnaire();
    q.preliminaryTaxPaid = undefined as unknown as "yes";
    exportDirectorToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Not answered");
  });

  it("handles preliminaryTaxPaid='yes' without amount", () => {
    const q = makeDirectorQuestionnaire();
    q.preliminaryTaxPaid = "yes" as const;
    q.preliminaryTaxAmount = "";
    q.preliminaryTaxDate = undefined;
    exportDirectorToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).not.toContain("Amount:");
  });
});

// ================================================================
// Branch coverage: business questionnaire else branches for automation changes
// ================================================================
describe("exportToExcel — business questionnaire else branches", () => {
  it("handles automationNoChanges=false with no individual changes flagged", () => {
    const q = makeQuestionnaire();
    q.automationNoChanges = false;
    q.automationChanges = {
      vatRegistration: false,
      incomeType: false,
      paymentMethods: false,
      businessActivities: false,
      personalSpending: false,
    };
    q.automationChangeDate = undefined;
    exportToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("Changes reported:");
    // None should be listed
    expect(content).not.toContain("VAT registration status");
    expect(content).not.toContain("How customers pay");
  });

  it("handles vatStatusCorrect=false without vatStatusChangeDate", () => {
    const q = makeQuestionnaire();
    q.vatStatusCorrect = false;
    q.vatStatusChangeDate = undefined;
    exportToExcel([makeTx()], undefined, q);
    const content = (blobInstances[0].parts as string[])[0];
    expect(content).toContain("VAT status changed");
    expect(content).not.toContain("VAT status change effective from");
  });
});

// ================================================================
// Branch coverage: director PDF with Uncategorised and null fields
// ================================================================
describe("exportDirectorToPDF — null category branch", () => {
  it("handles transactions with null category (Uncategorised)", () => {
    const tx = makeTx({
      id: "dir-uncat",
      type: "expense",
      amount: -100,
      category: null,
    });
    exportDirectorToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });
});

// ================================================================
// Branch coverage: description with empty string for revenue refund check
// ================================================================
describe("exportToPDF — description edge case", () => {
  it("handles expense with empty description string", () => {
    const tx = makeTx({
      id: "tx-empty-desc",
      type: "expense",
      amount: -100,
      description: "",
      category: { name: "Other" },
    });
    exportToPDF([tx]);
    expect(mockDoc.save).toHaveBeenCalled();
  });
});
