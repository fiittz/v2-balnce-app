import type { VATReportData } from "../types";
import { createPdfDoc, addHeader, addSection, addTable, addSignatures, addFooter, savePdf } from "../pdfHelpers";

export function generateVATPdf(data: VATReportData) {
  const doc = createPdfDoc();
  let y = addHeader(doc, data.meta, "VAT Return");

  // Registration Info first
  const regSection = data.sections.find((s) => s.title === "Registration Information");
  if (regSection) {
    y = addSection(doc, regSection, y);
  }

  // Sales and Purchases tables
  for (const table of data.tables) {
    y = addTable(doc, table, y);
  }

  // VAT Computation
  const computationSection = data.sections.find((s) => s.title === "VAT Return Computation");
  if (computationSection) {
    y = addSection(doc, computationSection, y);
  }

  y = addSignatures(doc, data.meta, y);
  addFooter(doc);
  savePdf(doc, `VAT_Return_${data.meta.companyName.replace(/\s+/g, "_")}_${data.meta.taxYear}.pdf`);
}
