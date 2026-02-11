// Client-side invoice HTML generation
// Generates the same HTML as the generate-invoice-pdf edge function

const VAT_RATE_LABELS: Record<string, string> = {
  standard_23: "23%",
  reduced_13_5: "13.5%",
  second_reduced_9: "9%",
  livestock_4_8: "4.8%",
  zero_rated: "0%",
  exempt: "Exempt",
};

export interface InvoiceHTMLData {
  invoiceType?: "quote" | "invoice";
  invoiceNumber?: string;
  status?: string;
  supplierName: string;
  supplierAddress?: string;
  supplierVatNumber?: string;
  supplierPhone?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerTaxNumber?: string;
  invoiceDate: string;
  supplyDate?: string;
  dueDate?: string;
  items: {
    description: string;
    qty: number;
    price: number;
    vatRate: string;
    lineTotal: number;
    vat_amount: number;
    total_amount: number;
  }[];
  subtotal: number;
  vatAmount: number;
  total: number;
  rctEnabled?: boolean;
  rctRate?: number;
  rctAmount?: number;
  comment?: string;
  notes?: string;
}

function formatDate(date: string): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-IE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(amount || 0);
}

export function generateInvoiceHTML(data: InvoiceHTMLData): string {
  const {
    invoiceType = "invoice",
    invoiceNumber = "PREVIEW",
    status = "draft",
    supplierName,
    supplierAddress = "",
    supplierVatNumber = "",
    supplierPhone = "",
    customerName,
    customerEmail = "",
    customerPhone = "",
    customerAddress = "",
    customerTaxNumber = "",
    invoiceDate,
    supplyDate,
    dueDate,
    items,
    subtotal,
    vatAmount,
    total,
    rctEnabled = false,
    rctRate = 0,
    rctAmount = 0,
    comment,
    notes,
  } = data;

  const effectiveDueDate = dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const itemsHTML = items.map((item) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.qty}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.price)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${VAT_RATE_LABELS[item.vatRate] || item.vatRate}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.total_amount)}</td>
    </tr>
  `).join("");

  const noteText = comment || notes || "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Nunito', sans-serif; color: #000; background: #fff;
      padding: 40px; max-width: 800px; margin: 0 auto;
    }
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #F2C300;
    }
    .logo-section h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
    .supplier-details { font-size: 12px; color: #666; line-height: 1.5; }
    .invoice-title { text-align: right; }
    .invoice-title h2 { font-size: 28px; margin-bottom: 8px; }
    .invoice-number { font-size: 14px; color: #666; }
    .details-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .details-block { flex: 1; }
    .details-block h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 8px; font-weight: 600; }
    .details-block p { font-size: 13px; line-height: 1.6; }
    .dates-section { display: flex; gap: 40px; margin-bottom: 30px; padding: 16px; background: #f9fafb; border-radius: 8px; }
    .date-item label { font-size: 11px; color: #666; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .date-item span { font-size: 14px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #000; color: #fff; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    th:nth-child(2), th:nth-child(4) { text-align: center; }
    th:nth-child(3), th:nth-child(5) { text-align: right; }
    .totals-section { display: flex; justify-content: flex-end; }
    .totals-table { width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .totals-row.rct { color: #d97706; }
    .totals-row.total { border-bottom: none; border-top: 2px solid #000; font-size: 18px; font-weight: 700; padding-top: 12px; }
    .notes-section { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    .notes-section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 8px; }
    .notes-section p { font-size: 13px; color: #333; line-height: 1.6; }
    .footer { margin-top: 60px; text-align: center; color: #666; font-size: 11px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .status-draft { background: #e5e7eb; color: #374151; }
    .status-sent { background: #dbeafe; color: #1d4ed8; }
    .status-paid { background: #dcfce7; color: #16a34a; }
    .status-overdue { background: #fee2e2; color: #dc2626; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-section">
      <h1>${supplierName}</h1>
      <div class="supplier-details">
        ${supplierAddress ? `${supplierAddress}<br>` : ""}
        ${supplierPhone ? `Tel: ${supplierPhone}<br>` : ""}
        ${supplierVatNumber ? `<strong>VAT No: ${supplierVatNumber}</strong>` : ""}
      </div>
    </div>
    <div class="invoice-title">
      <h2>${invoiceType === "quote" ? "QUOTE" : "INVOICE"}</h2>
      <p class="invoice-number">#${invoiceNumber}</p>
      ${status !== "draft" ? `<span class="status-badge status-${status}">${status}</span>` : ""}
    </div>
  </div>

  <div class="details-section">
    <div class="details-block">
      <h3>Bill To</h3>
      <p>
        <strong>${customerName || "Customer Name"}</strong><br>
        ${customerAddress ? `${customerAddress}<br>` : ""}
        ${customerEmail ? `${customerEmail}<br>` : ""}
        ${customerPhone ? `Tel: ${customerPhone}<br>` : ""}
        ${customerTaxNumber ? `<span style="font-size:11px;color:#666;">Tax/VAT No:</span> ${customerTaxNumber}` : ""}
      </p>
    </div>
  </div>

  <div class="dates-section">
    <div class="date-item">
      <label>Invoice Date</label>
      <span>${formatDate(invoiceDate)}</span>
    </div>
    ${supplyDate && supplyDate !== invoiceDate ? `
    <div class="date-item">
      <label>Date of Supply</label>
      <span>${formatDate(supplyDate)}</span>
    </div>` : ""}
    <div class="date-item">
      <label>Due Date</label>
      <span>${formatDate(effectiveDueDate)}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>VAT Rate</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <div class="totals-section">
    <div class="totals-table">
      <div class="totals-row">
        <span>Net Amount</span>
        <span>${formatCurrency(subtotal)}</span>
      </div>
      <div class="totals-row">
        <span>VAT${rctEnabled ? " (Reverse Charge)" : ""}</span>
        <span>${rctEnabled ? "€0.00" : formatCurrency(vatAmount)}</span>
      </div>
      ${rctEnabled ? `
      <div class="totals-row" style="font-size: 11px; color: #666;">
        <span colspan="2">VAT reverse charge applies per s.12(1)(b) VATCA 2010</span>
        <span></span>
      </div>
      <div class="totals-row rct">
        <span>RCT Deduction (${rctRate}%)</span>
        <span>-${formatCurrency(rctAmount)}</span>
      </div>` : ""}
      <div class="totals-row total">
        <span>${rctEnabled ? "Net Receivable" : "Total Due"}</span>
        <span>${formatCurrency(rctEnabled ? (total - rctAmount) : total)}</span>
      </div>
    </div>
  </div>

  ${noteText ? `
  <div class="notes-section">
    <h3>Notes</h3>
    <p>${noteText}</p>
  </div>` : ""}

  <div class="footer">
    <p>Thank you for your business!</p>
    ${supplierVatNumber ? `<p style="margin-top: 8px;">VAT Registration: ${supplierVatNumber}</p>` : ""}
    <p style="margin-top: 8px; color: #999;">Generated ${formatDate(new Date().toISOString())}</p>
  </div>
</body>
</html>`;
}
