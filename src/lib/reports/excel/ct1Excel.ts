import type { CT1ReportData } from "../types";
import { createWorkbook, addHeaderRows, addSectionRows, addTableRows, styleSheet, saveWorkbook } from "../excelHelpers";

export async function generateCT1Excel(data: CT1ReportData) {
  const wb = createWorkbook(data.meta);

  // ── Summary Sheet ─────────────────────────────────────
  const summary = wb.addWorksheet("Summary");
  addHeaderRows(summary, data.meta, "CT1 — Corporation Tax Return");

  // Company Info + CT Computation
  const companyInfo = data.sections.find((s) => s.title === "Company Information");
  if (companyInfo) addSectionRows(summary, companyInfo);

  const ctComputation = data.sections.find((s) => s.title === "Corporation Tax Computation");
  if (ctComputation) addSectionRows(summary, ctComputation);

  const vatSection = data.sections.find((s) => s.title === "VAT Position");
  if (vatSection) addSectionRows(summary, vatSection);

  styleSheet(summary);

  // ── Trading Profit Sheet ──────────────────────────────
  const tradingSheet = wb.addWorksheet("Trading Profit");
  addHeaderRows(tradingSheet, data.meta, "Trading Profit Adjustment");

  const incomeTable = data.tables.find((t) => t.title === "Trading Income");
  if (incomeTable) addTableRows(tradingSheet, incomeTable);

  const expenseBreakdown = data.tables.find((t) => t.title === "Expense Breakdown");
  if (expenseBreakdown) addTableRows(tradingSheet, expenseBreakdown);

  const deductions = data.sections.find((s) => s.title === "Allowable Deductions");
  if (deductions) addSectionRows(tradingSheet, deductions);

  const profitAdj = data.sections.find((s) => s.title === "Trading Profit Adjustment");
  if (profitAdj) addSectionRows(tradingSheet, profitAdj);

  const losses = data.sections.find((s) => s.title === "Losses Brought Forward");
  if (losses) addSectionRows(tradingSheet, losses);

  styleSheet(tradingSheet);

  // ── Capital Allowances Sheet ──────────────────────────
  const capSheet = wb.addWorksheet("Capital Allowances");
  addHeaderRows(capSheet, data.meta, "Capital Allowances");

  const capSection = data.sections.find((s) => s.title === "Capital Allowances");
  if (capSection) addSectionRows(capSheet, capSection);

  const flaggedTable = data.tables.find((t) => t.title === "Flagged Capital Items");
  if (flaggedTable) addTableRows(capSheet, flaggedTable);

  styleSheet(capSheet);

  // ── Tax Computation Sheet ─────────────────────────────
  const taxSheet = wb.addWorksheet("Tax Computation");
  addHeaderRows(taxSheet, data.meta, "Corporation Tax Computation");

  if (ctComputation) addSectionRows(taxSheet, ctComputation);

  styleSheet(taxSheet);

  await saveWorkbook(wb, `CT1_${data.meta.companyName.replace(/\s+/g, "_")}_${data.meta.taxYear}.xlsx`);
}
