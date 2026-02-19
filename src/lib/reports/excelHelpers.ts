import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ReportMeta, ReportSection, ReportTable } from "./types";
import { fmtDate, fmtTaxYear } from "./formatters";

export function createWorkbook(meta: ReportMeta): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.preparer ?? "Balnce";
  wb.created = meta.generatedDate;
  wb.company = meta.companyName;
  return wb;
}

export function addHeaderRows(ws: ExcelJS.Worksheet, meta: ReportMeta, reportTitle: string): number {
  // Company name
  const titleRow = ws.addRow([meta.companyName]);
  titleRow.font = { bold: true, size: 16 };
  titleRow.height = 24;

  // Report title
  const subtitleRow = ws.addRow([reportTitle]);
  subtitleRow.font = { bold: true, size: 12 };

  // Tax year
  ws.addRow([fmtTaxYear(meta.taxYear)]);

  // Generated date
  ws.addRow([`Generated: ${fmtDate(meta.generatedDate)}`]);

  if (meta.preparer) {
    ws.addRow([`Prepared by: ${meta.preparer}`]);
  }

  // Blank row
  ws.addRow([]);

  return ws.rowCount;
}

export function addSectionRows(ws: ExcelJS.Worksheet, section: ReportSection): number {
  // Section title
  const titleRow = ws.addRow([section.title]);
  titleRow.font = { bold: true, size: 11 };
  titleRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8E8E8" },
  };

  // Label/value rows
  for (const row of section.rows) {
    const dataRow = ws.addRow([row.label, row.value]);
    dataRow.getCell(2).alignment = { horizontal: "right" };
  }

  // Blank separator
  ws.addRow([]);

  return ws.rowCount;
}

export function addTableRows(ws: ExcelJS.Worksheet, table: ReportTable): number {
  // Table title
  const titleRow = ws.addRow([table.title]);
  titleRow.font = { bold: true, size: 11 };

  // Headers
  const headerRow = ws.addRow(table.headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF424242" },
  };
  headerRow.eachCell((cell) => {
    /* v8 ignore start -- eachCell callback runs at ExcelJS runtime, not testable via mock */
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };
    /* v8 ignore stop */
  });

  // Data rows
  for (let i = 0; i < table.rows.length; i++) {
    const row = ws.addRow(table.rows[i]);
    if (i % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8F8F8" },
      };
    }
  }

  // Blank separator
  ws.addRow([]);

  return ws.rowCount;
}

export function styleSheet(ws: ExcelJS.Worksheet) {
  // Auto-width columns based on content
  ws.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const cellLength = cell.value?.toString().length ?? 0;
      if (cellLength > maxLength) maxLength = cellLength;
    });
    column.width = Math.min(maxLength + 4, 50);
  });

  // Ensure at least 2 columns
  if (ws.columns.length < 2) {
    ws.getColumn(2).width = 20;
  }
}

export async function saveWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, filename);
}
