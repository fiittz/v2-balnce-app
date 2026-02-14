import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const AI_MODEL = Deno.env.get("AI_MODEL") || "google/gemini-2.5-flash";

// Known Irish merchants database for smart categorization
const KNOWN_MERCHANTS: Record<string, { 
  name: string; 
  category: string; 
  businessType: string;
  vatRate: string;
  keywords: string[];
}> = {
  // Builders Merchants
  "chadwicks": { name: "Chadwicks", category: "Materials", businessType: "builders_merchant", vatRate: "standard_23", keywords: ["chadwick"] },
  "heiton buckley": { name: "Heiton Buckley", category: "Materials", businessType: "builders_merchant", vatRate: "standard_23", keywords: ["heiton", "buckley"] },
  "woodies": { name: "Woodies", category: "Materials", businessType: "diy_store", vatRate: "standard_23", keywords: ["woodie"] },
  "screwfix": { name: "Screwfix", category: "Tools & Equipment", businessType: "tools_store", vatRate: "standard_23", keywords: ["screwfix"] },
  "toolstation": { name: "Toolstation", category: "Tools & Equipment", businessType: "tools_store", vatRate: "standard_23", keywords: ["toolstation"] },
  "brooks": { name: "Brooks", category: "Materials", businessType: "builders_merchant", vatRate: "standard_23", keywords: ["brooks"] },
  "jewson": { name: "Jewson", category: "Materials", businessType: "builders_merchant", vatRate: "standard_23", keywords: ["jewson"] },
  "travis perkins": { name: "Travis Perkins", category: "Materials", businessType: "builders_merchant", vatRate: "standard_23", keywords: ["travis", "perkins"] },
  "buildbase": { name: "Buildbase", category: "Materials", businessType: "builders_merchant", vatRate: "standard_23", keywords: ["buildbase"] },
  
  // Fuel Stations
  "circle k": { name: "Circle K", category: "Fuel & Transport", businessType: "fuel_station", vatRate: "standard_23", keywords: ["circle", "circlk"] },
  "applegreen": { name: "Applegreen", category: "Fuel & Transport", businessType: "fuel_station", vatRate: "standard_23", keywords: ["applegreen", "apple green"] },
  "topaz": { name: "Topaz", category: "Fuel & Transport", businessType: "fuel_station", vatRate: "standard_23", keywords: ["topaz"] },
  "maxol": { name: "Maxol", category: "Fuel & Transport", businessType: "fuel_station", vatRate: "standard_23", keywords: ["maxol"] },
  "texaco": { name: "Texaco", category: "Fuel & Transport", businessType: "fuel_station", vatRate: "standard_23", keywords: ["texaco"] },
  "esso": { name: "Esso", category: "Fuel & Transport", businessType: "fuel_station", vatRate: "standard_23", keywords: ["esso"] },
  "shell": { name: "Shell", category: "Fuel & Transport", businessType: "fuel_station", vatRate: "standard_23", keywords: ["shell"] },
  "go": { name: "GO", category: "Fuel & Transport", businessType: "fuel_station", vatRate: "standard_23", keywords: ["go fuel", "go station"] },
  
  // Software & Subscriptions
  "adobe": { name: "Adobe", category: "Software & Subscriptions", businessType: "software", vatRate: "standard_23", keywords: ["adobe", "creative cloud"] },
  "microsoft": { name: "Microsoft", category: "Software & Subscriptions", businessType: "software", vatRate: "standard_23", keywords: ["microsoft", "msft", "office 365", "ms office"] },
  "shopify": { name: "Shopify", category: "Software & Subscriptions", businessType: "software", vatRate: "standard_23", keywords: ["shopify"] },
  "xero": { name: "Xero", category: "Software & Subscriptions", businessType: "software", vatRate: "standard_23", keywords: ["xero"] },
  "quickbooks": { name: "QuickBooks", category: "Software & Subscriptions", businessType: "software", vatRate: "standard_23", keywords: ["quickbooks", "intuit"] },
  "dropbox": { name: "Dropbox", category: "Software & Subscriptions", businessType: "software", vatRate: "standard_23", keywords: ["dropbox"] },
  "google": { name: "Google", category: "Software & Subscriptions", businessType: "software", vatRate: "standard_23", keywords: ["google", "gsuite", "workspace"] },
  "amazon web services": { name: "AWS", category: "Software & Subscriptions", businessType: "software", vatRate: "standard_23", keywords: ["aws", "amazon web"] },
  "zoom": { name: "Zoom", category: "Software & Subscriptions", businessType: "software", vatRate: "standard_23", keywords: ["zoom"] },
  "slack": { name: "Slack", category: "Software & Subscriptions", businessType: "software", vatRate: "standard_23", keywords: ["slack"] },
  "canva": { name: "Canva", category: "Software & Subscriptions", businessType: "software", vatRate: "standard_23", keywords: ["canva"] },
  
  // Electrical Suppliers
  "cef": { name: "CEF", category: "Materials", businessType: "electrical_supplier", vatRate: "standard_23", keywords: ["cef", "city electrical"] },
  "kellihers": { name: "Kellihers", category: "Materials", businessType: "electrical_supplier", vatRate: "standard_23", keywords: ["kelliher"] },
  "electric ireland": { name: "Electric Ireland", category: "Utilities", businessType: "utility_provider", vatRate: "reduced_13_5", keywords: ["electric ireland"] },
  
  // Plumbing Suppliers
  "heat merchants": { name: "Heat Merchants", category: "Materials", businessType: "plumbing_supplier", vatRate: "standard_23", keywords: ["heat merchant"] },
  "davies": { name: "Davies", category: "Materials", businessType: "plumbing_supplier", vatRate: "standard_23", keywords: ["davies"] },
  "pipelife": { name: "Pipelife", category: "Materials", businessType: "plumbing_supplier", vatRate: "standard_23", keywords: ["pipelife"] },
  
  // Office Supplies
  "viking": { name: "Viking", category: "Office Supplies", businessType: "office_supplier", vatRate: "standard_23", keywords: ["viking"] },
  "staples": { name: "Staples", category: "Office Supplies", businessType: "office_supplier", vatRate: "standard_23", keywords: ["staples"] },
  "easons": { name: "Easons", category: "Office Supplies", businessType: "stationery", vatRate: "standard_23", keywords: ["easons", "eason"] },
  
  // Telecoms
  "vodafone": { name: "Vodafone", category: "Utilities", businessType: "telecom", vatRate: "standard_23", keywords: ["vodafone"] },
  "eir": { name: "Eir", category: "Utilities", businessType: "telecom", vatRate: "standard_23", keywords: ["eir", "eircom"] },
  "three": { name: "Three", category: "Utilities", businessType: "telecom", vatRate: "standard_23", keywords: ["three ireland", "3 ireland"] },
  
  // Insurance
  "allianz": { name: "Allianz", category: "Insurance", businessType: "insurance", vatRate: "exempt", keywords: ["allianz"] },
  "aviva": { name: "Aviva", category: "Insurance", businessType: "insurance", vatRate: "exempt", keywords: ["aviva"] },
  "axa": { name: "AXA", category: "Insurance", businessType: "insurance", vatRate: "exempt", keywords: ["axa"] },
  "zurich": { name: "Zurich", category: "Insurance", businessType: "insurance", vatRate: "exempt", keywords: ["zurich"] },
  
  // Banks
  "aib": { name: "AIB", category: "Bank Fees", businessType: "bank", vatRate: "exempt", keywords: ["aib", "allied irish"] },
  "bank of ireland": { name: "Bank of Ireland", category: "Bank Fees", businessType: "bank", vatRate: "exempt", keywords: ["bank of ireland", "boi"] },
  "ulster bank": { name: "Ulster Bank", category: "Bank Fees", businessType: "bank", vatRate: "exempt", keywords: ["ulster bank"] },
  "ptsb": { name: "PTSB", category: "Bank Fees", businessType: "bank", vatRate: "exempt", keywords: ["ptsb", "permanent tsb"] },
  "revolut": { name: "Revolut", category: "Bank Fees", businessType: "fintech", vatRate: "exempt", keywords: ["revolut"] },
  "stripe": { name: "Stripe", category: "Bank Fees", businessType: "payment_processor", vatRate: "exempt", keywords: ["stripe"] },
  "paypal": { name: "PayPal", category: "Bank Fees", businessType: "payment_processor", vatRate: "exempt", keywords: ["paypal"] },
  "sumup": { name: "SumUp", category: "Bank Fees", businessType: "payment_processor", vatRate: "exempt", keywords: ["sumup", "sum up"] },
  
  // Vehicle Services
  "nct": { name: "NCT", category: "Vehicle Costs", businessType: "vehicle_testing", vatRate: "exempt", keywords: ["nct", "national car test"] },
  "cvrt": { name: "CVRT", category: "Vehicle Costs", businessType: "vehicle_testing", vatRate: "exempt", keywords: ["cvrt"] },
  "halfords": { name: "Halfords", category: "Vehicle Costs", businessType: "vehicle_parts", vatRate: "standard_23", keywords: ["halfords"] },
};

// Parse description to extract clean merchant name
function extractMerchantName(description: string): { cleanName: string; matchedMerchant: typeof KNOWN_MERCHANTS[string] | null } {
  const desc = description.toLowerCase()
    .replace(/pos\s+/gi, "")
    .replace(/card\s+/gi, "")
    .replace(/debit\s+/gi, "")
    .replace(/credit\s+/gi, "")
    .replace(/payment\s+to\s+/gi, "")
    .replace(/ie$/gi, "")
    .replace(/ireland$/gi, "")
    .replace(/dublin\s*\d*/gi, "")
    .replace(/\d{2}\/\d{2}\/\d{4}/g, "") // Remove dates
    .replace(/[^\w\s]/g, " ")
    .trim();

  // Try to match against known merchants
  for (const [key, merchant] of Object.entries(KNOWN_MERCHANTS)) {
    if (desc.includes(key)) {
      return { cleanName: merchant.name, matchedMerchant: merchant };
    }
    for (const keyword of merchant.keywords) {
      if (desc.includes(keyword)) {
        return { cleanName: merchant.name, matchedMerchant: merchant };
      }
    }
  }

  // Clean up the description for display
  const words = desc.split(/\s+/).filter(w => w.length > 1);
  const cleanName = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  
  return { cleanName: cleanName || description, matchedMerchant: null };
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

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: 60 categorizations per minute per user
    const rl = checkRateLimit(user.id, "categorize", 60);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!, corsHeaders);
    }

    const { transaction, categories, businessType, action, receiptText } = await req.json();

    // Input validation
    if (!transaction || !transaction.description) {
      return new Response(
        JSON.stringify({ error: "transaction with description is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!action || !["categorize", "match", "detect_anomaly"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "action must be one of: categorize, match, detect_anomaly" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "categorize" && categories && !Array.isArray(categories)) {
      return new Response(
        JSON.stringify({ error: "categories must be an array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    console.log("Categorizing transaction for user:", user.id, "Action:", action);

    // Extract merchant info from description
    const { cleanName, matchedMerchant } = extractMerchantName(transaction.description || "");
    console.log("Extracted merchant:", cleanName, "Matched:", matchedMerchant?.name);

    // Build the system prompt based on action type
    let systemPrompt = "";
    let userPrompt = "";

    if (action === "categorize") {
      systemPrompt = `You are the Autocategorisation Engine for Balnce, an Irish bookkeeping and VAT app.
Based on the ICTC Indirect Tax Syllabus 2025 and Irish Revenue Guidelines.

Your job is to automatically categorise bank transactions, expenses and income following Irish VAT law.

## CORE PRINCIPLES
1. Identify the merchant/supplier from the description
2. Determine what the company does (supplier type)
3. Apply DISALLOWED INPUT CREDIT rules (Section 60)
4. Combine with user's industry to infer transaction purpose
5. Assign correct category and VAT treatment
6. Return a confidence score

## IRISH VAT RATES (use exact keys):
- "standard_23" (23%): General goods & services, materials, tools
- "reduced_13_5" (13.5%): Construction labour on dwellings, renovation, repairs, energy, cleaning, photography, hairdressing, veterinary, concrete, some books
- "second_reduced_9" (9%): Newspapers, periodicals, e-books, admission to cultural/sports events, gas & electric (temp rate until 30/04/2025), heat pump installation
- "livestock_4_8" (4.8%): Livestock for food production, some agricultural supplies
- "zero_rated" (0%): Exports, intra-EU B2B, children's clothing/footwear, most basic food, books, medicines, children's nappies, feminine hygiene
- "exempt" (0%): Insurance, financial services, banking, medical/dental/optical, education, childcare, undertaking services

## CRITICAL: DISALLOWED VAT INPUT CREDITS (Section 60 VAT Act)
These categories CANNOT recover VAT:
1. **Food, Drink, Accommodation** (Section 60(2)(a)(i)):
   - ANY food or drink for staff/owner
   - Hotels, B&Bs, Airbnb (EXCEPTION: qualifying conference accommodation)
   - Restaurants, cafes, takeaway
   - Keywords: mcdonalds, subway, starbucks, costa, hotel, airbnb, just eat, deliveroo

2. **Entertainment** (Section 60(2)(a)(iii)):
   - Client entertainment
   - Cinema, theatre, concerts
   - Streaming services (Netflix, Spotify, Disney+)
   - Gaming (PlayStation, Xbox)
   - Toys (Smyths)

3. **Passenger Vehicles** (Section 60(2)(a)(iv)):
   - Purchase, hire, or lease of cars
   - EXCEPTION: Car rental businesses (as stock-in-trade)

4. **PETROL** (Section 60(2)(a)(v)):
   - Petrol is NEVER deductible
   - DIESEL IS ALLOWED - only petrol is blocked
   - At mixed retailers (Maxol, Circle K, Applegreen): need receipt to prove diesel vs petrol

5. **Non-business use**:
   - Personal items (clothing, toys, personal subscriptions)

## ALLOWED VAT CREDITS (Section 59):
- Trade materials and supplies
- DIESEL fuel (not petrol)
- Commercial vehicle repairs/maintenance
- Software subscriptions (business use)
- Professional services (accounting, legal)
- Telecommunications
- Tools and equipment
- Workwear and PPE

## TWO-THIRDS RULE (for repairs):
- Repairs = service at 13.5%
- BUT if parts cost ≥ 2/3 of total charge (excl VAT) → 23% applies to entire supply
- Cost = VAT-exclusive cost to supplier, not charged price

## RCT (Relevant Contracts Tax):
- Applies ONLY to payments TO subcontractors in construction
- Subcontractors do NOT charge VAT to principal contractors
- Principal accounts for VAT via reverse charge
- Rates: 0% (compliant), 20% (standard), 35% (non-compliant)

## EXEMPT vs ZERO-RATED:
- EXEMPT: No VAT charged, NO input credit allowed (insurance, banking, medical)
- ZERO-RATED: Rate is 0%, but CAN claim input credits (exports, children's clothes)

## KNOWN MERCHANT INTELLIGENCE:
${matchedMerchant ? `
MATCHED MERCHANT: ${matchedMerchant.name}
- Business Type: ${matchedMerchant.businessType}
- Typical Category: ${matchedMerchant.category}
- Default VAT: ${matchedMerchant.vatRate}
Use this as guidance but ALWAYS apply Section 60 disallowed rules first.
` : `No known merchant matched. Analyze the description carefully.`}

## USER CONTEXT:
- Industry: ${businessType || "general"}
- This affects interpretation (e.g., Screwfix for builder = Materials (business), for office worker = unusual (personal?))

## CONFIDENCE SCORING:
- 80-100: Auto-accept. Known merchant + clear category + VAT rules clear
- 50-79: Suggestion. Likely correct but user should verify
- 0-49: Needs review. Uncertain - flag for manual check

## CATEGORY LIST (use exact names):
${categories?.map((c: any) => `- "${c.name}" (${c.type}, VAT: ${c.default_vat_rate}, recoverable: ${c.is_vat_recoverable})`).join("\n")}

## OUTPUT FORMAT:
Return ONLY a valid JSON object:
{
  "category_id": "uuid or null",
  "category_name": "exact category name from list",
  "vat_rate": "standard_23|reduced_13_5|second_reduced_9|livestock_4_8|zero_rated|exempt",
  "is_vat_recoverable": true/false (APPLY SECTION 60 RULES),
  "rct_applicable": false (only true for subcontractor payments),
  "rct_rate": null (or 0/20/35 if rct_applicable),
  "confidence": 0-100 integer,
  "business_purpose": "One sentence explaining business use or why personal",
  "merchant_identified": "Clean merchant name",
  "notes": "MUST cite Section 60 if VAT not recoverable"
}`;

      userPrompt = `Categorize this transaction:

DESCRIPTION: ${transaction.description}
AMOUNT: €${Math.abs(transaction.amount).toFixed(2)}
DATE: ${transaction.transaction_date || transaction.date}
DIRECTION: ${transaction.type === "income" ? "Income (money IN)" : "Expense (money OUT)"}
${transaction.merchant ? `MERCHANT FIELD: ${transaction.merchant}` : ""}
${receiptText ? `
RECEIPT TEXT (OCR):
${receiptText}
Use this to confirm or correct category. Receipt details take priority.
` : ""}

EXTRACTED MERCHANT: ${cleanName}
${matchedMerchant ? `KNOWN AS: ${matchedMerchant.name} (${matchedMerchant.businessType})` : "UNKNOWN MERCHANT - analyze description carefully"}

Respond with the JSON object only.`;

    } else if (action === "match") {
      systemPrompt = `You are a transaction matching AI for Balnce bookkeeping. 
Match bank transactions to invoices or expenses based on:
1. Amount (exact or very close match)
2. Date proximity (within 30 days typically)
3. Description/reference similarity
4. Customer/supplier name matching`;

      userPrompt = `Match this bank transaction to the best candidate:

Transaction:
- Description: ${transaction.description}
- Amount: €${Math.abs(transaction.amount).toFixed(2)}
- Date: ${transaction.transaction_date || transaction.date}
- Type: ${transaction.type}

Candidates:
${JSON.stringify(categories, null, 2)}

Respond with ONLY valid JSON:
{
  "match_id": "uuid of best match or null",
  "match_type": "invoice" or "expense",
  "confidence": 0-100,
  "explanation": "Why this is the best match"
}`;

    } else if (action === "detect_anomaly") {
      systemPrompt = `You are a fraud and anomaly detection AI for Balnce bookkeeping.
Detect:
1. Duplicate transactions (same amount, date, description)
2. Unusual amounts (much larger than typical)
3. Suspicious patterns (odd timing, frequency)
4. Potentially personal expenses`;

      userPrompt = `Analyze this transaction for anomalies:

Transaction:
- Description: ${transaction.description}
- Amount: €${Math.abs(transaction.amount).toFixed(2)}
- Date: ${transaction.transaction_date || transaction.date}

Recent similar transactions:
${JSON.stringify(categories, null, 2)}

Respond with ONLY valid JSON:
{
  "is_anomaly": true/false,
  "anomaly_type": "duplicate" | "unusual_amount" | "suspicious_pattern" | "potential_personal" | "none",
  "duplicate_of_id": "uuid if duplicate, else null",
  "confidence": 0-100,
  "explanation": "Description of any concerns"
}`;
    }

    // Call Lovable AI Gateway
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
          { role: "user", content: userPrompt },
        ],
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
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    
    let result;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      result = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Return a safe fallback for categorization
      if (action === "categorize") {
        result = {
          category_id: null,
          category_name: matchedMerchant?.category || "Uncategorized",
          vat_rate: matchedMerchant?.vatRate || "standard_23",
          is_vat_recoverable: true,
          rct_applicable: false,
          rct_rate: null,
          confidence: matchedMerchant ? 60 : 20,
          business_purpose: `Purchase from ${cleanName}`,
          merchant_identified: cleanName,
          notes: "AI response parsing failed. Using merchant database fallback."
        };
      } else {
        throw new Error("Invalid AI response format");
      }
    }

    // Enhance result with extracted merchant info if not present
    if (action === "categorize" && !result.merchant_identified) {
      result.merchant_identified = cleanName;
    }

    // Convert confidence to 0-100 if it's 0-1
    if (result.confidence !== undefined && result.confidence <= 1) {
      result.confidence = Math.round(result.confidence * 100);
    }

    console.log("AI categorization result:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in categorize-transaction:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
