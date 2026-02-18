import type { AbridgedAccountsReportData } from "../types";
import { createPdfDoc, addSection, addFooter, savePdf } from "../pdfHelpers";
import { fmtDate, fmtTaxYear } from "../formatters";

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CENTER_X = PAGE_WIDTH / 2;

function addCoverPage(doc: ReturnType<typeof createPdfDoc>, data: AbridgedAccountsReportData): void {
  let y = 60;

  // Company name centred
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(data.meta.companyName, CENTER_X, y, { align: "center" });
  y += 12;

  // CRO number
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  if (data.croNumber) {
    doc.text(`CRO Number: ${data.croNumber}`, CENTER_X, y, { align: "center" });
    y += 8;
  }

  // Registered address
  if (data.registeredAddress) {
    doc.text(data.registeredAddress, CENTER_X, y, { align: "center" });
    y += 12;
  }

  // Separator
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 30, y, PAGE_WIDTH - MARGIN - 30, y);
  y += 14;

  // Report title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Abridged Financial Statements", CENTER_X, y, { align: "center" });
  y += 10;

  // FRS 102 Section 1A subtitle
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Prepared under FRS 102, Section 1A (Small Entities)", CENTER_X, y, { align: "center" });
  y += 8;
  doc.text("Companies Act 2014, Section 352", CENTER_X, y, { align: "center" });
  y += 14;

  doc.setTextColor(0);

  // Year end
  doc.setFontSize(12);
  doc.text(fmtTaxYear(data.meta.taxYear), CENTER_X, y, { align: "center" });
  y += 16;

  // Directors
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Directors", CENTER_X, y, { align: "center" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const name of data.directorNames) {
    doc.text(name, CENTER_X, y, { align: "center" });
    y += 6;
  }

  // Generated date
  y += 10;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated: ${fmtDate(data.meta.generatedDate)}`, CENTER_X, y, { align: "center" });
  doc.setTextColor(0);
}

function addTextSection(
  doc: ReturnType<typeof createPdfDoc>,
  title: string,
  paragraphs: { label: string; value: string }[],
  startY: number,
): number {
  let y = startY;

  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  // Section title
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN, y);
  y += 3;
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  for (const p of paragraphs) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    // Sub-heading if label isn't generic
    if (p.label && p.label !== "Statement" && p.label !== "Exemption" && p.label !== "Obligations") {
      doc.setFont("helvetica", "bold");
      doc.text(p.label, MARGIN, y);
      y += 5;
      doc.setFont("helvetica", "normal");
    }

    // Wrap long text
    const lines = doc.splitTextToSize(p.value, PAGE_WIDTH - MARGIN * 2);
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, MARGIN, y);
      y += 4.5;
    }
    y += 3;
  }

  return y + 2;
}

function addSignatureLines(
  doc: ReturnType<typeof createPdfDoc>,
  data: AbridgedAccountsReportData,
  startY: number,
): number {
  let y = startY;

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Approved by the Board of Directors on ${fmtDate(data.meta.generatedDate)}`, MARGIN, y);
  y += 12;

  for (const name of data.directorNames) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    // Signature line
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, MARGIN + 60, y);
    y += 5;
    doc.setFontSize(9);
    doc.text(name, MARGIN, y);
    doc.text("Director", MARGIN + 65, y);
    y += 12;
  }

  // Single-director company: secretary must also sign (Companies Act 2014)
  if (data.directorNames.length === 1) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, MARGIN + 60, y);
    y += 5;
    doc.setFontSize(9);
    doc.text(data.companySecretaryName || "________________", MARGIN, y);
    doc.text("Secretary", MARGIN + 65, y);
    y += 12;
  }

  return y;
}

export function generateAbridgedAccountsPdf(data: AbridgedAccountsReportData) {
  const doc = createPdfDoc();

  // Page 1: Cover
  addCoverPage(doc, data);

  // Page 2+: Statutory sections
  doc.addPage();
  let y = 20;

  // Find each section by title
  const directorsStatement = data.sections.find((s) => s.title === "Directors' Responsibility Statement");
  const accountingPolicies = data.sections.find((s) => s.title === "Accounting Policies");
  const balanceSheet = data.sections.find((s) => s.title === "Abridged Balance Sheet");
  const capitalReserves = data.sections.find((s) => s.title === "Capital and Reserves");
  const notes = data.sections.find((s) => s.title === "Notes to the Financial Statements");
  const auditExemption = data.sections.find((s) => s.title === "Audit Exemption Statement");

  // Directors' Responsibility Statement
  if (directorsStatement) {
    y = addTextSection(doc, directorsStatement.title, directorsStatement.rows, y);
    y = addSignatureLines(doc, data, y);
  }

  // Accounting Policies
  if (accountingPolicies) {
    doc.addPage();
    y = 20;
    y = addTextSection(doc, accountingPolicies.title, accountingPolicies.rows, y);
  }

  // Abridged Balance Sheet
  if (balanceSheet) {
    doc.addPage();
    y = 20;
    y = addSection(doc, balanceSheet, y);
    y = addSignatureLines(doc, data, y);
  }

  // Capital & Reserves
  if (capitalReserves) {
    y = addSection(doc, capitalReserves, y);
  }

  // Notes
  if (notes) {
    doc.addPage();
    y = 20;
    y = addTextSection(doc, notes.title, notes.rows, y);
  }

  // Audit Exemption Statement
  if (auditExemption) {
    y = addTextSection(doc, auditExemption.title, auditExemption.rows, y);
  }

  addFooter(doc);

  const companySlug = data.meta.companyName.replace(/\s+/g, "_");
  savePdf(doc, `Abridged_Accounts_${companySlug}_${data.meta.taxYear}.pdf`);
}
