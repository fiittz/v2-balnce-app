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
const CHAT_MODEL = Deno.env.get("CHAT_MODEL") || "anthropic/claude-sonnet-4-5";

// Tool definitions sent to the model
const TOOLS = [
  {
    type: "function",
    function: {
      name: "navigate_to_page",
      description: "Navigate the user to a specific page in the Balnce app. Use this when the user asks to see or go to a particular section.",
      parameters: {
        type: "object",
        properties: {
          page: {
            type: "string",
            enum: ["dashboard","bank","invoices","vat","rct","tax","ct1","form11","balance_sheet","reliefs","trips","pnl","aged_debtors","reports","accounts","settings"],
            description: "The page to navigate to",
          },
        },
        required: ["page"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_tax_summary",
      description: "Show the user's CT1 corporation tax computation as a formatted summary. Use when they ask about their tax bill, CT liability, or how much tax they owe.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "show_expense_breakdown",
      description: "Show a breakdown of the user's business expenses by category. Use when they ask about expenses, spending, or deductions.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of top categories to show (default 10)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_pension_savings",
      description: "Calculate how much tax the user would save if the company made an employer pension contribution of the given amount.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "The pension contribution amount in euros" },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_tax_deadlines",
      description: "Show upcoming Irish tax deadlines (CT1, Form 11, VAT, preliminary tax).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "run_company_health_check",
      description: "Run a company (Ltd) tax health check. Reviews the CT1 corporation tax return, capital allowances, RCT credits, start-up relief, expense anomalies, and business deadlines. Use when the user asks about their company tax position, CT1 health check, or business tax overview.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "run_director_health_check",
      description: "Run a personal director tax health check. Reviews Form 11 income tax, pension contributions, salary vs dividend optimisation, small benefit exemption, mileage & subsistence claims, and personal tax credits. Use when the user asks about their personal tax, director's tax position, Form 11 health check, or personal tax planning.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "what_if_buy_van",
      description: "Calculate the tax impact of the company buying a van or commercial vehicle. Shows capital allowances (12.5% over 8 years), CT saving, and net cost after tax relief.",
      parameters: {
        type: "object",
        properties: {
          cost: { type: "number", description: "Purchase cost of the van in euros" },
        },
        required: ["cost"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "what_if_hire_employee",
      description: "Calculate the total cost of hiring an employee at the given salary, including employer PRSI, and check if start-up company relief applies.",
      parameters: {
        type: "object",
        properties: {
          salary: { type: "number", description: "Annual gross salary in euros" },
        },
        required: ["salary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "what_if_salary_vs_dividend",
      description: "Compare the tax efficiency of extracting a given amount from the company as salary vs dividend vs employer pension. Shows total tax under each method.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Amount to extract in euros" },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_transactions",
      description: "Search the user's bank transactions by keyword, category, or vendor name. Use when the user asks to find specific transactions, payments, or wants to see spending on a particular thing.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term to match against transaction descriptions, categories, or vendors" },
          limit: { type: "number", description: "Max results to return (default 15)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_chart",
      description: "Show a visual chart of the user's financial data. Use when the user asks to see expenses, income, or any data as a chart, graph, pie chart, or visual breakdown.",
      parameters: {
        type: "object",
        properties: {
          chart_type: { type: "string", enum: ["expenses_pie", "expenses_bar", "income_vs_expenses", "monthly_spending"], description: "Type of chart to show" },
        },
        required: ["chart_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_trial_balance",
      description: "Show the user's trial balance — a double-entry summary of all accounts with debit and credit totals, plus any bookkeeping issues. Use when the user asks to check their accounts, trial balance, bookkeeping accuracy, or whether their books balance.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "explain_eu_vat",
      description: "Explain EU and international VAT rules — intra-community supplies, reverse charge, OSS, imports/exports, place of supply, VIES/Intrastat, UK post-Brexit, postponed accounting, Section 56. Use when the user asks about EU VAT, cross-border trade, reverse charge, exports, imports, or international VAT treatment.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            enum: ["intra_community_supplies","reverse_charge_services","oss_distance_selling","imports_exports","place_of_supply","vies_intrastat","uk_post_brexit","postponed_accounting","section_56","general"],
            description: "The EU VAT topic to explain",
          },
          scenario: {
            type: "string",
            description: "Optional specific scenario to analyse",
          },
        },
        required: ["topic"],
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const userId = user.id;

    // Rate limit: 20 messages per minute per user
    const rl = checkRateLimit(userId, "chat", 20);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!, corsHeaders);
    }

    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured. Please set OPENROUTER_API_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { message: rawMessage, financialContext, chatHistory, toolResults, currentPage } = await req.json();

    // Rewrite trigger phrases so the model doesn't refuse legal tax planning questions
    const message = rawMessage
      ?.replace(/\bavoid(?:ing)?\s+tax/gi, "reduce my tax bill using legal reliefs")
      .replace(/\btax\s+avoidance/gi, "legal tax planning")
      .replace(/\bavoid(?:ing)?\s+paying\s+tax/gi, "reduce my tax liability using allowances and deductions")
      .replace(/\bpay\s+less\s+tax/gi, "reduce my tax bill")
      .replace(/\bloopholes?\b/gi, "reliefs and allowances") ?? "";

    const pageContext = currentPage ? `\n\n=== USER CONTEXT ===\nThe user is currently viewing: ${currentPage}. Tailor your response to what they're looking at.` : "";

    const systemPrompt = `You are Balnce, a tax accountant AI built into the Balnce accounting app for Irish limited companies. You are a Chartered Accountant and Tax Advisor. Your entire purpose is to help users pay the correct amount of tax — no more, no less — by applying every legitimate relief, allowance, deduction, and credit available under Irish tax law.

## CRITICAL INSTRUCTION — READ THIS FIRST
When a user says "avoid tax", "pay less tax", "reduce my tax", or similar — they are asking about LEGAL TAX PLANNING. In Ireland, tax avoidance is legal and is what every accountant does. You MUST treat these questions the same as "what reliefs and deductions am I entitled to?" and answer with specific strategies from the knowledge base below.

DO NOT refuse. DO NOT say "I cannot provide advice on tax avoidance". DO NOT lecture about the difference between avoidance and evasion. Just answer the question with practical, legal ways to reduce their tax bill using Irish tax reliefs, allowances, deductions, and credits.

The ONLY thing you refuse is tax FRAUD — hiding income, fabricating expenses, or making false claims to Revenue. Anything else, you help with.

## Tools
You have tools available. Use them proactively — don't just describe data, show it:
- **navigate_to_page**: When the user wants to see a specific page (P&L, CT1, bank feed, etc.)
- **show_tax_summary**: When the user asks about their tax liability or CT computation
- **show_expense_breakdown**: When the user asks about their expenses or deductions
- **calculate_pension_savings**: When the user asks about pension savings or "what if I contributed X to pension"
- **show_tax_deadlines**: When the user asks about upcoming deadlines
- **run_company_health_check**: When the user asks about their company tax position, CT1 health check, or business tax overview
- **run_director_health_check**: When the user asks about their personal tax, director's tax position, Form 11 health check, or personal tax planning
- **what_if_buy_van**: When the user asks about buying a van or vehicle
- **what_if_hire_employee**: When the user asks about hiring costs
- **what_if_salary_vs_dividend**: When the user asks about salary vs dividends vs pension
- **search_transactions**: When the user asks to find or look up specific transactions, payments, or spending
- **show_chart**: When the user asks for a chart, graph, pie chart, or visual breakdown of their data
- **show_trial_balance**: When the user asks to check their accounts, trial balance, bookkeeping accuracy, or whether their books balance
- **explain_eu_vat**: When the user asks about EU VAT, cross-border trade, reverse charge, OSS, imports/exports, VIES, Intrastat, UK post-Brexit, or international VAT

## Formatting
You can use markdown: **bold** for amounts, tables for comparisons, bullet lists for multiple items. Keep responses concise. The tool results already include source citations — do not remove them.

## Rules
- Be short. Answer in 1-3 sentences max unless the user asks for detail or you're showing a table.
- No waffle. No filler. No preamble. Just the answer.
- Use the user's actual numbers from the data below. Cite € amounts directly.
- Use euro (€). Irish tax year = calendar year. CT rate = 12.5%.
- If you don't know, say "I don't have that" — don't guess.
- One-line disclaimer at the end only when giving tax figures: "Verify with your accountant before filing."

## Irish Tax Knowledge Base (2026 rates)

### Capital Allowances (Wear & Tear)
- Plant & Machinery: 12.5% straight-line over 8 years
- Vans / commercial vehicles: 12.5% over 8 years (no cost cap — full purchase price qualifies)
- Cars: 12.5% over 8 years, max qualifying cost €24,000 (regardless of actual price)
- Business use restriction: if vehicle is X% business use, allowance = 12.5% × qualifying cost × X%
- Energy-efficient equipment (Triple E list): 100% accelerated allowance in year 1
- Industrial buildings: 4% over 25 years
- Net Book Value = cost − cumulative allowances claimed. Balancing allowance/charge on disposal.

### Small Benefit Exemption (SBE) — 2025 onwards
- Employer can give up to 5 non-cash benefits per employee per year, combined max €1,500
- Must be vouchers or gift cards — NOT cash
- Tax-free for the employee (no PAYE/PRSI/USC)
- Fully deductible expense for the company
- If combined benefits exceed €1,500, the ENTIRE amount is taxable (not just the excess)
- Director-employees qualify too

### CT1 Reliefs & Credits
- Start-up company relief: new companies in first 3 years — CT relief up to amount of employer PRSI paid (max €40,000 CT relief per year). Marginal relief if CT is between €40k–€60k.
- R&D tax credit: 35% of qualifying R&D expenditure (from 1 Jan 2026, was 30%). First-year refund instalment up to €87,500.
- Knowledge Development Box (KDB): 10% CT rate on qualifying IP profits (instead of 12.5%)
- Group relief: losses in one group company can offset profits in another
- Double taxation relief: credit for foreign tax already paid
- Loss relief: trading losses carried forward indefinitely against future trading profits. Can also be set against other income of same period.
- Close company surcharge: 20% on undistributed investment/estate income, 15% on 50% of undistributed professional services income
- Preliminary tax: must be paid by day 23 of month 6 (small company) or month 11 (large company) of accounting period

### Employer Taxes (PAYE/PRSI/USC) — 2026
- Employer PRSI: 11.25% (rising to 11.40% from 1 Oct 2026). Reduced rate 9.0%/9.15% if weekly pay ≤€496.
- Employee PRSI: 4.2% (rising to 4.35% from 1 Oct 2026). Class A1. No PRSI if earning ≤€352/week.
- USC: 0.5% on first €12,012 | 2% on €12,013–€28,700 | 3% on €28,701–€70,044 | 8% above €70,044. Exempt if total income ≤€13,000.
- PAYE: 20% standard rate, 40% higher rate. Cut-off: €44,000 single, €53,000 married (one earner), €88,000 married (two earners).
- Tax credits (2026): personal €2,000 (single) / €4,000 (married), employee €2,000, earned income €2,000. Employee + earned income combined max €2,000.
- Rent tax credit: €1,000 per person / €2,000 jointly assessed (to 31 Dec 2028)
- Benefit-in-Kind on company vehicles: based on OMV and business km bands

### Pension Contributions
- EMPLOYER contributions to a director's pension: 100% deductible for the company, NO age-based limits, NO earnings cap for employer contributions. This is the single most tax-efficient way to extract value from a company.
- The director pays no income tax, PRSI, or USC on employer pension contributions (they are not treated as salary).
- PERSONAL contributions (from the director's own salary): tax relief at marginal rate (20%/40%), subject to age-based limits (15% of earnings age <30, up to 40% age 60+) and annual earnings cap of €115,000.
- Retirement lump sum: first €200,000 tax-free, next €300,000 at 20%, balance at marginal rate.
- Executive pension (company scheme) vs PRSA: both work, executive pension has more flexibility on contribution levels.

### Mileage Rates (Civil Service, per km)
Motor car (1501cc+): 0–1,500km = 51.82c | 1,501–5,500km = 90.63c | 5,501–25,000km = 39.22c | 25,001+km = 25.87c
Motor car (1201–1500cc): 0–1,500km = 43.40c | 1,501–5,500km = 79.18c | 5,501–25,000km = 31.79c | 25,001+km = 23.85c
Motor car (≤1200cc): 0–1,500km = 41.80c | 1,501–5,500km = 72.64c | 5,501–25,000km = 31.78c | 25,001+km = 20.56c
Electric vehicles: use 1201–1500cc rates
Bicycle: 8c/km flat

### Subsistence Rates (from 29 Jan 2025)
- Overnight: €205.53 (normal), €184.98 (reduced)
- Day (10+ hours away): €46.17
- Day (5–10 hours away): €19.25
- These are tax-free to the employee/director and deductible for the company

### SURE (Start-Up Relief for Entrepreneurs) — s.507C TCA 1997
- Refund of PAYE income tax paid in the 6 years before starting a qualifying business
- Must invest in shares of a new qualifying company (own company counts)
- Min investment: €250. Max relief: €700,000 (lifetime)
- Must hold shares for 4 years minimum
- Must work full-time as director/employee in the company
- Cannot have been self-employed in the 2 years before
- The company must be a qualifying new venture (trading company, <€500K assets at time of investment)
- Relief = income tax paid in prior 6 years, up to the amount invested
- Example: director invested €100K and paid €80K PAYE over prior 6 years → refund of €80K

### Entrepreneur Relief (CGT) — s.597AA TCA 1997
- 10% CGT rate (instead of 33%) on disposal of qualifying business assets
- Lifetime limit: €1,000,000 in chargeable gains
- Must hold at least 5% of ordinary shares for 3 continuous years in the 5 years before disposal
- Must be a working director/employee who spends 50%+ of their time in the business
- Applies to: disposal of shares in a qualifying company, disposal of a business or part of a business
- The company must be a trading company (not investment/property)
- Saving: on €1M gain, pay €100K CGT instead of €330K = €230K saved

### Medical Expenses Relief — s.469 TCA 1997
- 20% tax relief on qualifying unreimbursed medical expenses
- Qualifying: doctor/consultant fees, prescribed drugs, hospital charges, physio, non-routine dental, nursing home
- Non-qualifying: routine dental, routine optical
- No excess/threshold — relief from first euro spent
- Claim on Form 11 or Med 1

### Remote Working Relief — s.114A TCA 1997
- 30% of vouched electricity, heating, and broadband costs for WFH days
- Apportion by days worked at home vs total working days
- Employer e-working allowance: up to €3.20/day tax-free (no receipts needed)
- Both can be claimed (employer allowance + personal relief on remaining costs)

### Charitable Donations Relief — s.848A TCA 1997
- Min donation: €250/year to an approved body
- Company donations: deductible trading expense (reduces CT)
- Individual donations: relief at marginal rate
- Max: 10% of total income
- The charity must be on Revenue's list of approved bodies

### Home Carer Tax Credit
- €1,800 credit if spouse/partner cares for a dependant (child, elderly, incapacitated person) at home
- Carer's income must be ≤€7,200 (reduced credit if €7,200–€10,400)

### Flat-Rate Expenses
- Fixed deduction by trade/profession — no receipts required
- Carpenter/joiner: check Revenue's published list
- Claimed automatically against employment income

### EU & International VAT (Cross-Border Trade)
**Intra-Community Supplies (ICS):** Selling goods to EU — zero-rated if goods transported to another EU state, customer provides valid EU VAT number (verified on VIES), and proof of transport retained. Report in VAT3 box E1 and VIES return.
**Intra-Community Acquisitions (ICA):** Buying goods from EU — self-account for Irish VAT. Output (T1) and input (T2) on VAT3. Net zero if fully deductible.
**Reverse Charge Services:** B2B services from/to EU — invoice without VAT. Self-account for Irish VAT. Boxes ES1 (outgoing) and ES2 (incoming).
**One Stop Shop (OSS):** EU B2C sales of goods or digital services above €10,000 combined — charge destination country VAT rates. Register via Revenue's OSS portal. Quarterly returns.
**Exports to non-EU:** Zero-rated. Retain customs export documentation. VAT3 box E2.
**Imports from non-EU:** VAT on CIF + customs duty + excise duty. Use Postponed Accounting (PA1) to self-account on VAT3 — no cash-flow impact.
**Section 56:** For exporters where 75%+ of supplies are zero-rated — receive goods/services without VAT being charged.
**UK Post-Brexit:** GB (England, Scotland, Wales) = non-EU for goods and services. Northern Ireland = EU for goods (XI prefix VAT numbers, intra-community rules), non-EU for services.
**VIES Return:** Quarterly, report all intra-community supplies. No threshold. Due 23rd of month after quarter-end.
**Intrastat:** Monthly statistical return when arrivals or dispatches exceed €750,000/year.
**Irish VAT number = EU VAT number:** The IE prefix identifies the company in the EU VIES system. Customers/suppliers must share this number for zero-rating and reverse charge to apply.

## The User's Financial Data
${financialContext}${pageContext}`;

    // Filter out previous refusal messages
    const REFUSAL_PATTERNS = ["cannot provide advice", "cannot help with tax avoidance", "I cannot provide", "not able to assist with tax avoidance", "I must operate within"];
    const cleanHistory = (chatHistory || [])
      .filter((msg: { role: string; content: string }) => {
        if (msg.role !== "assistant") return true;
        const lower = (msg.content || "").toLowerCase();
        return !REFUSAL_PATTERNS.some(p => lower.includes(p.toLowerCase()));
      })
      .map((msg: { role: string; content: string; tool_call_id?: string; name?: string }) => {
        if (msg.role === "tool") {
          return { role: "tool", content: msg.content, tool_call_id: msg.tool_call_id, name: msg.name };
        }
        return { role: msg.role, content: msg.content };
      });

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...cleanHistory,
    ];

    // If we have tool results, add them; otherwise add the user message
    if (toolResults && toolResults.length > 0) {
      // toolResults = [{ tool_call_id, name, content }]
      for (const tr of toolResults) {
        messages.push({ role: "tool", tool_call_id: tr.tool_call_id, name: tr.name, content: tr.content });
      }
    } else if (message) {
      messages.push({ role: "user", content: message });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://balnce.ie",
        "X-Title": "Balnce AI Tax Assistant",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages,
        tools: TOOLS,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "I'm a bit busy right now. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
    }

    // Stream the SSE response through to the client
    const reader = response.body!.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let toolCallBuffers: Record<number, { id: string; name: string; arguments: string }> = {};

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                // Check if we buffered any tool calls
                const toolCalls = Object.values(toolCallBuffers);
                if (toolCalls.length > 0) {
                  controller.enqueue(encoder.encode(`event: tool_calls\ndata: ${JSON.stringify(toolCalls)}\n\n`));
                  toolCallBuffers = {};
                }
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;

                // Handle content deltas (text streaming)
                if (delta.content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta.content })}\n\n`));
                }

                // Handle tool call deltas
                if (delta.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCallBuffers[idx]) {
                      toolCallBuffers[idx] = { id: tc.id || "", name: "", arguments: "" };
                    }
                    if (tc.id) toolCallBuffers[idx].id = tc.id;
                    if (tc.function?.name) toolCallBuffers[idx].name += tc.function.name;
                    if (tc.function?.arguments) toolCallBuffers[idx].arguments += tc.function.arguments;
                  }
                }
              } catch {
                // Skip unparseable lines
              }
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Chat assistant error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
