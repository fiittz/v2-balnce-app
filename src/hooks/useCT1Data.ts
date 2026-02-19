import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useVATSummary } from "@/hooks/useVATData";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import { useDirectorOnboarding } from "@/hooks/useDirectorOnboarding";
import { useInvoices } from "@/hooks/useInvoices";
import { useInvoiceTripMatcher } from "@/hooks/useInvoiceTripMatcher";
import { isVATDeductible, isCTDeductible } from "@/lib/vatDeductibility";
import { calculateVehicleDepreciation, type VehicleDepreciation } from "@/lib/vehicleDepreciation";

export interface CT1ReEvalOptions {
  vatChangeDate?: string; // ISO date from questionnaire Section 4
  vatStatusBefore?: string; // e.g., "not_registered"
  vatStatusAfter?: string; // e.g., "cash_basis"
}

export interface CT1Data {
  detectedIncome: { category: string; amount: number }[];
  expenseByCategory: { category: string; amount: number }[];
  expenseSummary: { allowable: number; disallowed: number };
  disallowedByCategory: { category: string; amount: number }[];
  detectedPayments: { type: string; amount: number }[];
  closingBalance: number;
  vatPosition: { type: "payable" | "refundable"; amount: number } | undefined;
  flaggedCapitalItems: { description: string; date: string; amount: number }[];
  vehicleAsset: {
    description: string;
    reg: string;
    depreciation: VehicleDepreciation;
  } | null;
  rctPrepayment: number; // Total RCT deducted from invoices — current asset / CT credit
  travelAllowance: number; // Total Revenue mileage + subsistence across all trips
  directorsLoanTravel: number; // Net owed to director (Revenue allowance - CSV expenses)
  directorsLoanDebits: number; // Total DLA debits (money taken by director from company)
  netDirectorsLoan: number; // directorsLoanTravel - directorsLoanDebits (positive = company owes director)
  isConstructionTrade: boolean;
  isCloseCompany: boolean;
  isLoading: boolean;
  // Re-evaluation fields
  reEvaluationApplied: boolean;
  reEvaluationWarnings: string[];
  originalExpenseSummary?: { allowable: number; disallowed: number };
}

const CONSTRUCTION_TRADE_TYPES = [
  "construction",
  "forestry",
  "meat_processing",
  "carpentry_joinery",
  "electrical",
  "plumbing_heating",
];

/** Parse a transaction description into a payment type bucket */
function classifyPaymentType(description: string): string {
  const d = (description || "").toLowerCase();
  if (d.includes("salary") || d.includes("wages")) return "Wages";
  if (d.includes("sepa")) return "SEPA Transfer";
  if (d.includes("direct debit") || d.includes(" dd ") || d.startsWith("dd ")) return "Direct Debit";
  if (d.includes("pos") || d.includes("card")) return "Card Payment";
  if (d.includes("standing order") || d.includes("s/o")) return "Standing Order";
  if (d.includes("cheque") || d.includes("chq")) return "Cheque";
  return "Other";
}

export function useCT1Data(options?: CT1ReEvalOptions): CT1Data {
  // Determine tax year (Irish tax year = calendar year)
  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const startDate = `${taxYear}-01-01`;
  const endDate = `${taxYear}-12-31`;

  // Split date for re-evaluation (if VAT status changed mid-year)
  const splitDate = options?.vatChangeDate ?? endDate;

  // Fetch business transactions for the tax year
  const { data: incomeTransactions, isLoading: incomeLoading } = useTransactions({
    type: "income",
    startDate,
    endDate,
    accountType: "limited_company",
  });

  const { data: expenseTransactions, isLoading: expenseLoading } = useTransactions({
    type: "expense",
    startDate,
    endDate,
    accountType: "limited_company",
  });

  // VAT: pre-change period (full year if no split)
  const { data: vatSummaryPre, isLoading: vatPreLoading } = useVATSummary(startDate, splitDate);
  // VAT: post-change period (only meaningful when there's a split)
  const { data: vatSummaryPost, isLoading: vatPostLoading } = useVATSummary(splitDate, endDate);

  // Onboarding settings for business_type
  const { data: onboarding, isLoading: onboardingLoading } = useOnboardingSettings();

  // Director onboarding — vehicle asset data
  const { data: directorRows, isLoading: directorLoading } = useDirectorOnboarding();

  // Invoices — for RCT deduction calculation
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();

  // Trip matcher — travel/accommodation & director's loan
  const { invoiceTrips, isLoading: tripsLoading } = useInvoiceTripMatcher();

  const hasVATSplit = !!options?.vatChangeDate;
  const isLoading =
    incomeLoading ||
    expenseLoading ||
    vatPreLoading ||
    vatPostLoading ||
    onboardingLoading ||
    directorLoading ||
    invoicesLoading ||
    tripsLoading;

  return useMemo(() => {
    // 1. Detected income — group by category name
    // Exclude Tax Refund (Revenue Commissioners) — not taxable income
    const NON_TAXABLE_CATEGORIES = ["Tax Refund"];
    const incomeByCategory = new Map<string, number>();
    for (const t of incomeTransactions ?? []) {
      const catName = (t.category as { id: string; name: string } | null)?.name ?? "Uncategorised";
      // Skip non-taxable categories (e.g. Revenue refunds)
      if (NON_TAXABLE_CATEGORIES.includes(catName)) continue;
      // Also skip if description contains Revenue indicators and not yet recategorised
      const desc = (t.description ?? "").toLowerCase();
      if (
        catName === "Uncategorised" &&
        (desc.includes("revenue") || desc.includes("collector general") || desc.includes("tax refund"))
      )
        continue;
      const prev = incomeByCategory.get(catName) ?? 0;
      incomeByCategory.set(catName, prev + Math.abs(Number(t.amount) || 0));
    }
    const detectedIncome = Array.from(incomeByCategory.entries()).map(([category, amount]) => ({ category, amount }));

    // 2. Expense summary — allowable vs disallowed using VAT deductibility rules
    // Director's Loan Account debits are balance sheet items, not P&L expenses — tracked separately
    const isDLA = (catName: string | null) => {
      if (!catName) return false;
      const lower = catName.toLowerCase();
      return lower.includes("drawing") || lower.includes("director's loan") || lower.includes("directors loan");
    };

    let origAllowable = 0;
    let origDisallowed = 0;
    let totalDLADebits = 0;
    const disallowedByCategoryMap = new Map<string, number>();
    for (const t of expenseTransactions ?? []) {
      const amt = Math.abs(Number(t.amount) || 0);
      const catName = (t.category as { id: string; name: string } | null)?.name ?? null;
      // Director's Loan Account debits excluded from P&L — they're balance sheet items
      if (isDLA(catName)) {
        totalDLADebits += amt;
        continue;
      }
      // Use CT deductibility (not VAT) for add-backs — hotel/bank charges are CT-deductible
      const result = isCTDeductible(t.description ?? "", catName);
      if (result.isDeductible) {
        origAllowable += amt;
      } else {
        origDisallowed += amt;
        const dCat = catName ?? "Uncategorised";
        disallowedByCategoryMap.set(dCat, (disallowedByCategoryMap.get(dCat) ?? 0) + amt);
      }
    }
    const disallowedByCategory = Array.from(disallowedByCategoryMap.entries())
      .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);
    const originalExpenseSummary = { allowable: origAllowable, disallowed: origDisallowed };

    // 2b. Expense breakdown by category
    const expenseByCategoryMap = new Map<string, number>();
    for (const t of expenseTransactions ?? []) {
      const amt = Math.abs(Number(t.amount) || 0);
      const catName = (t.category as { id: string; name: string } | null)?.name ?? "Uncategorised";
      const prev = expenseByCategoryMap.get(catName) ?? 0;
      expenseByCategoryMap.set(catName, prev + amt);
    }
    const expenseByCategory = Array.from(expenseByCategoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Re-evaluate expenses if VAT status changed mid-year
    let expenseSummary = originalExpenseSummary;
    let reEvaluationApplied = false;
    const reEvaluationWarnings: string[] = [];

    if (hasVATSplit && options?.vatStatusBefore === "not_registered") {
      // Pre-change: all expenses are non-deductible for VAT purposes
      // Post-change: apply normal deductibility rules
      let splitAllowable = 0;
      let splitDisallowed = 0;
      const changeDate = options.vatChangeDate!;
      for (const t of expenseTransactions ?? []) {
        const amt = Math.abs(Number(t.amount) || 0);
        const catName = (t.category as { id: string; name: string } | null)?.name ?? null;
        // Skip drawings — not P&L items
        if (isDLA(catName)) continue;
        const txDate = t.transaction_date ?? "";
        const result = isVATDeductible(t.description ?? "", catName);
        if (result.isDeductible) {
          splitAllowable += amt;
        } else {
          splitDisallowed += amt;
        }
      }
      expenseSummary = { allowable: splitAllowable, disallowed: splitDisallowed };
      reEvaluationApplied = true;
      reEvaluationWarnings.push(
        `Expenses re-evaluated based on VAT registration from ${changeDate}. Pre-registration expenses have no recoverable VAT input.`,
      );
    }

    // 3. Detected payments — classify by description
    const paymentsByType = new Map<string, number>();
    const allTransactions = [...(incomeTransactions ?? []), ...(expenseTransactions ?? [])];
    for (const t of allTransactions) {
      const paymentType = classifyPaymentType(t.description ?? "");
      const prev = paymentsByType.get(paymentType) ?? 0;
      paymentsByType.set(paymentType, prev + Math.abs(Number(t.amount) || 0));
    }
    const detectedPayments = Array.from(paymentsByType.entries()).map(([type, amount]) => ({ type, amount }));

    // 4. Closing balance — income minus expenses
    const totalIncome = (incomeTransactions ?? []).reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    const totalExpenses = (expenseTransactions ?? []).reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    const closingBalance = totalIncome - totalExpenses;

    // 5. VAT position — use post-change period only when split applies
    let vatPosition: CT1Data["vatPosition"] = undefined;
    if (hasVATSplit && vatSummaryPost) {
      // Only the post-registration period has recoverable VAT
      const netVat = vatSummaryPost.netVat;
      vatPosition = {
        type: netVat >= 0 ? "payable" : "refundable",
        amount: Math.abs(netVat),
      };
      reEvaluationWarnings.push("VAT position reflects the registered period only (post-change).");
    } else if (vatSummaryPre) {
      const netVat = vatSummaryPre.netVat;
      vatPosition = {
        type: netVat >= 0 ? "payable" : "refundable",
        amount: Math.abs(netVat),
      };
    }

    // 6. Flagged capital items — expenses >= EUR 1,000 or capital-related categories
    const capitalKeywords = ["equipment", "tools", "vehicle", "fixed asset", "machinery", "plant"];
    const flaggedCapitalItems: CT1Data["flaggedCapitalItems"] = [];
    for (const t of expenseTransactions ?? []) {
      const amt = Math.abs(Number(t.amount) || 0);
      const catName = (t.category as { id: string; name: string } | null)?.name?.toLowerCase() ?? "";
      const isCapitalCategory = capitalKeywords.some((kw) => catName.includes(kw));
      if (amt >= 1000 || isCapitalCategory) {
        flaggedCapitalItems.push({
          description: t.description ?? "Unknown",
          date: t.transaction_date ?? "",
          amount: amt,
        });
      }
    }

    // 7. Construction trade check
    const isConstructionTrade = CONSTRUCTION_TRADE_TYPES.includes(onboarding?.business_type ?? "");

    // 8. Close company — default true for most small Irish LLCs
    const isCloseCompany = true;

    // 9. Vehicle asset — depreciation & capital allowances from director onboarding
    let vehicleAsset: CT1Data["vehicleAsset"] = null;
    const director1Data = (directorRows?.[0] as Record<string, unknown>)?.onboarding_data as
      | Record<string, unknown>
      | undefined;
    if (director1Data?.vehicle_owned_by_director && director1Data?.vehicle_purchase_cost > 0) {
      const depreciation = calculateVehicleDepreciation(
        {
          description: director1Data.vehicle_description || "Motor Vehicle",
          reg: director1Data.vehicle_reg || "",
          purchaseCost: Number(director1Data.vehicle_purchase_cost) || 0,
          dateAcquired: director1Data.vehicle_date_acquired || `${taxYear}-01-01`,
          businessUsePct: Number(director1Data.vehicle_business_use_pct) || 100,
        },
        taxYear,
      );
      vehicleAsset = {
        description: director1Data.vehicle_description || "Motor Vehicle",
        reg: director1Data.vehicle_reg || "",
        depreciation,
      };
    }

    // 10. RCT prepayment — sum RCT deducted from invoices in the tax year
    let rctPrepayment = 0;
    for (const inv of invoices ?? []) {
      const invDate = (inv as Record<string, unknown>).invoice_date ?? "";
      if (invDate < startDate || invDate > endDate) continue;
      try {
        const invRecord = inv as Record<string, unknown>;
        const notes = invRecord.notes ? JSON.parse(invRecord.notes as string) : null;
        if (notes?.rct_enabled && notes?.rct_amount > 0) {
          rctPrepayment += Number(notes.rct_amount) || 0;
        }
      } catch {
        /* not JSON */
      }
    }
    rctPrepayment = Math.round(rctPrepayment * 100) / 100;

    // 11. Travel allowance & director's loan from trips
    const travelAllowance = Math.round(invoiceTrips.reduce((sum, t) => sum + t.totalRevenueAllowance, 0) * 100) / 100;
    const directorsLoanTravel =
      Math.round(
        Math.max(
          0,
          invoiceTrips.reduce((sum, t) => sum + t.directorsLoanBalance, 0),
        ) * 100,
      ) / 100;

    // DLA debits offset the director's loan balance
    // Positive netDirectorsLoan = company still owes director (liability)
    // Negative = director owes company (becomes a debtor/asset)
    const directorsLoanDebits = Math.round(totalDLADebits * 100) / 100;
    const netDirectorsLoan = Math.round((directorsLoanTravel - directorsLoanDebits) * 100) / 100;

    return {
      detectedIncome,
      expenseByCategory,
      expenseSummary,
      disallowedByCategory,
      detectedPayments,
      closingBalance,
      vatPosition,
      flaggedCapitalItems,
      vehicleAsset,
      rctPrepayment,
      travelAllowance,
      directorsLoanTravel,
      directorsLoanDebits,
      netDirectorsLoan,
      isConstructionTrade,
      isCloseCompany,
      isLoading,
      reEvaluationApplied,
      reEvaluationWarnings,
      originalExpenseSummary: reEvaluationApplied ? originalExpenseSummary : undefined,
    };
  }, [
    incomeTransactions,
    expenseTransactions,
    vatSummaryPre,
    vatSummaryPost,
    onboarding,
    directorRows,
    invoices,
    invoiceTrips,
    isLoading,
    hasVATSplit,
    options,
    endDate,
    startDate,
    taxYear,
  ]);
}
