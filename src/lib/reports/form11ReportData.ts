import type { Form11Input, Form11Result } from "@/lib/form11Calculator";
import type { Form11ReportData, ReportMeta, ReportSection, ReportTable } from "./types";
import { fmtEuro, fmtPercent } from "./formatters";

export interface Form11ReportOptions {
  expenseByCategory?: { category: string; amount: number }[];
  incomeByCategory?: { category: string; amount: number }[];
}

export function assembleForm11ReportData(
  input: Form11Input,
  result: Form11Result,
  meta: ReportMeta,
  options?: Form11ReportOptions,
): Form11ReportData {
  const sections: ReportSection[] = [];
  const tables: ReportTable[] = [];

  // ── Personal Details ──────────────────────────────────
  sections.push({
    title: "Personal Details",
    rows: [
      { label: "Name", value: input.directorName },
      { label: "PPS Number", value: input.ppsNumber || "Not provided" },
      { label: "Marital Status", value: capitalize(input.maritalStatus) },
      { label: "Assessment Basis", value: capitalize(input.assessmentBasis) },
    ],
  });

  // ── Schedule E — Employment Income ────────────────────
  const scheduleERows: { label: string; value: string }[] = [];
  if (input.salary > 0) scheduleERows.push({ label: "Salary", value: fmtEuro(input.salary) });
  if (input.dividends > 0) scheduleERows.push({ label: "Dividends", value: fmtEuro(input.dividends) });
  if (input.bik > 0) scheduleERows.push({ label: "Benefit in Kind", value: fmtEuro(input.bik) });
  if (input.mileageAllowance > 0)
    scheduleERows.push({ label: "Less: Mileage Allowance", value: `(${fmtEuro(input.mileageAllowance)})` });
  scheduleERows.push({ label: "Net Schedule E", value: fmtEuro(result.scheduleE) });

  if (scheduleERows.length > 1) {
    sections.push({ title: "Schedule E — Employment Income", rows: scheduleERows });
  }

  // ── Schedule D — Business Income ──────────────────────
  if (input.businessIncome > 0 || result.scheduleD > 0) {
    sections.push({
      title: "Schedule D — Business Income",
      rows: [
        { label: "Business Income", value: fmtEuro(input.businessIncome) },
        { label: "Less: Business Expenses", value: `(${fmtEuro(input.businessExpenses)})` },
        { label: "Less: Capital Allowances", value: `(${fmtEuro(input.capitalAllowances)})` },
        { label: "Net Schedule D", value: fmtEuro(result.scheduleD) },
      ],
    });
  }

  // ── Business Income Breakdown (by category) ───────────
  if (options?.incomeByCategory && options.incomeByCategory.length > 0) {
    const totalInc = options.incomeByCategory.reduce((s, e) => s + e.amount, 0);
    tables.push({
      title: "Business Income Breakdown",
      headers: ["Category", "Amount"],
      rows: [...options.incomeByCategory.map((e) => [e.category, fmtEuro(e.amount)]), ["Total", fmtEuro(totalInc)]],
    });
  }

  // ── Business Expense Breakdown (by category) ──────────
  if (options?.expenseByCategory && options.expenseByCategory.length > 0) {
    const totalExp = options.expenseByCategory.reduce((s, e) => s + e.amount, 0);
    tables.push({
      title: "Business Expense Breakdown",
      headers: ["Category", "Amount"],
      rows: [...options.expenseByCategory.map((e) => [e.category, fmtEuro(e.amount)]), ["Total", fmtEuro(totalExp)]],
    });
  }

  // ── Rental / Investment Income ────────────────────────
  if (result.rentalProfit > 0 || result.foreignIncome > 0 || result.otherIncome > 0) {
    const rows: { label: string; value: string }[] = [];
    if (result.rentalProfit > 0) rows.push({ label: "Rental Profit", value: fmtEuro(result.rentalProfit) });
    if (result.foreignIncome > 0) rows.push({ label: "Foreign Income", value: fmtEuro(result.foreignIncome) });
    if (result.otherIncome > 0) rows.push({ label: "Other Income", value: fmtEuro(result.otherIncome) });
    sections.push({ title: "Rental / Investment Income", rows });
  }

  // ── Spouse Income (Joint) ─────────────────────────────
  if (result.spouseIncome > 0) {
    sections.push({
      title: "Spouse Income (Joint Assessment)",
      rows: [{ label: "Spouse Income", value: fmtEuro(result.spouseIncome) }],
    });
  }

  // ── Total Income ──────────────────────────────────────
  sections.push({
    title: "Total Income",
    rows: [
      { label: "Total Gross Income", value: fmtEuro(result.totalGrossIncome) },
      ...(result.pensionRelief > 0
        ? [
            {
              label: `Less: Pension Relief (${fmtPercent(result.pensionAgeLimit)} limit)`,
              value: `(${fmtEuro(result.pensionRelief)})`,
            },
          ]
        : []),
      { label: "Assessable Income", value: fmtEuro(result.assessableIncome) },
    ],
  });

  // ── Income Tax Bands ──────────────────────────────────
  tables.push({
    title: "Income Tax Calculation",
    headers: ["Band", "Amount", "Rate", "Tax"],
    rows: [
      ...result.incomeTaxBands.map((b) => [b.label, fmtEuro(b.amount), fmtPercent(b.rate), fmtEuro(b.tax)]),
      ["Gross Income Tax", "", "", fmtEuro(result.grossIncomeTax)],
    ],
  });

  // ── Tax Credits ───────────────────────────────────────
  tables.push({
    title: "Tax Credits",
    headers: ["Credit", "Amount"],
    rows: [...result.credits.map((c) => [c.label, fmtEuro(c.amount)]), ["Total Credits", fmtEuro(result.totalCredits)]],
  });

  sections.push({
    title: "Net Income Tax",
    rows: [
      { label: "Gross Income Tax", value: fmtEuro(result.grossIncomeTax) },
      { label: "Less: Tax Credits", value: `(${fmtEuro(result.totalCredits)})` },
      { label: "Net Income Tax", value: fmtEuro(result.netIncomeTax) },
    ],
  });

  // ── USC ───────────────────────────────────────────────
  if (result.uscExempt) {
    sections.push({
      title: "Universal Social Charge",
      rows: [{ label: "Status", value: "Exempt — income below €13,000" }],
    });
  } else {
    tables.push({
      title: "Universal Social Charge",
      headers: ["Band", "Amount", "Rate", "USC"],
      rows: [
        ...result.uscBands.map((b) => [b.label, fmtEuro(b.amount), fmtPercent(b.rate), fmtEuro(b.tax)]),
        ["Total USC", "", "", fmtEuro(result.totalUSC)],
      ],
    });
  }

  // ── PRSI ──────────────────────────────────────────────
  sections.push({
    title: "PRSI (Class S)",
    rows: [
      { label: "Assessable Income", value: fmtEuro(result.prsiAssessable) },
      { label: "PRSI @ 4.1%", value: fmtEuro(result.prsiCalculated) },
      { label: "PRSI Payable", value: fmtEuro(result.prsiPayable) },
    ],
  });

  // ── CGT ───────────────────────────────────────────────
  if (result.cgtApplicable) {
    sections.push({
      title: "Capital Gains Tax",
      rows: [
        { label: "Total Gains", value: fmtEuro(result.cgtGains) },
        { label: "Less: Losses", value: `(${fmtEuro(result.cgtLosses)})` },
        { label: "Less: Annual Exemption", value: `(${fmtEuro(result.cgtExemption)})` },
        { label: "CGT Payable (33%)", value: fmtEuro(result.cgtPayable) },
      ],
    });
  }

  // ── Tax Computation Summary ───────────────────────────
  const summaryRows: { label: string; value: string }[] = [
    { label: "Net Income Tax", value: fmtEuro(result.netIncomeTax) },
    { label: "USC", value: fmtEuro(result.totalUSC) },
    { label: "PRSI", value: fmtEuro(result.prsiPayable) },
  ];
  if (result.cgtApplicable) {
    summaryRows.push({ label: "CGT", value: fmtEuro(result.cgtPayable) });
  }
  summaryRows.push({ label: "Total Liability", value: fmtEuro(result.totalLiability) });
  if (result.preliminaryTaxPaid > 0) {
    summaryRows.push({ label: "Less: Preliminary Tax Paid", value: `(${fmtEuro(result.preliminaryTaxPaid)})` });
  }
  summaryRows.push({
    label: result.balanceDue < 0 ? "Refund Due" : "Balance Due",
    value: fmtEuro(Math.abs(result.balanceDue)),
  });

  sections.push({ title: "Tax Computation Summary", rows: summaryRows });

  // ── Split-Year Note ───────────────────────────────────
  if (result.splitYearApplied) {
    sections.push({
      title: "Split-Year Assessment",
      rows: [{ label: "Note", value: result.splitYearNote }],
    });
  }

  // ── Warnings ──────────────────────────────────────────
  if (result.warnings.length > 0) {
    sections.push({
      title: "Warnings",
      rows: result.warnings.map((w, i) => ({ label: `Warning ${i + 1}`, value: w })),
    });
  }

  return { meta, input, result, sections, tables };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}
