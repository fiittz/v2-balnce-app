import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const AI_MODEL = Deno.env.get("AI_MODEL") || "google/gemini-2.5-flash";

interface VendorLookupRequest {
  vendor_name: string;
  amount?: number;
  user_industry?: string;
  user_business_type?: string;
}

interface VendorLookupResult {
  vendor_name: string;
  is_business_expense: boolean | null;
  confidence: number;
  vendor_type: string;
  category_suggestion: string;
  vat_rate_suggestion: string;
  is_vat_recoverable: boolean;
  explanation: string;
  web_research?: string;
}

// Clean up bank transaction descriptions to extract vendor name
function extractVendorName(rawDescription: string): string {
  let cleaned = rawDescription
    .replace(/^(VDP-|VDC-|VDA-|POS |DD |D\/D |STO |BGC |TFR |FPI |FPO |CHQ )/i, "")
    .replace(/\d{6,}/g, "") // Remove long numbers (account refs, card numbers)
    .replace(/\s+\d{2}\/\d{2}\/\d{2,4}/g, "") // Remove dates
    .replace(/\s+[A-Z]{2}\d{2}[A-Z0-9]{10,}/g, "") // Remove IBANs
    .replace(/\s{2,}/g, " ")
    .trim();
  
  // Take first meaningful part (often company name)
  const parts = cleaned.split(/\s+/);
  if (parts.length > 3) {
    cleaned = parts.slice(0, 3).join(" ");
  }
  
  return cleaned;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "No authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Always keep a vendor name around for safe fallbacks in error paths.
  let vendorNameForResponse = "";

  try {
    const { vendor_name, amount, user_industry, user_business_type }: VendorLookupRequest = await req.json();
    vendorNameForResponse = vendor_name || "";

    if (!vendor_name || typeof vendor_name !== "string" || vendor_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "vendor_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (vendor_name.length > 500) {
      return new Response(
        JSON.stringify({ error: "vendor_name must be 500 characters or fewer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      console.error("OPENROUTER_API_KEY not configured");
      // IMPORTANT: Returning a non-2xx status can surface as a runtime error in the UI.
      // Degrade gracefully: return a normal payload that tells the client to skip AI.
      return new Response(
        JSON.stringify({
          vendor_name: vendorNameForResponse,
          is_business_expense: null,
          confidence: 0,
          vendor_type: "AI Not Configured",
          category_suggestion: "General Expenses",
          vat_rate_suggestion: "standard_23",
          is_vat_recoverable: false,
          explanation: "AI service not configured - vendor lookup skipped.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Clean up the vendor name
    const cleanedVendor = extractVendorName(vendor_name);
    console.log(`[VendorLookup] Raw: "${vendor_name}" → Cleaned: "${cleanedVendor}"`);

    // Step 2: Web search to identify the vendor
    let webResearchResult = "";
    try {
      const searchResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { 
              role: "system", 
              content: "You are a research assistant. When given a company/vendor name, search the web to find what the company does, what products/services they sell, and their industry. Be concise." 
            },
            { 
              role: "user", 
              content: `Search the web for information about "${cleanedVendor}" (likely an Irish or UK company). What do they sell or what services do they provide? What industry are they in?` 
            },
          ],
        }),
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        webResearchResult = searchData.choices?.[0]?.message?.content || "";
        console.log(`[VendorLookup] Web research for "${cleanedVendor}":`, webResearchResult.substring(0, 200));
      }
    } catch (searchError) {
      console.error("[VendorLookup] Web search failed:", searchError);
    }

    // Step 3: Analyze vendor with web research context and match to business profile
    const systemPrompt = `You are an expert Irish tax accountant helping categorize bank transactions for SME businesses.
Based on the ICTC Indirect Tax Syllabus 2025 and Irish Revenue Guidelines (VAT Consolidation Act 2010).

Your task is to analyze a vendor/merchant and determine if it's a business expense for THIS SPECIFIC USER.

## THE USER'S BUSINESS PROFILE:
- Industry: ${user_industry || "Unknown"}
- Business Type: ${user_business_type || "Unknown"}

${webResearchResult ? `## WEB RESEARCH ABOUT THIS VENDOR:\n${webResearchResult}\n` : ""}

## CRITICAL: DISALLOWED VAT INPUT CREDITS (Section 60 VAT Act)
These expenses CANNOT recover VAT - set is_vat_recoverable = false:

1. **Food, Drink, Accommodation** (Section 60(2)(a)(i)):
   - ANY food/drink for staff/owner (McDonald's, Starbucks, restaurants, cafes)
   - Hotels, B&Bs, Airbnb (EXCEPTION: qualifying conferences)
   - Supermarkets if buying food
   
2. **Entertainment** (Section 60(2)(a)(iii)):
   - Client entertainment expenses
   - Cinema, theatre, concerts, events
   - Streaming: Netflix, Spotify, Disney+, Amazon Prime
   - Gaming: PlayStation, Xbox, Smyths Toys
   
3. **Passenger Vehicles** (Section 60(2)(a)(iv)):
   - Car purchase, hire, or lease
   - EXCEPTION: Car rental businesses
   
4. **PETROL** (Section 60(2)(a)(v)):
   - Petrol is NEVER deductible
   - DIESEL IS ALLOWED - only petrol blocked
   - Fuel stations (Maxol, Circle K): need receipt to verify diesel vs petrol

## ALLOWED VAT CREDITS (Section 59):
- Trade materials/supplies for business use
- DIESEL fuel (not petrol)
- Commercial vehicle repairs
- Business software subscriptions
- Professional services (accounting, legal)
- Telecommunications
- Tools and equipment
- Workwear and PPE

## IRISH VAT RATES:
- standard_23: 23% (most goods/services, materials, tools)
- reduced_13_5: 13.5% (construction work on dwellings, repairs, energy)
- second_reduced_9: 9% (hospitality, newspapers, e-books)
- livestock_4_8: 4.8% (livestock for food)
- zero_rated: 0% (exports, children's clothes, books, basic food)
- exempt: No VAT (financial services, insurance, banking, medical, education)

## MATCHING LOGIC - Is this vendor relevant to the user's business?
1. Apply Section 60 disallowed rules FIRST
2. Then check if vendor sells products/services the user would use IN THEIR BUSINESS
3. Consider industry match:
   - Carpentry/Construction + trade supplier (Screwfix, Chadwicks) = 95% business
   - Any business + relevant software = likely business
   - Any business + fuel station = partial (diesel OK, petrol blocked)
   
4. Mark as personal if:
   - Entertainment/streaming services
   - Personal shopping (Penneys, Zara, H&M)
   - Toy stores (Smyths)
   - Gaming purchases

RESPONSE: Analyze the vendor and call analyze_vendor with your assessment.`;


    const userPrompt = `Analyze this vendor from a bank statement:

Vendor/Merchant: "${vendor_name}"
Cleaned Name: "${cleanedVendor}"
${amount ? `Amount: €${amount}` : ""}

The user runs a ${user_business_type || "business"} in the ${user_industry || "general"} industry.

Based on the web research and business profile, is this a legitimate business expense for THIS user?`;

    // Retry logic for analysis
    const MAX_RETRIES = 3;
    let response: Response | null = null;
    let lastError = "";

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: AI_MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "analyze_vendor",
                  description: "Return structured vendor analysis for categorization",
                  parameters: {
                    type: "object",
                    properties: {
                      vendor_type: {
                        type: "string",
                        description: "Type of vendor based on web research (e.g., 'Recruitment Platform', 'Insurance Financing', 'Trade Supplier', etc.)"
                      },
                      what_they_sell: {
                        type: "string",
                        description: "Brief description of what this vendor sells/provides based on web research"
                      },
                      is_business_expense: {
                        type: "boolean",
                        description: "true if this is a business expense for THIS user's business type, false if personal, null if uncertain"
                      },
                      confidence: {
                        type: "number",
                        description: "Confidence score 0-100 based on how well this matches the user's business profile"
                      },
                      category_suggestion: {
                        type: "string",
                        description: "Suggested expense category"
                      },
                      vat_rate_suggestion: {
                        type: "string",
                        enum: ["standard_23", "reduced_13_5", "second_reduced_9", "livestock_4_8", "zero_rated", "exempt"]
                      },
                      is_vat_recoverable: {
                        type: "boolean",
                        description: "Whether VAT can be reclaimed on this expense"
                      },
                      explanation: {
                        type: "string",
                        description: "Explanation including: what the vendor does, and why it IS or ISN'T a business expense for this specific user's business"
                      }
                    },
                    required: ["vendor_type", "what_they_sell", "is_business_expense", "confidence", "category_suggestion", "vat_rate_suggestion", "is_vat_recoverable", "explanation"],
                    additionalProperties: false
                  }
                }
              }
            ],
            tool_choice: { type: "function", function: { name: "analyze_vendor" } }
          }),
        });

        if (response.ok) break;

        if (response.status === 429) {
          // IMPORTANT: Returning a non-2xx status can surface as a runtime error in the UI.
          // Degrade gracefully and let the client continue.
          return new Response(
            JSON.stringify({
              vendor_name,
              is_business_expense: null,
              confidence: 0,
              vendor_type: "AI Rate Limited",
              category_suggestion: "General Expenses",
              vat_rate_suggestion: "standard_23",
              is_vat_recoverable: false,
              explanation: "AI rate limit exceeded - vendor lookup skipped. Please wait a minute and try again.",
              web_research: webResearchResult || undefined,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          // IMPORTANT: Returning a non-2xx status can surface as a runtime error in the UI.
          // Degrade gracefully: return a normal payload that tells the client to skip AI.
          return new Response(
            JSON.stringify({
              vendor_name,
              is_business_expense: null,
              confidence: 0,
              vendor_type: "AI Unavailable",
              category_suggestion: "General Expenses",
              vat_rate_suggestion: "standard_23",
              is_vat_recoverable: false,
              explanation: "AI credits exhausted - vendor lookup skipped. Please add AI credits to continue.",
              web_research: webResearchResult || undefined,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (response.status >= 500 && attempt < MAX_RETRIES) {
          lastError = await response.text();
          console.log(`[VendorLookup] Retry ${attempt}/${MAX_RETRIES} for "${vendor_name}" (${response.status})`);
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }

        lastError = await response.text();
        console.error("AI gateway error:", response.status, lastError);
      } catch (fetchError) {
        lastError = fetchError instanceof Error ? fetchError.message : "Fetch failed";
        console.error(`[VendorLookup] Fetch error attempt ${attempt}:`, lastError);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
      }
    }

    if (!response || !response.ok) {
      console.log(`[VendorLookup] Returning fallback for "${vendor_name}" after ${MAX_RETRIES} attempts`);
      return new Response(JSON.stringify({
        vendor_name,
        is_business_expense: null,
        confidence: 0,
        vendor_type: "Unknown",
        category_suggestion: "General Expenses",
        vat_rate_suggestion: "standard_23",
        is_vat_recoverable: false,
        explanation: "Could not analyze vendor - please review manually",
        web_research: webResearchResult || undefined,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "analyze_vendor") {
      console.error("Unexpected AI response format:", data);
      return new Response(
        JSON.stringify({ 
          vendor_name,
          is_business_expense: null,
          confidence: 0,
          vendor_type: "Unknown",
          category_suggestion: "General Expenses",
          vat_rate_suggestion: "standard_23",
          is_vat_recoverable: false,
          explanation: "Could not analyze vendor",
          web_research: webResearchResult || undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    
    const result: VendorLookupResult = {
      vendor_name,
      is_business_expense: analysis.is_business_expense,
      confidence: analysis.confidence,
      vendor_type: analysis.vendor_type,
      category_suggestion: analysis.category_suggestion,
      vat_rate_suggestion: analysis.vat_rate_suggestion,
      is_vat_recoverable: analysis.is_vat_recoverable,
      explanation: analysis.explanation,
      web_research: webResearchResult || undefined,
    };

    console.log(`[VendorLookup] "${vendor_name}" → ${result.vendor_type}, business=${result.is_business_expense}, conf=${result.confidence}%, reason: ${result.explanation.substring(0, 100)}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Vendor lookup error:", error);

    // IMPORTANT: Returning a non-2xx status can surface as a runtime error in the UI.
    // Degrade gracefully: return a normal payload that tells the client to skip AI.
    return new Response(
      JSON.stringify({
        vendor_name: vendorNameForResponse,
        is_business_expense: null,
        confidence: 0,
        vendor_type: "Lookup Failed",
        category_suggestion: "General Expenses",
        vat_rate_suggestion: "standard_23",
        is_vat_recoverable: false,
        explanation: error instanceof Error ? error.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
