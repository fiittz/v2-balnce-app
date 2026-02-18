import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { QuestionnaireData } from "@/components/export/BusinessBankExportQuestionnaire";
import { DirectorQuestionnaireData } from "@/components/export/DirectorExportQuestionnaire";

interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  type: string;
  vat_rate?: string | null;
  vat_amount?: number | null;
  net_amount?: number | null;
  bank_reference?: string | null;
  receipt_url?: string | null;
  category?: { name: string } | null;
  account?: { name: string } | null;
}

export interface PnlCt1Summary {
  incomeByCategory: Record<string, number>;
  totalIncome: number;
  directCostsByCategory: Record<string, number>;
  totalDirectCosts: number;
  expensesByCategory: Record<string, number>;
  totalExpenses: number;
  revenueRefunds: number;
  netExpenses: number;
  grossProfit: number;
  netProfit: number;
  // CT1 fields (company accounts only)
  disallowedByCategory?: { category: string; amount: number }[];
  capitalAllowances?: number;
  travelDeduction?: number;
  tradingProfit?: number;
  lossesForward?: number;
  taxableProfit?: number;
  ctAt125?: number;
  surcharge?: number;
  totalCT?: number;
  rctCredit?: number;
  prelimPaid?: number;
  balanceDue?: number;
  // Directors Current Account
  directorsDrawings?: number;
  netDirectorsLoan?: number; // positive = company owes director, negative = director owes company
  totalSubsistenceAllowance?: number;
  totalMileageAllowance?: number;
}

const fmtEur = (v: number) => `€${v.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPnlCt1Section = (s: PnlCt1Summary): string => {
  const lines: string[] = [];
  lines.push("=".repeat(60));
  lines.push("PROFIT & LOSS / CT1 COMPUTATION");
  lines.push("=".repeat(60));
  lines.push("");

  lines.push("INCOME");
  lines.push("-".repeat(40));
  for (const [cat, amt] of Object.entries(s.incomeByCategory).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${cat}: ${fmtEur(amt)}`);
  }
  lines.push(`  Total Income: ${fmtEur(s.totalIncome)}`);
  lines.push("");

  if (s.totalDirectCosts > 0) {
    lines.push("DIRECT COSTS");
    lines.push("-".repeat(40));
    for (const [cat, amt] of Object.entries(s.directCostsByCategory).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${cat}: ${fmtEur(amt)}`);
    }
    lines.push(`  Total Direct Costs: ${fmtEur(s.totalDirectCosts)}`);
    lines.push("");
  }

  lines.push(`GROSS PROFIT: ${fmtEur(s.grossProfit)}`);
  lines.push("");

  lines.push("EXPENSES");
  lines.push("-".repeat(40));
  for (const [cat, amt] of Object.entries(s.expensesByCategory).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${cat}: ${fmtEur(amt)}`);
  }
  if (s.revenueRefunds > 0) {
    lines.push(`  Less: Revenue Refund: (${fmtEur(s.revenueRefunds)})`);
  }
  lines.push(`  Net Expenses: ${fmtEur(s.netExpenses)}`);
  lines.push("");
  lines.push(`NET PROFIT: ${fmtEur(s.netProfit)}`);
  lines.push("");

  // CT1 computation
  if (s.taxableProfit !== undefined) {
    lines.push("=".repeat(60));
    lines.push("CORPORATION TAX (CT1) COMPUTATION");
    lines.push("=".repeat(60));
    lines.push("");
    lines.push(`Net Profit (per accounts): ${fmtEur(s.netProfit)}`);
    if (s.disallowedByCategory && s.disallowedByCategory.length > 0) {
      lines.push("Add back: Non-deductible expenses");
      for (const { category, amount } of s.disallowedByCategory) {
        lines.push(`  ${category}: ${fmtEur(amount)}`);
      }
    }
    if (s.capitalAllowances && s.capitalAllowances > 0) {
      lines.push(`Less: Capital Allowances: (${fmtEur(s.capitalAllowances)})`);
    }
    if (s.travelDeduction && s.travelDeduction > 0) {
      lines.push(`Less: Travel Deduction: (${fmtEur(s.travelDeduction)})`);
    }
    lines.push(`Trading Profit: ${fmtEur(s.tradingProfit ?? 0)}`);
    if (s.lossesForward && s.lossesForward > 0) {
      lines.push(`Less: Losses B/F: ${fmtEur(s.lossesForward)}`);
    }
    lines.push(`Taxable Profit: ${fmtEur(s.taxableProfit)}`);
    lines.push("");
    lines.push(`CT @ 12.5%: ${fmtEur(s.ctAt125 ?? 0)}`);
    if (s.surcharge && s.surcharge > 0) {
      lines.push(`Close Company Surcharge: ${fmtEur(s.surcharge)}`);
    }
    lines.push(`Total CT Liability: ${fmtEur(s.totalCT ?? 0)}`);
    if (s.rctCredit && s.rctCredit > 0) {
      lines.push(`Less: RCT Credit: ${fmtEur(s.rctCredit)}`);
    }
    if (s.prelimPaid && s.prelimPaid > 0) {
      lines.push(`Less: Preliminary CT Paid: ${fmtEur(s.prelimPaid)}`);
    }
    lines.push("");
    const due = s.balanceDue ?? 0;
    lines.push(`${due <= 0 ? "CT REFUND DUE" : "CT BALANCE DUE"}: ${fmtEur(Math.abs(due))}`);
    lines.push("");
  }

  // Directors Current Account
  const drawings = s.directorsDrawings ?? 0;
  const subsAllowance = s.totalSubsistenceAllowance ?? 0;
  const mileAllowance = s.totalMileageAllowance ?? 0;
  const netLoan = s.netDirectorsLoan ?? 0;
  if (drawings > 0 || subsAllowance > 0 || mileAllowance > 0) {
    lines.push("=".repeat(60));
    lines.push("DIRECTORS CURRENT ACCOUNT");
    lines.push("=".repeat(60));
    lines.push("");
    if (drawings > 0) lines.push(`Drawings taken by director: ${fmtEur(drawings)}`);
    if (subsAllowance > 0) lines.push(`Less: Subsistence owed to director: (${fmtEur(subsAllowance)})`);
    if (mileAllowance > 0) lines.push(`Less: Mileage owed to director: (${fmtEur(mileAllowance)})`);
    lines.push(
      netLoan >= 0
        ? `Directors Current A/C (Cr): ${fmtEur(netLoan)}`
        : `Directors Current A/C (Dr): (${fmtEur(Math.abs(netLoan))})`,
    );
    lines.push("");
  }

  lines.push("");
  return lines.join("\n");
};

const formatPnlCt1Html = (s: PnlCt1Summary): string => {
  const row = (label: string, amount: string, bold = false) =>
    `<tr${bold ? ' style="font-weight:bold;border-top:2px solid #333"' : ""}><td>${label}</td><td class="amount">${amount}</td></tr>`;

  let html =
    '<h2>Profit & Loss</h2><table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">';
  html += '<tr style="background:#f5f5f5;font-weight:bold"><td colspan="2">Income</td></tr>';
  for (const [cat, amt] of Object.entries(s.incomeByCategory).sort((a, b) => b[1] - a[1])) {
    html += row(`&nbsp;&nbsp;${cat}`, fmtEur(amt));
  }
  html += row("Total Income", fmtEur(s.totalIncome), true);

  if (s.totalDirectCosts > 0) {
    html += '<tr style="background:#f5f5f5;font-weight:bold"><td colspan="2">Direct Costs</td></tr>';
    for (const [cat, amt] of Object.entries(s.directCostsByCategory).sort((a, b) => b[1] - a[1])) {
      html += row(`&nbsp;&nbsp;${cat}`, fmtEur(amt));
    }
    html += row("Total Direct Costs", fmtEur(s.totalDirectCosts), true);
  }

  html += row("Gross Profit", fmtEur(s.grossProfit), true);
  html += '<tr style="background:#f5f5f5;font-weight:bold"><td colspan="2">Expenses</td></tr>';
  for (const [cat, amt] of Object.entries(s.expensesByCategory).sort((a, b) => b[1] - a[1])) {
    html += row(`&nbsp;&nbsp;${cat}`, fmtEur(amt));
  }
  if (s.revenueRefunds > 0) {
    html += row("&nbsp;&nbsp;Less: Revenue Refund", `(${fmtEur(s.revenueRefunds)})`);
  }
  html += row("Net Expenses", fmtEur(s.netExpenses), true);
  html += row("Net Profit", fmtEur(s.netProfit), true);
  html += "</table>";

  if (s.taxableProfit !== undefined) {
    html +=
      '<h2>Corporation Tax (CT1)</h2><table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">';
    html += row("Net Profit (per accounts)", fmtEur(s.netProfit));
    if (s.disallowedByCategory && s.disallowedByCategory.length > 0) {
      html +=
        '<tr style="font-size:11px;color:#b45309"><td colspan="2"><em>Add back: Non-deductible expenses</em></td></tr>';
      for (const { category, amount } of s.disallowedByCategory) {
        html += `<tr style="font-size:11px;color:#b45309"><td>&nbsp;&nbsp;&nbsp;&nbsp;${category}</td><td class="amount">${fmtEur(amount)}</td></tr>`;
      }
    }
    if (s.capitalAllowances && s.capitalAllowances > 0)
      html += row("Less: Capital Allowances", `(${fmtEur(s.capitalAllowances)})`);
    if (s.travelDeduction && s.travelDeduction > 0)
      html += row("Less: Travel Deduction", `(${fmtEur(s.travelDeduction)})`);
    html += row("Trading Profit", fmtEur(s.tradingProfit ?? 0), true);
    if (s.lossesForward && s.lossesForward > 0) html += row("Less: Losses B/F", fmtEur(s.lossesForward));
    html += row("Taxable Profit", fmtEur(s.taxableProfit), true);
    html += row("CT @ 12.5%", fmtEur(s.ctAt125 ?? 0));
    if (s.surcharge && s.surcharge > 0) html += row("Close Company Surcharge", fmtEur(s.surcharge));
    html += row("Total CT Liability", fmtEur(s.totalCT ?? 0), true);
    if (s.rctCredit && s.rctCredit > 0) html += row("Less: RCT Credit", fmtEur(s.rctCredit));
    if (s.prelimPaid && s.prelimPaid > 0) html += row("Less: Preliminary CT Paid", fmtEur(s.prelimPaid));
    const due = s.balanceDue ?? 0;
    html += `<tr style="font-weight:bold;font-size:14px;border-top:3px solid #333;color:${due <= 0 ? "#16a34a" : "#dc2626"}"><td>${due <= 0 ? "CT Refund Due" : "CT Balance Due"}</td><td class="amount">${fmtEur(Math.abs(due))}</td></tr>`;
    html += "</table>";
  }

  // Directors Current Account
  {
    const dr = s.directorsDrawings ?? 0;
    const sub = s.totalSubsistenceAllowance ?? 0;
    const mile = s.totalMileageAllowance ?? 0;
    const net = s.netDirectorsLoan ?? 0;
    if (dr > 0 || sub > 0 || mile > 0) {
      html +=
        '<h2>Directors Current Account</h2><table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">';
      if (dr > 0) html += row("Drawings taken by director", fmtEur(dr));
      if (sub > 0) html += row("Less: Subsistence owed to director", `(${fmtEur(sub)})`);
      if (mile > 0) html += row("Less: Mileage owed to director", `(${fmtEur(mile)})`);
      html += row(
        net >= 0 ? "Directors Current A/C (Cr)" : "Directors Current A/C (Dr)",
        net >= 0 ? fmtEur(net) : `(${fmtEur(Math.abs(net))})`,
        true,
      );
      html += "</table>";
    }
  }

  return html + '<hr style="margin:20px 0;border:none;border-top:2px solid #ddd" />';
};

const formatBusinessQuestionnaireSection = (data: QuestionnaireData): string => {
  const lines: string[] = [];

  lines.push("=".repeat(60));
  lines.push("BUSINESS BANK ACCOUNT FINALISATION QUESTIONNAIRE");
  lines.push("=".repeat(60));
  lines.push("");

  // Section 1
  lines.push("1. AUTOMATION ASSUMPTION CHECK");
  lines.push("-".repeat(40));
  if (data.automationNoChanges) {
    lines.push("☑ No changes since onboarding");
  } else {
    lines.push("Changes reported:");
    if (data.automationChanges.vatRegistration) lines.push("  ☑ VAT registration status");
    if (data.automationChanges.incomeType) lines.push("  ☑ Type of income received");
    if (data.automationChanges.paymentMethods) lines.push("  ☑ How customers pay");
    if (data.automationChanges.businessActivities) lines.push("  ☑ Business activities");
    if (data.automationChanges.personalSpending) lines.push("  ☑ Personal spending from account");
    if (data.automationChangeDate) {
      lines.push(`  Change effective from: ${format(data.automationChangeDate, "dd/MM/yyyy")}`);
    }
  }
  lines.push("");

  // Section 2
  lines.push("2. INCOME CAPTURE VALIDATION");
  lines.push("-".repeat(40));
  lines.push(data.incomeComplete ? "☑ Income is complete and accurate" : "☐ Income requires review");
  if (data.incomeNotes) lines.push(`Notes: ${data.incomeNotes}`);
  lines.push("");

  // Section 3
  lines.push("3. EXPENSE CLASSIFICATION CONFIRMATION");
  lines.push("-".repeat(40));
  lines.push(data.expensesCorrect ? "☑ Expenses correctly classified" : "☐ Expenses require review");
  if (data.expenseNotes) lines.push(`Notes: ${data.expenseNotes}`);
  lines.push("");

  // Section 4
  lines.push("4. VAT TREATMENT CONFIRMATION");
  lines.push("-".repeat(40));
  const vatLabels = {
    not_registered: "Not VAT registered",
    cash_basis: "VAT registered — Cash basis",
    invoice_basis: "VAT registered — Invoice basis",
  };
  lines.push(`VAT Status: ${vatLabels[data.vatStatus]}`);
  lines.push(data.vatStatusCorrect ? "☑ Correct for entire period" : "☐ VAT status changed");
  if (data.vatStatusChangeDate) {
    lines.push(`VAT status change effective from: ${format(data.vatStatusChangeDate, "dd/MM/yyyy")}`);
  }
  lines.push("");

  // Section 5
  lines.push("5. CAPITAL & ONE-OFF TRANSACTIONS");
  lines.push("-".repeat(40));
  lines.push(data.capitalTransactionsCorrect ? "☑ Findings correct" : "☐ Findings require review");
  if (data.capitalNotes) lines.push(`Notes: ${data.capitalNotes}`);
  lines.push("");

  // Section 6
  lines.push("6. PAYMENTS VALIDATION");
  lines.push("-".repeat(40));
  lines.push(data.paymentsCorrect ? "☑ Payments correct" : "☐ Payments require correction");
  if (data.paymentNotes) lines.push(`Notes: ${data.paymentNotes}`);
  lines.push("");

  // Section 7
  lines.push("7. BALANCE SHEET CONFIRMATION");
  lines.push("-".repeat(40));
  lines.push(data.bankBalanceConfirmed ? "☑ Bank balance confirmed" : "☐ Bank balance discrepancy");
  lines.push(data.vatPositionConfirmed ? "☑ VAT position confirmed" : "☐ VAT position needs review");
  lines.push(data.fixedAssetsConfirmed ? "☑ Fixed assets complete" : "☐ Fixed assets incomplete");
  lines.push(data.loansConfirmed ? "☑ Loans confirmed" : "☐ Loans need review");
  if (data.directorsLoanDirection) {
    lines.push(`Director's Loan: Money owed ${data.directorsLoanDirection === "owed_to" ? "TO" : "BY"} the director`);
    lines.push(data.directorsLoanConfirmed ? "☑ Director's loan confirmed" : "☐ Director's loan needs review");
  }
  lines.push("");

  // Section 8
  lines.push("8. FINAL DECLARATION");
  lines.push("-".repeat(40));
  lines.push(
    data.finalDeclaration
      ? "☑ CONFIRMED: Balnce has correctly automated the bookkeeping, VAT, and balance sheet for this business account."
      : "☐ NOT CONFIRMED",
  );
  lines.push("");
  lines.push(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}`);
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("");

  return lines.join("\n");
};

const formatDirectorQuestionnaireSection = (data: DirectorQuestionnaireData): string => {
  const lines: string[] = [];

  lines.push("=".repeat(60));
  lines.push("DIRECTOR - PERSONAL ACCOUNT FINALISATION (FORM 11)");
  lines.push("=".repeat(60));
  lines.push("");

  // Section 1
  lines.push("1. CHANGE DETECTION SINCE ONBOARDING");
  lines.push("-".repeat(40));
  if (data.noChanges) {
    lines.push("☑ No changes affecting personal tax position");
  } else {
    lines.push("Changes reported:");
    if (data.changes.employmentStatus) lines.push("  ☑ Employment status");
    if (data.changes.incomeSources) lines.push("  ☑ Income sources");
    if (data.changes.assessmentStatus) lines.push("  ☑ Joint / separate assessment status");
    if (data.changes.pensionContributions) lines.push("  ☑ Pension contributions or reliefs");
    if (data.changes.foreignIncome) lines.push("  ☑ Foreign income");
    if (data.changeEffectiveDate) {
      lines.push(`  Effective from: ${format(data.changeEffectiveDate, "dd/MM/yyyy")}`);
    }
  }
  lines.push("");

  // Section 2
  lines.push("2. INCOME SOURCE RECONCILIATION");
  lines.push("-".repeat(40));
  lines.push(data.incomeComplete ? "☑ Income sources complete" : "☐ Missing income source");
  if (data.incomeNotes) lines.push(`Notes: ${data.incomeNotes}`);
  lines.push("");

  // Section 3
  lines.push("3. BUSINESS LINK VALIDATION");
  lines.push("-".repeat(40));
  const businessLabels = { yes: "☑ Yes", no: "☐ No", unsure: "? Unsure" };
  lines.push(
    `All business income included: ${data.businessLinksStatus ? businessLabels[data.businessLinksStatus] : "Not answered"}`,
  );
  if (data.businessLinkNotes) lines.push(`Notes: ${data.businessLinkNotes}`);
  lines.push("");

  // Section 4
  lines.push("4. RELIEFS & CREDITS CONFIRMATION");
  lines.push("-".repeat(40));
  lines.push(data.reliefsCorrect ? "☑ Reliefs correct" : "☐ Something changed");
  if (data.reliefsNotes) lines.push(`Notes: ${data.reliefsNotes}`);
  lines.push("");

  // Section 5
  lines.push("5. PRELIMINARY TAX (PERSONAL)");
  lines.push("-".repeat(40));
  const prelimLabels = { yes: "☑ Yes", no: "☐ No", unsure: "? Unsure" };
  lines.push(
    `Preliminary tax paid: ${data.preliminaryTaxPaid ? prelimLabels[data.preliminaryTaxPaid] : "Not answered"}`,
  );
  if (data.preliminaryTaxPaid === "yes") {
    if (data.preliminaryTaxAmount) lines.push(`Amount: ${data.preliminaryTaxAmount}`);
    if (data.preliminaryTaxDate) lines.push(`Date paid: ${format(data.preliminaryTaxDate, "dd/MM/yyyy")}`);
  }
  lines.push("");

  // Section 6
  lines.push("6. REVENUE EDGE CASES");
  lines.push("-".repeat(40));
  if (data.edgeCases.none) {
    lines.push("☑ None of the above");
  } else {
    if (data.edgeCases.capitalGains) lines.push("☑ Capital gains (CGT) events");
    if (data.edgeCases.foreignIncome) lines.push("☑ Foreign income");
    if (data.edgeCases.chargeableBenefits) lines.push("☑ Chargeable benefits");
  }
  lines.push("");

  // Section 7
  lines.push("7. FINAL DECLARATION - FORM 11");
  lines.push("-".repeat(40));
  lines.push(
    data.finalDeclaration
      ? "☑ CONFIRMED: Balnce's automated treatment of personal income, expenses, and tax position is accurate for Form 11 purposes."
      : "☐ NOT CONFIRMED",
  );
  lines.push("");
  lines.push(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}`);
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("");

  return lines.join("\n");
};

export const exportToExcel = (
  transactions: Transaction[],
  filename?: string,
  questionnaire?: QuestionnaireData,
  pnlCt1?: PnlCt1Summary,
) => {
  const headers = [
    "Date",
    "Description",
    "Amount (€)",
    "Type",
    "Category",
    "Account",
    "VAT Rate",
    "VAT Amount (€)",
    "Net Amount (€)",
    "Reference",
    "Receipt",
  ];

  const rows = transactions.map((tx) => [
    format(new Date(tx.transaction_date), "dd/MM/yyyy"),
    tx.description,
    tx.amount.toFixed(2),
    tx.type,
    tx.category?.name || "",
    tx.account?.name || "",
    tx.vat_rate || "",
    tx.vat_amount?.toFixed(2) || "",
    tx.net_amount?.toFixed(2) || "",
    tx.bank_reference || "",
    tx.receipt_url ? "Yes" : "No",
  ]);

  // Create CSV content (Excel compatible)
  let csvContent = "";

  // Add P&L + CT1 summary if provided
  if (pnlCt1) {
    csvContent += formatPnlCt1Section(pnlCt1);
  }

  // Add questionnaire if provided
  if (questionnaire) {
    csvContent += formatBusinessQuestionnaireSection(questionnaire);
  }

  // Receipt Matching Summary
  {
    const totalTx = transactions.length;
    const matched = transactions.filter((tx) => tx.receipt_url).length;
    const unmatched = totalTx - matched;
    const matchedPct = totalTx > 0 ? Math.round((matched / totalTx) * 100) : 0;
    const unmatchedPct = totalTx > 0 ? 100 - matchedPct : 0;
    csvContent += "Receipt Matching Summary\n";
    csvContent += `"Total transactions","${totalTx}"\n`;
    csvContent += `"Receipts matched","${matched} (${matchedPct}%)"\n`;
    csvContent += `"Unmatched","${unmatched} (${unmatchedPct}%)"\n`;
    csvContent += "\n";
  }

  csvContent += [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  // Add BOM for Excel UTF-8 compatibility
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8" });

  const defaultFilename = `transactions_${format(new Date(), "yyyy-MM-dd")}.csv`;
  downloadBlob(blob, filename || defaultFilename);
};

export interface CompanyInfo {
  companyName?: string;
  registeredAddress?: string;
  croNumber?: string;
  incorporationDate?: string;
  taxReference?: string;
  directorNames?: string[];
}

export interface ExportInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total: number;
  vat_amount: number | null;
  subtotal: number | null;
  notes?: string | null;
  customer?: { name: string } | null;
}

export interface ExportOptions {
  isRCT?: boolean; // RCT-registered: income defaults to 0% VAT (reverse charge)
  invoices?: ExportInvoice[]; // Invoices for Sales side of Sales Tax Audit
}

export const exportToPDF = (
  transactions: Transaction[],
  filename?: string,
  questionnaire?: QuestionnaireData,
  pnlCt1?: PnlCt1Summary,
  companyInfo?: CompanyInfo,
  options?: ExportOptions,
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 15;

  const addText = (
    text: string,
    size: number,
    opts?: { bold?: boolean; color?: [number, number, number]; maxW?: number },
  ) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    if (opts?.color) doc.setTextColor(...opts.color);
    else doc.setTextColor(0, 0, 0);
    doc.text(text, 14, y, { maxWidth: opts?.maxW ?? pageW - 28 });
    y += size * 0.5;
  };

  const checkPage = (need: number) => {
    if (y + need > 280) {
      doc.addPage();
      y = 15;
    }
  };

  // Company header
  if (companyInfo?.companyName) {
    addText(companyInfo.companyName, 16, { bold: true });
  }
  if (companyInfo?.registeredAddress) {
    addText(companyInfo.registeredAddress, 9, { color: [80, 80, 80] });
  }
  const infoLines: string[] = [];
  if (companyInfo?.croNumber) infoLines.push(`CRO: ${companyInfo.croNumber}`);
  if (companyInfo?.taxReference) infoLines.push(`Tax Ref: ${companyInfo.taxReference}`);
  if (companyInfo?.incorporationDate)
    infoLines.push(`Incorporated: ${format(new Date(companyInfo.incorporationDate), "dd MMMM yyyy")}`);
  if (infoLines.length > 0) {
    addText(infoLines.join("  |  "), 8, { color: [100, 100, 100] });
  }
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageW - 14, y);
  y += 4;

  // Title
  addText("Transaction Report", 18, { bold: true });
  addText(`Generated on ${format(new Date(), "dd MMMM yyyy 'at' HH:mm")}`, 9, { color: [120, 120, 120] });
  y += 4;

  // P&L / CT1 section
  if (pnlCt1) {
    addText("Profit & Loss", 14, { bold: true });
    y += 2;
    const pnlRows: [string, string][] = [];
    for (const [cat, amt] of Object.entries(pnlCt1.incomeByCategory).sort((a, b) => b[1] - a[1])) {
      pnlRows.push([`  ${cat}`, fmtEur(amt)]);
    }
    pnlRows.push(["Total Income", fmtEur(pnlCt1.totalIncome)]);
    if (pnlCt1.totalDirectCosts > 0) {
      for (const [cat, amt] of Object.entries(pnlCt1.directCostsByCategory).sort((a, b) => b[1] - a[1])) {
        pnlRows.push([`  ${cat}`, fmtEur(amt)]);
      }
      pnlRows.push(["Total Direct Costs", fmtEur(pnlCt1.totalDirectCosts)]);
    }
    pnlRows.push(["Gross Profit", fmtEur(pnlCt1.grossProfit)]);
    for (const [cat, amt] of Object.entries(pnlCt1.expensesByCategory).sort((a, b) => b[1] - a[1])) {
      pnlRows.push([`  ${cat}`, fmtEur(amt)]);
    }
    if (pnlCt1.revenueRefunds > 0) pnlRows.push(["  Less: Revenue Refund", `(${fmtEur(pnlCt1.revenueRefunds)})`]);
    pnlRows.push(["Net Expenses", fmtEur(pnlCt1.netExpenses)]);
    pnlRows.push(["Net Profit", fmtEur(pnlCt1.netProfit)]);

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      theme: "plain",
      head: [["", "Amount"]],
      body: pnlRows,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [240, 240, 240], fontStyle: "bold" },
      didParseCell: (data) => {
        const label = String(data.cell.raw);
        if (["Total Income", "Total Direct Costs", "Gross Profit", "Net Expenses", "Net Profit"].includes(label)) {
          data.cell.styles.fontStyle = "bold";
        }
        if (data.column.index === 1) data.cell.styles.halign = "right";
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

    if (pnlCt1.taxableProfit !== undefined) {
      checkPage(40);
      addText("Corporation Tax (CT1)", 14, { bold: true });
      y += 2;
      const ctRows: [string, string][] = [["Net Profit (per accounts)", fmtEur(pnlCt1.netProfit)]];
      if (pnlCt1.disallowedByCategory && pnlCt1.disallowedByCategory.length > 0) {
        ctRows.push(["Add back: Non-deductible expenses", ""]);
        for (const { category, amount } of pnlCt1.disallowedByCategory) {
          ctRows.push([`    ${category}`, fmtEur(amount)]);
        }
      }
      if (pnlCt1.capitalAllowances && pnlCt1.capitalAllowances > 0)
        ctRows.push(["Less: Capital Allowances", `(${fmtEur(pnlCt1.capitalAllowances)})`]);
      if (pnlCt1.travelDeduction && pnlCt1.travelDeduction > 0)
        ctRows.push(["Less: Travel Deduction", `(${fmtEur(pnlCt1.travelDeduction)})`]);
      ctRows.push(["Trading Profit", fmtEur(pnlCt1.tradingProfit ?? 0)]);
      if (pnlCt1.lossesForward && pnlCt1.lossesForward > 0)
        ctRows.push(["Less: Losses B/F", fmtEur(pnlCt1.lossesForward)]);
      ctRows.push(["Taxable Profit", fmtEur(pnlCt1.taxableProfit)]);
      ctRows.push(["CT @ 12.5%", fmtEur(pnlCt1.ctAt125 ?? 0)]);
      if (pnlCt1.surcharge && pnlCt1.surcharge > 0) ctRows.push(["Close Company Surcharge", fmtEur(pnlCt1.surcharge)]);
      ctRows.push(["Total CT Liability", fmtEur(pnlCt1.totalCT ?? 0)]);
      if (pnlCt1.rctCredit && pnlCt1.rctCredit > 0) ctRows.push(["Less: RCT Credit", fmtEur(pnlCt1.rctCredit)]);
      if (pnlCt1.prelimPaid && pnlCt1.prelimPaid > 0)
        ctRows.push(["Less: Preliminary CT Paid", fmtEur(pnlCt1.prelimPaid)]);
      const due = pnlCt1.balanceDue ?? 0;
      ctRows.push([due <= 0 ? "CT Refund Due" : "CT Balance Due", fmtEur(Math.abs(due))]);

      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        theme: "plain",
        head: [["", "Amount"]],
        body: ctRows,
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [240, 240, 240], fontStyle: "bold" },
        didParseCell: (data) => {
          const label = String(data.cell.raw);
          if (
            ["Trading Profit", "Taxable Profit", "Total CT Liability", "CT Balance Due", "CT Refund Due"].includes(
              label,
            )
          ) {
            data.cell.styles.fontStyle = "bold";
          }
          if (label === "Add back: Non-deductible expenses") {
            data.cell.styles.fontStyle = "italic";
            data.cell.styles.textColor = [180, 83, 9]; // amber
          }
          if (label.startsWith("    ")) {
            data.cell.styles.textColor = [180, 83, 9]; // amber
            data.cell.styles.fontSize = 7;
          }
          if (data.column.index === 1) data.cell.styles.halign = "right";
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
  }

  // Directors Current Account
  if (pnlCt1 && (pnlCt1.directorsDrawings || pnlCt1.netDirectorsLoan != null)) {
    const drawings = pnlCt1.directorsDrawings ?? 0;
    const subsAllowance = pnlCt1.totalSubsistenceAllowance ?? 0;
    const mileAllowance = pnlCt1.totalMileageAllowance ?? 0;
    const netLoan = pnlCt1.netDirectorsLoan ?? 0;
    if (drawings > 0 || subsAllowance > 0 || mileAllowance > 0) {
      checkPage(30);
      addText("Directors Current Account", 14, { bold: true });
      y += 2;
      const dcaRows: [string, string][] = [];
      if (drawings > 0) dcaRows.push(["Drawings taken by director", fmtEur(drawings)]);
      if (subsAllowance > 0) dcaRows.push(["Less: Subsistence owed to director", `(${fmtEur(subsAllowance)})`]);
      if (mileAllowance > 0) dcaRows.push(["Less: Mileage owed to director", `(${fmtEur(mileAllowance)})`]);
      dcaRows.push([
        netLoan >= 0 ? "Directors Current A/C (Cr)" : "Directors Current A/C (Dr)",
        netLoan >= 0 ? fmtEur(netLoan) : `(${fmtEur(Math.abs(netLoan))})`,
      ]);
      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        theme: "plain",
        head: [["", "Amount"]],
        body: dcaRows,
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [240, 240, 240], fontStyle: "bold" },
        didParseCell: (data) => {
          if (data.column.index === 1) data.cell.styles.halign = "right";
          const label = String(data.cell.raw);
          if (label.startsWith("Directors Current A/C")) data.cell.styles.fontStyle = "bold";
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
  }

  // Questionnaire section
  if (questionnaire) {
    checkPage(30);
    addText("Business Bank Account Finalisation", 14, { bold: true });
    y += 2;
    const qRows: [string, string][] = [];
    qRows.push(["1. Automation Check", questionnaire.automationNoChanges ? "No changes" : "Changes reported"]);
    qRows.push(["2. Income Capture", questionnaire.incomeComplete ? "Complete" : "Requires review"]);
    qRows.push(["3. Expense Classification", questionnaire.expensesCorrect ? "Correct" : "Requires review"]);
    qRows.push([
      "4. VAT Status",
      questionnaire.vatStatus === "not_registered"
        ? "Not registered"
        : questionnaire.vatStatus === "cash_basis"
          ? "Cash basis"
          : "Invoice basis",
    ]);
    qRows.push(["5. Capital Items", questionnaire.capitalTransactionsCorrect ? "Correct" : "Requires review"]);
    qRows.push(["6. Payments", questionnaire.paymentsCorrect ? "Correct" : "Requires correction"]);
    qRows.push(["7. Balance Sheet", questionnaire.bankBalanceConfirmed ? "Confirmed" : "Not confirmed"]);
    qRows.push(["8. Final Declaration", questionnaire.finalDeclaration ? "CONFIRMED" : "NOT CONFIRMED"]);

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      theme: "striped",
      head: [["Section", "Status"]],
      body: qRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Sales Tax Audit Report — transactions grouped by VAT rate
  checkPage(20);
  addText("Sales Tax Audit Report", 14, { bold: true });
  y += 2;

  // Calculate VAT from rate when vat_amount is not stored
  // Formula: VAT = gross × (rate / (100 + rate)) for VAT-inclusive amounts
  const calcVat = (
    gross: number,
    vatPct: number,
    storedVat: number | null | undefined,
  ): { tax: number; net: number } => {
    if (storedVat != null && storedVat !== 0) {
      return { tax: Math.abs(storedVat), net: Math.abs(gross) - Math.abs(storedVat) };
    }
    if (vatPct > 0) {
      const tax = Math.round(Math.abs(gross) * (vatPct / (100 + vatPct)) * 100) / 100;
      return { tax, net: Math.round((Math.abs(gross) - tax) * 100) / 100 };
    }
    return { tax: 0, net: Math.abs(gross) };
  };

  // ── PURCHASES: only expense bank transactions ──
  interface AuditGroup {
    label: string;
    sortKey: number;
    bodyRows: string[][];
    catHeaderIndices: number[];
    totalRowIdx: number;
    totalGross: number;
    totalTax: number;
    totalNet: number;
  }
  const auditGroups: AuditGroup[] = [];
  let purchaseGross = 0,
    purchaseTax = 0,
    purchaseNet = 0;
  let salesGross = 0,
    salesTax = 0,
    salesNet = 0;

  // Group expenses by VAT rate
  // Exclude: Director's Drawings (balance sheet), Revenue refunds (not a supply — no VAT)
  const isDrawings = (catName: string | null) => (catName ? catName.toLowerCase().includes("drawing") : false);
  const isRevenueRefund = (tx: Transaction) => {
    const cat = tx.category?.name ?? "";
    const d = (tx.description || "").toLowerCase();
    return cat === "Tax Refund" || d.includes("revenue") || d.includes("collector general") || d.includes("tax refund");
  };
  const expenseGroupMap = new Map<number, Transaction[]>();
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    if (isDrawings(tx.category?.name ?? null)) continue;
    if (isRevenueRefund(tx)) continue;
    const vatPct = tx.vat_rate ? parseFloat(tx.vat_rate) : 0;
    if (!expenseGroupMap.has(vatPct)) expenseGroupMap.set(vatPct, []);
    expenseGroupMap.get(vatPct)!.push(tx);
  }
  // Sort by rate descending
  const sortedExpRates = Array.from(expenseGroupMap.keys()).sort((a, b) => b - a);
  for (const vatPct of sortedExpRates) {
    const txs = expenseGroupMap.get(vatPct)!;
    const rateLabel = vatPct > 0 ? `${vatPct}%` : "0%";
    const label = vatPct > 0 ? `Purchases ${rateLabel} (${rateLabel})` : `Tax on Purchases (${rateLabel})`;

    // Sub-group by category
    const catMap = new Map<string, Transaction[]>();
    for (const tx of txs) {
      const cat = tx.category?.name || "Uncategorised";
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(tx);
    }
    const sortedCats = Array.from(catMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    const bodyRows: string[][] = [];
    const catHeaderIndices: number[] = [];
    let grpGross = 0,
      grpTax = 0,
      grpNet = 0;

    for (const [catName, catTxs] of sortedCats) {
      catHeaderIndices.push(bodyRows.length);
      bodyRows.push([catName, "", "", "", "", "", "", ""]);
      for (const tx of catTxs.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))) {
        const absGross = Math.abs(tx.amount);
        const { tax, net } = calcVat(absGross, vatPct, tx.vat_amount);
        bodyRows.push([
          format(new Date(tx.transaction_date), "d/MM/yyyy"),
          "",
          tx.bank_reference || "",
          tx.description,
          fmtEur(-absGross),
          fmtEur(-tax),
          fmtEur(-net),
          tx.receipt_url ? "Yes" : "No",
        ]);
        grpGross -= absGross;
        grpTax -= tax;
        grpNet -= net;
      }
    }

    const totalRowIdx = bodyRows.length;
    bodyRows.push(["", `Total ${label}`, "", "", fmtEur(grpGross), fmtEur(grpTax), fmtEur(grpNet), ""]);
    purchaseGross += grpGross;
    purchaseTax += grpTax;
    purchaseNet += grpNet;
    auditGroups.push({
      label,
      sortKey: 100 - vatPct,
      bodyRows,
      catHeaderIndices,
      totalRowIdx,
      totalGross: grpGross,
      totalTax: grpTax,
      totalNet: grpNet,
    });
  }

  // ── SALES: bank income transactions ──
  // For RCT: all income is 0% VAT (reverse charge) — force to 0%
  // For non-RCT: use the stored vat_rate on the transaction
  // Revenue refunds excluded (not a supply)
  const incomeGroupMap = new Map<number, Transaction[]>();
  for (const tx of transactions) {
    if (tx.type !== "income") continue;
    if (isRevenueRefund(tx)) continue;
    let vatPct = tx.vat_rate ? parseFloat(tx.vat_rate) : 0;
    // RCT income is always 0% (reverse charge) — subcontractor doesn't charge VAT
    // Also clear any stale vat_amount so calcVat doesn't use it
    const incomeTx = options?.isRCT ? ({ ...tx, vat_amount: null, vat_rate: "0" } as Transaction) : tx;
    if (options?.isRCT) vatPct = 0;
    if (!incomeGroupMap.has(vatPct)) incomeGroupMap.set(vatPct, []);
    incomeGroupMap.get(vatPct)!.push(incomeTx);
  }
  const sortedIncRates = Array.from(incomeGroupMap.keys()).sort((a, b) => b - a);
  for (const vatPct of sortedIncRates) {
    const txs = incomeGroupMap.get(vatPct)!;
    const rateLabel = vatPct > 0 ? `${vatPct}%` : "0%";
    const label = vatPct > 0 ? `Sales ${rateLabel} (${rateLabel})` : `Tax on Sales (${rateLabel})`;

    // Sub-group by category
    const catMap = new Map<string, Transaction[]>();
    for (const tx of txs) {
      const cat = tx.category?.name || "Uncategorised";
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(tx);
    }
    const sortedCats = Array.from(catMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    const bodyRows: string[][] = [];
    const catHeaderIndices: number[] = [];
    let grpGross = 0,
      grpTax = 0,
      grpNet = 0;

    for (const [catName, catTxs] of sortedCats) {
      catHeaderIndices.push(bodyRows.length);
      bodyRows.push([catName, "", "", "", "", "", "", ""]);
      for (const tx of catTxs.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))) {
        const absGross = Math.abs(tx.amount);
        const { tax, net } = calcVat(absGross, vatPct, tx.vat_amount);
        bodyRows.push([
          format(new Date(tx.transaction_date), "d/MM/yyyy"),
          "",
          tx.bank_reference || "",
          tx.description,
          fmtEur(absGross),
          fmtEur(tax),
          fmtEur(net),
          tx.receipt_url ? "Yes" : "No",
        ]);
        grpGross += absGross;
        grpTax += tax;
        grpNet += net;
      }
    }

    const totalRowIdx = bodyRows.length;
    bodyRows.push(["", `Total ${label}`, "", "", fmtEur(grpGross), fmtEur(grpTax), fmtEur(grpNet), ""]);
    salesGross += grpGross;
    salesTax += grpTax;
    salesNet += grpNet;
    auditGroups.push({
      label,
      sortKey: 1000 + (100 - vatPct),
      bodyRows,
      catHeaderIndices,
      totalRowIdx,
      totalGross: grpGross,
      totalTax: grpTax,
      totalNet: grpNet,
    });
  }

  // Sort: purchases first, then sales
  auditGroups.sort((a, b) => a.sortKey - b.sortKey);

  for (const g of auditGroups) {
    checkPage(20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(g.label, 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      theme: "plain",
      head: [["Date", "Account", "Ref", "Details", "Gross", "Tax", "Net", "Receipt"]],
      body: g.bodyRows,
      styles: { fontSize: 6.5, cellPadding: 1.2, overflow: "linebreak" },
      headStyles: { fillColor: [240, 240, 240], fontStyle: "bold", fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 18 },
        2: { cellWidth: 18 },
        3: { cellWidth: 44 },
        4: { halign: "right", cellWidth: 20 },
        5: { halign: "right", cellWidth: 16 },
        6: { halign: "right", cellWidth: 18 },
        7: { cellWidth: 14, halign: "center" },
      },
      didParseCell: (data) => {
        // Category sub-header rows
        if (g.catHeaderIndices.includes(data.row.index)) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 6;
          data.cell.styles.fillColor = [250, 250, 250];
        }
        // Total row
        if (data.row.index === g.totalRowIdx) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [245, 245, 245];
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  // Summary — separate purchase / sales totals + VAT position
  checkPage(30);
  const summaryRows: string[][] = [
    ["Total Purchases", fmtEur(purchaseGross), fmtEur(purchaseTax), fmtEur(purchaseNet)],
    ["Total Sales", fmtEur(salesGross), fmtEur(salesTax), fmtEur(salesNet)],
  ];
  // Only show VAT breakdown when there's actual VAT
  const inputVat = Math.abs(purchaseTax);
  const outputVat = salesTax;
  if (inputVat > 0 || outputVat > 0) {
    summaryRows.push(["", "", "", ""]); // separator
    if (outputVat > 0) summaryRows.push(["Output VAT (on Sales)", "", fmtEur(outputVat), ""]);
    if (inputVat > 0) summaryRows.push(["Input VAT (on Purchases)", "", fmtEur(inputVat), ""]);
    const netVat = outputVat - inputVat;
    summaryRows.push([netVat >= 0 ? "VAT Payable" : "VAT Refundable", "", fmtEur(Math.abs(netVat)), ""]);
  }
  const vatSummaryRowIdx = summaryRows.length - 1;
  const separatorRowIdx = summaryRows.findIndex((r) => r[0] === "" && r[1] === "" && r[2] === "" && r[3] === "");
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    theme: "plain",
    head: [["", "Gross", "Tax", "Net"]],
    body: summaryRows,
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [220, 220, 220], fontStyle: "bold", fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold" },
      1: { halign: "right", cellWidth: 28 },
      2: { halign: "right", cellWidth: 28 },
      3: { halign: "right", cellWidth: 28 },
    },
    didParseCell: (data) => {
      // VAT Payable/Refundable row — highlight
      if (data.row.index === vatSummaryRowIdx && (inputVat > 0 || outputVat > 0)) {
        data.cell.styles.fillColor = [245, 245, 245];
        data.cell.styles.fontStyle = "bold";
      }
      // Separator row
      if (data.row.index === separatorRowIdx && separatorRowIdx >= 0) {
        data.cell.styles.minCellHeight = 2;
        data.cell.styles.fontSize = 2;
      }
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
  addText(`${transactions.length} transactions`, 8, { color: [100, 100, 100] });

  // Receipt Matching Summary
  {
    const totalTx = transactions.length;
    const matched = transactions.filter((tx) => tx.receipt_url).length;
    const unmatched = totalTx - matched;
    const matchedPct = totalTx > 0 ? Math.round((matched / totalTx) * 100) : 0;
    const unmatchedPct = totalTx > 0 ? 100 - matchedPct : 0;

    checkPage(30);
    y += 4;
    addText("Receipt Matching Summary", 11, { bold: true });
    y += 2;
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      theme: "plain",
      body: [
        ["Total transactions", String(totalTx)],
        ["Receipts matched", `${matched} (${matchedPct}%)`],
        ["Unmatched", `${unmatched} (${unmatchedPct}%)`],
      ],
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: "bold" },
        1: { cellWidth: 40 },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  // Signature lines based on director count
  const directors = companyInfo?.directorNames ?? [];
  if (directors.length > 0) {
    const lineWidth = 70;
    const blocksNeeded = directors.length === 1 ? 2 : directors.length;
    const spaceNeeded = 30 + blocksNeeded * 28;
    if (y + spaceNeeded > 280) {
      doc.addPage();
      y = 15;
    }

    y += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Signed on behalf of the company", 14, y);
    y += 10;

    if (directors.length === 1) {
      // Single director — needs Director + Secretary signatures
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(14, y, 14 + lineWidth, y);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Director", 14, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(directors[0], 14, y + 10);
      doc.setTextColor(0, 0, 0);

      const rightX = pageW - 14 - lineWidth;
      doc.line(rightX, y, rightX + lineWidth, y);
      doc.setFont("helvetica", "bold");
      doc.text("Secretary", rightX, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text("________________________", rightX, y + 10);
      doc.setTextColor(0, 0, 0);
      y += 20;
    } else {
      // Two+ directors — no secretary required
      for (const name of directors) {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(14, y, 14 + lineWidth, y);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Director", 14, y + 5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.text(name, 14, y + 10);
        doc.setTextColor(0, 0, 0);
        y += 22;
      }
    }

    // Date line
    y += 4;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(14, y, 14 + lineWidth, y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Date", 14, y + 5);
  }

  doc.save(filename || `transactions_${format(new Date(), "yyyy-MM-dd")}.pdf`);
};

export const exportDirectorToExcel = (
  transactions: Transaction[],
  filename?: string,
  questionnaire?: DirectorQuestionnaireData,
) => {
  const headers = [
    "Date",
    "Description",
    "Amount (€)",
    "Type",
    "Category",
    "Account",
    "VAT Rate",
    "VAT Amount (€)",
    "Net Amount (€)",
    "Reference",
    "Receipt",
  ];

  const rows = transactions.map((tx) => [
    format(new Date(tx.transaction_date), "dd/MM/yyyy"),
    tx.description,
    tx.amount.toFixed(2),
    tx.type,
    tx.category?.name || "",
    tx.account?.name || "",
    tx.vat_rate || "",
    tx.vat_amount?.toFixed(2) || "",
    tx.net_amount?.toFixed(2) || "",
    tx.bank_reference || "",
    tx.receipt_url ? "Yes" : "No",
  ]);

  let csvContent = "";

  if (questionnaire) {
    csvContent += formatDirectorQuestionnaireSection(questionnaire);
  }

  // Receipt Matching Summary
  {
    const totalTx = transactions.length;
    const matched = transactions.filter((tx) => tx.receipt_url).length;
    const unmatched = totalTx - matched;
    const matchedPct = totalTx > 0 ? Math.round((matched / totalTx) * 100) : 0;
    const unmatchedPct = totalTx > 0 ? 100 - matchedPct : 0;
    csvContent += "Receipt Matching Summary\n";
    csvContent += `"Total transactions","${totalTx}"\n`;
    csvContent += `"Receipts matched","${matched} (${matchedPct}%)"\n`;
    csvContent += `"Unmatched","${unmatched} (${unmatchedPct}%)"\n`;
    csvContent += "\n";
  }

  csvContent += [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8" });

  const defaultFilename = `director_transactions_${format(new Date(), "yyyy-MM-dd")}.csv`;
  downloadBlob(blob, filename || defaultFilename);
};

export const exportDirectorToPDF = (
  transactions: Transaction[],
  filename?: string,
  questionnaire?: DirectorQuestionnaireData,
  companyInfo?: CompanyInfo,
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 15;

  const addText = (
    text: string,
    size: number,
    opts?: { bold?: boolean; color?: [number, number, number]; maxW?: number },
  ) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    if (opts?.color) doc.setTextColor(...opts.color);
    else doc.setTextColor(0, 0, 0);
    doc.text(text, 14, y, { maxWidth: opts?.maxW ?? pageW - 28 });
    y += size * 0.5;
  };

  const checkPage = (need: number) => {
    if (y + need > 280) {
      doc.addPage();
      y = 15;
    }
  };

  // Company header
  if (companyInfo?.companyName) {
    addText(companyInfo.companyName, 16, { bold: true });
  }
  const infoLines: string[] = [];
  if (companyInfo?.registeredAddress) infoLines.push(companyInfo.registeredAddress);
  if (companyInfo?.croNumber) infoLines.push(`CRO: ${companyInfo.croNumber}`);
  if (companyInfo?.incorporationDate)
    infoLines.push(`Incorporated: ${format(new Date(companyInfo.incorporationDate), "dd MMMM yyyy")}`);
  if (infoLines.length > 0) {
    addText(infoLines.join("  |  "), 8, { color: [100, 100, 100] });
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y, pageW - 14, y);
    y += 4;
  }

  // Title
  addText("Director Personal Account Report", 18, { bold: true });
  addText(`Generated on ${format(new Date(), "dd MMMM yyyy 'at' HH:mm")}`, 9, { color: [120, 120, 120] });
  y += 4;

  // Questionnaire
  if (questionnaire) {
    addText("Personal Account Finalisation (Form 11)", 14, { bold: true });
    y += 2;
    const qRows: [string, string][] = [];
    qRows.push(["1. Changes Since Onboarding", questionnaire.noChanges ? "No changes" : "Changes reported"]);
    qRows.push(["2. Income Reconciliation", questionnaire.incomeComplete ? "Complete" : "Missing source"]);
    qRows.push([
      "3. Business Link",
      questionnaire.businessLinksStatus === "yes"
        ? "Yes"
        : questionnaire.businessLinksStatus === "no"
          ? "No"
          : "Unsure",
    ]);
    qRows.push(["4. Reliefs & Credits", questionnaire.reliefsCorrect ? "Correct" : "Changed"]);
    qRows.push([
      "5. Preliminary Tax",
      questionnaire.preliminaryTaxPaid === "yes"
        ? "Paid"
        : questionnaire.preliminaryTaxPaid === "no"
          ? "Not paid"
          : "Unsure",
    ]);
    qRows.push(["6. Edge Cases", questionnaire.edgeCases.none ? "None" : "See details"]);
    qRows.push(["7. Final Declaration", questionnaire.finalDeclaration ? "CONFIRMED" : "NOT CONFIRMED"]);

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      theme: "striped",
      head: [["Section", "Status"]],
      body: qRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Sales Tax Audit Report — transactions grouped by VAT rate
  checkPage(20);
  addText("Transactions", 14, { bold: true });
  y += 2;

  // Calculate VAT from rate when vat_amount is not stored
  const dirCalcVat = (
    gross: number,
    vatPct: number,
    storedVat: number | null | undefined,
  ): { tax: number; net: number } => {
    if (storedVat != null && storedVat !== 0) {
      return { tax: Math.abs(storedVat), net: Math.abs(gross) - Math.abs(storedVat) };
    }
    if (vatPct > 0) {
      const tax = Math.round(Math.abs(gross) * (vatPct / (100 + vatPct)) * 100) / 100;
      return { tax, net: Math.round((Math.abs(gross) - tax) * 100) / 100 };
    }
    return { tax: 0, net: Math.abs(gross) };
  };

  const dirGroupMap = new Map<
    string,
    { label: string; sortKey: number; rows: Transaction[]; totalGross: number; totalTax: number; totalNet: number }
  >();
  for (const tx of transactions) {
    const vatPct = tx.vat_rate ? parseFloat(tx.vat_rate) : 0;
    const isPurchase = tx.type === "expense";
    const rateLabel = vatPct > 0 ? `${vatPct}%` : "0%";
    const typeLabel = isPurchase ? "Expenses" : "Income";
    const key = `${typeLabel}_${vatPct}`;
    const label = `${typeLabel} (${rateLabel})`;
    const sortKey = (isPurchase ? 1000 : 0) + (vatPct > 0 ? 100 - vatPct : 200);
    if (!dirGroupMap.has(key)) {
      dirGroupMap.set(key, { label, sortKey, rows: [], totalGross: 0, totalTax: 0, totalNet: 0 });
    }
    const g = dirGroupMap.get(key)!;
    g.rows.push(tx);
    const sign = isPurchase ? -1 : 1;
    const absGross = Math.abs(tx.amount);
    const { tax, net } = dirCalcVat(absGross, vatPct, tx.vat_amount);
    g.totalGross += sign * absGross;
    g.totalTax += sign * tax;
    g.totalNet += sign * net;
  }

  const dirGroups = Array.from(dirGroupMap.values()).sort((a, b) => a.sortKey - b.sortKey);
  for (const g of dirGroups) {
    checkPage(20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(g.label, 14, y);
    y += 4;
    const isPurchase = g.sortKey >= 1000;
    const sign = isPurchase ? -1 : 1;

    // Sub-group by category
    const dirCatMap = new Map<string, Transaction[]>();
    for (const tx of g.rows) {
      const cat = tx.category?.name || "Uncategorised";
      if (!dirCatMap.has(cat)) dirCatMap.set(cat, []);
      dirCatMap.get(cat)!.push(tx);
    }
    const dirSortedCats = Array.from(dirCatMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    const bodyRows: string[][] = [];
    const dirCatHeaderIndices: number[] = [];

    for (const [catName, txs] of dirSortedCats) {
      dirCatHeaderIndices.push(bodyRows.length);
      bodyRows.push([catName, "", "", "", "", "", ""]);
      for (const tx of txs.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))) {
        const vatPct = tx.vat_rate ? parseFloat(tx.vat_rate) : 0;
        const absGross = Math.abs(tx.amount);
        const { tax, net } = dirCalcVat(absGross, vatPct, tx.vat_amount);
        bodyRows.push([
          format(new Date(tx.transaction_date), "d/MM/yyyy"),
          "",
          tx.description,
          fmtEur(sign * absGross),
          fmtEur(sign * tax),
          fmtEur(sign * net),
          tx.receipt_url ? "Yes" : "No",
        ]);
      }
    }

    const dirTotalIdx = bodyRows.length;
    bodyRows.push(["", `Total ${g.label}`, "", fmtEur(g.totalGross), fmtEur(g.totalTax), fmtEur(g.totalNet), ""]);

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      theme: "plain",
      head: [["Date", "Account", "Details", "Gross", "Tax", "Net", "Receipt"]],
      body: bodyRows,
      styles: { fontSize: 6.5, cellPadding: 1.2, overflow: "linebreak" },
      headStyles: { fillColor: [240, 240, 240], fontStyle: "bold", fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 18 },
        3: { halign: "right", cellWidth: 20 },
        4: { halign: "right", cellWidth: 16 },
        5: { halign: "right", cellWidth: 18 },
        6: { cellWidth: 14, halign: "center" },
      },
      didParseCell: (data) => {
        if (dirCatHeaderIndices.includes(data.row.index)) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 6;
          data.cell.styles.fillColor = [250, 250, 250];
        }
        if (data.row.index === dirTotalIdx) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [245, 245, 245];
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  addText(`${transactions.length} transactions`, 8, { color: [100, 100, 100] });

  // Receipt Matching Summary
  {
    const totalTx = transactions.length;
    const matched = transactions.filter((tx) => tx.receipt_url).length;
    const unmatched = totalTx - matched;
    const matchedPct = totalTx > 0 ? Math.round((matched / totalTx) * 100) : 0;
    const unmatchedPct = totalTx > 0 ? 100 - matchedPct : 0;

    checkPage(30);
    y += 4;
    addText("Receipt Matching Summary", 11, { bold: true });
    y += 2;
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      theme: "plain",
      body: [
        ["Total transactions", String(totalTx)],
        ["Receipts matched", `${matched} (${matchedPct}%)`],
        ["Unmatched", `${unmatched} (${unmatchedPct}%)`],
      ],
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: "bold" },
        1: { cellWidth: 40 },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  doc.save(filename || `director_report_${format(new Date(), "yyyy-MM-dd")}.pdf`);
};

const escapeHtml = (text: string) => {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
