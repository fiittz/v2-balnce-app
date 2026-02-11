import { supabase } from "@/integrations/supabase/client";

export interface RCTDeduction {
  id: string;
  user_id: string;
  subcontractor_id: string;
  contract_id: string | null;
  expense_id: string | null;
  payment_date: string;
  gross_amount: number;
  rct_rate: number;
  rct_deducted: number;
  net_payable: number;
  period_month: number;
  period_year: number;
  submitted_to_revenue: boolean;
  submission_date: string | null;
}

export interface SubcontractorInfo {
  id: string;
  name: string;
  taxReference: string | null;
}

export interface RCTCalculation {
  grossAmount: number;
  rctRate: number;
  rctDeducted: number;
  netPayable: number;
  subcontractor: SubcontractorInfo;
}

export interface RCTMonthlySummary {
  period: {
    month: number;
    year: number;
  };
  totals: {
    grossTotal: number;
    rctTotal: number;
    netTotal: number;
    count: number;
  };
  bySubcontractor: Array<{
    subcontractor: { name: string; tax_reference: string | null };
    grossTotal: number;
    rctTotal: number;
    netTotal: number;
    deductions: RCTDeduction[];
  }>;
  deductions: RCTDeduction[];
}

/**
 * Calculate RCT deduction for a payment
 */
export async function calculateRCT(
  grossAmount: number,
  subcontractorId: string
): Promise<RCTCalculation> {
  const { data, error } = await supabase.functions.invoke("process-rct", {
    body: {
      action: "calculate_deduction",
      grossAmount,
      subcontractorId,
    },
  });

  if (error) {
    console.error("RCT calculation error:", error);
    throw new Error(error.message || "Failed to calculate RCT");
  }

  return data as RCTCalculation;
}

/**
 * Record an RCT deduction
 */
export async function recordRCTDeduction(params: {
  expenseId?: string;
  subcontractorId: string;
  contractId?: string;
  grossAmount: number;
  rctRate: number;
  paymentDate: string;
}): Promise<{ deduction: RCTDeduction }> {
  const { data, error } = await supabase.functions.invoke("process-rct", {
    body: {
      action: "record_deduction",
      ...params,
    },
  });

  if (error) {
    console.error("RCT recording error:", error);
    throw new Error(error.message || "Failed to record RCT deduction");
  }

  return data;
}

/**
 * Get monthly RCT summary
 */
export async function getRCTMonthlySummary(
  month: number,
  year: number
): Promise<RCTMonthlySummary> {
  const { data, error } = await supabase.functions.invoke("process-rct", {
    body: {
      action: "get_monthly_summary",
      month,
      year,
    },
  });

  if (error) {
    console.error("RCT summary error:", error);
    throw new Error(error.message || "Failed to get RCT summary");
  }

  return data as RCTMonthlySummary;
}

/**
 * Get RCT rate description
 */
export function getRCTRateDescription(rate: number): string {
  switch (rate) {
    case 0:
      return "0% - Fully Compliant";
    case 20:
      return "20% - Standard Rate";
    case 35:
      return "35% - Non-Compliant";
    default:
      return `${rate}%`;
  }
}

/**
 * Get RCT rate color for UI
 */
export function getRCTRateColor(rate: number): string {
  switch (rate) {
    case 0:
      return "text-green-600";
    case 20:
      return "text-yellow-600";
    case 35:
      return "text-red-600";
    default:
      return "text-gray-600";
  }
}

/**
 * Format RCT period label
 */
export function formatRCTPeriod(month: number, year: number): string {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${monthNames[month - 1]} ${year}`;
}

/**
 * Get RCT filing deadline
 * RCT returns must be filed by the 23rd of the following month
 */
export function getRCTDeadline(month: number, year: number): Date {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(nextYear, nextMonth - 1, 23);
}

/**
 * Check if RCT deadline has passed
 */
export function isRCTDeadlinePassed(month: number, year: number): boolean {
  const deadline = getRCTDeadline(month, year);
  return new Date() > deadline;
}
