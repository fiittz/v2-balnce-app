import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
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

    // Auth client - only used to verify the JWT
    const authClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // User client - uses the caller's JWT so RLS is enforced
    const supabase = createClient(SUPABASE_URL!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { action, ...params } = await req.json();

    if (action === "calculate_deduction") {
      const { grossAmount, subcontractorId } = params;

      // Get subcontractor's RCT rate
      const { data: subcontractor, error: subError } = await supabase
        .from("subcontractors")
        .select("*")
        .eq("id", subcontractorId)
        .eq("user_id", user.id)
        .single();

      if (subError || !subcontractor) {
        throw new Error("Subcontractor not found");
      }

      const rctRate = subcontractor.rct_rate;
      const rctDeducted = Number((grossAmount * (rctRate / 100)).toFixed(2));
      const netPayable = Number((grossAmount - rctDeducted).toFixed(2));

      return new Response(JSON.stringify({
        grossAmount,
        rctRate,
        rctDeducted,
        netPayable,
        subcontractor: {
          id: subcontractor.id,
          name: subcontractor.name,
          taxReference: subcontractor.tax_reference,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "record_deduction") {
      const { expenseId, subcontractorId, contractId, grossAmount, rctRate, paymentDate } = params;

      // Validate RCT rate is one of the allowed values
      if (![0, 20, 35].includes(rctRate)) {
        return new Response(
          JSON.stringify({ error: "Invalid RCT rate. Must be 0, 20, or 35." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate gross amount is a positive number
      if (typeof grossAmount !== "number" || !isFinite(grossAmount) || grossAmount <= 0) {
        return new Response(
          JSON.stringify({ error: "grossAmount must be a positive number." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const rctDeducted = Number((grossAmount * (rctRate / 100)).toFixed(2));
      const netPayable = Number((grossAmount - rctDeducted).toFixed(2));
      
      const date = new Date(paymentDate);
      const periodMonth = date.getMonth() + 1;
      const periodYear = date.getFullYear();

      // Create RCT deduction record
      const { data: deduction, error: dedError } = await supabase
        .from("rct_deductions")
        .insert({
          user_id: user.id,
          expense_id: expenseId,
          subcontractor_id: subcontractorId,
          contract_id: contractId,
          payment_date: paymentDate,
          gross_amount: grossAmount,
          rct_rate: rctRate,
          rct_deducted: rctDeducted,
          net_payable: netPayable,
          period_month: periodMonth,
          period_year: periodYear,
        })
        .select()
        .single();

      if (dedError) throw dedError;

      // Update expense with RCT info
      if (expenseId) {
        await supabase
          .from("expenses")
          .update({
            rct_applicable: true,
            rct_rate: rctRate,
            rct_amount: rctDeducted,
            subcontractor_id: subcontractorId,
          })
          .eq("id", expenseId)
          .eq("user_id", user.id);
      }

      // Log audit entry
      await supabase.from("audit_log").insert({
        user_id: user.id,
        entity_type: "expense",
        entity_id: expenseId || deduction.id,
        action: "rct_applied",
        new_value: { rct_rate: rctRate, rct_deducted: rctDeducted },
        explanation: `RCT deduction of €${rctDeducted} (${rctRate}%) applied`,
      });

      return new Response(JSON.stringify({ deduction }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_monthly_summary") {
      const { month, year } = params;

      // Get all deductions for the period
      const { data: deductions, error: dedError } = await supabase
        .from("rct_deductions")
        .select(`
          *,
          subcontractor:subcontractors(name, tax_reference)
        `)
        .eq("user_id", user.id)
        .eq("period_month", month)
        .eq("period_year", year);

      if (dedError) throw dedError;

      // Calculate totals
      const totals = deductions?.reduce((acc, ded) => ({
        grossTotal: acc.grossTotal + Number(ded.gross_amount),
        rctTotal: acc.rctTotal + Number(ded.rct_deducted),
        netTotal: acc.netTotal + Number(ded.net_payable),
        count: acc.count + 1,
      }), { grossTotal: 0, rctTotal: 0, netTotal: 0, count: 0 });

      // Group by subcontractor
      const bySubcontractor = deductions?.reduce((acc: any, ded) => {
        const key = ded.subcontractor_id;
        if (!acc[key]) {
          acc[key] = {
            subcontractor: ded.subcontractor,
            grossTotal: 0,
            rctTotal: 0,
            netTotal: 0,
            deductions: [],
          };
        }
        acc[key].grossTotal += Number(ded.gross_amount);
        acc[key].rctTotal += Number(ded.rct_deducted);
        acc[key].netTotal += Number(ded.net_payable);
        acc[key].deductions.push(ded);
        return acc;
      }, {});

      return new Response(JSON.stringify({
        period: { month, year },
        totals,
        bySubcontractor: Object.values(bySubcontractor || {}),
        deductions,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    console.error("Error in process-rct:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
