import { supabase } from "@/integrations/supabase/client";

interface Transaction {
  description: string;
  amount: number;
  transaction_date?: string;
  date?: string;
  type?: string;
  merchant?: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  vat_rate?: number | null;
  account_code?: string | null;
}

interface CategorizationResult {
  category_id: string | null;
  category_name: string;
  vat_rate: string;
  is_vat_recoverable: boolean;
  rct_applicable: boolean;
  rct_rate?: number;
  confidence: number;
  explanation: string;
}

export async function categorizeTransaction(
  transaction: Transaction,
  categories: Category[],
  businessType?: string,
  receiptText?: string,
): Promise<CategorizationResult> {
  try {
    const { data, error } = await supabase.functions.invoke("categorize-transaction", {
      body: {
        transaction,
        categories,
        businessType,
        action: "categorize",
        receiptText,
      },
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Categorization error:", error);
    // Return a default categorization if AI fails
    return {
      category_id: null,
      category_name: "Uncategorized",
      vat_rate: "standard_23",
      is_vat_recoverable: true,
      rct_applicable: false,
      confidence: 0,
      explanation: "AI categorization unavailable. Please categorize manually.",
    };
  }
}

export async function matchTransaction(
  transaction: Transaction,
  candidates: unknown[],
): Promise<{
  match_id: string | null;
  match_type: "invoice" | "expense" | null;
  confidence: number;
  explanation: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke("categorize-transaction", {
      body: {
        transaction,
        categories: candidates,
        action: "match",
      },
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Matching error:", error);
    return {
      match_id: null,
      match_type: null,
      confidence: 0,
      explanation: "Unable to find a match automatically.",
    };
  }
}

export async function detectAnomaly(
  transaction: Transaction,
  recentTransactions: Transaction[],
): Promise<{
  is_anomaly: boolean;
  anomaly_type: string;
  duplicate_of_id?: string;
  confidence: number;
  explanation: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke("categorize-transaction", {
      body: {
        transaction,
        categories: recentTransactions,
        action: "detect_anomaly",
      },
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Anomaly detection error:", error);
    return {
      is_anomaly: false,
      anomaly_type: "none",
      confidence: 0,
      explanation: "Anomaly detection unavailable.",
    };
  }
}

// VAT rate mapping for calculations
export const VAT_RATES: Record<string, number> = {
  standard_23: 0.23,
  reduced_13_5: 0.135,
  second_reduced_9: 0.09,
  livestock_4_8: 0.048,
  zero_rated: 0,
  exempt: 0,
};

export function calculateVat(total: number, vatRate: string): { net: number; vat: number } {
  const rate = VAT_RATES[vatRate] || 0.23;
  if (rate === 0) {
    return { net: total, vat: 0 };
  }
  const vat = Number(((total * rate) / (1 + rate)).toFixed(2));
  const net = Number((total - vat).toFixed(2));
  return { net, vat };
}

export function calculateRct(grossAmount: number, rctRate: number): { deducted: number; netPayable: number } {
  const deducted = Number((grossAmount * (rctRate / 100)).toFixed(2));
  const netPayable = Number((grossAmount - deducted).toFixed(2));
  return { deducted, netPayable };
}
