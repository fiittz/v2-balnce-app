import type { BalanceSheetReportData } from "../types";
import { createWorkbook, addHeaderRows, addSectionRows, styleSheet, saveWorkbook } from "../excelHelpers";

export async function generateBalanceSheetExcel(data: BalanceSheetReportData) {
  const wb = createWorkbook(data.meta);

  // ── Balance Sheet Summary ─────────────────────────────
  const summary = wb.addWorksheet("Balance Sheet");
  addHeaderRows(summary, data.meta, "Balance Sheet");

  const netAssets = data.sections.find((s) => s.title === "Net Assets");
  if (netAssets) addSectionRows(summary, netAssets);

  const capReserves = data.sections.find((s) => s.title === "Capital & Reserves");
  if (capReserves) addSectionRows(summary, capReserves);

  styleSheet(summary);

  // ── Assets Sheet ──────────────────────────────────────
  const assetsSheet = wb.addWorksheet("Assets");
  addHeaderRows(assetsSheet, data.meta, "Assets");

  const fixedAssets = data.sections.find((s) => s.title === "Fixed Assets");
  if (fixedAssets) addSectionRows(assetsSheet, fixedAssets);

  const currentAssets = data.sections.find((s) => s.title === "Current Assets");
  if (currentAssets) addSectionRows(assetsSheet, currentAssets);

  styleSheet(assetsSheet);

  // ── Liabilities Sheet ─────────────────────────────────
  const liabilitiesSheet = wb.addWorksheet("Liabilities");
  addHeaderRows(liabilitiesSheet, data.meta, "Liabilities");

  const currentLiabilities = data.sections.find((s) => s.title === "Current Liabilities");
  if (currentLiabilities) addSectionRows(liabilitiesSheet, currentLiabilities);

  const netCurrentAssets = data.sections.find((s) => s.title === "Net Current Assets");
  if (netCurrentAssets) addSectionRows(liabilitiesSheet, netCurrentAssets);

  const longTermLiabilities = data.sections.find((s) => s.title === "Long-term Liabilities");
  if (longTermLiabilities) addSectionRows(liabilitiesSheet, longTermLiabilities);

  styleSheet(liabilitiesSheet);

  await saveWorkbook(wb, `Balance_Sheet_${data.meta.companyName.replace(/\s+/g, "_")}_${data.meta.taxYear}.xlsx`);
}
