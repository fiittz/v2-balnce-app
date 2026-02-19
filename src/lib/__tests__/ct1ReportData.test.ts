import { describe, it, expect } from "vitest";
import { assembleCT1ReportData } from "../reports/ct1ReportData";
import type { CT1Data } from "@/hooks/useCT1Data";
import type { ReportMeta } from "../reports/types";
import { fmtEuro } from "../reports/formatters";

const META: ReportMeta = {
  companyName: "Test Co Ltd",
  taxYear: "2024",
  generatedDate: new Date("2025-01-15"),
};

/** Factory for a minimal CT1Data object — override fields as needed */
function makeCT1(overrides: Partial<CT1Data> = {}): CT1Data {
  return {
    isConstructionTrade: false,
    isCloseCompany: true,
    detectedIncome: [
      { category: "Sales", amount: 80000 },
      { category: "Other Income", amount: 5000 },
    ],
    expenseByCategory: [
      { category: "Materials", amount: 20000 },
      { category: "Motor Expenses", amount: 5000 },
    ],
    expenseSummary: { allowable: 22000, disallowed: 3000 },
    disallowedByCategory: [],
    detectedPayments: [],
    closingBalance: 0,
    vatPosition: { type: "payable", amount: 2500 },
    flaggedCapitalItems: [{ description: "DeWalt Table Saw", date: "2024-03-15", amount: 1200 }],
    vehicleAsset: null,
    rctPrepayment: 0,
    travelAllowance: 0,
    directorsLoanTravel: 0,
    directorsLoanDebits: 0,
    netDirectorsLoan: 0,
    isLoading: false,
    reEvaluationApplied: false,
    reEvaluationWarnings: [],
    ...overrides,
  };
}

// ── Company Information Section ────────────────────────────────

describe("assembleCT1ReportData — Company Information", () => {
  it("populates company name, tax year, construction trade, and close company flags", () => {
    const ct1 = makeCT1({ isConstructionTrade: true, isCloseCompany: true });
    const result = assembleCT1ReportData(ct1, null, META);
    const info = result.sections.find((s) => s.title === "Company Information")!;
    expect(info.rows.find((r) => r.label === "Company Name")?.value).toBe("Test Co Ltd");
    expect(info.rows.find((r) => r.label === "Tax Year")?.value).toBe("2024");
    expect(info.rows.find((r) => r.label === "Construction Trade")?.value).toBe("Yes");
    expect(info.rows.find((r) => r.label === "Close Company")?.value).toBe("Yes");
  });

  it("shows VAT status from questionnaire when present", () => {
    const ct1 = makeCT1();
    const result = assembleCT1ReportData(ct1, { vatStatus: "Cash basis" }, META);
    const info = result.sections.find((s) => s.title === "Company Information")!;
    expect(info.rows.find((r) => r.label === "VAT Status")?.value).toBe("Cash basis");
  });

  it("shows 'Not specified' when questionnaire has no vatStatus", () => {
    const ct1 = makeCT1();
    const result = assembleCT1ReportData(ct1, null, META);
    const info = result.sections.find((s) => s.title === "Company Information")!;
    expect(info.rows.find((r) => r.label === "VAT Status")?.value).toBe("Not specified");
  });
});

// ── Trading Income Table ───────────────────────────────────────

describe("assembleCT1ReportData — Trading Income", () => {
  it("lists each income category and computes total", () => {
    const ct1 = makeCT1();
    const result = assembleCT1ReportData(ct1, null, META);
    const table = result.tables.find((t) => t.title === "Trading Income")!;
    expect(table.rows.length).toBe(3); // 2 categories + total
    expect(table.rows[0]).toEqual(["Sales", fmtEuro(80000)]);
    expect(table.rows[1]).toEqual(["Other Income", fmtEuro(5000)]);
    expect(table.rows[2]).toEqual(["Total Income", fmtEuro(85000)]);
  });
});

// ── Expense Breakdown Table ────────────────────────────────────

describe("assembleCT1ReportData — Expense Breakdown", () => {
  it("lists each expense category and computes total", () => {
    const ct1 = makeCT1();
    const result = assembleCT1ReportData(ct1, null, META);
    const table = result.tables.find((t) => t.title === "Expense Breakdown")!;
    expect(table.rows.length).toBe(3); // 2 categories + total
    expect(table.rows[0]).toEqual(["Materials", fmtEuro(20000)]);
    expect(table.rows[1]).toEqual(["Motor Expenses", fmtEuro(5000)]);
    expect(table.rows[2]).toEqual(["Total Expenses", fmtEuro(25000)]);
  });
});

// ── Capital Allowances ─────────────────────────────────────────

describe("assembleCT1ReportData — Capital Allowances", () => {
  it("uses vehicleAsset depreciation when vehicleAsset is present", () => {
    const ct1 = makeCT1({
      vehicleAsset: {
        description: "Toyota Corolla",
        reg: "241-D-12345",
        depreciation: { annualAllowance: 3125, yearsOwned: 2, netBookValue: 18750 },
      },
    });
    const questionnaire = { capitalAllowancesPlant: 1000 };
    const result = assembleCT1ReportData(ct1, questionnaire, META);
    const capSection = result.sections.find((s) => s.title === "Capital Allowances")!;
    expect(capSection).toBeDefined();
    // Motor Vehicles row should use vehicleAsset's annualAllowance (3125)
    const motorRow = capSection.rows.find((r) => r.label === "Motor Vehicles")!;
    expect(motorRow.value).toBe(fmtEuro(3125));
    // Vehicle detail line should be present
    const detailRow = capSection.rows.find((r) => r.label.includes("241-D-12345"));
    expect(detailRow).toBeDefined();
    expect(detailRow!.label).toContain("Year 2/8");
  });

  it("falls back to questionnaire capitalAllowancesMotorVehicles when no vehicleAsset", () => {
    const ct1 = makeCT1({ vehicleAsset: null });
    const questionnaire = {
      capitalAllowancesPlant: 500,
      capitalAllowancesMotorVehicles: 2000,
    };
    const result = assembleCT1ReportData(ct1, questionnaire, META);
    const capSection = result.sections.find((s) => s.title === "Capital Allowances")!;
    expect(capSection).toBeDefined();
    const motorRow = capSection.rows.find((r) => r.label === "Motor Vehicles")!;
    expect(motorRow.value).toBe(fmtEuro(2000));
  });

  it("shows capital allowances section when capitalAllowancesTotal > 0 in questionnaire even if computed total is 0", () => {
    const ct1 = makeCT1({ vehicleAsset: null });
    const questionnaire = {
      capitalAllowancesPlant: 0,
      capitalAllowancesMotorVehicles: 0,
      capitalAllowancesTotal: 4000,
    };
    const result = assembleCT1ReportData(ct1, questionnaire, META);
    const capSection = result.sections.find((s) => s.title === "Capital Allowances");
    expect(capSection).toBeDefined();
    // Total row uses questionnaire.capitalAllowancesTotal as override
    const totalRow = capSection!.rows.find((r) => r.label === "Total Capital Allowances")!;
    expect(totalRow.value).toBe(fmtEuro(4000));
  });
});

// ── Losses Brought Forward ─────────────────────────────────────

describe("assembleCT1ReportData — Losses Brought Forward", () => {
  it("shows Losses Brought Forward section when lossesForward > 0", () => {
    const ct1 = makeCT1();
    const questionnaire = { lossesForward: 10000 };
    const result = assembleCT1ReportData(ct1, questionnaire, META);
    const section = result.sections.find((s) => s.title === "Losses Brought Forward");
    expect(section).toBeDefined();
    expect(section!.rows.find((r) => r.label === "Less: Losses B/F")?.value).toBe(fmtEuro(10000));
  });

  it("omits Losses Brought Forward section when lossesForward is 0", () => {
    const ct1 = makeCT1();
    const result = assembleCT1ReportData(ct1, { lossesForward: 0 }, META);
    const section = result.sections.find((s) => s.title === "Losses Brought Forward");
    expect(section).toBeUndefined();
  });
});

// ── CT Computation ─────────────────────────────────────────────

describe("assembleCT1ReportData — CT Computation", () => {
  it("computes taxable profit, CT @ 12.5%, surcharge and balance due", () => {
    const ct1 = makeCT1({
      detectedIncome: [{ category: "Sales", amount: 100000 }],
      expenseSummary: { allowable: 20000, disallowed: 0 },
      vehicleAsset: null,
    });
    // capitalAllowancesTotal = plant(5000) + motor(0) = 5000
    // tradingProfit = 100000 - 20000 - 5000 = 75000
    // taxableProfit = 75000 - 10000 (losses) = 65000
    // ctAt125 = 65000 * 0.125 = 8125
    // surcharge = 2000
    // totalCT = 8125 + 2000 = 10125
    // prelimPaid = 5000
    // balanceDue = 10125 - 5000 = 5125
    const questionnaire = {
      capitalAllowancesPlant: 5000,
      lossesForward: 10000,
      closeCompanySurcharge: 2000,
      preliminaryCTPaid: 5000,
    };
    const result = assembleCT1ReportData(ct1, questionnaire, META);
    const ctSection = result.sections.find((s) => s.title === "Corporation Tax Computation")!;
    expect(ctSection.rows.find((r) => r.label === "Taxable Profit")?.value).toBe(fmtEuro(65000));
    expect(ctSection.rows.find((r) => r.label === "CT @ 12.5% (trading)")?.value).toBe(fmtEuro(8125));
    expect(ctSection.rows.find((r) => r.label === "Close Company Surcharge")?.value).toBe(fmtEuro(2000));
    expect(ctSection.rows.find((r) => r.label === "Total CT Liability")?.value).toBe(fmtEuro(10125));
    expect(ctSection.rows.find((r) => r.label === "Less: Preliminary CT Paid")?.value).toBe(fmtEuro(5000));
    expect(ctSection.rows.find((r) => r.label === "Balance Due")?.value).toBe(fmtEuro(5125));
  });

  it("omits surcharge row when surcharge is 0", () => {
    const ct1 = makeCT1();
    const result = assembleCT1ReportData(ct1, { closeCompanySurcharge: 0 }, META);
    const ctSection = result.sections.find((s) => s.title === "Corporation Tax Computation")!;
    expect(ctSection.rows.find((r) => r.label === "Close Company Surcharge")).toBeUndefined();
  });

  it("omits preliminary CT and balance due rows when preliminaryCTPaid is 0", () => {
    const ct1 = makeCT1();
    const result = assembleCT1ReportData(ct1, { preliminaryCTPaid: 0 }, META);
    const ctSection = result.sections.find((s) => s.title === "Corporation Tax Computation")!;
    expect(ctSection.rows.find((r) => r.label === "Less: Preliminary CT Paid")).toBeUndefined();
    expect(ctSection.rows.find((r) => r.label === "Balance Due")).toBeUndefined();
  });
});

// ── VAT Position ───────────────────────────────────────────────

describe("assembleCT1ReportData — VAT Position", () => {
  it("shows VAT Payable section when vatPosition is payable", () => {
    const ct1 = makeCT1({ vatPosition: { type: "payable", amount: 3000 } });
    const result = assembleCT1ReportData(ct1, null, META);
    const section = result.sections.find((s) => s.title === "VAT Position");
    expect(section).toBeDefined();
    expect(section!.rows[0].label).toBe("VAT Payable");
    expect(section!.rows[0].value).toBe(fmtEuro(3000));
  });

  it("omits VAT Position section when vatPosition is null/undefined", () => {
    const ct1 = makeCT1({ vatPosition: undefined });
    const result = assembleCT1ReportData(ct1, null, META);
    const section = result.sections.find((s) => s.title === "VAT Position");
    expect(section).toBeUndefined();
  });
});

// ── Flagged Capital Items ──────────────────────────────────────

describe("assembleCT1ReportData — Flagged Capital Items", () => {
  it("includes flagged capital items table when non-empty", () => {
    const ct1 = makeCT1({
      flaggedCapitalItems: [
        { description: "DeWalt Table Saw", date: "2024-03-15", amount: 1200 },
        { description: "Scaffolding", date: "2024-06-01", amount: 2500 },
      ],
    });
    const result = assembleCT1ReportData(ct1, null, META);
    const table = result.tables.find((t) => t.title === "Flagged Capital Items");
    expect(table).toBeDefined();
    expect(table!.rows.length).toBe(2);
    expect(table!.rows[0]).toEqual(["DeWalt Table Saw", "2024-03-15", fmtEuro(1200)]);
  });

  it("omits flagged capital items table when array is empty", () => {
    const ct1 = makeCT1({ flaggedCapitalItems: [] });
    const result = assembleCT1ReportData(ct1, null, META);
    const table = result.tables.find((t) => t.title === "Flagged Capital Items");
    expect(table).toBeUndefined();
  });
});

// ── VAT Position — refundable branch (line 176) ─────────────────

describe("assembleCT1ReportData — VAT Position refundable", () => {
  it("shows VAT Refundable when vatPosition type is refundable", () => {
    const ct1 = makeCT1({ vatPosition: { type: "refundable", amount: 1500 } });
    const result = assembleCT1ReportData(ct1, null, META);
    const section = result.sections.find((s) => s.title === "VAT Position");
    expect(section).toBeDefined();
    expect(section!.rows[0].label).toBe("VAT Refundable");
    expect(section!.rows[0].value).toBe(fmtEuro(1500));
  });
});

// ── Construction Trade false path (line 52) ─────────────────────

describe("assembleCT1ReportData — Construction Trade false", () => {
  it("shows 'No' when isConstructionTrade is false", () => {
    const ct1 = makeCT1({ isConstructionTrade: false });
    const result = assembleCT1ReportData(ct1, null, META);
    const info = result.sections.find((s) => s.title === "Company Information")!;
    expect(info.rows.find((r) => r.label === "Construction Trade")?.value).toBe("No");
  });
});

// ── Return Values ──────────────────────────────────────────────

describe("assembleCT1ReportData — return values", () => {
  it("returns totalCTLiability, tradingProfit, totalIncome, totalDeductions", () => {
    const ct1 = makeCT1({
      detectedIncome: [{ category: "Sales", amount: 100000 }],
      expenseSummary: { allowable: 30000, disallowed: 5000 },
      vehicleAsset: null,
    });
    const questionnaire = { capitalAllowancesPlant: 2000 };
    // totalIncome = 100000
    // capitalAllowancesTotal = 2000 + 0 (no vehicle) = 2000
    // tradingProfit = 100000 - 30000 - 2000 = 68000
    // taxableProfit = 68000 (no losses)
    // ctAt125 = 68000 * 0.125 = 8500
    // totalCT = 8500 (no surcharge)
    // totalDeductions = 30000 + 2000 = 32000
    const result = assembleCT1ReportData(ct1, questionnaire, META);
    expect(result.totalIncome).toBe(100000);
    expect(result.tradingProfit).toBe(68000);
    expect(result.totalCTLiability).toBe(8500);
    expect(result.totalDeductions).toBe(32000);
  });
});

// ── Travel Deduction & RCT Credit ─────────────────────────────

describe("assembleCT1ReportData — travel deduction and RCT credit", () => {
  it("includes directors' travel allowance row when directorsLoanTravel > 0", () => {
    const ct1 = makeCT1({ directorsLoanTravel: 3000 });
    const result = assembleCT1ReportData(ct1, null, META);
    const section = result.sections.find((s) => s.title === "Trading Profit Adjustment")!;
    expect(section.rows.some((r) => r.label.includes("Directors' Travel Allowance"))).toBe(true);
    expect(section.rows.find((r) => r.label.includes("Directors' Travel Allowance"))?.value).toBe(fmtEuro(3000));
  });

  it("excludes directors' travel allowance row when directorsLoanTravel is 0", () => {
    const ct1 = makeCT1({ directorsLoanTravel: 0 });
    const result = assembleCT1ReportData(ct1, null, META);
    const section = result.sections.find((s) => s.title === "Trading Profit Adjustment")!;
    expect(section.rows.some((r) => r.label.includes("Directors' Travel Allowance"))).toBe(false);
  });

  it("includes RCT credit row when rctPrepayment > 0", () => {
    const ct1 = makeCT1({ rctPrepayment: 2500 });
    const result = assembleCT1ReportData(ct1, null, META);
    const section = result.sections.find((s) => s.title === "Corporation Tax Computation")!;
    expect(section.rows.some((r) => r.label.includes("RCT Credit"))).toBe(true);
    expect(section.rows.find((r) => r.label.includes("RCT Credit"))?.value).toBe(fmtEuro(2500));
  });

  it("excludes RCT credit row when rctPrepayment is 0", () => {
    const ct1 = makeCT1({ rctPrepayment: 0 });
    const result = assembleCT1ReportData(ct1, null, META);
    const section = result.sections.find((s) => s.title === "Corporation Tax Computation")!;
    expect(section.rows.some((r) => r.label.includes("RCT Credit"))).toBe(false);
  });

  it("includes travel deduction in totalDeductions", () => {
    const ct1 = makeCT1({ directorsLoanTravel: 5000 });
    const result = assembleCT1ReportData(ct1, null, META);
    // totalDeductions = allowable + capitalAllowancesTotal + travelDeduction
    // = 22000 + 0 + 5000 = 27000
    expect(result.totalDeductions).toBe(27000);
  });
});
