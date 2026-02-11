import type { AbridgedAccountsReportData } from "../types";
import { createWorkbook, addHeaderRows, addSectionRows, styleSheet, saveWorkbook } from "../excelHelpers";

export async function generateAbridgedAccountsExcel(data: AbridgedAccountsReportData) {
  const wb = createWorkbook(data.meta);

  // ── Cover Sheet ─────────────────────────────────────────
  const cover = wb.addWorksheet("Cover");
  addHeaderRows(cover, data.meta, "Abridged Financial Statements");

  const companyInfo = data.sections.find((s) => s.title === "Company Information");
  if (companyInfo) addSectionRows(cover, companyInfo);

  const directorsStatement = data.sections.find(
    (s) => s.title === "Directors' Responsibility Statement"
  );
  if (directorsStatement) addSectionRows(cover, directorsStatement);

  styleSheet(cover);

  // ── Balance Sheet ───────────────────────────────────────
  const bsSheet = wb.addWorksheet("Balance Sheet");
  addHeaderRows(bsSheet, data.meta, "Abridged Balance Sheet — Schedule 3A");

  const balanceSheet = data.sections.find((s) => s.title === "Abridged Balance Sheet");
  if (balanceSheet) addSectionRows(bsSheet, balanceSheet);

  const capitalReserves = data.sections.find((s) => s.title === "Capital and Reserves");
  if (capitalReserves) addSectionRows(bsSheet, capitalReserves);

  styleSheet(bsSheet);

  // ── Notes Sheet ─────────────────────────────────────────
  const notesSheet = wb.addWorksheet("Notes");
  addHeaderRows(notesSheet, data.meta, "Notes to the Financial Statements");

  const notes = data.sections.find((s) => s.title === "Notes to the Financial Statements");
  if (notes) addSectionRows(notesSheet, notes);

  const auditExemption = data.sections.find((s) => s.title === "Audit Exemption Statement");
  if (auditExemption) addSectionRows(notesSheet, auditExemption);

  styleSheet(notesSheet);

  // ── Accounting Policies Sheet ───────────────────────────
  const policiesSheet = wb.addWorksheet("Accounting Policies");
  addHeaderRows(policiesSheet, data.meta, "Accounting Policies");

  const policies = data.sections.find((s) => s.title === "Accounting Policies");
  if (policies) addSectionRows(policiesSheet, policies);

  styleSheet(policiesSheet);

  const companySlug = data.meta.companyName.replace(/\s+/g, "_");
  await saveWorkbook(wb, `Abridged_Accounts_${companySlug}_${data.meta.taxYear}.xlsx`);
}
