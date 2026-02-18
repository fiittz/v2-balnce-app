import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Expense = Database["public"]["Tables"]["expenses"]["Row"];
type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];

export function useExpenses(options?: { limit?: number; status?: string }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["expenses", user?.id, options],
    queryFn: async () => {
      let query = supabase
        .from("expenses")
        .select(
          `
          *,
          category:categories(id, name),
          supplier:suppliers(id, name)
        `,
        )
        .eq("user_id", user!.id)
        .order("expense_date", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateExpense() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expense: Omit<ExpenseInsert, "user_id">) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("expenses")
        .insert({ ...expense, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Expense saved successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save expense");
    },
  });
}

export function useExpenseStats(periodStart?: string, periodEnd?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["expense-stats", user?.id, periodStart, periodEnd],
    queryFn: async () => {
      let query = supabase.from("expenses").select("amount, vat_amount").eq("user_id", user!.id);

      if (periodStart) {
        query = query.gte("expense_date", periodStart);
      }
      if (periodEnd) {
        query = query.lte("expense_date", periodEnd);
      }

      const { data, error } = await query;
      if (error) throw error;

      const totalExpenses = data?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
      const vatRecoverable = data?.reduce((sum, e) => sum + Number(e.vat_amount || 0), 0) || 0;

      return { totalExpenses, vatRecoverable, count: data?.length || 0 };
    },
    enabled: !!user,
  });
}
