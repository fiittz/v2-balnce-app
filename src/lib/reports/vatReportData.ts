import type { VATReportData, ReportMeta, ReportSection, ReportTable } from "./types";
import { fmtEuro } from "./formatters";

export interface VATInput {
  vatNumber?: string;
  vatBasis?: string; // "cash_basis" | "invoice_basis"
  periodStart: string;
  periodEnd: string;
  salesByRate: { rate: string; net: number; vat: number }[];
  purchasesByRate: { rate: string; net: number; vat: number }[];
}

export function assembleVATReportData(input: VATInput, meta: ReportMeta): VATReportData {
  const sections: ReportSection[] = [];
  const tables: ReportTable[] = [];

  const totalSalesNet = input.salesByRate.reduce((s, r) => s + r.net, 0);
  const totalSalesVat = input.salesByRate.reduce((s, r) => s + r.vat, 0);
  const totalPurchasesNet = input.purchasesByRate.reduce((s, r) => s + r.net, 0);
  const totalPurchasesVat = input.purchasesByRate.reduce((s, r) => s + r.vat, 0);
  const netVat = totalSalesVat - totalPurchasesVat;

  // ── Registration Info ─────────────────────────────────
  sections.push({
    title: "Registration Information",
    rows: [
      { label: "VAT Number", value: input.vatNumber || "Not specified" },
      { label: "Accounting Basis", value: input.vatBasis === "invoice_basis" ? "Invoice basis" : "Cash basis" },
      { label: "Period", value: `${input.periodStart} to ${input.periodEnd}` },
    ],
  });

  // ── Sales Analysis ────────────────────────────────────
  tables.push({
    title: "Sales Analysis",
    headers: ["VAT Rate", "Net Sales", "VAT Charged"],
    rows: [
      ...input.salesByRate.map((r) => [r.rate, fmtEuro(r.net), fmtEuro(r.vat)]),
      ["Total", fmtEuro(totalSalesNet), fmtEuro(totalSalesVat)],
    ],
  });

  // ── Purchases Analysis ────────────────────────────────
  tables.push({
    title: "Purchases Analysis",
    headers: ["VAT Rate", "Net Purchases", "VAT Deductible"],
    rows: [
      ...input.purchasesByRate.map((r) => [r.rate, fmtEuro(r.net), fmtEuro(r.vat)]),
      ["Total", fmtEuro(totalPurchasesNet), fmtEuro(totalPurchasesVat)],
    ],
  });

  // ── VAT Computation (T1–T4) ───────────────────────────
  sections.push({
    title: "VAT Return Computation",
    rows: [
      { label: "T1 — VAT on Sales", value: fmtEuro(totalSalesVat) },
      { label: "T2 — VAT on EU Acquisitions", value: fmtEuro(0) },
      { label: "T3 — VAT on Purchases", value: fmtEuro(totalPurchasesVat) },
      { label: "T4 — VAT on EU Acquisitions (input)", value: fmtEuro(0) },
      {
        label: netVat >= 0 ? "Net VAT Payable" : "Net VAT Refundable",
        value: fmtEuro(Math.abs(netVat)),
      },
    ],
  });

  return {
    meta,
    sections,
    tables,
    t1Sales: totalSalesVat,
    t2Vat: 0,
    t3Purchases: totalPurchasesVat,
    t4InputVat: 0,
    netVat,
  };
}
