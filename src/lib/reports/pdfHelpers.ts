import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportMeta, ReportSection, ReportTable } from "./types";
import { fmtDate, fmtTaxYear } from "./formatters";

const MARGIN = 20;
const PAGE_WIDTH = 210; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export function createPdfDoc(): jsPDF {
  return new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
}

export function addHeader(doc: jsPDF, meta: ReportMeta, reportTitle: string) {
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(meta.companyName, MARGIN, 25);

  let y = 33;

  if (meta.registeredAddress) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(meta.registeredAddress, MARGIN, y, { maxWidth: CONTENT_WIDTH });
    y += 6;
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  doc.text(reportTitle, MARGIN, y);
  y += 7;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(fmtTaxYear(meta.taxYear), MARGIN, y);
  y += 6;
  doc.text(`Generated: ${fmtDate(meta.generatedDate)}`, MARGIN, y);
  y += 6;
  if (meta.preparer) {
    doc.text(`Prepared by: ${meta.preparer}`, MARGIN, y);
    y += 6;
  }
  doc.setTextColor(0);

  // Separator line
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);

  return y + 6;
}

export function addSection(
  doc: jsPDF,
  section: ReportSection,
  startY: number
): number {
  let y = startY;

  // Check if we need a new page
  if (y > 260) {
    doc.addPage();
    y = 20;
  }

  // Section title
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(section.title, MARGIN, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  for (let i = 0; i < section.rows.length; i++) {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }

    const row = section.rows[i];
    // Alternating background
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 6, "F");
    }

    doc.text(row.label, MARGIN + 2, y);
    doc.text(row.value, PAGE_WIDTH - MARGIN - 2, y, { align: "right" });
    y += 6;
  }

  return y + 4;
}

export function addTable(
  doc: jsPDF,
  table: ReportTable,
  startY: number
): number {
  let y = startY;

  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  // Table title
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(table.title, MARGIN, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [table.headers],
    body: table.rows,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY + 8;
}

export function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);

    // Page number
    doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH - MARGIN, 290, {
      align: "right",
    });

    // Disclaimer
    doc.text(
      "AI-generated calculations require professional review. Verify current rates at Revenue.ie.",
      MARGIN,
      290
    );
    doc.setTextColor(0);
  }
}

/**
 * Add signature lines at the bottom of the last page.
 * - 1 director: Director + Secretary signature (company secretary required)
 * - 2+ directors: Director signatures only (one can act as secretary)
 */
export function addSignatures(doc: jsPDF, meta: ReportMeta, startY: number): number {
  const directors = meta.directorNames ?? [];
  if (directors.length === 0) return startY;

  let y = startY;

  // Need ~40mm per signature block; check if we need a new page
  const blocksNeeded = directors.length === 1 ? 2 : directors.length;
  const spaceNeeded = 30 + blocksNeeded * 28;
  if (y + spaceNeeded > 280) {
    doc.addPage();
    y = 20;
  }

  y += 10;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Signed on behalf of the company", MARGIN, y);
  y += 10;

  const lineWidth = 70;

  if (directors.length === 1) {
    // Single director — needs Director + Secretary signatures
    // Director
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, MARGIN + lineWidth, y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Director", MARGIN, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(directors[0], MARGIN, y + 10);
    doc.setTextColor(0);

    // Secretary (right side)
    const rightX = PAGE_WIDTH - MARGIN - lineWidth;
    doc.line(rightX, y, rightX + lineWidth, y);
    doc.setFont("helvetica", "bold");
    doc.text("Secretary", rightX, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text("________________________", rightX, y + 10);
    doc.setTextColor(0);

    y += 20;
  } else {
    // Two or more directors — no secretary required
    for (const name of directors) {
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y, MARGIN + lineWidth, y);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Director", MARGIN, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text(name, MARGIN, y + 10);
      doc.setTextColor(0);
      y += 22;
    }
  }

  // Date line
  y += 4;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + lineWidth, y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Date", MARGIN, y + 5);
  y += 10;

  return y;
}

export function savePdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}
