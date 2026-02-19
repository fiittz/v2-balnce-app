import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// VAT rate display mapping
const VAT_RATE_LABELS: Record<string, string> = {
  standard_23: "23%",
  reduced_13_5: "13.5%",
  second_reduced_9: "9%",
  livestock_4_8: "4.8%",
  zero_rated: "0%",
  exempt: "Exempt",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth client - only used to verify the JWT
    const authClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: 30 requests per minute per user
    const rl = checkRateLimit(user.id, "invoice-pdf", 30);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!, corsHeaders);
    }

    // User client - uses the caller's JWT so RLS is enforced
    const supabase = createClient(SUPABASE_URL!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { invoiceId, invoiceData } = body || {};
    
    console.log("Request received:", { 
      hasInvoiceId: !!invoiceId, 
      hasInvoiceData: !!invoiceData,
      bodyKeys: body ? Object.keys(body) : []
    });

    // If invoiceData is provided, generate PDF directly without fetching from DB
    // This is useful for previewing before saving
    if (invoiceData) {
      // Fetch supplier details from profile and onboarding
      const [profileResult, onboardingResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("onboarding_settings").select("*").eq("user_id", user.id).maybeSingle()
      ]);

      const profile = profileResult.data;
      const onboarding = onboardingResult.data;

      const html = generateInvoiceHTML(invoiceData, profile, onboarding, true);
      
      return new Response(JSON.stringify({ html }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: "Invoice ID is required (no invoiceData provided for preview)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating PDF for invoice:", invoiceId);

    // Fetch invoice with related data
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select(`
        *,
        customer:customers(*),
        items:invoice_items(*)
      `)
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .single();

    if (invError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user profile and onboarding for business details
    const [profileResult, onboardingResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("onboarding_settings").select("*").eq("user_id", user.id).maybeSingle()
    ]);

    const profile = profileResult.data;
    const onboarding = onboardingResult.data;

    // Generate HTML for the invoice
    const html = generateInvoiceHTML(invoice, profile, onboarding, false);

    // Return HTML that can be printed to PDF by the browser
    return new Response(JSON.stringify({
      html,
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        customer_name: invoice.customer?.name,
        total: invoice.total,
        status: invoice.status,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-invoice-pdf:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function generateInvoiceHTML(invoice: any, profile: any, onboarding: any, isPreview: boolean): string {
  const formatDate = (date: string) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-IE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
    }).format(amount || 0);
  };

  // For preview, items come directly; for saved invoice, from invoice.items
  const items = isPreview ? (invoice.items || []) : (invoice.items || []);
  
  const itemsHTML = items.map((item: any) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.description)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity || item.qty}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price || item.price)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${VAT_RATE_LABELS[item.vat_rate || item.vatRate] || escapeHtml(item.vat_rate || item.vatRate)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.total_amount || item.lineTotal)}</td>
    </tr>
  `).join("") || "";

  // Supplier details - combine profile and onboarding
  const supplierName = onboarding?.business_name || profile?.business_name || "Your Business";
  const supplierAddress = profile?.address || "";
  const supplierVatNumber = onboarding?.vat_number || profile?.vat_number || "";
  const supplierPhone = profile?.phone || "";

  // Customer details - for preview, from invoiceData; for saved, from invoice.customer
  const customerName = isPreview ? invoice.customerName : (invoice.customer?.name || "");
  const customerAddress = isPreview ? invoice.customerAddress : (invoice.customer?.address || "");
  const customerEmail = isPreview ? invoice.customerEmail : (invoice.customer?.email || "");
  const customerPhone = isPreview ? invoice.customerPhone : (invoice.customer?.phone || "");
  const customerTaxNumber = isPreview ? invoice.customerTaxNumber : (invoice.customer?.vat_number || "");

  // Invoice details
  const invoiceNumber = invoice.invoice_number || "PREVIEW";
  const issueDate = invoice.issue_date || invoice.invoiceDate || new Date().toISOString().split("T")[0];
  const supplyDate = invoice.supply_date || invoice.supplyDate;
  const dueDate = invoice.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const status = invoice.status || "draft";

  // Totals
  const subtotal = invoice.subtotal || 0;
  const vatAmount = invoice.vat_amount || invoice.vatAmount || 0;
  const total = invoice.total || 0;
  const rctApplicable = invoice.rct_applicable || invoice.rctEnabled || false;
  const rctRate = invoice.rct_rate || invoice.rctRate || 0;
  const rctAmount = invoice.rct_amount || invoice.rctAmount || 0;

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
      font-family: 'Nunito', sans-serif; 
      color: #000; 
      background: #fff;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #F2C300;
    }
    
    .logo-section h1 {
      font-size: 28px;
      font-weight: 700;
      color: #000;
      margin-bottom: 4px;
    }
    
    .supplier-details {
      font-size: 12px;
      color: #666;
      line-height: 1.5;
    }
    
    .invoice-title {
      text-align: right;
    }
    
    .invoice-title h2 {
      font-size: 28px;
      color: #000;
      margin-bottom: 8px;
    }
    
    .invoice-number {
      font-size: 14px;
      color: #666;
    }
    
    .details-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    
    .details-block {
      flex: 1;
    }
    
    .details-block h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      margin-bottom: 8px;
      font-weight: 600;
    }
    
    .details-block p {
      font-size: 13px;
      line-height: 1.6;
      color: #000;
    }
    
    .details-block .label {
      font-size: 11px;
      color: #666;
      margin-top: 8px;
    }
    
    .dates-section {
      display: flex;
      gap: 40px;
      margin-bottom: 30px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
    }
    
    .date-item label {
      font-size: 11px;
      color: #666;
      display: block;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .date-item span {
      font-size: 14px;
      font-weight: 600;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    
    th {
      background: #000;
      color: #fff;
      padding: 12px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    th:nth-child(2), th:nth-child(4) { text-align: center; }
    th:nth-child(3), th:nth-child(5) { text-align: right; }
    
    .totals-section {
      display: flex;
      justify-content: flex-end;
    }
    
    .totals-table {
      width: 300px;
    }
    
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    
    .totals-row.rct {
      color: #d97706;
    }
    
    .totals-row.total {
      border-bottom: none;
      border-top: 2px solid #000;
      font-size: 18px;
      font-weight: 700;
      padding-top: 12px;
    }
    
    .notes-section {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    
    .notes-section h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      margin-bottom: 8px;
    }
    
    .notes-section p {
      font-size: 13px;
      color: #333;
      line-height: 1.6;
    }
    
    .footer {
      margin-top: 60px;
      text-align: center;
      color: #666;
      font-size: 11px;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .status-draft { background: #e5e7eb; color: #374151; }
    .status-sent { background: #dbeafe; color: #1d4ed8; }
    .status-paid { background: #dcfce7; color: #16a34a; }
    .status-overdue { background: #fee2e2; color: #dc2626; }
    
    .vat-summary {
      margin-top: 20px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
      font-size: 12px;
    }
    
    .vat-summary h4 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      margin-bottom: 8px;
    }
    
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <!-- HEADER WITH SUPPLIER INFO -->
  <div class="header">
    <div class="logo-section">
      <h1>${escapeHtml(supplierName)}</h1>
      <div class="supplier-details">
        ${supplierAddress ? `${escapeHtml(supplierAddress)}<br>` : ""}
        ${supplierPhone ? `Tel: ${escapeHtml(supplierPhone)}<br>` : ""}
        ${supplierVatNumber ? `<strong>VAT No: ${escapeHtml(supplierVatNumber)}</strong>` : ""}
      </div>
    </div>
    <div class="invoice-title">
      <h2>${invoice.invoiceType === "quote" ? "QUOTE" : "INVOICE"}</h2>
      <p class="invoice-number">#${escapeHtml(invoiceNumber)}</p>
      ${!isPreview ? `<span class="status-badge status-${escapeHtml(status)}">${escapeHtml(status)}</span>` : ""}
    </div>
  </div>

  <!-- CUSTOMER DETAILS -->
  <div class="details-section">
    <div class="details-block">
      <h3>Bill To</h3>
      <p>
        <strong>${escapeHtml(customerName) || "Customer Name"}</strong><br>
        ${customerAddress ? `${escapeHtml(customerAddress)}<br>` : ""}
        ${customerEmail ? `${escapeHtml(customerEmail)}<br>` : ""}
        ${customerPhone ? `Tel: ${escapeHtml(customerPhone)}<br>` : ""}
        ${customerTaxNumber ? `<span class="label">Tax/VAT No:</span> ${escapeHtml(customerTaxNumber)}` : ""}
      </p>
    </div>
  </div>

  <!-- DATES SECTION -->
  <div class="dates-section">
    <div class="date-item">
      <label>Invoice Date</label>
      <span>${formatDate(issueDate)}</span>
    </div>
    ${supplyDate && supplyDate !== issueDate ? `
    <div class="date-item">
      <label>Date of Supply</label>
      <span>${formatDate(supplyDate)}</span>
    </div>
    ` : ""}
    <div class="date-item">
      <label>Due Date</label>
      <span>${formatDate(dueDate)}</span>
    </div>
  </div>

  <!-- LINE ITEMS TABLE -->
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

  <!-- TOTALS -->
  <div class="totals-section">
    <div class="totals-table">
      <div class="totals-row">
        <span>Net Amount</span>
        <span>${formatCurrency(subtotal)}</span>
      </div>
      <div class="totals-row">
        <span>VAT</span>
        <span>${formatCurrency(vatAmount)}</span>
      </div>
      ${rctApplicable ? `
      <div class="totals-row rct">
        <span>RCT Deduction (${rctRate}%)</span>
        <span>-${formatCurrency(rctAmount)}</span>
      </div>
      ` : ""}
      <div class="totals-row total">
        <span>${rctApplicable ? "Net Receivable" : "Total Due"}</span>
        <span>${formatCurrency(rctApplicable ? (total - rctAmount) : total)}</span>
      </div>
    </div>
  </div>

  ${invoice.notes || invoice.comment ? `
  <div class="notes-section">
    <h3>Notes</h3>
    <p>${escapeHtml(invoice.notes || invoice.comment)}</p>
  </div>
  ` : ""}

  <!-- FOOTER -->
  <div class="footer">
    <p>Thank you for your business!</p>
    ${supplierVatNumber ? `<p style="margin-top: 8px;">VAT Registration: ${escapeHtml(supplierVatNumber)}</p>` : ""}
    <p style="margin-top: 8px; color: #999;">Generated ${formatDate(new Date().toISOString())}</p>
  </div>
</body>
</html>
  `;
}
