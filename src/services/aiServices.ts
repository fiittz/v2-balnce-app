import { supabase } from "@/integrations/supabase/client";

export interface CategorizeResult {
  category_id: string | null;
  category_name: string;
  vat_rate: string;
  is_vat_recoverable: boolean;
  rct_applicable: boolean;
  rct_rate?: number;
  confidence: number;
  explanation: string;
}

export interface ReceiptData {
  supplier_name: string | null;
  date: string | null;
  invoice_number: string | null;
  total_amount: number;
  vat_amount: number | null;
  vat_rate: string | null;
  net_amount: number | null;
  payment_method: string | null;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  suggested_category: string | null;
  currency: string;
  confidence: number;
}

export interface ReceiptResult {
  success: boolean;
  data: ReceiptData;
  raw_text: string;
  notes: string;
}

export interface Transaction {
  description: string;
  amount: number;
  transaction_date?: string;
  date?: string;
  type?: string;
  merchant?: string;
}

export interface Category {
  id: string;
  name: string;
  type: string;
  vat_rate?: number | null;
  account_code?: string | null;
}

/**
 * Categorize a transaction using AI
 */
export async function categorizeTransaction(
  transaction: Transaction,
  categories: Category[],
  businessType?: string,
  receiptText?: string
): Promise<CategorizeResult> {
  const { data, error } = await supabase.functions.invoke("categorize-transaction", {
    body: {
      transaction,
      categories,
      businessType,
      action: "categorize",
      receiptText,
    },
  });

  if (error) {
    console.error("Categorization error:", error);
    throw new Error(error.message || "Failed to categorize transaction");
  }

  return data as CategorizeResult;
}

/**
 * Match a transaction to an invoice or expense
 */
export async function matchTransaction(
  transaction: Transaction,
  candidates: Array<{ id: string; type: string; amount: number; date: string; description?: string }>
): Promise<{
  match_id: string | null;
  match_type: "invoice" | "expense";
  confidence: number;
  explanation: string;
}> {
  const { data, error } = await supabase.functions.invoke("categorize-transaction", {
    body: {
      transaction,
      categories: candidates,
      action: "match",
    },
  });

  if (error) {
    console.error("Matching error:", error);
    throw new Error(error.message || "Failed to match transaction");
  }

  return data;
}

/**
 * Detect anomalies in a transaction
 */
export async function detectAnomaly(
  transaction: Transaction,
  recentTransactions: Transaction[]
): Promise<{
  is_anomaly: boolean;
  anomaly_type: "duplicate" | "unusual_amount" | "suspicious_pattern" | "none";
  duplicate_of_id?: string;
  confidence: number;
  explanation: string;
}> {
  const { data, error } = await supabase.functions.invoke("categorize-transaction", {
    body: {
      transaction,
      categories: recentTransactions,
      action: "detect_anomaly",
    },
  });

  if (error) {
    console.error("Anomaly detection error:", error);
    throw new Error(error.message || "Failed to detect anomalies");
  }

  return data;
}

/**
 * Process a receipt image using OCR
 */
export async function processReceipt(
  imageBase64: string,
  categories?: Category[],
  mimeType?: string
): Promise<ReceiptResult> {
  const { data, error } = await supabase.functions.invoke("process-receipt", {
    body: {
      imageBase64,
      mimeType: mimeType || "image/jpeg",
      categories,
    },
  });

  if (error) {
    console.error("Receipt processing error:", error);
    throw new Error(error.message || "Failed to process receipt");
  }

  return data as ReceiptResult;
}

/**
 * Process a receipt from URL
 */
export async function processReceiptFromUrl(
  imageUrl: string,
  categories?: Category[]
): Promise<ReceiptResult> {
  const { data, error } = await supabase.functions.invoke("process-receipt", {
    body: {
      imageUrl,
      categories,
    },
  });

  if (error) {
    console.error("Receipt processing error:", error);
    throw new Error(error.message || "Failed to process receipt");
  }

  return data as ReceiptResult;
}

/**
 * Generate invoice PDF HTML
 */
export async function generateInvoicePDF(invoiceId: string): Promise<{
  html: string;
  invoice: {
    id: string;
    invoice_number: string;
    customer_name: string;
    total: number;
    status: string;
  };
}> {
  const { data, error } = await supabase.functions.invoke("generate-invoice-pdf", {
    body: { invoiceId },
  });

  if (error) {
    console.error("PDF generation error:", error);
    throw new Error(error.message || "Failed to generate invoice PDF");
  }

  return data;
}

/**
 * Open invoice PDF in new window for printing
 */
export async function printInvoice(invoiceId: string): Promise<void> {
  const { html, invoice } = await generateInvoicePDF(invoiceId);
  
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

/**
 * Download invoice as PDF (using browser print to PDF)
 */
export async function downloadInvoice(invoiceId: string): Promise<void> {
  const { html, invoice } = await generateInvoicePDF(invoiceId);
  
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.document.title = `Invoice-${invoice.invoice_number}`;
  }
}
