import type { Form11ReportData } from "../types";
import { createWorkbook, addHeaderRows, addSectionRows, addTableRows, styleSheet, saveWorkbook } from "../excelHelpers";

export async function generateForm11Excel(data: Form11ReportData) {
  const wb = createWorkbook(data.meta);

  // ── Summary Sheet ─────────────────────────────────────
  const summary = wb.addWorksheet("Summary");
  addHeaderRows(summary, data.meta, "Form 11 — Income Tax Return");

  const personalDetails = data.sections.find((s) => s.title === "Personal Details");
  if (personalDetails) addSectionRows(summary, personalDetails);

  const taxSummary = data.sections.find((s) => s.title === "Tax Computation Summary");
  if (taxSummary) addSectionRows(summary, taxSummary);

  const splitYear = data.sections.find((s) => s.title === "Split-Year Assessment");
  if (splitYear) addSectionRows(summary, splitYear);

  const warnings = data.sections.find((s) => s.title === "Warnings");
  if (warnings) addSectionRows(summary, warnings);

  styleSheet(summary);

  // ── Income Sources Sheet ──────────────────────────────
  const incomeSheet = wb.addWorksheet("Income Sources");
  addHeaderRows(incomeSheet, data.meta, "Income Sources");

  const scheduleE = data.sections.find((s) => s.title === "Schedule E — Employment Income");
  if (scheduleE) addSectionRows(incomeSheet, scheduleE);

  const scheduleD = data.sections.find((s) => s.title === "Schedule D — Business Income");
  if (scheduleD) addSectionRows(incomeSheet, scheduleD);

  const incBreakdown = data.tables.find((t) => t.title === "Business Income Breakdown");
  if (incBreakdown) addTableRows(incomeSheet, incBreakdown);

  const expBreakdown = data.tables.find((t) => t.title === "Business Expense Breakdown");
  if (expBreakdown) addTableRows(incomeSheet, expBreakdown);

  const rentalInv = data.sections.find((s) => s.title === "Rental / Investment Income");
  if (rentalInv) addSectionRows(incomeSheet, rentalInv);

  const spouseIncome = data.sections.find((s) => s.title === "Spouse Income (Joint Assessment)");
  if (spouseIncome) addSectionRows(incomeSheet, spouseIncome);

  const totalIncome = data.sections.find((s) => s.title === "Total Income");
  if (totalIncome) addSectionRows(incomeSheet, totalIncome);

  styleSheet(incomeSheet);

  // ── Tax Computation Sheet ─────────────────────────────
  const taxSheet = wb.addWorksheet("Tax Computation");
  addHeaderRows(taxSheet, data.meta, "Tax Computation");

  const incomeTaxTable = data.tables.find((t) => t.title === "Income Tax Calculation");
  if (incomeTaxTable) addTableRows(taxSheet, incomeTaxTable);

  const netIncomeTax = data.sections.find((s) => s.title === "Net Income Tax");
  if (netIncomeTax) addSectionRows(taxSheet, netIncomeTax);

  const uscTable = data.tables.find((t) => t.title === "Universal Social Charge");
  if (uscTable) addTableRows(taxSheet, uscTable);

  const uscExempt = data.sections.find((s) => s.title === "Universal Social Charge");
  if (uscExempt) addSectionRows(taxSheet, uscExempt);

  const prsi = data.sections.find((s) => s.title === "PRSI (Class S)");
  if (prsi) addSectionRows(taxSheet, prsi);

  const cgt = data.sections.find((s) => s.title === "Capital Gains Tax");
  if (cgt) addSectionRows(taxSheet, cgt);

  styleSheet(taxSheet);

  // ── Credits Sheet ─────────────────────────────────────
  const creditsSheet = wb.addWorksheet("Credits");
  addHeaderRows(creditsSheet, data.meta, "Tax Credits & Reliefs");

  const creditsTable = data.tables.find((t) => t.title === "Tax Credits");
  if (creditsTable) addTableRows(creditsSheet, creditsTable);

  styleSheet(creditsSheet);

  const directorName = data.input.directorName.replace(/\s+/g, "_");
  await saveWorkbook(wb, `Form11_${directorName}_${data.meta.taxYear}.xlsx`);
}
