import type { CT1ReportData } from "../types";
import { createPdfDoc, addHeader, addSection, addTable, addFooter, savePdf } from "../pdfHelpers";

export function generateCT1Pdf(data: CT1ReportData) {
  const doc = createPdfDoc();
  let y = addHeader(doc, data.meta, "CT1 — Corporation Tax Return");

  const rendered = new Set<string>();

  for (const section of data.sections) {
    // Before "Allowable Deductions", render Trading Income table
    if (section.title === "Allowable Deductions") {
      const incomeTable = data.tables.find((t) => t.title === "Trading Income");
      if (incomeTable) {
        y = addTable(doc, incomeTable, y);
        rendered.add("Trading Income");
      }
    }

    y = addSection(doc, section, y);

    // After "Allowable Deductions", render Expense Breakdown table
    if (section.title === "Allowable Deductions") {
      const expenseTable = data.tables.find((t) => t.title === "Expense Breakdown");
      if (expenseTable) {
        y = addTable(doc, expenseTable, y);
        rendered.add("Expense Breakdown");
      }
    }
  }

  // Render remaining tables (Flagged Capital Items etc.)
  for (const table of data.tables) {
    if (rendered.has(table.title)) continue;
    y = addTable(doc, table, y);
  }

  addFooter(doc);
  savePdf(doc, `CT1_${data.meta.companyName.replace(/\s+/g, "_")}_${data.meta.taxYear}.pdf`);
}
