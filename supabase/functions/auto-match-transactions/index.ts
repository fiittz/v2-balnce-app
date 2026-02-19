import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const AI_MODEL = Deno.env.get("AI_MODEL") || "google/gemini-2.5-flash";

interface MatchCandidate {
  id: string;
  type: "invoice" | "expense";
  amount: number;
  date: string;
  description: string;
  customer_or_supplier?: string;
}

interface MatchResult {
  transaction_id: string;
  match_id: string | null;
  match_type: "invoice" | "expense" | null;
  confidence: number;
  explanation: string;
  amount_diff: number;
  date_diff_days: number;
}

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

    // Rate limit: 20 requests per minute per user
    const rl = checkRateLimit(user.id, "auto-match", 20);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!, corsHeaders);
    }

    // User client - uses the caller's JWT so RLS is enforced
    const supabase = createClient(SUPABASE_URL!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { action, transactionIds, transactionId } = await req.json();

    // Input validation: max batch size of 10
    if (transactionIds && Array.isArray(transactionIds) && transactionIds.length > 10) {
      return new Response(
        JSON.stringify({ error: "Maximum batch size is 10 transactions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Auto-match action: ${action} for user: ${user.id}`);

    if (action === "match_single" && transactionId) {
      // Match a single transaction
      const result = await matchSingleTransaction(supabase, user.id, transactionId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "match_bulk" && transactionIds && Array.isArray(transactionIds)) {
      // Match multiple transactions
      const results = await matchBulkTransactions(supabase, user.id, transactionIds);
      return new Response(JSON.stringify({ results, matched: results.filter(r => r.match_id).length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "match_all_unmatched") {
      // Match all unmatched transactions
      const results = await matchAllUnmatched(supabase, user.id);
      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_suggestions" && transactionId) {
      // Get match suggestions without auto-applying
      const suggestions = await getMatchSuggestions(supabase, user.id, transactionId);
      return new Response(JSON.stringify({ suggestions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in auto-match-transactions:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function matchSingleTransaction(
  supabase: any,
  userId: string,
  transactionId: string
): Promise<MatchResult> {
  // Get the transaction
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .single();

  if (txError || !transaction) {
    throw new Error("Transaction not found");
  }

  // Get candidates based on transaction type
  const candidates = await getCandidates(supabase, userId, transaction);
  
  if (candidates.length === 0) {
    return {
      transaction_id: transactionId,
      match_id: null,
      match_type: null,
      confidence: 0,
      explanation: "No matching invoices or expenses found",
      amount_diff: 0,
      date_diff_days: 0,
    };
  }

  // Use AI to find the best match
  const bestMatch = await findBestMatchWithAI(transaction, candidates);

  if (bestMatch && bestMatch.confidence >= 0.7) {
    // Apply the match
    await applyMatch(supabase, userId, transactionId, bestMatch);
  }

  return bestMatch || {
    transaction_id: transactionId,
    match_id: null,
    match_type: null,
    confidence: 0,
    explanation: "No confident match found",
    amount_diff: 0,
    date_diff_days: 0,
  };
}

async function matchBulkTransactions(
  supabase: any,
  userId: string,
  transactionIds: string[]
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  
  for (const txId of transactionIds) {
    try {
      const result = await matchSingleTransaction(supabase, userId, txId);
      results.push(result);
    } catch (error) {
      console.error(`Error matching transaction ${txId}:`, error);
      results.push({
        transaction_id: txId,
        match_id: null,
        match_type: null,
        confidence: 0,
        explanation: "Error during matching",
        amount_diff: 0,
        date_diff_days: 0,
      });
    }
  }
  
  return results;
}

async function matchAllUnmatched(
  supabase: any,
  userId: string
): Promise<{ results: MatchResult[]; total: number; matched: number }> {
  // Get all unmatched transactions
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("is_reconciled", false)
    .is("invoice_id", null)
    .is("expense_id", null)
    .order("transaction_date", { ascending: false })
    .limit(10); // Process in small batches to limit AI cost per request

  if (error) {
    throw new Error("Failed to fetch unmatched transactions");
  }

  const transactionIds = transactions?.map((t: any) => t.id) || [];
  const results = await matchBulkTransactions(supabase, userId, transactionIds);

  return {
    results,
    total: transactionIds.length,
    matched: results.filter(r => r.match_id).length,
  };
}

async function getMatchSuggestions(
  supabase: any,
  userId: string,
  transactionId: string
): Promise<Array<MatchCandidate & { confidence: number; explanation: string }>> {
  // Get the transaction
  const { data: transaction, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .single();

  if (error || !transaction) {
    throw new Error("Transaction not found");
  }

  const candidates = await getCandidates(supabase, userId, transaction);
  
  if (candidates.length === 0) {
    return [];
  }

  // Score all candidates
  const suggestions = await scoreCandidates(transaction, candidates);
  
  return suggestions
    .filter(s => s.confidence > 0.3)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

async function getCandidates(
  supabase: any,
  userId: string,
  transaction: any
): Promise<MatchCandidate[]> {
  const candidates: MatchCandidate[] = [];
  const txDate = new Date(transaction.transaction_date);
  const dateRangeStart = new Date(txDate);
  const dateRangeEnd = new Date(txDate);
  dateRangeStart.setDate(dateRangeStart.getDate() - 14);
  dateRangeEnd.setDate(dateRangeEnd.getDate() + 7);

  if (transaction.type === "income" || transaction.amount > 0) {
    // Look for unpaid invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, issue_date, due_date, customer_id, customers(name)")
      .eq("user_id", userId)
      .in("status", ["sent", "draft"])
      .is("matched_transaction_id", null)
      .gte("issue_date", dateRangeStart.toISOString().split("T")[0])
      .lte("issue_date", dateRangeEnd.toISOString().split("T")[0]);

    if (invoices) {
      for (const inv of invoices) {
        candidates.push({
          id: inv.id,
          type: "invoice",
          amount: inv.total,
          date: inv.issue_date,
          description: `Invoice ${inv.invoice_number}`,
          customer_or_supplier: inv.customers?.name,
        });
      }
    }
  }

  if (transaction.type === "expense" || transaction.amount < 0) {
    // Look for unmatched expenses
    const { data: expenses } = await supabase
      .from("expenses")
      .select("id, description, total_amount, expense_date, supplier_id, suppliers(name)")
      .eq("user_id", userId)
      .is("matched_transaction_id", null)
      .gte("expense_date", dateRangeStart.toISOString().split("T")[0])
      .lte("expense_date", dateRangeEnd.toISOString().split("T")[0]);

    if (expenses) {
      for (const exp of expenses) {
        candidates.push({
          id: exp.id,
          type: "expense",
          amount: exp.total_amount,
          date: exp.expense_date,
          description: exp.description || "Expense",
          customer_or_supplier: exp.suppliers?.name,
        });
      }
    }
  }

  return candidates;
}

async function findBestMatchWithAI(
  transaction: any,
  candidates: MatchCandidate[]
): Promise<MatchResult | null> {
  if (!OPENROUTER_API_KEY || candidates.length === 0) {
    // Fallback to rule-based matching
    return findBestMatchRuleBased(transaction, candidates);
  }

  try {
    const prompt = `Match this bank transaction to the best candidate.

Transaction:
- Description: ${transaction.description}
- Amount: €${Math.abs(transaction.amount)}
- Date: ${transaction.transaction_date}
- Type: ${transaction.type}

Candidates:
${candidates.map((c, i) => `${i + 1}. ${c.type}: ${c.description} - €${c.amount} on ${c.date}${c.customer_or_supplier ? ` (${c.customer_or_supplier})` : ""}`).join("\n")}

Return JSON with:
{
  "best_match_index": number (1-based) or null if no good match,
  "confidence": 0.0-1.0,
  "explanation": "Why this is the best match or why no match found"
}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: "You are a bookkeeping AI that matches bank transactions to invoices and expenses." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error("AI matching failed, falling back to rules");
      return findBestMatchRuleBased(transaction, candidates);
    }

    const aiResponse = await response.json();
    const result = JSON.parse(aiResponse.choices?.[0]?.message?.content || "{}");

    if (result.best_match_index && result.confidence >= 0.5) {
      const candidate = candidates[result.best_match_index - 1];
      const dateDiff = Math.abs(
        (new Date(transaction.transaction_date).getTime() - new Date(candidate.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      return {
        transaction_id: transaction.id,
        match_id: candidate.id,
        match_type: candidate.type,
        confidence: result.confidence,
        explanation: result.explanation,
        amount_diff: Math.abs(Math.abs(transaction.amount) - candidate.amount),
        date_diff_days: Math.round(dateDiff),
      };
    }

    return null;
  } catch (error) {
    console.error("AI matching error:", error);
    return findBestMatchRuleBased(transaction, candidates);
  }
}

function findBestMatchRuleBased(
  transaction: any,
  candidates: MatchCandidate[]
): MatchResult | null {
  const txAmount = Math.abs(transaction.amount);
  const txDate = new Date(transaction.transaction_date);
  
  let bestMatch: MatchCandidate | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const candidateDate = new Date(candidate.date);
    const amountDiff = Math.abs(txAmount - candidate.amount);
    const dateDiffDays = Math.abs((txDate.getTime() - candidateDate.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate score based on amount similarity (most important) and date proximity
    let score = 0;
    
    // Exact amount match = 0.6 points
    if (amountDiff < 0.01) {
      score += 0.6;
    } else if (amountDiff / txAmount < 0.05) {
      score += 0.4;
    } else if (amountDiff / txAmount < 0.1) {
      score += 0.2;
    }

    // Date proximity = up to 0.4 points
    if (dateDiffDays <= 1) {
      score += 0.4;
    } else if (dateDiffDays <= 3) {
      score += 0.3;
    } else if (dateDiffDays <= 7) {
      score += 0.2;
    } else if (dateDiffDays <= 14) {
      score += 0.1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  if (bestMatch && bestScore >= 0.7) {
    const dateDiff = Math.abs(
      (txDate.getTime() - new Date(bestMatch.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return {
      transaction_id: transaction.id,
      match_id: bestMatch.id,
      match_type: bestMatch.type,
      confidence: bestScore,
      explanation: `Matched by amount (€${bestMatch.amount}) and date proximity (${Math.round(dateDiff)} days)`,
      amount_diff: Math.abs(txAmount - bestMatch.amount),
      date_diff_days: Math.round(dateDiff),
    };
  }

  return null;
}

async function scoreCandidates(
  transaction: any,
  candidates: MatchCandidate[]
): Promise<Array<MatchCandidate & { confidence: number; explanation: string }>> {
  const txAmount = Math.abs(transaction.amount);
  const txDate = new Date(transaction.transaction_date);
  
  return candidates.map(candidate => {
    const candidateDate = new Date(candidate.date);
    const amountDiff = Math.abs(txAmount - candidate.amount);
    const dateDiffDays = Math.abs((txDate.getTime() - candidateDate.getTime()) / (1000 * 60 * 60 * 24));

    let confidence = 0;
    const reasons: string[] = [];
    
    if (amountDiff < 0.01) {
      confidence += 0.5;
      reasons.push("Exact amount match");
    } else if (amountDiff / txAmount < 0.05) {
      confidence += 0.35;
      reasons.push("Amount within 5%");
    } else if (amountDiff / txAmount < 0.1) {
      confidence += 0.2;
      reasons.push("Amount within 10%");
    }

    if (dateDiffDays <= 1) {
      confidence += 0.35;
      reasons.push("Same day");
    } else if (dateDiffDays <= 3) {
      confidence += 0.25;
      reasons.push("Within 3 days");
    } else if (dateDiffDays <= 7) {
      confidence += 0.15;
      reasons.push("Within 1 week");
    }

    // Description similarity bonus
    const descLower = transaction.description.toLowerCase();
    const candDescLower = (candidate.customer_or_supplier || candidate.description).toLowerCase();
    if (descLower.includes(candDescLower) || candDescLower.includes(descLower)) {
      confidence += 0.15;
      reasons.push("Description match");
    }

    return {
      ...candidate,
      confidence: Math.min(confidence, 1),
      explanation: reasons.join(", ") || "Low similarity",
    };
  });
}

async function applyMatch(
  supabase: any,
  userId: string,
  transactionId: string,
  match: MatchResult
): Promise<void> {
  if (!match.match_id || !match.match_type) return;

  // Update transaction
  const updateData: any = {
    is_reconciled: true,
  };

  if (match.match_type === "invoice") {
    updateData.invoice_id = match.match_id;
    
    // Update invoice status to paid
    await supabase
      .from("invoices")
      .update({ status: "paid", matched_transaction_id: transactionId })
      .eq("id", match.match_id)
      .eq("user_id", userId);
  } else {
    updateData.expense_id = match.match_id;
    
    // Update expense status
    await supabase
      .from("expenses")
      .update({ status: "paid", matched_transaction_id: transactionId })
      .eq("id", match.match_id)
      .eq("user_id", userId);
  }

  await supabase
    .from("transactions")
    .update(updateData)
    .eq("id", transactionId)
    .eq("user_id", userId);

  // Log to audit
  await supabase.from("audit_log").insert({
    user_id: userId,
    entity_type: "transaction",
    entity_id: transactionId,
    action: "matched_transaction",
    new_value: { match_id: match.match_id, match_type: match.match_type },
    confidence_score: match.confidence,
    explanation: match.explanation,
  });
}
