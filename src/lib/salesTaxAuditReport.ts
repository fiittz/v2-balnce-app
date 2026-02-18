import { format } from "date-fns";
import { isVATDeductible, calculateVATFromGross } from "./vatDeductibility";

// VAT rate display names and values
const VAT_RATE_CONFIG: Record<string, { display: string; rate: number }> = {
  standard_23: { display: "23%", rate: 0.23 },
  reduced_13_5: { display: "13.5%", rate: 0.135 },
  second_reduced_9: { display: "9%", rate: 0.09 },
  livestock_4_8: { display: "4.8%", rate: 0.048 },
  zero_rated: { display: "0%", rate: 0 },
  exempt: { display: "Exempt", rate: 0 },
};

interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  vat_rate?: string;
  vat_amount?: number;
  net_amount?: number;
  is_business_expense?: boolean | null;
  category?: { name: string; id: string } | null;
  account?: { name: string } | null;
  bank_reference?: string;
}

interface Expense {
  id: string;
  expense_date: string;
  description?: string;
  total_amount: number;
  vat_rate: string;
  vat_amount: number;
  net_amount: number;
  category?: { name: string; id: string } | null;
  invoice_number?: string;
  supplier?: { name: string } | null;
}

interface Invoice {
  id: string;
  issue_date: string;
  invoice_number: string;
  total: number;
  vat_amount: number;
  subtotal: number;
  customer?: { name: string } | null;
  items?: Array<{
    description: string;
    vat_rate: string;
    vat_amount: number;
    net_amount: number;
    total_amount: number;
  }>;
}

interface AuditLineItem {
  date: string;
  account: string;
  reference: string;
  details: string;
  gross: number;
  tax: number;
  net: number;
}

interface AuditSection {
  title: string;
  vatRate: string;
  type: "sales" | "purchases";
  items: AuditLineItem[];
  totalGross: number;
  totalTax: number;
  totalNet: number;
}

export interface SalesTaxAuditReport {
  businessName: string;
  periodStart: string;
  periodEnd: string;
  sections: AuditSection[];
  grandTotalSalesGross: number;
  grandTotalSalesTax: number;
  grandTotalSalesNet: number;
  grandTotalPurchasesGross: number;
  grandTotalPurchasesTax: number;
  grandTotalPurchasesNet: number;
  netVatPayable: number;
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "d/MM/yyyy");
  } catch {
    return dateStr;
  }
}

function calculateVatFromTotal(total: number, vatRateKey: string): { net: number; vat: number } {
  const config = VAT_RATE_CONFIG[vatRateKey];
  if (!config || config.rate === 0) {
    return { net: total, vat: 0 };
  }
  const vat = Number(((total * config.rate) / (1 + config.rate)).toFixed(2));
  const net = Number((total - vat).toFixed(2));
  return { net, vat };
}

export function generateSalesTaxAuditReport(
  businessName: string,
  periodStart: Date,
  periodEnd: Date,
  transactions: Transaction[],
  expenses: Expense[],
  invoices: Invoice[],
): SalesTaxAuditReport {
  const sections: AuditSection[] = [];

  // Group by VAT rate and type
  const purchasesByRate: Record<string, AuditLineItem[]> = {};
  const salesByRate: Record<string, AuditLineItem[]> = {};

  // Process expenses (purchases)
  for (const expense of expenses) {
    const vatRateKey = expense.vat_rate || "standard_23";
    const rateConfig = VAT_RATE_CONFIG[vatRateKey] || VAT_RATE_CONFIG.standard_23;

    if (!purchasesByRate[vatRateKey]) {
      purchasesByRate[vatRateKey] = [];
    }

    const categoryName = expense.category?.name || "Uncategorized";
    const supplierName = expense.supplier?.name || "";
    const details = expense.description
      ? `${supplierName}${supplierName ? " - " : ""}${expense.description}`
      : supplierName || "Purchase";

    purchasesByRate[vatRateKey].push({
      date: formatDate(expense.expense_date),
      account: categoryName,
      reference: expense.invoice_number || "",
      details: details,
      gross: -Math.abs(expense.total_amount), // Expenses are negative
      tax: -Math.abs(expense.vat_amount),
      net: -Math.abs(expense.net_amount),
    });
  }

  // Process transactions that are expenses (applying Section 59/60 deductibility rules)
  const expenseTransactions = transactions.filter((t) => t.type === "expense");
  for (const txn of expenseTransactions) {
    // Skip non-business expenses
    if (txn.is_business_expense === false) {
      continue;
    }

    const vatRateKey = txn.vat_rate || "standard_23";
    const categoryName = txn.category?.name || null;
    const accountName = txn.account?.name || null;

    // Apply Section 59/60 deductibility check
    const deductibility = isVATDeductible(txn.description, categoryName, accountName);

    // Skip non-deductible transactions for VAT purposes
    if (!deductibility.isDeductible) {
      continue;
    }

    if (!purchasesByRate[vatRateKey]) {
      purchasesByRate[vatRateKey] = [];
    }

    const { net, vat } =
      txn.net_amount && txn.vat_amount
        ? { net: txn.net_amount, vat: txn.vat_amount }
        : calculateVatFromTotal(txn.amount, vatRateKey);

    purchasesByRate[vatRateKey].push({
      date: formatDate(txn.transaction_date),
      account: categoryName || "Uncategorized",
      reference: txn.bank_reference || "",
      details: `${txn.description} (${deductibility.reason})`,
      gross: -Math.abs(txn.amount),
      tax: -Math.abs(vat),
      net: -Math.abs(net),
    });
  }

  // Process invoices (sales)
  for (const invoice of invoices) {
    // Try to determine VAT rate from items or default to 13.5% for trades
    let primaryVatRate = "reduced_13_5"; // Default for trades/construction

    if (invoice.items && invoice.items.length > 0) {
      // Use the VAT rate from the first item or most common
      primaryVatRate = invoice.items[0].vat_rate || "reduced_13_5";
    }

    // If no VAT, it's zero-rated
    if (invoice.vat_amount === 0) {
      primaryVatRate = "zero_rated";
    }

    if (!salesByRate[primaryVatRate]) {
      salesByRate[primaryVatRate] = [];
    }

    const customerName = invoice.customer?.name || "";
    const itemDescriptions = invoice.items?.map((i) => i.description).join("; ") || "";
    const details = `${customerName}${customerName && itemDescriptions ? " - " : ""}${itemDescriptions}`.slice(0, 100);

    salesByRate[primaryVatRate].push({
      date: formatDate(invoice.issue_date),
      account: "Sales",
      reference: invoice.invoice_number,
      details: details || "Invoice",
      gross: invoice.total,
      tax: invoice.vat_amount,
      net: invoice.subtotal,
    });
  }

  // Process income transactions
  const incomeTransactions = transactions.filter((t) => t.type === "income");
  for (const txn of incomeTransactions) {
    const vatRateKey = txn.vat_rate || "zero_rated"; // Default income to zero-rated (subcontractor)

    if (!salesByRate[vatRateKey]) {
      salesByRate[vatRateKey] = [];
    }

    const { net, vat } =
      txn.net_amount && txn.vat_amount
        ? { net: txn.net_amount, vat: txn.vat_amount }
        : calculateVatFromTotal(txn.amount, vatRateKey);

    const categoryName = txn.category?.name || "Sales";

    salesByRate[vatRateKey].push({
      date: formatDate(txn.transaction_date),
      account: categoryName,
      reference: txn.bank_reference || "",
      details: txn.description,
      gross: txn.amount,
      tax: vat,
      net: net,
    });
  }

  // Build sections in order: Purchases by rate, then Sales by rate
  const rateOrder = ["reduced_13_5", "standard_23", "second_reduced_9", "livestock_4_8", "zero_rated", "exempt"];

  // Purchases sections
  for (const rate of rateOrder) {
    const items = purchasesByRate[rate];
    if (items && items.length > 0) {
      const rateConfig = VAT_RATE_CONFIG[rate] || { display: rate, rate: 0 };
      const totalGross = items.reduce((sum, i) => sum + i.gross, 0);
      const totalTax = items.reduce((sum, i) => sum + i.tax, 0);
      const totalNet = items.reduce((sum, i) => sum + i.net, 0);

      sections.push({
        title: `Purchases ${rateConfig.display} (${rateConfig.display})`,
        vatRate: rate,
        type: "purchases",
        items: items.sort(
          (a, b) =>
            new Date(a.date.split("/").reverse().join("-")).getTime() -
            new Date(b.date.split("/").reverse().join("-")).getTime(),
        ),
        totalGross: Number(totalGross.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        totalNet: Number(totalNet.toFixed(2)),
      });
    }
  }

  // Sales sections
  for (const rate of rateOrder) {
    const items = salesByRate[rate];
    if (items && items.length > 0) {
      const rateConfig = VAT_RATE_CONFIG[rate] || { display: rate, rate: 0 };
      const totalGross = items.reduce((sum, i) => sum + i.gross, 0);
      const totalTax = items.reduce((sum, i) => sum + i.tax, 0);
      const totalNet = items.reduce((sum, i) => sum + i.net, 0);

      sections.push({
        title: `Sales ${rateConfig.display} (${rateConfig.display})`,
        vatRate: rate,
        type: "sales",
        items: items.sort(
          (a, b) =>
            new Date(a.date.split("/").reverse().join("-")).getTime() -
            new Date(b.date.split("/").reverse().join("-")).getTime(),
        ),
        totalGross: Number(totalGross.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        totalNet: Number(totalNet.toFixed(2)),
      });
    }
  }

  // Calculate grand totals
  const salesSections = sections.filter((s) => s.type === "sales");
  const purchaseSections = sections.filter((s) => s.type === "purchases");

  const grandTotalSalesGross = salesSections.reduce((sum, s) => sum + s.totalGross, 0);
  const grandTotalSalesTax = salesSections.reduce((sum, s) => sum + s.totalTax, 0);
  const grandTotalSalesNet = salesSections.reduce((sum, s) => sum + s.totalNet, 0);

  const grandTotalPurchasesGross = purchaseSections.reduce((sum, s) => sum + s.totalGross, 0);
  const grandTotalPurchasesTax = purchaseSections.reduce((sum, s) => sum + s.totalTax, 0);
  const grandTotalPurchasesNet = purchaseSections.reduce((sum, s) => sum + s.totalNet, 0);

  // Net VAT = VAT on Sales - VAT on Purchases (purchases tax is already negative)
  const netVatPayable = grandTotalSalesTax + grandTotalPurchasesTax; // Purchases tax is negative

  return {
    businessName,
    periodStart: format(periodStart, "d MMMM yyyy"),
    periodEnd: format(periodEnd, "d MMMM yyyy"),
    sections,
    grandTotalSalesGross: Number(grandTotalSalesGross.toFixed(2)),
    grandTotalSalesTax: Number(grandTotalSalesTax.toFixed(2)),
    grandTotalSalesNet: Number(grandTotalSalesNet.toFixed(2)),
    grandTotalPurchasesGross: Number(grandTotalPurchasesGross.toFixed(2)),
    grandTotalPurchasesTax: Number(grandTotalPurchasesTax.toFixed(2)),
    grandTotalPurchasesNet: Number(grandTotalPurchasesNet.toFixed(2)),
    netVatPayable: Number(netVatPayable.toFixed(2)),
  };
}

function formatCurrency(amount: number): string {
  const prefix = amount < 0 ? "-" : "";
  return `${prefix}€${Math.abs(amount).toFixed(2)}`;
}

export function exportToCSV(report: SalesTaxAuditReport): string {
  const lines: string[] = [];

  // Header
  lines.push("Sales Tax Audit Report");
  lines.push(report.businessName);
  lines.push(`For the period ${report.periodStart} to ${report.periodEnd}`);
  lines.push("");
  lines.push("Date,Account,Reference,Details,Gross,Tax,Net");
  lines.push("");

  // Sections
  for (const section of report.sections) {
    lines.push(section.title);

    for (const item of section.items) {
      const escapedDetails = `"${item.details.replace(/"/g, '""')}"`;
      lines.push(
        [
          item.date,
          item.account,
          item.reference,
          escapedDetails,
          formatCurrency(item.gross),
          formatCurrency(item.tax),
          formatCurrency(item.net),
        ].join(","),
      );
    }

    lines.push(
      [
        `Total ${section.title}`,
        "",
        "",
        "",
        formatCurrency(section.totalGross),
        formatCurrency(section.totalTax),
        formatCurrency(section.totalNet),
      ].join(","),
    );
    lines.push("");
  }

  // Summary
  lines.push("");
  lines.push("SUMMARY");
  lines.push(
    `Total Sales,,,${formatCurrency(report.grandTotalSalesGross)},${formatCurrency(report.grandTotalSalesTax)},${formatCurrency(report.grandTotalSalesNet)}`,
  );
  lines.push(
    `Total Purchases,,,${formatCurrency(report.grandTotalPurchasesGross)},${formatCurrency(report.grandTotalPurchasesTax)},${formatCurrency(report.grandTotalPurchasesNet)}`,
  );
  lines.push("");
  lines.push(`Net VAT Payable,,,,,${formatCurrency(report.netVatPayable)}`);

  return lines.join("\n");
}

/* v8 ignore next 13 -- DOM-only download helper, untestable in Node */
export function downloadCSV(report: SalesTaxAuditReport, filename?: string): void {
  const csv = exportToCSV(report);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    filename ||
      `Sales_Tax_Audit_Report_${report.periodStart.replace(/ /g, "_")}_to_${report.periodEnd.replace(/ /g, "_")}.csv`,
  );
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
