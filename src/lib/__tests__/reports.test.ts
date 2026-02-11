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
