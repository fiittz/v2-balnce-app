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

    // User client - uses the caller's JWT so RLS is enforced
    const supabase = createClient(SUPABASE_URL!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Rate limit: 30 receipts per minute per user
    const rl = checkRateLimit(user.id, "receipt", 30);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!, corsHeaders);
    }

    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const { imageBase64, imageUrl, mimeType, categories } = await req.json();

    // Max ~5MB raw file (base64 is ~1.37x the raw size, so 7MB base64 ≈ 5MB raw)
    if (imageBase64 && imageBase64.length > 7_000_000) {
      return new Response(
        JSON.stringify({ error: "Image too large. Maximum size is 5MB." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!imageBase64 && !imageUrl) {
      return new Response(
        JSON.stringify({ error: "Either imageBase64 or imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing receipt for user:", user.id);

    // Build messages for vision model
    const detectedMime = mimeType || "image/jpeg";
    const imageContent = imageBase64
      ? { type: "image_url", image_url: { url: `data:${detectedMime};base64,${imageBase64}` } }
      : { type: "image_url", image_url: { url: imageUrl } };

    const systemPrompt = `You are an expert Irish receipt OCR AI for Balnce bookkeeping. 
Extract structured data from receipt images with high accuracy.

IRISH VAT RATES to identify:
- 23% (standard): General goods & services
- 13.5% (reduced): Construction, energy, repairs
- 9% (hospitality): Restaurants, hotels
- 0% (zero-rated): Exports, certain food
- Exempt: Medical, education, financial

Look for:
- Total amount (required)
- VAT amount and rate (if shown)
- Supplier/merchant name
- Date of purchase
- Invoice/receipt number
- Line items if visible
- Payment method

Available categories for suggestion:
${categories?.map((c: any) => `- ${c.name} (${c.type})`).join("\n") || "Not provided"}`;

    const userPrompt = `Extract all visible information from this receipt image.

Return a JSON object with:
{
  "success": true/false,
  "data": {
    "supplier_name": "string or null",
    "date": "YYYY-MM-DD or null",
    "invoice_number": "string or null",
    "total_amount": number,
    "vat_amount": number or null,
    "vat_rate": "standard_23" | "reduced_13_5" | "second_reduced_9" | "zero_rated" | "exempt" | null,
    "net_amount": number or null,
    "payment_method": "cash" | "card" | "bank_transfer" | null,
    "line_items": [
      { "description": "string", "quantity": number, "unit_price": number, "total": number }
    ],
    "suggested_category": "category name or null",
    "currency": "EUR" | "GBP" | "USD",
    "confidence": 0.0-1.0
  },
  "raw_text": "All text visible on receipt",
  "notes": "Any relevant observations about the receipt quality or missing info"
}`;

    // Call Lovable AI Gateway with vision model
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: [
              { type: "text", text: userPrompt },
              imageContent
            ]
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid AI response format");
    }

    // Log audit entry
    await supabase.from("audit_log").insert({
      user_id: user.id,
      entity_type: "receipt",
      entity_id: crypto.randomUUID(),
      action: "matched_receipt",
      new_value: result.data,
      confidence_score: result.data?.confidence,
      explanation: `Receipt processed: ${result.data?.supplier_name || "Unknown"} - €${result.data?.total_amount || 0}`,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in process-receipt:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
