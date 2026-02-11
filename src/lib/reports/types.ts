import type { Form11Input, Form11Result } from "@/lib/form11Calculator";
import type { CT1Data } from "@/hooks/useCT1Data";

// ── Shared Report Types ──────────────────────────────────────

export interface ReportMeta {
  companyName: string;
  taxYear: string;
  generatedDate: Date;
  preparer?: string;
  registeredAddress?: string;
  directorNames?: string[];
}

export interface ReportSection {
  title: string;
  rows: { label: string; value: string }[];
}

export interface ReportTable {
  title: string;
  headers: string[];
  rows: string[][];
}

// ── CT1 Report ───────────────────────────────────────────────

export interface CT1ReportData {
  meta: ReportMeta;
  sections: ReportSection[];
  tables: ReportTable[];
  totalCTLiability: number;
  tradingProfit: number;
  totalIncome: number;
  totalDeductions: number;
}

// ── Form 11 Report ───────────────────────────────────────────

export interface Form11ReportData {
  meta: ReportMeta;
  input: Form11Input;
  result: Form11Result;
  sections: ReportSection[];
  tables: ReportTable[];
}

// ── VAT Report ───────────────────────────────────────────────

export interface VATReportData {
  meta: ReportMeta;
  sections: ReportSection[];
  tables: ReportTable[];
  t1Sales: number;
  t2Vat: number;
  t3Purchases: number;
  t4InputVat: number;
  netVat: number;
}

// ── Balance Sheet Report ─────────────────────────────────────

export interface BalanceSheetReportData {
  meta: ReportMeta;
  sections: ReportSection[];
  fixedAssets: number;
  currentAssets: number;
  currentLiabilities: number;
  longTermLiabilities: number;
  netAssets: number;
  capitalReserves: number;
}

// ── Abridged Accounts Report (CRO Filing) ───────────────────

export interface AbridgedAccountsReportData {
  meta: ReportMeta;
  sections: ReportSection[];
  directorNames: string[];
  companySecretaryName?: string;
  croNumber: string;
  registeredAddress: string;
  accountingYearEnd: string;
  // Balance sheet totals
  fixedAssets: number;
  currentAssets: number;
  currentLiabilities: number;
  netCurrentAssets: number;
  longTermLiabilities: number;
  netAssets: number;
  shareCapital: number;
  retainedProfits: number;
  shareholdersFunds: number;
}
