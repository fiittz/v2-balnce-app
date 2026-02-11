import type { BalanceSheetReportData } from "../types";
import { createPdfDoc, addHeader, addSection, addSignatures, addFooter, savePdf } from "../pdfHelpers";

export function generateBalanceSheetPdf(data: BalanceSheetReportData) {
  const doc = createPdfDoc();
  let y = addHeader(doc, data.meta, "Balance Sheet");

  for (const section of data.sections) {
    y = addSection(doc, section, y);
  }

  y = addSignatures(doc, data.meta, y);
  addFooter(doc);
  savePdf(doc, `Balance_Sheet_${data.meta.companyName.replace(/\s+/g, "_")}_${data.meta.taxYear}.pdf`);
}
