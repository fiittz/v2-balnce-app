import type { Form11ReportData } from "../types";
import { createPdfDoc, addHeader, addSection, addTable, addFooter, savePdf } from "../pdfHelpers";

export function generateForm11Pdf(data: Form11ReportData) {
  const doc = createPdfDoc();
  let y = addHeader(doc, data.meta, "Form 11 — Income Tax Return");

  // Interleave sections and tables in logical order
  const sectionIterator = data.sections[Symbol.iterator]();
  const tableQueue = [...data.tables];

  // Personal Details, Schedule E, Schedule D, Other Income, Total Income
  for (const section of data.sections) {
    y = addSection(doc, section, y);

    // After Schedule D, insert income/expense breakdown tables
    if (section.title === "Schedule D — Business Income") {
      for (const title of ["Business Income Breakdown", "Business Expense Breakdown"]) {
        const table = tableQueue.find((t) => t.title === title);
        if (table) {
          y = addTable(doc, table, y);
          tableQueue.splice(tableQueue.indexOf(table), 1);
        }
      }
    }

    // After "Total Income", insert the income tax bands and credits tables
    if (section.title === "Total Income" && tableQueue.length > 0) {
      const incomeTaxTable = tableQueue.find((t) => t.title === "Income Tax Calculation");
      if (incomeTaxTable) {
        y = addTable(doc, incomeTaxTable, y);
        tableQueue.splice(tableQueue.indexOf(incomeTaxTable), 1);
      }
      const creditsTable = tableQueue.find((t) => t.title === "Tax Credits");
      if (creditsTable) {
        y = addTable(doc, creditsTable, y);
        tableQueue.splice(tableQueue.indexOf(creditsTable), 1);
      }
    }

    // After PRSI, insert USC table
    if (section.title === "PRSI (Class S)") {
      const uscTable = tableQueue.find((t) => t.title === "Universal Social Charge");
      if (uscTable) {
        y = addTable(doc, uscTable, y);
        tableQueue.splice(tableQueue.indexOf(uscTable), 1);
      }
    }
  }

  // Any remaining tables
  for (const table of tableQueue) {
    y = addTable(doc, table, y);
  }

  addFooter(doc);

  const directorName = data.input.directorName.replace(/\s+/g, "_");
  savePdf(doc, `Form11_${directorName}_${data.meta.taxYear}.pdf`);
}
