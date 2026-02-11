import type { CT1Data } from "@/hooks/useCT1Data";
import type { CT1ReportData, ReportMeta, ReportSection, ReportTable } from "./types";
import { fmtEuro } from "./formatters";

interface CT1QuestionnaireData {
  // Section 7 — Fixed Assets
  fixedAssetsLandBuildings?: number;
  fixedAssetsPlantMachinery?: number;
  fixedAssetsMotorVehicles?: number;
  fixedAssetsFixturesFittings?: number;
  // Section 8 — Current Assets
  currentAssetsStock?: number;
  currentAssetsDebtors?: number;
  currentAssetsCash?: number;
  currentAssetsBankBalance?: number;
  // Section 9 — Capital Allowances
  capitalAllowancesPlant?: number;
  capitalAllowancesMotorVehicles?: number;
  capitalAllowancesTotal?: number;
  // Section 10 — Liabilities
  liabilitiesCreditors?: number;
  liabilitiesTaxation?: number;
  liabilitiesBankLoans?: number;
  liabilitiesDirectorsLoans?: number;
  // Section 13 — Losses
  lossesForward?: number;
  // Section 14 — Close Company Surcharge
  closeCompanySurcharge?: number;
  // Section 15 — Preliminary CT
  preliminaryCTPaid?: number;
  // General
  vatStatus?: string;
  finalDeclaration?: boolean;
  [key: string]: unknown;
}

export function assembleCT1ReportData(
  ct1: CT1Data,
  questionnaire: CT1QuestionnaireData | null,
  meta: ReportMeta
): CT1ReportData {
  const sections: ReportSection[] = [];
  const tables: ReportTable[] = [];

  // ── Company Info ──────────────────────────────────────
  sections.push({
    title: "Company Information",
    rows: [
      { label: "Company Name", value: meta.companyName },
      { label: "Tax Year", value: meta.taxYear },
      { label: "Construction Trade", value: ct1.isConstructionTrade ? "Yes" : "No" },
      { label: "Close Company", value: ct1.isCloseCompany ? "Yes" : "No" },
      { label: "VAT Status", value: questionnaire?.vatStatus ?? "Not specified" },
    ],
  });

  // ── Trading Income ────────────────────────────────────
  const totalIncome = ct1.detectedIncome.reduce((sum, i) => sum + i.amount, 0);

  tables.push({
    title: "Trading Income",
    headers: ["Category", "Amount"],
    rows: [
      ...ct1.detectedIncome.map((i) => [i.category, fmtEuro(i.amount)]),
      ["Total Income", fmtEuro(totalIncome)],
    ],
  });

  // ── Expense Breakdown by Category ──────────────────────
  const totalExpenses = ct1.expenseByCategory.reduce((sum, e) => sum + e.amount, 0);

  tables.push({
    title: "Expense Breakdown",
    headers: ["Category", "Amount"],
    rows: [
      ...ct1.expenseByCategory.map((e) => [e.category, fmtEuro(e.amount)]),
      ["Total Expenses", fmtEuro(totalExpenses)],
    ],
  });

  // ── Allowable Deductions ──────────────────────────────
  sections.push({
    title: "Allowable Deductions",
    rows: [
      { label: "Allowable Expenses", value: fmtEuro(ct1.expenseSummary.allowable) },
      { label: "Disallowed Expenses", value: fmtEuro(ct1.expenseSummary.disallowed) },
    ],
  });

  // ── Capital Allowances ────────────────────────────────
  // Motor vehicle allowance: prefer auto-calculated from vehicle asset
  const motorVehicleAllowance = ct1.vehicleAsset
    ? ct1.vehicleAsset.depreciation.annualAllowance
    : (questionnaire?.capitalAllowancesMotorVehicles ?? 0);
  const capitalAllowancesTotal =
    (questionnaire?.capitalAllowancesPlant ?? 0) + motorVehicleAllowance;

  if (capitalAllowancesTotal > 0 || questionnaire?.capitalAllowancesTotal) {
    const capAllowanceRows = [
      { label: "Plant & Machinery", value: fmtEuro(questionnaire?.capitalAllowancesPlant ?? 0) },
      { label: "Motor Vehicles", value: fmtEuro(motorVehicleAllowance) },
    ];
    if (ct1.vehicleAsset) {
      const v = ct1.vehicleAsset;
      capAllowanceRows.push({
        label: `  ${v.description} (${v.reg}) — Year ${v.depreciation.yearsOwned}/8, NBV ${fmtEuro(v.depreciation.netBookValue)}`,
        value: "",
      });
    }
    capAllowanceRows.push({
      label: "Total Capital Allowances",
      value: fmtEuro(questionnaire?.capitalAllowancesTotal ?? capitalAllowancesTotal),
    });
    sections.push({ title: "Capital Allowances", rows: capAllowanceRows });
  }

  // ── Trading Profit Adjustment ─────────────────────────
  const tradingProfit = totalIncome - ct1.expenseSummary.allowable - capitalAllowancesTotal;

  sections.push({
    title: "Trading Profit Adjustment",
    rows: [
      { label: "Total Income", value: fmtEuro(totalIncome) },
      { label: "Less: Allowable Expenses", value: fmtEuro(ct1.expenseSummary.allowable) },
      { label: "Less: Capital Allowances", value: fmtEuro(capitalAllowancesTotal) },
      { label: "Adjusted Trading Profit", value: fmtEuro(Math.max(0, tradingProfit)) },
    ],
  });

  // ── Losses Brought Forward ────────────────────────────
  const lossesForward = questionnaire?.lossesForward ?? 0;
  const taxableProfit = Math.max(0, tradingProfit - lossesForward);

  if (lossesForward > 0) {
    sections.push({
      title: "Losses Brought Forward",
      rows: [
        { label: "Trading Profit", value: fmtEuro(Math.max(0, tradingProfit)) },
        { label: "Less: Losses B/F", value: fmtEuro(lossesForward) },
        { label: "Taxable Profit", value: fmtEuro(taxableProfit) },
      ],
    });
  }

  // ── CT Computation ────────────────────────────────────
  const ctAt125 = taxableProfit * 0.125;
  const surcharge = questionnaire?.closeCompanySurcharge ?? 0;
  const totalCT = ctAt125 + surcharge;
  const prelimPaid = questionnaire?.preliminaryCTPaid ?? 0;
  const balanceDue = totalCT - prelimPaid;

  sections.push({
    title: "Corporation Tax Computation",
    rows: [
      { label: "Taxable Profit", value: fmtEuro(taxableProfit) },
      { label: "CT @ 12.5% (trading)", value: fmtEuro(ctAt125) },
      ...(surcharge > 0
        ? [{ label: "Close Company Surcharge", value: fmtEuro(surcharge) }]
        : []),
      { label: "Total CT Liability", value: fmtEuro(totalCT) },
      ...(prelimPaid > 0
        ? [
            { label: "Less: Preliminary CT Paid", value: fmtEuro(prelimPaid) },
            { label: "Balance Due", value: fmtEuro(balanceDue) },
          ]
        : []),
    ],
  });

  // ── VAT Position ──────────────────────────────────────
  if (ct1.vatPosition) {
    sections.push({
      title: "VAT Position",
      rows: [
        {
          label: ct1.vatPosition.type === "payable" ? "VAT Payable" : "VAT Refundable",
          value: fmtEuro(ct1.vatPosition.amount),
        },
      ],
    });
  }

  // ── Flagged Capital Items ─────────────────────────────
  if (ct1.flaggedCapitalItems.length > 0) {
    tables.push({
      title: "Flagged Capital Items",
      headers: ["Description", "Date", "Amount"],
      rows: ct1.flaggedCapitalItems.map((item) => [
        item.description,
        item.date,
        fmtEuro(item.amount),
      ]),
    });
  }

  return {
    meta,
    sections,
    tables,
    totalCTLiability: totalCT,
    tradingProfit: Math.max(0, tradingProfit),
    totalIncome,
    totalDeductions: ct1.expenseSummary.allowable + capitalAllowancesTotal,
  };
}
