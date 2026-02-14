import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { action, periodStart, periodEnd } = await req.json();

    if (action === "calculate") {
      // Calculate VAT for the period
      
      // Get all invoices (VAT on Sales)
      const { data: invoices, error: invError } = await supabase
        .from("invoices")
        .select("*")
        .eq("user_id", user.id)
        .gte("issue_date", periodStart)
        .lte("issue_date", periodEnd)
        .in("status", ["sent", "paid"]);

      if (invError) throw invError;

      // Get all expenses (VAT on Purchases)
      const { data: expenses, error: expError } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .gte("expense_date", periodStart)
        .lte("expense_date", periodEnd)
        .eq("status", "approved");

      if (expError) throw expError;

      // Calculate totals
      const vatOnSales = invoices?.reduce((sum, inv) => sum + Number(inv.vat_amount || 0), 0) || 0;
      
      // Only include VAT recoverable expenses
      const vatOnPurchases = expenses?.reduce((sum, exp) => {
        if (exp.is_vat_recoverable) {
          return sum + Number(exp.vat_amount || 0);
        }
        return sum;
      }, 0) || 0;

      const netVat = vatOnSales - vatOnPurchases;

      // Calculate due date (23rd of month after period ends)
      const endDate = new Date(periodEnd);
      const dueDate = new Date(endDate.getFullYear(), endDate.getMonth() + 2, 23);

      // Create or update VAT return record
      const { data: vatReturn, error: upsertError } = await supabase
        .from("vat_returns")
        .upsert({
          user_id: user.id,
          period_start: periodStart,
          period_end: periodEnd,
          vat_on_sales: vatOnSales,
          vat_on_purchases: vatOnPurchases,
          net_vat: netVat,
          due_date: dueDate.toISOString().split("T")[0],
          status: "draft",
        }, {
          onConflict: "user_id,period_start,period_end",
        })
        .select()
        .single();

      if (upsertError) throw upsertError;

      // Return detailed breakdown
      return new Response(JSON.stringify({
        vatReturn,
        breakdown: {
          invoices: invoices?.length || 0,
          expenses: expenses?.length || 0,
          vatOnSales,
          vatOnPurchases,
          netVat,
          status: netVat >= 0 ? "payable" : "refund",
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "submit") {
      // Mark VAT return as submitted
      const { data: vatReturn, error } = await supabase
        .from("vat_returns")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ vatReturn }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    console.error("Error in process-vat-return:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
