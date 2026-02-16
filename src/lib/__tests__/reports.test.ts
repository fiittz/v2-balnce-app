import { describe, it, expect } from "vitest";
import { fmtEuro, fmtDate, fmtPercent, fmtTaxYear } from "../reports/formatters";
import { assembleBalanceSheetData, BalanceSheetInput } from "../reports/balanceSheetData";
import { assembleVATReportData, VATInput } from "../reports/vatReportData";
import { assembleAbridgedAccountsData, AbridgedAccountsInput } from "../reports/abridgedAccountsData";
import { assembleForm11ReportData } from "../reports/form11ReportData";
import { calculateForm11, Form11Input } from "../form11Calculator";
import type { ReportMeta } from "../reports/types";

const META: ReportMeta = {
  companyName: "Test Co Ltd",
  taxYear: "2024",
  generatedDate: new Date("2025-01-15"),
};

// ── Formatters ─────────────────────────────────────────────

describe("Formatters", () => {
  it("formats Euro amounts", () => {
    expect(fmtEuro(1234.5)).toContain("1,234.50");
  });

  it("formats zero", () => {
    expect(fmtEuro(0)).toContain("0.00");
  });

  it("formats negative amounts", () => {
    expect(fmtEuro(-500)).toContain("500.00");
  });

  it("formats dates in Irish locale", () => {
    const result = fmtDate(new Date("2025-01-15"));
    expect(result).toContain("Jan");
    expect(result).toContain("2025");
  });

  it("formats percentages", () => {
    expect(fmtPercent(0.20)).toBe("20%");
    expect(fmtPercent(0.125)).toBe("13%"); // rounds
  });

  it("formats tax year", () => {
    expect(fmtTaxYear("2024")).toBe("Year ended 31 December 2024");
    expect(fmtTaxYear(2024)).toBe("Year ended 31 December 2024");
  });
});

// ── Balance Sheet ─────────────────────────────────────────

describe("assembleBalanceSheetData", () => {
  const input: BalanceSheetInput = {
    landBuildings: 0,
    plantMachinery: 15000,
    motorVehicles: 25000,
    fixturesFittings: 5000,
    stock: 3000,
    debtors: 8000,
    cash: 500,
    bankBalance: 12000,
    creditors: 6000,
    taxation: 3000,
    bankOverdraft: 0,
    bankLoans: 10000,
    directorsLoans: 5000,
    shareCapital: 100,
    retainedProfits: 44400,
  };

  it("calculates fixed assets total", () => {
    const result = assembleBalanceSheetData(input, META);
    expect(result.fixedAssets).toBe(45000);
  });

  it("calculates current assets total", () => {
    const result = assembleBalanceSheetData(input, META);
    expect(result.currentAssets).toBe(23500);
  });

  it("calculates current liabilities total", () => {
    const result = assembleBalanceSheetData(input, META);
    expect(result.currentLiabilities).toBe(9000);
  });

  it("calculates net assets correctly", () => {
    const result = assembleBalanceSheetData(input, META);
    // 45000 + 23500 - 9000 - 15000 = 44500
    expect(result.netAssets).toBe(44500);
  });

  it("calculates capital and reserves", () => {
    const result = assembleBalanceSheetData(input, META);
    expect(result.capitalReserves).toBe(44500);
  });

  it("balance sheet balances (net assets = capital reserves)", () => {
    const result = assembleBalanceSheetData(input, META);
    expect(result.netAssets).toBe(result.capitalReserves);
  });

  it("includes long-term liabilities section when > 0", () => {
    const result = assembleBalanceSheetData(input, META);
    const ltSection = result.sections.find(s => s.title === "Long-term Liabilities");
    expect(ltSection).toBeDefined();
  });

  it("omits long-term liabilities section when zero", () => {
    const noLoans = { ...input, bankLoans: 0, directorsLoans: 0 };
    const result = assembleBalanceSheetData(noLoans, META);
    const ltSection = result.sections.find(s => s.title === "Long-term Liabilities");
    expect(ltSection).toBeUndefined();
  });

  it("snapshot: sections structure is stable", () => {
    const result = assembleBalanceSheetData(input, META);
    expect(result.sections.map(s => s.title)).toMatchSnapshot();
  });
});

// ── VAT Report ─────────────────────────────────────────────

describe("assembleVATReportData", () => {
  const input: VATInput = {
    vatNumber: "IE1234567T",
    vatBasis: "invoice_basis",
    periodStart: "2024-01-01",
    periodEnd: "2024-02-28",
    salesByRate: [
      { rate: "13.5%", net: 50000, vat: 6750 },
      { rate: "23%", net: 10000, vat: 2300 },
    ],
    purchasesByRate: [
      { rate: "23%", net: 20000, vat: 4600 },
    ],
  };

  it("calculates T1 (VAT on sales)", () => {
    const result = assembleVATReportData(input, META);
    expect(result.t1Sales).toBe(9050); // 6750 + 2300
  });

  it("calculates T3 (VAT on purchases)", () => {
    const result = assembleVATReportData(input, META);
    expect(result.t3Purchases).toBe(4600);
  });

  it("calculates net VAT payable", () => {
    const result = assembleVATReportData(input, META);
    expect(result.netVat).toBe(4450); // 9050 - 4600
  });

  it("shows refundable when purchases > sales", () => {
    const refundInput: VATInput = {
      ...input,
      salesByRate: [{ rate: "13.5%", net: 5000, vat: 675 }],
      purchasesByRate: [{ rate: "23%", net: 20000, vat: 4600 }],
    };
    const result = assembleVATReportData(refundInput, META);
    expect(result.netVat).toBeLessThan(0);
  });

  it("handles missing VAT number gracefully", () => {
    const noVatInput: VATInput = {
      periodStart: "2024-01-01",
      periodEnd: "2024-02-28",
      salesByRate: [{ rate: "23%", net: 10000, vat: 2300 }],
      purchasesByRate: [],
    };
    const result = assembleVATReportData(noVatInput, META);
    const vatRow = result.sections[0].rows.find(r => r.label === "VAT Number");
    expect(vatRow?.value).toBe("Not specified");
  });

  it("handles cash basis correctly", () => {
    const cashInput: VATInput = {
      vatNumber: "IE1234567T",
      vatBasis: "cash_basis",
      periodStart: "2024-01-01",
      periodEnd: "2024-02-28",
      salesByRate: [{ rate: "23%", net: 10000, vat: 2300 }],
      purchasesByRate: [],
    };
    const result = assembleVATReportData(cashInput, META);
    const basisRow = result.sections[0].rows.find(r => r.label === "Accounting Basis");
    expect(basisRow?.value).toBe("Cash basis");
  });

  it("snapshot: sections structure is stable", () => {
    const result = assembleVATReportData(input, META);
    expect(result.sections.map(s => s.title)).toMatchSnapshot();
  });
});

// ── Abridged Accounts ─────────────────────────────────────

describe("assembleAbridgedAccountsData", () => {
  const input: AbridgedAccountsInput = {
    companyName: "Test Carpentry Ltd",
    croNumber: "123456",
    registeredAddress: "123 Main St, Dublin 15",
    accountingYearEnd: "31 December 2024",
    directorNames: ["John Smith"],
    companySecretaryName: "Jane Smith",
    fixedAssetsTangible: 30000,
    stock: 2000,
    wip: 1000,
    debtors: 5000,
    prepayments: 500,
    cashAtBank: 10000,
    creditors: 4000,
    accruals: 1000,
    taxation: 2000,
    bankLoans: 8000,
    directorsLoans: 3000,
    shareCapital: 100,
    retainedProfits: 30400,
  };

  it("calculates fixed assets", () => {
    const result = assembleAbridgedAccountsData(input, META);
    expect(result.fixedAssets).toBe(30000);
  });

  it("calculates current assets (including WIP and prepayments)", () => {
    const result = assembleAbridgedAccountsData(input, META);
    expect(result.currentAssets).toBe(18500); // 2000+1000+5000+500+10000
  });

  it("calculates current liabilities", () => {
    const result = assembleAbridgedAccountsData(input, META);
    expect(result.currentLiabilities).toBe(7000); // 4000+1000+2000
  });

  it("calculates net current assets", () => {
    const result = assembleAbridgedAccountsData(input, META);
    expect(result.netCurrentAssets).toBe(11500); // 18500-7000
  });

  it("calculates net assets", () => {
    const result = assembleAbridgedAccountsData(input, META);
    // 30000 + 11500 - 11000 = 30500
    expect(result.netAssets).toBe(30500);
  });

  it("calculates shareholders funds", () => {
    const result = assembleAbridgedAccountsData(input, META);
    expect(result.shareholdersFunds).toBe(30500); // 100 + 30400
  });

  it("balance sheet balances", () => {
    const result = assembleAbridgedAccountsData(input, META);
    expect(result.netAssets).toBe(result.shareholdersFunds);
  });

  it("includes directors responsibility and audit exemption", () => {
    const result = assembleAbridgedAccountsData(input, META);
    const titles = result.sections.map(s => s.title);
    expect(titles).toContain("Directors' Responsibility Statement");
    expect(titles).toContain("Audit Exemption Statement");
    expect(titles).toContain("Accounting Policies");
  });

  it("includes directors loan note when present", () => {
    const result = assembleAbridgedAccountsData(input, META);
    const notes = result.sections.find(s => s.title === "Notes to the Financial Statements");
    expect(notes?.rows.some(r => r.label.includes("Directors' Loans"))).toBe(true);
  });

  it("snapshot: sections structure is stable", () => {
    const result = assembleAbridgedAccountsData(input, META);
    expect(result.sections.map(s => s.title)).toMatchSnapshot();
  });
});

// ── Form 11 Report ─────────────────────────────────────────

describe("assembleForm11ReportData", () => {
  const form11Input: Form11Input = {
    directorName: "John Smith",
    ppsNumber: "1234567T",
    dateOfBirth: "1985-06-15",
    maritalStatus: "single",
    assessmentBasis: "single",
    salary: 60000,
    dividends: 0,
    bik: 0,
    businessIncome: 20000,
    businessExpenses: 5000,
    capitalAllowances: 2000,
    rentalIncome: 0,
    rentalExpenses: 0,
    foreignIncome: 0,
    otherIncome: 0,
    capitalGains: 5000,
    capitalLosses: 0,
    pensionContributions: 5000,
    medicalExpenses: 500,
    rentPaid: 6000,
    charitableDonations: 0,
    remoteWorkingCosts: 0,
    spouseIncome: 0,
    claimHomeCarer: false,
    claimSingleParent: false,
    hasPAYEIncome: true,
    mileageAllowance: 0,
    preliminaryTaxPaid: 10000,
  };

  it("produces sections and tables", () => {
    const calcResult = calculateForm11(form11Input);
    const report = assembleForm11ReportData(form11Input, calcResult, META);
    expect(report.sections.length).toBeGreaterThan(0);
    expect(report.tables.length).toBeGreaterThan(0);
  });

  it("includes personal details section", () => {
    const calcResult = calculateForm11(form11Input);
    const report = assembleForm11ReportData(form11Input, calcResult, META);
    const personal = report.sections.find(s => s.title === "Personal Details");
    expect(personal).toBeDefined();
    expect(personal?.rows.some(r => r.value === "John Smith")).toBe(true);
  });

  it("includes income tax and USC tables", () => {
    const calcResult = calculateForm11(form11Input);
    const report = assembleForm11ReportData(form11Input, calcResult, META);
    const titles = report.tables.map(t => t.title);
    expect(titles).toContain("Income Tax Calculation");
    expect(titles).toContain("Tax Credits");
    expect(titles).toContain("Universal Social Charge");
  });

  it("includes CGT section when applicable", () => {
    const calcResult = calculateForm11(form11Input);
    const report = assembleForm11ReportData(form11Input, calcResult, META);
    const cgt = report.sections.find(s => s.title === "Capital Gains Tax");
    expect(cgt).toBeDefined();
  });

  it("includes expense breakdown when provided", () => {
    const calcResult = calculateForm11(form11Input);
    const report = assembleForm11ReportData(form11Input, calcResult, META, {
      expenseByCategory: [
        { category: "Materials", amount: 3000 },
        { category: "Tools", amount: 2000 },
      ],
    });
    const expTable = report.tables.find(t => t.title === "Business Expense Breakdown");
    expect(expTable).toBeDefined();
    expect(expTable?.rows.length).toBe(3); // 2 categories + total
  });

  it("snapshot: sections + tables structure is stable", () => {
    const calcResult = calculateForm11(form11Input);
    const report = assembleForm11ReportData(form11Input, calcResult, META);
    expect({
      sections: report.sections.map(s => s.title),
      tables: report.tables.map(t => t.title),
    }).toMatchSnapshot();
  });
});

// ── Balance Sheet — conditional rows ─────────────────────────────

describe("assembleBalanceSheetData — conditional rows", () => {
  const baseInput: BalanceSheetInput = {
    landBuildings: 0,
    plantMachinery: 15000,
    motorVehicles: 25000,
    fixturesFittings: 5000,
    stock: 3000,
    debtors: 8000,
    cash: 500,
    bankBalance: 12000,
    rctPrepayment: 0,
    creditors: 6000,
    taxation: 3000,
    bankOverdraft: 0,
    directorsLoanTravel: 0,
    bankLoans: 10000,
    directorsLoans: 5000,
    shareCapital: 100,
    retainedProfits: 44400,
  };

  it("includes RCT prepayment row when rctPrepayment > 0", () => {
    const input = { ...baseInput, rctPrepayment: 1500 };
    const result = assembleBalanceSheetData(input, META);
    const currentAssetsSection = result.sections.find(s => s.title === "Current Assets")!;
    const rctRow = currentAssetsSection.rows.find(r => r.label === "RCT Prepayment");
    expect(rctRow).toBeDefined();
    // rctPrepayment is included in the current assets total
    expect(result.currentAssets).toBe(3000 + 8000 + 500 + 12000 + 1500);
  });

  it("omits RCT prepayment row when rctPrepayment is 0", () => {
    const input = { ...baseInput, rctPrepayment: 0 };
    const result = assembleBalanceSheetData(input, META);
    const currentAssetsSection = result.sections.find(s => s.title === "Current Assets")!;
    const rctRow = currentAssetsSection.rows.find(r => r.label === "RCT Prepayment");
    expect(rctRow).toBeUndefined();
  });

  it("includes Director's Loan row when directorsLoanTravel > 0", () => {
    const input = { ...baseInput, directorsLoanTravel: 800 };
    const result = assembleBalanceSheetData(input, META);
    const clSection = result.sections.find(s => s.title === "Current Liabilities")!;
    const dlRow = clSection.rows.find(r => r.label === "Director's Loan");
    expect(dlRow).toBeDefined();
    // directorsLoanTravel is included in current liabilities total
    expect(result.currentLiabilities).toBe(6000 + 3000 + 0 + 800);
  });

  it("omits Director's Loan row when directorsLoanTravel is 0", () => {
    const input = { ...baseInput, directorsLoanTravel: 0 };
    const result = assembleBalanceSheetData(input, META);
    const clSection = result.sections.find(s => s.title === "Current Liabilities")!;
    const dlRow = clSection.rows.find(r => r.label === "Director's Loan");
    expect(dlRow).toBeUndefined();
  });
});

// ── Abridged Accounts — conditional rows ─────────────────────────

describe("assembleAbridgedAccountsData — conditional rows", () => {
  const baseInput: AbridgedAccountsInput = {
    companyName: "Test Carpentry Ltd",
    croNumber: "123456",
    registeredAddress: "123 Main St, Dublin 15",
    accountingYearEnd: "31 December 2024",
    directorNames: ["John Smith"],
    companySecretaryName: "Jane Smith",
    fixedAssetsTangible: 30000,
    stock: 2000,
    wip: 0,
    debtors: 5000,
    prepayments: 0,
    cashAtBank: 10000,
    creditors: 4000,
    accruals: 0,
    taxation: 0,
    bankLoans: 0,
    directorsLoans: 0,
    shareCapital: 100,
    retainedProfits: 30900,
  };

  it("includes WIP row when wip > 0", () => {
    const input = { ...baseInput, wip: 1500 };
    const result = assembleAbridgedAccountsData(input, META);
    const bs = result.sections.find(s => s.title === "Abridged Balance Sheet")!;
    const wipRow = bs.rows.find(r => r.label === "  Work-in-progress");
    expect(wipRow).toBeDefined();
  });

  it("omits WIP row when wip is 0", () => {
    const result = assembleAbridgedAccountsData(baseInput, META);
    const bs = result.sections.find(s => s.title === "Abridged Balance Sheet")!;
    const wipRow = bs.rows.find(r => r.label === "  Work-in-progress");
    expect(wipRow).toBeUndefined();
  });

  it("includes Prepayments row when prepayments > 0", () => {
    const input = { ...baseInput, prepayments: 500 };
    const result = assembleAbridgedAccountsData(input, META);
    const bs = result.sections.find(s => s.title === "Abridged Balance Sheet")!;
    const row = bs.rows.find(r => r.label === "  Prepayments and accrued income");
    expect(row).toBeDefined();
  });

  it("omits Prepayments row when prepayments is 0", () => {
    const result = assembleAbridgedAccountsData(baseInput, META);
    const bs = result.sections.find(s => s.title === "Abridged Balance Sheet")!;
    const row = bs.rows.find(r => r.label === "  Prepayments and accrued income");
    expect(row).toBeUndefined();
  });

  it("includes Accruals row when accruals > 0", () => {
    const input = { ...baseInput, accruals: 1000 };
    const result = assembleAbridgedAccountsData(input, META);
    const bs = result.sections.find(s => s.title === "Abridged Balance Sheet")!;
    const row = bs.rows.find(r => r.label === "  Accruals and deferred income");
    expect(row).toBeDefined();
  });

  it("omits Accruals row when accruals is 0", () => {
    const result = assembleAbridgedAccountsData(baseInput, META);
    const bs = result.sections.find(s => s.title === "Abridged Balance Sheet")!;
    const row = bs.rows.find(r => r.label === "  Accruals and deferred income");
    expect(row).toBeUndefined();
  });

  it("includes Taxation row when taxation > 0", () => {
    const input = { ...baseInput, taxation: 2000 };
    const result = assembleAbridgedAccountsData(input, META);
    const bs = result.sections.find(s => s.title === "Abridged Balance Sheet")!;
    const row = bs.rows.find(r => r.label === "  Taxation");
    expect(row).toBeDefined();
  });

  it("omits Taxation row when taxation is 0", () => {
    const result = assembleAbridgedAccountsData(baseInput, META);
    const bs = result.sections.find(s => s.title === "Abridged Balance Sheet")!;
    const row = bs.rows.find(r => r.label === "  Taxation");
    expect(row).toBeUndefined();
  });

  it("includes long-term liabilities section when longTermLiabilities > 0", () => {
    const input = { ...baseInput, bankLoans: 8000, directorsLoans: 3000 };
    const result = assembleAbridgedAccountsData(input, META);
    const bs = result.sections.find(s => s.title === "Abridged Balance Sheet")!;
    const header = bs.rows.find(r => r.label === "CREDITORS: amounts falling due after more than one year");
    expect(header).toBeDefined();
    const bankLoansRow = bs.rows.find(r => r.label === "  Bank loans");
    expect(bankLoansRow).toBeDefined();
  });

  it("omits long-term liabilities section when all zero", () => {
    const result = assembleAbridgedAccountsData(baseInput, META);
    const bs = result.sections.find(s => s.title === "Abridged Balance Sheet")!;
    const header = bs.rows.find(r => r.label === "CREDITORS: amounts falling due after more than one year");
    expect(header).toBeUndefined();
  });

  it("shows directorsLoanDirection 'from_company' label", () => {
    const input = { ...baseInput, directorsLoans: 5000, directorsLoanDirection: "from_company" as const };
    const result = assembleAbridgedAccountsData(input, META);
    const bs = result.sections.find(s => s.title === "Abridged Balance Sheet")!;
    const dlRow = bs.rows.find(r => r.label.includes("Directors' loan") && r.label.includes("due from company"));
    expect(dlRow).toBeDefined();
  });

  it("shows directorsLoanDirection 'to_company' note text", () => {
    const input = { ...baseInput, directorsLoans: 5000, directorsLoanDirection: "to_company" as const };
    const result = assembleAbridgedAccountsData(input, META);
    const notes = result.sections.find(s => s.title === "Notes to the Financial Statements")!;
    const dlNote = notes.rows.find(r => r.label.includes("Directors' Loans"));
    expect(dlNote).toBeDefined();
    expect(dlNote!.value).toContain("owed to the company by the directors");
  });

  it("shows generic note text when no directorsLoanDirection", () => {
    const input = { ...baseInput, directorsLoans: 5000 };
    const result = assembleAbridgedAccountsData(input, META);
    const notes = result.sections.find(s => s.title === "Notes to the Financial Statements")!;
    const dlNote = notes.rows.find(r => r.label.includes("Directors' Loans"));
    expect(dlNote).toBeDefined();
    // Ends with just a period, no direction specified
    expect(dlNote!.value).not.toContain("owed by the company");
    expect(dlNote!.value).not.toContain("owed to the company");
  });

  it("omits directors loan note when directorsLoans is 0", () => {
    const result = assembleAbridgedAccountsData(baseInput, META);
    const notes = result.sections.find(s => s.title === "Notes to the Financial Statements")!;
    const dlNote = notes.rows.find(r => r.label.includes("Directors' Loans"));
    expect(dlNote).toBeUndefined();
  });
});

// ── Form 11 Report — conditional sections ────────────────────────

describe("assembleForm11ReportData — conditional sections", () => {
  const form11Input: Form11Input = {
    directorName: "John Smith",
    ppsNumber: "1234567T",
    dateOfBirth: "1985-06-15",
    maritalStatus: "single",
    assessmentBasis: "single",
    salary: 60000,
    dividends: 0,
    bik: 0,
    businessIncome: 20000,
    businessExpenses: 5000,
    capitalAllowances: 2000,
    rentalIncome: 0,
    rentalExpenses: 0,
    foreignIncome: 0,
    otherIncome: 0,
    capitalGains: 5000,
    capitalLosses: 0,
    pensionContributions: 5000,
    medicalExpenses: 500,
    rentPaid: 6000,
    charitableDonations: 0,
    remoteWorkingCosts: 0,
    spouseIncome: 0,
    claimHomeCarer: false,
    claimSingleParent: false,
    hasPAYEIncome: true,
    mileageAllowance: 0,
    preliminaryTaxPaid: 10000,
  };

  it("shows USC exempt message when income below \u20AC13,000", () => {
    const lowIncomeInput: Form11Input = {
      ...form11Input,
      salary: 10000,
      businessIncome: 0,
      businessExpenses: 0,
      capitalAllowances: 0,
      capitalGains: 0,
      pensionContributions: 0,
      medicalExpenses: 0,
      rentPaid: 0,
    };
    const calcResult = calculateForm11(lowIncomeInput);
    expect(calcResult.uscExempt).toBe(true);
    const report = assembleForm11ReportData(lowIncomeInput, calcResult, META);
    const uscSection = report.sections.find(s => s.title === "Universal Social Charge");
    expect(uscSection).toBeDefined();
    expect(uscSection!.rows[0].value).toContain("Exempt");
    expect(uscSection!.rows[0].value).toContain("13,000");
  });

  it("includes split-year assessment section when applicable", () => {
    const splitInput: Form11Input = {
      ...form11Input,
      changeEffectiveDate: "2024-07-01",
      preChangeAssessmentBasis: "single",
      assessmentBasis: "joint",
      maritalStatus: "married",
      spouseIncome: 30000,
    };
    const calcResult = calculateForm11(splitInput);
    expect(calcResult.splitYearApplied).toBe(true);
    const report = assembleForm11ReportData(splitInput, calcResult, META);
    const splitSection = report.sections.find(s => s.title === "Split-Year Assessment");
    expect(splitSection).toBeDefined();
    expect(splitSection!.rows[0].value).toContain("changed on");
  });

  it("includes warnings section when warnings present", () => {
    // Charitable donation below minimum triggers a warning
    const warnInput: Form11Input = {
      ...form11Input,
      charitableDonations: 100, // below €250 minimum
    };
    const calcResult = calculateForm11(warnInput);
    expect(calcResult.warnings.length).toBeGreaterThan(0);
    const report = assembleForm11ReportData(warnInput, calcResult, META);
    const warningsSection = report.sections.find(s => s.title === "Warnings");
    expect(warningsSection).toBeDefined();
    expect(warningsSection!.rows.length).toBeGreaterThan(0);
  });

  it("omits warnings section when no warnings", () => {
    // Default form11Input has charitableDonations: 0, no pension cap hit
    const noWarnInput: Form11Input = {
      ...form11Input,
      charitableDonations: 0,
      pensionContributions: 0,
    };
    const calcResult = calculateForm11(noWarnInput);
    expect(calcResult.warnings.length).toBe(0);
    const report = assembleForm11ReportData(noWarnInput, calcResult, META);
    const warningsSection = report.sections.find(s => s.title === "Warnings");
    expect(warningsSection).toBeUndefined();
  });

  it("includes income breakdown table when incomeByCategory provided", () => {
    const calcResult = calculateForm11(form11Input);
    const report = assembleForm11ReportData(form11Input, calcResult, META, {
      incomeByCategory: [
        { category: "Carpentry", amount: 15000 },
        { category: "Consultancy", amount: 5000 },
      ],
    });
    const incTable = report.tables.find(t => t.title === "Business Income Breakdown");
    expect(incTable).toBeDefined();
    expect(incTable!.rows.length).toBe(3); // 2 categories + total
  });

  it("includes Rental / Investment Income section when rentalProfit, foreignIncome or otherIncome > 0", () => {
    const rentalInput: Form11Input = {
      ...form11Input,
      rentalIncome: 15000,
      rentalExpenses: 5000,
      foreignIncome: 2000,
      otherIncome: 1000,
    };
    const calcResult = calculateForm11(rentalInput);
    const report = assembleForm11ReportData(rentalInput, calcResult, META);
    const rentalSection = report.sections.find(s => s.title === "Rental / Investment Income");
    expect(rentalSection).toBeDefined();
    expect(rentalSection!.rows.some(r => r.label === "Rental Profit")).toBe(true);
    expect(rentalSection!.rows.some(r => r.label === "Foreign Income")).toBe(true);
    expect(rentalSection!.rows.some(r => r.label === "Other Income")).toBe(true);
  });

  it("omits Schedule E section when no employment income", () => {
    const noEmploymentInput: Form11Input = {
      ...form11Input,
      salary: 0,
      dividends: 0,
      bik: 0,
      mileageAllowance: 0,
    };
    const calcResult = calculateForm11(noEmploymentInput);
    const report = assembleForm11ReportData(noEmploymentInput, calcResult, META);
    const scheduleE = report.sections.find(s => s.title === "Schedule E — Employment Income");
    // scheduleE is 0 and scheduleERows has only 1 row (the Net Schedule E line),
    // so the section is omitted because length <= 1
    expect(scheduleE).toBeUndefined();
  });
});
