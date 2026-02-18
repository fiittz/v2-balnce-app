import { supabase } from "@/integrations/supabase/client";

export interface VATReturn {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  vat_on_sales: number;
  vat_on_purchases: number;
  net_vat: number;
  due_date: string;
  status: "draft" | "ready" | "submitted" | "paid";
  submitted_at: string | null;
  notes: string | null;
}

export interface VATBreakdown {
  invoices: number;
  expenses: number;
  vatOnSales: number;
  vatOnPurchases: number;
  netVat: number;
  status: "payable" | "refund";
}

export interface VATCalculationResult {
  vatReturn: VATReturn;
  breakdown: VATBreakdown;
}

/**
 * Calculate VAT for a specific period
 */
export async function calculateVAT(periodStart: string, periodEnd: string): Promise<VATCalculationResult> {
  const { data, error } = await supabase.functions.invoke("process-vat-return", {
    body: {
      action: "calculate",
      periodStart,
      periodEnd,
    },
  });

  if (error) {
    console.error("VAT calculation error:", error);
    throw new Error(error.message || "Failed to calculate VAT");
  }

  return data as VATCalculationResult;
}

/**
 * Submit a VAT return
 */
export async function submitVATReturn(periodStart: string, periodEnd: string): Promise<{ vatReturn: VATReturn }> {
  const { data, error } = await supabase.functions.invoke("process-vat-return", {
    body: {
      action: "submit",
      periodStart,
      periodEnd,
    },
  });

  if (error) {
    console.error("VAT submission error:", error);
    throw new Error(error.message || "Failed to submit VAT return");
  }

  return data;
}

/**
 * Get VAT period dates for a given date
 * Irish VAT is bi-monthly: Jan-Feb, Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec
 */
export function getVATPeriod(date: Date = new Date()): {
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  dueDate: string;
} {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed

  let startMonth: number;
  let endMonth: number;
  let dueDateMonth: number;
  let dueDateYear = year;

  if (month <= 2) {
    startMonth = 1;
    endMonth = 2;
    dueDateMonth = 3;
  } else if (month <= 4) {
    startMonth = 3;
    endMonth = 4;
    dueDateMonth = 5;
  } else if (month <= 6) {
    startMonth = 5;
    endMonth = 6;
    dueDateMonth = 7;
  } else if (month <= 8) {
    startMonth = 7;
    endMonth = 8;
    dueDateMonth = 9;
  } else if (month <= 10) {
    startMonth = 9;
    endMonth = 10;
    dueDateMonth = 11;
  } else {
    startMonth = 11;
    endMonth = 12;
    dueDateMonth = 1;
    dueDateYear = year + 1;
  }

  const startDate = new Date(year, startMonth - 1, 1);
  const endDate = new Date(year, endMonth, 0); // Last day of end month
  const dueDate = new Date(dueDateYear, dueDateMonth - 1, 23);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const periodLabel = `${monthNames[startMonth - 1]}-${monthNames[endMonth - 1]} ${year}`;

  return {
    periodStart: startDate.toISOString().split("T")[0],
    periodEnd: endDate.toISOString().split("T")[0],
    periodLabel,
    dueDate: dueDate.toISOString().split("T")[0],
  };
}

/**
 * Get all VAT periods for a year
 */
export function getVATPeriodsForYear(year: number): Array<{
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  dueDate: string;
}> {
  const periods = [];
  const biMonthlyPeriods = [
    { start: 1, end: 2, due: 3 },
    { start: 3, end: 4, due: 5 },
    { start: 5, end: 6, due: 7 },
    { start: 7, end: 8, due: 9 },
    { start: 9, end: 10, due: 11 },
    { start: 11, end: 12, due: 1 },
  ];

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (const period of biMonthlyPeriods) {
    const startDate = new Date(year, period.start - 1, 1);
    const endDate = new Date(year, period.end, 0);
    const dueYear = period.due === 1 ? year + 1 : year;
    const dueDate = new Date(dueYear, period.due - 1, 23);

    periods.push({
      periodStart: startDate.toISOString().split("T")[0],
      periodEnd: endDate.toISOString().split("T")[0],
      periodLabel: `${monthNames[period.start - 1]}-${monthNames[period.end - 1]} ${year}`,
      dueDate: dueDate.toISOString().split("T")[0],
    });
  }

  return periods;
}
