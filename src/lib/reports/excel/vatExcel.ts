import type { VATReportData } from "../types";
import { createWorkbook, addHeaderRows, addSectionRows, addTableRows, styleSheet, saveWorkbook } from "../excelHelpers";

export async function generateVATExcel(data: VATReportData) {
  const wb = createWorkbook(data.meta);

  // ── VAT Summary Sheet ─────────────────────────────────
  const summary = wb.addWorksheet("VAT Summary");
  addHeaderRows(summary, data.meta, "VAT Return");

  const regInfo = data.sections.find((s) => s.title === "Registration Information");
  if (regInfo) addSectionRows(summary, regInfo);

  const computation = data.sections.find((s) => s.title === "VAT Return Computation");
  if (computation) addSectionRows(summary, computation);

  styleSheet(summary);

  // ── Sales Detail Sheet ────────────────────────────────
  const salesSheet = wb.addWorksheet("Sales Detail");
  addHeaderRows(salesSheet, data.meta, "Sales Analysis");

  const salesTable = data.tables.find((t) => t.title === "Sales Analysis");
  if (salesTable) addTableRows(salesSheet, salesTable);

  styleSheet(salesSheet);

  // ── Purchases Detail Sheet ────────────────────────────
  const purchasesSheet = wb.addWorksheet("Purchases Detail");
  addHeaderRows(purchasesSheet, data.meta, "Purchases Analysis");

  const purchasesTable = data.tables.find((t) => t.title === "Purchases Analysis");
  if (purchasesTable) addTableRows(purchasesSheet, purchasesTable);

  styleSheet(purchasesSheet);

  await saveWorkbook(wb, `VAT_Return_${data.meta.companyName.replace(/\s+/g, "_")}_${data.meta.taxYear}.xlsx`);
}
