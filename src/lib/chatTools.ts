/**
 * AI Tool definitions (OpenAI function calling format) and client-side handlers
 * for the Balnce chat assistant.
 */

import type { CT1Data } from "@/hooks/useCT1Data";

// ── Route map ──────────────────────────────────────────────
export const PAGE_ROUTES: Record<string, { path: string; label: string }> = {
  dashboard:      { path: "/dashboard",          label: "Dashboard" },
  bank:           { path: "/bank",               label: "Bank Feed" },
  invoices:       { path: "/invoices",           label: "Invoices" },
  vat:            { path: "/vat",                label: "VAT Centre" },
  rct:            { path: "/rct",                label: "RCT Centre" },
  tax:            { path: "/tax",                label: "Tax Centre" },
  ct1:            { path: "/tax/ct1",            label: "CT1 Corporation Tax Return" },
  form11:         { path: "/tax/form11/1",       label: "Form 11 Income Tax Return" },
  balance_sheet:  { path: "/tax/balance-sheet",  label: "Balance Sheet" },
  reliefs:        { path: "/tax/reliefs",        label: "Relief Scanner" },
  trips:          { path: "/tax/trips",          label: "Trip Claims" },
  pnl:            { path: "/reports/pnl",        label: "Profit & Loss" },
  aged_debtors:   { path: "/reports/aged-debtors", label: "Aged Debtors" },
  reports:        { path: "/reports",            label: "Reports & Exports" },
  accounts:       { path: "/accounts",           label: "Chart of Accounts" },
  settings:       { path: "/settings",           label: "Settings" },
};

// ── Route → label (for page awareness) ─────────────────────
export const ROUTE_LABELS: Record<string, string> = {
  "/dashboard":          "Dashboard",
  "/bank":               "Bank Feed — imported transactions",
  "/invoices":           "Invoices",
  "/vat":                "VAT Centre",
  "/rct":                "RCT Centre",
  "/tax":                "Tax Centre",
  "/tax/ct1":            "CT1 Corporation Tax Return",
  "/tax/balance-sheet":  "Balance Sheet",
  "/tax/reliefs":        "Relief Scanner",
  "/tax/trips":          "Trip Claims Manager",
  "/reports/pnl":        "Profit & Loss Statement",
  "/reports/aged-debtors": "Aged Debtors Report",
  "/reports":            "Reports & Exports",
  "/accounts":           "Chart of Accounts",
  "/settings":           "Settings",
};

export function getPageLabel(pathname: string): string {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  if (pathname.startsWith("/tax/form11/")) {
    const num = pathname.split("/").pop();
    return `Form 11 Income Tax Return — Director ${num}`;
  }
  if (pathname.startsWith("/accounts/")) return "Account Detail";
  return "the app";
}

// ── Tool definitions (sent to OpenRouter) ──────────────────
export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "navigate_to_page",
      description: "Navigate the user to a specific page in the Balnce app. Use this when the user asks to see or go to a particular section.",
      parameters: {
        type: "object",
        properties: {
          page: { type: "string", enum: Object.keys(PAGE_ROUTES), description: "The page to navigate to" },
        },
        required: ["page"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "show_tax_summary",
      description: "Show the user's CT1 corporation tax computation as a formatted summary. Use when they ask about their tax bill, CT liability, or how much tax they owe.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "show_expense_breakdown",
      description: "Show a breakdown of the user's business expenses by category.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of top categories to show (default 10)" },
        },
      },
    },
  },
  {
    type: "function" as const,
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
    type: "function" as const,
    function: {
      name: "show_tax_deadlines",
      description: "Show upcoming Irish tax deadlines (CT1, Form 11, VAT, preliminary tax).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_company_health_check",
      description: "Run a company (Ltd) tax health check. Reviews the CT1 corporation tax return, capital allowances, RCT credits, start-up relief, expense anomalies, and business deadlines. Use when the user asks about their company tax position, CT1 health check, or business tax overview.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_director_health_check",
      description: "Run a personal director tax health check. Reviews Form 11 income tax, pension contributions, salary vs dividend optimisation, small benefit exemption, mileage & subsistence claims, and personal tax credits. Use when the user asks about their personal tax, director's tax position, Form 11 health check, or personal tax planning.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
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
    type: "function" as const,
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
    type: "function" as const,
    function: {
      name: "what_if_salary_vs_dividend",
      description: "Compare the tax efficiency of extracting a given amount from the company as salary vs dividend. Shows total tax paid under each method.",
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
    type: "function" as const,
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
    type: "function" as const,
    function: {
      name: "show_chart",
      description: "Show a visual chart of the user's financial data. Use when the user asks to see expenses, income, or any data as a chart, graph, or visual breakdown.",
      parameters: {
        type: "object",
        properties: {
          chart_type: { type: "string", enum: ["expenses_pie", "expenses_bar", "income_vs_expenses", "monthly_spending"], description: "Type of chart to show" },
        },
        required: ["chart_type"],
      },
    },
  },
];

// ── Euro formatter ─────────────────────────────────────────
const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);

// ── Source citation builder ────────────────────────────────
function buildSources(ctx: ToolContext, extras?: string[]): string {
  const parts: string[] = [];
  if (ctx.transactionCount > 0) parts.push(`${ctx.transactionCount} bank transactions`);
  if (ctx.invoiceCount > 0) parts.push(`${ctx.invoiceCount} invoices`);
  if (ctx.savedCT1) parts.push("CT1 questionnaire");
  if (ctx.directorData) parts.push("director onboarding data");
  if (extras) parts.push(...extras);
  return parts.length > 0
    ? `\n\n---\n*Sources: ${parts.join(", ")}. All figures computed from your private financial data.*`
    : "";
}

// ── Client-side tool execution ─────────────────────────────
export interface ToolContext {
  ct1: CT1Data;
  savedCT1: Record<string, any> | null;
  taxYear: number;
  navigate: (path: string) => void;
  directorData: Record<string, any> | null;
  transactionCount: number;
  invoiceCount: number;
  transactions: Record<string, any>[];
  invoices: Record<string, any>[];
  incorporationDate?: string | null;
  allForm11Data: { directorNumber: number; data: Record<string, any> }[];
}

// ── Helper: CT1 numbers (reused by multiple tools) ─────────
function computeCT1(ctx: ToolContext) {
  const { ct1, savedCT1 } = ctx;
  const totalIncome = ct1.detectedIncome.reduce((s, i) => s + i.amount, 0);
  const motorVehicleAllowance = ct1.vehicleAsset
    ? ct1.vehicleAsset.depreciation.annualAllowance
    : (savedCT1?.capitalAllowancesMotorVehicles ?? 0);
  const capitalAllowancesTotal = (savedCT1?.capitalAllowancesPlant ?? 0) + motorVehicleAllowance;
  const expensesBase = ct1.expenseSummary.allowable + capitalAllowancesTotal + ct1.directorsLoanTravel;
  const tradingProfit = Math.max(0, totalIncome - expensesBase);
  const lossesForward = savedCT1?.lossesForward ?? 0;
  const taxableProfit = Math.max(0, tradingProfit - lossesForward);
  const ctAt125 = taxableProfit * 0.125;
  const surcharge = savedCT1?.closeCompanySurcharge ?? 0;
  const totalCT = ctAt125 + surcharge;
  const prelimPaid = savedCT1?.preliminaryCTPaid ?? 0;
  const rctCredit = ct1.rctPrepayment;
  const balanceDue = totalCT - prelimPaid - rctCredit;
  return {
    totalIncome, motorVehicleAllowance, capitalAllowancesTotal,
    expensesBase, tradingProfit, lossesForward, taxableProfit,
    ctAt125, surcharge, totalCT, prelimPaid, rctCredit, balanceDue,
  };
}

export function executeToolCall(
  name: string,
  args: Record<string, any>,
  ctx: ToolContext
): { result: string; navigated?: boolean } {
  switch (name) {
    // ── Navigate ──────────────────────────────────────────
    case "navigate_to_page": {
      const page = args.page as string;
      const route = PAGE_ROUTES[page];
      if (!route) return { result: `Unknown page: ${page}` };
      ctx.navigate(route.path);
      return { result: `Navigated to ${route.label}.`, navigated: true };
    }

    // ── Tax Summary ───────────────────────────────────────
    case "show_tax_summary": {
      const n = computeCT1(ctx);
      const { ct1 } = ctx;
      const lines = [
        `| Line | Amount |`,
        `|------|--------|`,
        `| Total Income | ${eur(n.totalIncome)} |`,
        `| Less: Allowable Expenses | ${eur(ct1.expenseSummary.allowable)} |`,
      ];
      if (ct1.directorsLoanTravel > 0) lines.push(`| Less: Travel & Accommodation | ${eur(ct1.directorsLoanTravel)} |`);
      if (n.capitalAllowancesTotal > 0) lines.push(`| Less: Capital Allowances | ${eur(n.capitalAllowancesTotal)} |`);
      lines.push(`| **Trading Profit** | **${eur(n.tradingProfit)}** |`);
      if (n.lossesForward > 0) lines.push(`| Less: Losses Forward | ${eur(n.lossesForward)} |`);
      lines.push(`| **Taxable Profit** | **${eur(n.taxableProfit)}** |`);
      lines.push(`| CT @ 12.5% | ${eur(n.ctAt125)} |`);
      if (n.surcharge > 0) lines.push(`| Close Company Surcharge | ${eur(n.surcharge)} |`);
      lines.push(`| **Total CT Liability** | **${eur(n.totalCT)}** |`);
      if (n.rctCredit > 0) lines.push(`| Less: RCT Credit | ${eur(n.rctCredit)} |`);
      if (n.prelimPaid > 0) lines.push(`| Less: Preliminary CT Paid | ${eur(n.prelimPaid)} |`);
      lines.push(`| **${n.balanceDue <= 0 ? "Refund Due" : "Balance Due"}** | **${eur(Math.abs(n.balanceDue))}** |`);
      lines.push(buildSources(ctx));
      return { result: lines.join("\n") };
    }

    // ── Expense Breakdown ─────────────────────────────────
    case "show_expense_breakdown": {
      const limit = (args.limit as number) || 10;
      const sorted = [...ctx.ct1.expenseByCategory].sort((a, b) => b.amount - a.amount).slice(0, limit);
      const total = ctx.ct1.expenseByCategory.reduce((s, e) => s + e.amount, 0);
      const lines = [
        `| Category | Amount | % |`,
        `|----------|--------|---|`,
        ...sorted.map(e => `| ${e.category} | ${eur(e.amount)} | ${total > 0 ? ((e.amount / total) * 100).toFixed(1) : 0}% |`),
        `| **Total** | **${eur(total)}** | **100%** |`,
        buildSources(ctx),
      ];
      return { result: lines.join("\n") };
    }

    // ── Pension Savings ───────────────────────────────────
    case "calculate_pension_savings": {
      const amount = (args.amount as number) || 0;
      const n = computeCT1(ctx);
      const lf = ctx.savedCT1?.lossesForward ?? 0;

      const profitBefore = n.tradingProfit;
      const taxableBefore = Math.max(0, profitBefore - lf);
      const ctBefore = taxableBefore * 0.125;

      const profitAfter = Math.max(0, n.totalIncome - n.expensesBase - amount);
      const taxableAfter = Math.max(0, profitAfter - lf);
      const ctAfter = taxableAfter * 0.125;

      const ctSaving = ctBefore - ctAfter;
      const personalMarginalRate = 0.492;
      const personalSaving = amount * personalMarginalRate;

      const lines = [
        `**Employer pension contribution: ${eur(amount)}**`,
        ``,
        `| | Before | After | Saving |`,
        `|--|--------|-------|--------|`,
        `| Company Trading Profit | ${eur(profitBefore)} | ${eur(profitAfter)} | ${eur(profitBefore - profitAfter)} |`,
        `| Corporation Tax (12.5%) | ${eur(ctBefore)} | ${eur(ctAfter)} | **${eur(ctSaving)}** |`,
        ``,
        `**Director personal tax avoided** (not treated as salary):`,
        `- No PAYE/PRSI/USC on ${eur(amount)} = **~${eur(personalSaving)} saved**`,
        ``,
        `**Combined tax saving: ~${eur(ctSaving + personalSaving)}**`,
        ``,
        `The ${eur(amount)} goes directly into the director's pension fund, tax-free. No age-based limit on employer contributions.`,
        buildSources(ctx, ["Irish Revenue pension rules"]),
      ];
      return { result: lines.join("\n") };
    }

    // ── Tax Deadlines ─────────────────────────────────────
    case "show_tax_deadlines": {
      const year = ctx.taxYear;
      const today = new Date();
      const deadlines = [
        { name: "CT1 preliminary tax (small co.)", date: new Date(year + 1, 5, 23), desc: "Month 6 of accounting period" },
        { name: "CT1 preliminary tax (large co.)", date: new Date(year, 10, 23), desc: "Month 11 of accounting period" },
        { name: "CT1 filing deadline", date: new Date(year + 1, 8, 23), desc: "9 months after year-end" },
        { name: "Form 11 preliminary tax", date: new Date(year, 9, 31), desc: "Pay & file for current year" },
        { name: "Form 11 filing deadline", date: new Date(year + 1, 9, 31), desc: "(mid-Nov if ROS)" },
        { name: "VAT3 returns", date: null, desc: "Bi-monthly — 19th of month following period" },
        { name: "RCT returns", date: null, desc: "Monthly — 23rd of following month" },
      ];
      const lines = [
        `| Deadline | Date | Status | Description |`,
        `|----------|------|--------|-------------|`,
      ];
      for (const d of deadlines) {
        const dateStr = d.date ? d.date.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" }) : "Recurring";
        let status = "";
        if (d.date) {
          const daysLeft = Math.ceil((d.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (daysLeft < 0) status = "**OVERDUE**";
          else if (daysLeft <= 30) status = `**${daysLeft}d left**`;
          else if (daysLeft <= 90) status = `${daysLeft}d left`;
          else status = "OK";
        } else {
          status = "Ongoing";
        }
        lines.push(`| ${d.name} | ${dateStr} | ${status} | ${d.desc} |`);
      }
      return { result: lines.join("\n") };
    }

    // ── COMPANY HEALTH CHECK (Ltd / CT1) ──────────────────
    case "run_company_health_check": {
      const n = computeCT1(ctx);
      const { ct1 } = ctx;
      let score = 100;
      const issues: string[] = [];
      const wins: string[] = [];

      // --- CT1 Summary ---
      const ctSummary = [
        `## CT1 Summary (${ctx.taxYear})`,
        `| | Amount |`,
        `|--|--------|`,
        `| Income | ${eur(n.totalIncome)} |`,
        `| Expenses | ${eur(ct1.expenseSummary.allowable)} |`,
        `| Trading Profit | ${eur(n.tradingProfit)} |`,
        `| **CT Liability** | **${eur(n.totalCT)}** |`,
        `| **${n.balanceDue <= 0 ? "Refund Due" : "Balance Due"}** | **${eur(Math.abs(n.balanceDue))}** |`,
      ];

      // --- Company-level reliefs ---
      const reliefs: string[] = [];
      let potentialSavings = 0;

      // Start-up relief
      if (ctx.incorporationDate) {
        const incorpYear = new Date(ctx.incorporationDate).getFullYear();
        const yearsTrading = ctx.taxYear - incorpYear;
        if (yearsTrading <= 3 && n.totalCT > 0) {
          const saving = Math.min(n.totalCT, 40000);
          potentialSavings += saving;
          reliefs.push(`| Start-up Relief (s.486C) | Year ${yearsTrading} of 3 | Up to ${eur(saving)} | Check eligibility |`);
          wins.push(`Start-up relief available (year ${yearsTrading})`);
        }
      }

      // Capital allowances
      if (n.capitalAllowancesTotal > 0) {
        wins.push(`Capital allowances claimed: ${eur(n.capitalAllowancesTotal)}`);
      } else if (ct1.flaggedCapitalItems.length > 0) {
        const flaggedTotal = ct1.flaggedCapitalItems.reduce((s, i) => s + i.amount, 0);
        const saving = flaggedTotal * 0.125 * 0.125;
        potentialSavings += saving;
        reliefs.push(`| Capital Allowances | ${ct1.flaggedCapitalItems.length} flagged items (${eur(flaggedTotal)}) | ~${eur(saving)}/yr | Review items |`);
        score -= 5;
        issues.push("Capital items flagged but no allowances claimed — review for plant & machinery write-down");
      }

      // Employer pension as CT deduction
      const anyPension = ctx.allForm11Data?.some(f => Number(f.data?.pensionContributions) > 0);
      if (!anyPension && n.tradingProfit > 10000) {
        const pensionSuggestion = Math.min(n.tradingProfit * 0.3, 50000);
        const ctSaving = pensionSuggestion * 0.125;
        potentialSavings += ctSaving;
        reliefs.push(`| Employer Pension (CT deduction) | ${eur(pensionSuggestion)} contribution | ~${eur(ctSaving)} CT saved | Not claimed |`);
        score -= 10;
        issues.push("No employer pension contributions — reduces taxable trading profit");
      } else if (anyPension) {
        wins.push("Employer pension contributions reducing trading profit");
      }

      // RCT credit
      if (ct1.rctPrepayment > 0) {
        wins.push(`RCT credit offsetting CT: ${eur(ct1.rctPrepayment)}`);
      }

      // --- Anomalies ---
      const anomalies: string[] = [];
      const txs = ctx.transactions || [];

      // Uncategorized
      const uncategorized = txs.filter((t: any) => !t.category || t.category === "Uncategorized");
      if (uncategorized.length > 0) {
        score -= Math.min(20, uncategorized.length);
        anomalies.push(`| Uncategorized Transactions | ${uncategorized.length} | May contain deductible expenses |`);
        issues.push(`${uncategorized.length} uncategorized transactions — categorise to maximise deductions`);
      }

      // Duplicate payments (same amount, same description, within 7 days)
      const expenseTxs = txs.filter((t: any) => t.type === "expense");
      const dupes: string[] = [];
      for (let i = 0; i < expenseTxs.length && dupes.length < 3; i++) {
        for (let j = i + 1; j < expenseTxs.length && dupes.length < 3; j++) {
          const a = expenseTxs[i] as any;
          const b = expenseTxs[j] as any;
          if (
            a.amount === b.amount &&
            Math.abs(a.amount) >= 100 &&
            a.description === b.description &&
            a.date && b.date &&
            Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) < 7 * 24 * 60 * 60 * 1000
          ) {
            dupes.push(`${a.description} (${eur(Math.abs(a.amount))} on ${a.date} & ${b.date})`);
          }
        }
      }
      if (dupes.length > 0) {
        score -= 5;
        anomalies.push(`| Possible Duplicates | ${dupes.length} | ${dupes[0]} |`);
        issues.push(`${dupes.length} possible duplicate payment(s)`);
      }

      // Large single expenses (>€5000)
      const largeExpenses = expenseTxs.filter((t: any) => Math.abs(t.amount) >= 5000);
      if (largeExpenses.length > 0) {
        anomalies.push(`| Large Expenses (>€5k) | ${largeExpenses.length} | Review for capitalisation (capital allowances) |`);
      }

      // Disallowed expenses ratio
      if (ct1.expenseSummary.disallowed > 0) {
        const ratio = ct1.expenseSummary.disallowed / (ct1.expenseSummary.allowable + ct1.expenseSummary.disallowed) * 100;
        if (ratio > 10) {
          score -= 5;
          anomalies.push(`| High Disallowed Rate | ${ratio.toFixed(1)}% | ${eur(ct1.expenseSummary.disallowed)} non-deductible |`);
          issues.push(`${ratio.toFixed(1)}% of expenses are disallowed for CT purposes`);
        }
      }

      // --- Deadlines (company only) ---
      const today = new Date();
      const upcomingDeadlines: string[] = [];
      const dList = [
        { name: "CT1 filing deadline", date: new Date(ctx.taxYear + 1, 8, 23) },
        { name: "CT1 preliminary tax (small co.)", date: new Date(ctx.taxYear + 1, 5, 23) },
        { name: "VAT3 return", date: null as Date | null, desc: "Bi-monthly — 19th of month following period" },
        { name: "RCT return", date: null as Date | null, desc: "Monthly — 23rd of following month" },
      ];
      for (const d of dList) {
        if (d.date) {
          const daysLeft = Math.ceil((d.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (daysLeft > 0 && daysLeft <= 120) {
            upcomingDeadlines.push(`- **${d.name}**: ${d.date.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })} (${daysLeft} days)`);
            if (daysLeft <= 30) { score -= 10; issues.push(`${d.name} due in ${daysLeft} days`); }
          }
        } else {
          upcomingDeadlines.push(`- **${d.name}**: ${d.desc}`);
        }
      }

      // --- Score ---
      score = Math.max(0, Math.min(100, score));
      let grade = "A+";
      if (score < 90) grade = "A";
      if (score < 80) grade = "B";
      if (score < 70) grade = "C";
      if (score < 60) grade = "D";
      if (score < 50) grade = "F";

      // --- Build report ---
      const report: string[] = [
        `# Company Health Check — ${ctx.taxYear}`,
        `*Corporation Tax (CT1) & Business Review*`,
        ``,
        `## Score: ${score}/100 (${grade})`,
        ``,
        ...ctSummary,
        ``,
      ];

      if (wins.length > 0) {
        report.push(`## What the Company Is Doing Right`);
        wins.forEach(w => report.push(`- ${w}`));
        report.push(``);
      }

      if (reliefs.length > 0) {
        report.push(`## Company Tax Reliefs & Opportunities`);
        report.push(`| Relief | Detail | Est. CT Saving | Status |`);
        report.push(`|--------|--------|----------------|--------|`);
        report.push(...reliefs);
        report.push(``);
        if (potentialSavings > 0) {
          report.push(`**Total potential company tax savings: ~${eur(potentialSavings)}**`);
          report.push(``);
        }
      }

      if (anomalies.length > 0) {
        report.push(`## Anomalies & Red Flags`);
        report.push(`| Issue | Count | Detail |`);
        report.push(`|-------|-------|--------|`);
        report.push(...anomalies);
        report.push(``);
      }

      if (upcomingDeadlines.length > 0) {
        report.push(`## Company Deadlines`);
        report.push(...upcomingDeadlines);
        report.push(``);
      }

      if (issues.length > 0) {
        report.push(`## Action Items (Ltd)`);
        issues.forEach((issue, i) => report.push(`${i + 1}. ${issue}`));
        report.push(``);
      }

      report.push(`> *Tip: Run a **Director Health Check** for personal tax advice (Form 11, pension, salary vs dividend).*`);
      report.push(buildSources(ctx, ["TCA 1997", "Revenue.ie Corporation Tax rates 2026"]));

      return { result: report.join("\n") };
    }

    // ── DIRECTOR HEALTH CHECK (Personal / Form 11) ─────────
    case "run_director_health_check": {
      const n = computeCT1(ctx);
      const { ct1 } = ctx;
      let score = 100;
      const issues: string[] = [];
      const wins: string[] = [];

      // --- Director info ---
      const directorSalary = Number(ctx.directorData?.salary || ctx.directorData?.annual_salary || 0);
      const directorName = ctx.directorData?.name || ctx.directorData?.full_name || "Director";

      // --- Salary setup ---
      const salarySummary: string[] = [];
      if (directorSalary > 0) {
        const employerPRSI = directorSalary <= 496 * 52 ? directorSalary * 0.09 : directorSalary * 0.1125;
        const paye = Math.min(directorSalary, 44000) * 0.20 + Math.max(0, directorSalary - 44000) * 0.40;
        const empPRSI = directorSalary > 352 * 52 ? directorSalary * 0.042 : 0;
        const usc = Math.min(directorSalary, 12012) * 0.005 + Math.min(Math.max(0, directorSalary - 12012), 16688) * 0.02 + Math.min(Math.max(0, directorSalary - 28700), 41344) * 0.03 + Math.max(0, directorSalary - 70044) * 0.08;
        const credits = 4000; // personal + employee
        const netPay = directorSalary - paye - empPRSI - usc + credits;

        salarySummary.push(
          `## Director Salary & Tax`,
          `| | Amount |`,
          `|--|--------|`,
          `| Gross Salary | ${eur(directorSalary)} |`,
          `| PAYE | ${eur(paye)} |`,
          `| Employee PRSI | ${eur(empPRSI)} |`,
          `| USC | ${eur(usc)} |`,
          `| Tax Credits | −${eur(credits)} |`,
          `| **Net Pay** | **${eur(Math.max(0, netPay))}** |`,
          `| Employer PRSI (company cost) | ${eur(employerPRSI)} |`,
          ``,
        );
        wins.push(`Director salary set at ${eur(directorSalary)}`);
      } else {
        score -= 10;
        issues.push("No director salary set — you may be missing personal tax credits (€4,000+)");
        salarySummary.push(
          `## Director Salary`,
          `No salary recorded. Consider setting a salary to utilise your personal tax credits (${eur(4000)}).`,
          ``,
        );
      }

      // --- Pension ---
      const reliefs: string[] = [];
      let potentialSavings = 0;

      const anyPension = ctx.allForm11Data?.some(f => Number(f.data?.pensionContributions) > 0);
      if (!anyPension && n.tradingProfit > 10000) {
        const pensionSuggestion = Math.min(n.tradingProfit * 0.3, 50000);
        const personalSaving = pensionSuggestion * 0.492;
        const ctSaving = pensionSuggestion * 0.125;
        potentialSavings += personalSaving + ctSaving;
        reliefs.push(`| Employer Pension | ${eur(pensionSuggestion)} contribution | ~${eur(personalSaving)} personal tax + ~${eur(ctSaving)} CT | Not claimed |`);
        score -= 15;
        issues.push("No pension contributions — biggest personal tax-saving opportunity. The company pays into your pension, you avoid PAYE/PRSI/USC on the full amount");
      } else if (anyPension) {
        const pensionAmt = ctx.allForm11Data?.reduce((s, f) => s + Number(f.data?.pensionContributions || 0), 0) ?? 0;
        wins.push(`Pension contributions active: ${eur(pensionAmt)}`);
      }

      // --- Small Benefit Exemption ---
      if (directorSalary > 0) {
        const sbeSaving = 1500 * 0.492;
        potentialSavings += sbeSaving;
        reliefs.push(`| Small Benefit Exemption | 5 vouchers × €300/yr | ~${eur(sbeSaving)} | Easy to claim |`);
        issues.push("Consider Small Benefit Exemption — up to €1,500/yr in tax-free vouchers (5 × €300)");
      }

      // --- Salary vs Dividend optimisation ---
      if (directorSalary > 0 && n.tradingProfit > directorSalary) {
        const surplus = n.tradingProfit - directorSalary;
        if (surplus > 5000) {
          // Quick comparison
          const divTax = surplus * 0.125 + (surplus * 0.875) * 0.492; // CT + personal
          const salTax = surplus * 0.492 + surplus * 0.1125; // PAYE+PRSI+USC + employer PRSI
          const pensionTax = 0;
          const bestMethod = pensionTax < salTax && pensionTax < divTax ? "pension" : salTax < divTax ? "salary" : "dividend";
          reliefs.push(`| Salary vs Dividend | ${eur(surplus)} surplus profit | Salary: ~${eur(salTax)} tax, Dividend: ~${eur(divTax)} tax | ${bestMethod === "pension" ? "**Pension best**" : bestMethod === "salary" ? "Salary more efficient" : "Dividend more efficient"} |`);
        }
      }

      // --- Travel & Mileage ---
      if (ct1.directorsLoanTravel > 0) {
        wins.push(`Mileage & subsistence claims: ${eur(ct1.travelAllowance)} (tax-free)`);
      } else {
        const commuteKm = Number(ctx.directorData?.commute_distance_km || 0);
        if (commuteKm > 0) {
          const annualMileage = commuteKm * 2 * 220; // return trip × working days
          const mileageRate = 0.4107; // civil service rate
          const potentialClaim = annualMileage * mileageRate;
          score -= 5;
          issues.push(`You commute ${commuteKm}km each way but have no mileage claims. Potential tax-free reimbursement: ~${eur(potentialClaim)}/yr`);
          reliefs.push(`| Mileage Allowance | ${commuteKm}km commute × 220 days | ~${eur(potentialClaim)}/yr tax-free | Not claimed |`);
          potentialSavings += potentialClaim;
        }
      }

      // --- Form 11 director data checks ---
      for (const f of (ctx.allForm11Data || [])) {
        const data = f.data || {};
        // Check for rental income
        if (Number(data.rentalIncome) > 0) {
          wins.push(`Rental income declared: ${eur(Number(data.rentalIncome))}`);
        }
        // Check for medical expenses
        if (Number(data.medicalExpenses) > 0) {
          wins.push(`Medical expenses claimed: ${eur(Number(data.medicalExpenses))} (20% relief)`);
        }
      }

      // --- Deadlines (personal) ---
      const today = new Date();
      const upcomingDeadlines: string[] = [];
      const dList = [
        { name: "Form 11 filing deadline", date: new Date(ctx.taxYear + 1, 9, 31) },
        { name: "Form 11 preliminary tax", date: new Date(ctx.taxYear, 9, 31) },
      ];
      for (const d of dList) {
        const daysLeft = Math.ceil((d.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0 && daysLeft <= 120) {
          upcomingDeadlines.push(`- **${d.name}**: ${d.date.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })} (${daysLeft} days)`);
          if (daysLeft <= 30) { score -= 10; issues.push(`${d.name} due in ${daysLeft} days`); }
        }
      }

      // --- Score ---
      score = Math.max(0, Math.min(100, score));
      let grade = "A+";
      if (score < 90) grade = "A";
      if (score < 80) grade = "B";
      if (score < 70) grade = "C";
      if (score < 60) grade = "D";
      if (score < 50) grade = "F";

      // --- Build report ---
      const report: string[] = [
        `# Director Health Check — ${ctx.taxYear}`,
        `*Personal Tax (Form 11) Review for ${directorName}*`,
        ``,
        `## Score: ${score}/100 (${grade})`,
        ``,
        ...salarySummary,
      ];

      if (wins.length > 0) {
        report.push(`## What You're Doing Right`);
        wins.forEach(w => report.push(`- ${w}`));
        report.push(``);
      }

      if (reliefs.length > 0) {
        report.push(`## Personal Tax Opportunities`);
        report.push(`| Opportunity | Detail | Est. Saving | Status |`);
        report.push(`|-------------|--------|-------------|--------|`);
        report.push(...reliefs);
        report.push(``);
        if (potentialSavings > 0) {
          report.push(`**Total potential personal savings: ~${eur(potentialSavings)}**`);
          report.push(``);
        }
      }

      if (upcomingDeadlines.length > 0) {
        report.push(`## Personal Tax Deadlines`);
        report.push(...upcomingDeadlines);
        report.push(``);
      }

      if (issues.length > 0) {
        report.push(`## Action Items (Personal)`);
        issues.forEach((issue, i) => report.push(`${i + 1}. ${issue}`));
        report.push(``);
      }

      report.push(`> *Tip: Run a **Company Health Check** for CT1, capital allowances, and business tax advice.*`);
      report.push(buildSources(ctx, ["TCA 1997", "Revenue.ie Income Tax rates 2026", "Form 11 guidance"]));

      return { result: report.join("\n") };
    }

    // ── WHAT IF: BUY A VAN ────────────────────────────────
    case "what_if_buy_van": {
      const cost = (args.cost as number) || 0;
      const n = computeCT1(ctx);
      const annualAllowance = cost * 0.125; // 12.5% over 8 years, no cap for vans
      const ctSavingPerYear = annualAllowance * 0.125;
      const totalCTSaving = cost * 0.125; // over full 8 years

      const lines = [
        `**What if the company buys a van for ${eur(cost)}?**`,
        ``,
        `Vans/commercial vehicles qualify for capital allowances at **12.5% per year** over 8 years, with **no cost cap** (unlike cars at €24,000).`,
        ``,
        `| Year | Allowance | CT Saved | Net Book Value |`,
        `|------|-----------|----------|----------------|`,
      ];
      for (let y = 1; y <= 8; y++) {
        const nbv = cost - (annualAllowance * y);
        lines.push(`| Year ${y} | ${eur(annualAllowance)} | ${eur(ctSavingPerYear)} | ${eur(Math.max(0, nbv))} |`);
      }
      lines.push(`| **Total** | **${eur(cost)}** | **${eur(totalCTSaving)}** | **${eur(0)}** |`);
      lines.push(``);

      // Impact on current year
      const newProfit = Math.max(0, n.tradingProfit - annualAllowance);
      const newCT = Math.max(0, newProfit - (ctx.savedCT1?.lossesForward ?? 0)) * 0.125;
      lines.push(`**Impact on ${ctx.taxYear} CT1:**`);
      lines.push(`- Trading profit: ${eur(n.tradingProfit)} → ${eur(newProfit)} (−${eur(annualAllowance)})`);
      lines.push(`- CT: ${eur(n.totalCT)} → ~${eur(newCT)} (**saves ${eur(n.totalCT - newCT)} this year**)`);
      lines.push(``);
      lines.push(`**Effective cost after full tax relief: ${eur(cost - totalCTSaving)}** (${((1 - 0.125) * 100).toFixed(1)}% of purchase price)`);
      lines.push(buildSources(ctx, ["TCA 1997 s.284 — Plant & machinery allowances"]));

      return { result: lines.join("\n") };
    }

    // ── WHAT IF: HIRE EMPLOYEE ────────────────────────────
    case "what_if_hire_employee": {
      const salary = (args.salary as number) || 0;
      const employerPRSI = salary <= 496 * 52 ? salary * 0.09 : salary * 0.1125;
      const totalCost = salary + employerPRSI;
      const ctReduction = totalCost * 0.125; // deductible expense reduces CT

      // Start-up relief check
      let startupNote = "";
      if (ctx.incorporationDate) {
        const incorpYear = new Date(ctx.incorporationDate).getFullYear();
        const yearsTrading = ctx.taxYear - incorpYear;
        if (yearsTrading <= 3) {
          const prsiRelief = Math.min(employerPRSI, 5000); // simplified per-employee
          startupNote = `\n**Start-up Company Relief:** Year ${yearsTrading} of 3 — employer PRSI of ${eur(employerPRSI)} can offset up to ${eur(Math.min(40000, employerPRSI))} of CT liability.`;
        }
      }

      // Employee taxes breakdown
      const paye20 = Math.min(salary, 44000) * 0.20;
      const paye40 = Math.max(0, salary - 44000) * 0.40;
      const employeePRSI = salary > 352 * 52 ? salary * 0.042 : 0;
      const usc = Math.min(salary, 12012) * 0.005 + Math.min(Math.max(0, salary - 12012), 16688) * 0.02 + Math.min(Math.max(0, salary - 28700), 41344) * 0.03 + Math.max(0, salary - 70044) * 0.08;
      const netPay = salary - paye20 - paye40 - employeePRSI - usc + 2000 + 2000; // basic credits

      const lines = [
        `**What if you hire an employee at ${eur(salary)}/year?**`,
        ``,
        `| Cost to Company | Amount |`,
        `|----------------|--------|`,
        `| Gross Salary | ${eur(salary)} |`,
        `| Employer PRSI (${salary <= 496 * 52 ? "9%" : "11.25%"}) | ${eur(employerPRSI)} |`,
        `| **Total Cost** | **${eur(totalCost)}** |`,
        ``,
        `| Employee Receives | Amount |`,
        `|------------------|--------|`,
        `| Gross Pay | ${eur(salary)} |`,
        `| Less: PAYE | ${eur(paye20 + paye40)} |`,
        `| Less: Employee PRSI (4.2%) | ${eur(employeePRSI)} |`,
        `| Less: USC | ${eur(usc)} |`,
        `| Plus: Tax Credits (est.) | ${eur(4000)} |`,
        `| **Approx. Net Pay** | **~${eur(Math.max(0, netPay))}** |`,
        ``,
        `**CT Impact:** The ${eur(totalCost)} is a deductible expense, saving **${eur(ctReduction)}** in corporation tax.`,
      ];

      if (startupNote) lines.push(startupNote);
      lines.push(buildSources(ctx, ["Revenue employer PRSI rates 2026", "PAYE/USC bands 2026"]));

      return { result: lines.join("\n") };
    }

    // ── WHAT IF: SALARY vs DIVIDEND ───────────────────────
    case "what_if_salary_vs_dividend": {
      const amount = (args.amount as number) || 0;

      // --- Salary route ---
      const employerPRSI = amount * 0.1125;
      const grossCost = amount + employerPRSI;
      const paye = Math.min(amount, 44000) * 0.20 + Math.max(0, amount - 44000) * 0.40;
      const empPRSI = amount > 352 * 52 ? amount * 0.042 : 0;
      const usc = Math.min(amount, 12012) * 0.005 + Math.min(Math.max(0, amount - 12012), 16688) * 0.02 + Math.min(Math.max(0, amount - 28700), 41344) * 0.03 + Math.max(0, amount - 70044) * 0.08;
      const credits = 4000; // personal + employee
      const salaryTax = paye + empPRSI + usc - credits + employerPRSI;
      const salaryNet = amount - paye - empPRSI - usc + credits;
      const salaryCTSaving = grossCost * 0.125;
      const salaryTotalTax = Math.max(0, salaryTax - salaryCTSaving);

      // --- Dividend route ---
      // Company pays CT on profit first, then distributes
      const ctOnProfit = amount * 0.125;
      const afterCT = amount - ctOnProfit;
      // Dividend = income for director — taxed at marginal rate, but dividend withholding tax (DWT) = 25%
      // For close company director: Schedule F income, taxed at marginal rate
      const divPaye = Math.min(afterCT, 44000) * 0.20 + Math.max(0, afterCT - 44000) * 0.40;
      const divPRSI = afterCT * 0.042;
      const divUSC = Math.min(afterCT, 12012) * 0.005 + Math.min(Math.max(0, afterCT - 12012), 16688) * 0.02 + Math.min(Math.max(0, afterCT - 28700), 41344) * 0.03 + Math.max(0, afterCT - 70044) * 0.08;
      const divCredits = 2000; // personal only (no employee credit for dividends)
      const divPersonalTax = divPaye + divPRSI + divUSC - divCredits;
      const divTotalTax = ctOnProfit + Math.max(0, divPersonalTax);
      const divNet = afterCT - Math.max(0, divPersonalTax);

      // --- Pension route (bonus comparison) ---
      const pensionTax = 0; // no tax at all
      const pensionNet = amount; // all goes to pension fund

      const lines = [
        `**Extracting ${eur(amount)} from the company — 3 methods compared:**`,
        ``,
        `| | Salary | Dividend | Employer Pension |`,
        `|--|--------|----------|-----------------|`,
        `| Gross Amount | ${eur(amount)} | ${eur(amount)} | ${eur(amount)} |`,
        `| Corporation Tax | ${eur(-salaryCTSaving)} (saving) | ${eur(ctOnProfit)} | ${eur(-amount * 0.125)} (saving) |`,
        `| Employer PRSI | ${eur(employerPRSI)} | — | — |`,
        `| PAYE/PRSI/USC | ${eur(Math.max(0, paye + empPRSI + usc - credits))} | ${eur(Math.max(0, divPersonalTax))} | **€0** |`,
        `| **Total Tax** | **${eur(Math.max(0, salaryTotalTax))}** | **${eur(Math.max(0, divTotalTax))}** | **${eur(0)}** |`,
        `| **You Receive** | **${eur(Math.max(0, salaryNet))}** | **${eur(Math.max(0, divNet))}** | **${eur(pensionNet)}** (in fund) |`,
        ``,
        `**Most tax-efficient: Employer pension contribution** — zero tax on the full ${eur(amount)}. The trade-off is it's locked in your pension until retirement.`,
        ``,
        `For cash now, salary is usually better than dividends for amounts under ~€100k due to the double taxation on dividends (CT + income tax).`,
        buildSources(ctx, ["TCA 1997", "Revenue PAYE/PRSI/USC 2026"]),
      ];
      return { result: lines.join("\n") };
    }

    // ── SEARCH TRANSACTIONS ──────────────────────────────
    case "search_transactions": {
      const query = (args.query as string || "").toLowerCase();
      const limit = (args.limit as number) || 15;
      const txs = ctx.transactions || [];

      const matches = txs.filter((t: any) => {
        const desc = (t.description || "").toLowerCase();
        const cat = (t.category || "").toLowerCase();
        const vendor = (t.vendor_name || "").toLowerCase();
        return desc.includes(query) || cat.includes(query) || vendor.includes(query);
      }).slice(0, limit);

      if (matches.length === 0) {
        return { result: `No transactions found matching "${args.query}".${buildSources(ctx)}` };
      }

      const lines = [
        `**Found ${matches.length} transaction${matches.length > 1 ? "s" : ""} matching "${args.query}":**`,
        ``,
        `| Date | Description | Category | Amount |`,
        `|------|-------------|----------|--------|`,
        ...matches.map((t: any) => {
          const amt = Number(t.amount) || 0;
          const sign = t.type === "expense" ? "-" : "";
          return `| ${t.date || "—"} | ${(t.description || "—").slice(0, 40)} | ${t.category || "—"} | ${sign}${eur(Math.abs(amt))} |`;
        }),
      ];

      const total = matches.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
      lines.push(`| | | **Total** | **${eur(Math.abs(total))}** |`);
      lines.push(buildSources(ctx));

      return { result: lines.join("\n") };
    }

    // ── SHOW CHART ────────────────────────────────────────
    case "show_chart": {
      const chartType = args.chart_type as string;
      const { ct1 } = ctx;

      if (chartType === "expenses_pie" || chartType === "expenses_bar") {
        const sorted = [...ct1.expenseByCategory].sort((a, b) => b.amount - a.amount).slice(0, 8);
        const chartData = sorted.map(e => ({ name: e.category.replace(/ & /g, "/").slice(0, 18), value: Math.round(e.amount) }));
        const type = chartType === "expenses_pie" ? "pie" : "bar";
        const chart = JSON.stringify({ type, data: chartData, title: "Expenses by Category" });
        return { result: `\`\`\`chart\n${chart}\n\`\`\`\n${buildSources(ctx)}` };
      }

      if (chartType === "income_vs_expenses") {
        const totalIncome = ct1.detectedIncome.reduce((s, i) => s + i.amount, 0);
        const totalExpenses = ct1.expenseByCategory.reduce((s, e) => s + e.amount, 0);
        const n = computeCT1(ctx);
        const chartData = [
          { name: "Income", value: Math.round(totalIncome) },
          { name: "Expenses", value: Math.round(totalExpenses) },
          { name: "CT Liability", value: Math.round(n.totalCT) },
          { name: "Net Profit", value: Math.round(n.tradingProfit) },
        ];
        const chart = JSON.stringify({ type: "bar", data: chartData, title: "Income vs Expenses vs Tax" });
        return { result: `\`\`\`chart\n${chart}\n\`\`\`\n${buildSources(ctx)}` };
      }

      if (chartType === "monthly_spending") {
        const txs = ctx.transactions || [];
        const monthly: Record<string, number> = {};
        for (const t of txs) {
          if ((t as any).type !== "expense" || !(t as any).date) continue;
          const month = (t as any).date.slice(0, 7); // YYYY-MM
          monthly[month] = (monthly[month] || 0) + Math.abs(Number((t as any).amount) || 0);
        }
        const chartData = Object.entries(monthly)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, value]) => ({
            name: new Date(month + "-01").toLocaleDateString("en-IE", { month: "short" }),
            value: Math.round(value),
          }));
        const chart = JSON.stringify({ type: "bar", data: chartData, title: "Monthly Spending" });
        return { result: `\`\`\`chart\n${chart}\n\`\`\`\n${buildSources(ctx)}` };
      }

      return { result: "Unknown chart type. Try: expenses_pie, expenses_bar, income_vs_expenses, or monthly_spending." };
    }

    default:
      return { result: `Unknown tool: ${name}` };
  }
}
