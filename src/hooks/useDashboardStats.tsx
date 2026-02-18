import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useDashboardStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-stats", user?.id],
    queryFn: async () => {
      // Get current period dates (current bi-monthly VAT period)
      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();

      // Determine period start (bi-monthly)
      const periodMonth = month % 2 === 0 ? month : month - 1;
      const periodStart = new Date(year, periodMonth, 1).toISOString().split("T")[0];
      const periodEnd = new Date(year, periodMonth + 2, 0).toISOString().split("T")[0];

      // Fetch invoices for income and VAT on sales
      const { data: invoices, error: invError } = await supabase
        .from("invoices")
        .select("total, vat_amount, status, invoice_date")
        .eq("user_id", user!.id)
        .gte("invoice_date", periodStart)
        .lte("invoice_date", periodEnd);

      if (invError) throw invError;

      // Fetch expenses for expenses and VAT on purchases
      const { data: expenses, error: expError } = await supabase
        .from("expenses")
        .select("amount, vat_amount, expense_date")
        .eq("user_id", user!.id)
        .gte("expense_date", periodStart)
        .lte("expense_date", periodEnd);

      if (expError) throw expError;

      // Calculate totals
      const totalIncome = invoices?.reduce((sum, inv) => sum + Number(inv.total || 0), 0) || 0;
      const vatOnSales = invoices?.reduce((sum, inv) => sum + Number(inv.vat_amount || 0), 0) || 0;

      const totalExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount || 0), 0) || 0;
      const vatOnPurchases = expenses?.reduce((sum, exp) => sum + Number(exp.vat_amount || 0), 0) || 0;

      const netVat = vatOnSales - vatOnPurchases;

      // Get next VAT return due date (23rd of month after period end)
      const periodEndDate = new Date(periodEnd);
      const dueDate = new Date(periodEndDate.getFullYear(), periodEndDate.getMonth() + 2, 23);

      return {
        income: {
          total: totalIncome,
          vatCollected: vatOnSales,
          count: invoices?.length || 0,
        },
        expenses: {
          total: totalExpenses,
          vatPaid: vatOnPurchases,
          count: expenses?.length || 0,
        },
        vat: {
          onSales: vatOnSales,
          onPurchases: vatOnPurchases,
          net: netVat,
          dueDate: dueDate.toLocaleDateString("en-IE", { month: "short", day: "numeric" }),
        },
        period: {
          start: periodStart,
          end: periodEnd,
        },
      };
    },
    enabled: !!user,
  });
}

// For sparkline charts - get last 7 periods of data
export function useIncomeHistory() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["income-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("total, invoice_date")
        .eq("user_id", user!.id)
        .order("invoice_date", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Group by month for last 7 months
      const monthlyTotals: number[] = [];
      const now = new Date();

      for (let i = 6; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const monthTotal =
          data
            ?.filter((inv) => {
              const date = new Date(inv.invoice_date);
              return date >= monthStart && date <= monthEnd;
            })
            .reduce((sum, inv) => sum + Number(inv.total || 0), 0) || 0;

        monthlyTotals.push(monthTotal);
      }

      return monthlyTotals;
    },
    enabled: !!user,
  });
}

export function useExpenseHistory() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["expense-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, expense_date")
        .eq("user_id", user!.id)
        .order("expense_date", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Group by month for last 7 months
      const monthlyTotals: number[] = [];
      const now = new Date();

      for (let i = 6; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const monthTotal =
          data
            ?.filter((exp) => {
              const date = new Date(exp.expense_date);
              return date >= monthStart && date <= monthEnd;
            })
            .reduce((sum, exp) => sum + Number(exp.amount || 0), 0) || 0;

        monthlyTotals.push(monthTotal);
      }

      return monthlyTotals;
    },
    enabled: !!user,
  });
}
