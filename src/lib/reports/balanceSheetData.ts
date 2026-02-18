import type { BalanceSheetReportData, ReportMeta, ReportSection } from "./types";
import { fmtEuro } from "./formatters";

export interface BalanceSheetInput {
  // Fixed Assets (from CT1 questionnaire section 7)
  landBuildings: number;
  plantMachinery: number;
  motorVehicles: number;
  fixturesFittings: number;
  // Current Assets (from CT1 questionnaire section 8)
  stock: number;
  debtors: number;
  cash: number;
  bankBalance: number;
  rctPrepayment: number; // RCT deducted from invoices — offset against CT
  // Current Liabilities (from CT1 questionnaire section 10)
  creditors: number;
  taxation: number;
  bankOverdraft: number;
  directorsLoanTravel: number; // Mileage/subsistence owed to director at Revenue rates
  // Long-term Liabilities
  bankLoans: number;
  directorsLoans: number;
  // Capital & Reserves
  shareCapital: number;
  retainedProfits: number;
}

export function assembleBalanceSheetData(input: BalanceSheetInput, meta: ReportMeta): BalanceSheetReportData {
  const sections: ReportSection[] = [];

  const fixedAssets = input.landBuildings + input.plantMachinery + input.motorVehicles + input.fixturesFittings;

  const currentAssets = input.stock + input.debtors + input.cash + input.bankBalance + (input.rctPrepayment ?? 0);

  const currentLiabilities = input.creditors + input.taxation + input.bankOverdraft + (input.directorsLoanTravel ?? 0);

  const longTermLiabilities = input.bankLoans + input.directorsLoans;

  const netAssets = fixedAssets + currentAssets - currentLiabilities - longTermLiabilities;
  const capitalReserves = input.shareCapital + input.retainedProfits;

  // ── Fixed Assets ──────────────────────────────────────
  sections.push({
    title: "Fixed Assets",
    rows: [
      { label: "Land & Buildings", value: fmtEuro(input.landBuildings) },
      { label: "Plant & Machinery", value: fmtEuro(input.plantMachinery) },
      { label: "Motor Vehicles", value: fmtEuro(input.motorVehicles) },
      { label: "Fixtures & Fittings", value: fmtEuro(input.fixturesFittings) },
      { label: "Total Fixed Assets", value: fmtEuro(fixedAssets) },
    ],
  });

  // ── Current Assets ────────────────────────────────────
  sections.push({
    title: "Current Assets",
    rows: [
      { label: "Stock", value: fmtEuro(input.stock) },
      { label: "Debtors", value: fmtEuro(input.debtors) },
      { label: "Cash in Hand", value: fmtEuro(input.cash) },
      { label: "Bank Balance", value: fmtEuro(input.bankBalance) },
      ...(input.rctPrepayment > 0 ? [{ label: "RCT Prepayment", value: fmtEuro(input.rctPrepayment) }] : []),
      { label: "Total Current Assets", value: fmtEuro(currentAssets) },
    ],
  });

  // ── Current Liabilities ───────────────────────────────
  sections.push({
    title: "Current Liabilities",
    rows: [
      { label: "Creditors", value: fmtEuro(input.creditors) },
      { label: "Taxation", value: fmtEuro(input.taxation) },
      { label: "Bank Overdraft", value: fmtEuro(input.bankOverdraft) },
      ...((input.directorsLoanTravel ?? 0) > 0
        ? [{ label: "Director's Loan", value: fmtEuro(input.directorsLoanTravel) }]
        : []),
      { label: "Total Current Liabilities", value: fmtEuro(currentLiabilities) },
    ],
  });

  // ── Net Current Assets ────────────────────────────────
  sections.push({
    title: "Net Current Assets",
    rows: [
      { label: "Current Assets", value: fmtEuro(currentAssets) },
      { label: "Less: Current Liabilities", value: `(${fmtEuro(currentLiabilities)})` },
      { label: "Net Current Assets", value: fmtEuro(currentAssets - currentLiabilities) },
    ],
  });

  // ── Long-term Liabilities ─────────────────────────────
  if (longTermLiabilities > 0) {
    sections.push({
      title: "Long-term Liabilities",
      rows: [
        { label: "Bank Loans", value: fmtEuro(input.bankLoans) },
        { label: "Directors' Loans", value: fmtEuro(input.directorsLoans) },
        { label: "Total Long-term Liabilities", value: fmtEuro(longTermLiabilities) },
      ],
    });
  }

  // ── Net Assets ────────────────────────────────────────
  sections.push({
    title: "Net Assets",
    rows: [
      { label: "Total Assets", value: fmtEuro(fixedAssets + currentAssets) },
      { label: "Less: Total Liabilities", value: `(${fmtEuro(currentLiabilities + longTermLiabilities)})` },
      { label: "Net Assets", value: fmtEuro(netAssets) },
    ],
  });

  // ── Capital & Reserves ────────────────────────────────
  sections.push({
    title: "Capital & Reserves",
    rows: [
      { label: "Share Capital", value: fmtEuro(input.shareCapital) },
      { label: "Retained Profits", value: fmtEuro(input.retainedProfits) },
      { label: "Total Capital & Reserves", value: fmtEuro(capitalReserves) },
    ],
  });

  return {
    meta,
    sections,
    fixedAssets,
    currentAssets,
    currentLiabilities,
    longTermLiabilities,
    netAssets,
    capitalReserves,
  };
}
