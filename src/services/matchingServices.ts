import { supabase } from "@/integrations/supabase/client";

export interface MatchResult {
  transaction_id: string;
  match_id: string | null;
  match_type: "invoice" | "expense" | null;
  confidence: number;
  explanation: string;
  amount_diff: number;
  date_diff_days: number;
}

export interface MatchSuggestion {
  id: string;
  type: "invoice" | "expense";
  amount: number;
  date: string;
  description: string;
  customer_or_supplier?: string;
  confidence: number;
  explanation: string;
}

export interface BulkMatchResult {
  results: MatchResult[];
  matched: number;
  total?: number;
}

/**
 * Match a single transaction to invoices/expenses
 */
export async function matchSingleTransaction(
  transactionId: string
): Promise<MatchResult> {
  const { data, error } = await supabase.functions.invoke("auto-match-transactions", {
    body: {
      action: "match_single",
      transactionId,
    },
  });

  if (error) {
    console.error("Match error:", error);
    throw new Error(error.message || "Failed to match transaction");
  }

  return data as MatchResult;
}

/**
 * Match multiple transactions
 */
export async function matchBulkTransactions(
  transactionIds: string[]
): Promise<BulkMatchResult> {
  const { data, error } = await supabase.functions.invoke("auto-match-transactions", {
    body: {
      action: "match_bulk",
      transactionIds,
    },
  });

  if (error) {
    console.error("Bulk match error:", error);
    throw new Error(error.message || "Failed to match transactions");
  }

  return data as BulkMatchResult;
}

/**
 * Match all unmatched transactions
 */
export async function matchAllUnmatched(): Promise<BulkMatchResult> {
  const { data, error } = await supabase.functions.invoke("auto-match-transactions", {
    body: {
      action: "match_all_unmatched",
    },
  });

  if (error) {
    console.error("Match all error:", error);
    throw new Error(error.message || "Failed to match transactions");
  }

  return data as BulkMatchResult;
}

/**
 * Get match suggestions for a transaction
 */
export async function getMatchSuggestions(
  transactionId: string
): Promise<MatchSuggestion[]> {
  const { data, error } = await supabase.functions.invoke("auto-match-transactions", {
    body: {
      action: "get_suggestions",
      transactionId,
    },
  });

  if (error) {
    console.error("Suggestions error:", error);
    throw new Error(error.message || "Failed to get suggestions");
  }

  return data?.suggestions || [];
}

/**
 * Manually apply a match
 */
export async function applyManualMatch(
  transactionId: string,
  matchId: string,
  matchType: "invoice" | "expense"
): Promise<void> {
  // Update transaction
  const updateData: any = {
    is_reconciled: true,
  };

  if (matchType === "invoice") {
    updateData.invoice_id = matchId;
  } else {
    updateData.expense_id = matchId;
  }

  const { error: txError } = await supabase
    .from("transactions")
    .update(updateData)
    .eq("id", transactionId);

  if (txError) throw txError;

  // Update the matched record
  if (matchType === "invoice") {
    await supabase
      .from("invoices")
      .update({ status: "paid", matched_transaction_id: transactionId })
      .eq("id", matchId);
  } else {
    await supabase
      .from("expenses")
      .update({ notes: `Matched to transaction ${transactionId}` })
      .eq("id", matchId);
  }
}
