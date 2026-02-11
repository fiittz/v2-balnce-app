import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

export const useTransactions = (filters?: {
  type?: "income" | "expense";
  isReconciled?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
  accountId?: string;
  accountType?: string;
}) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transactions", user?.id, filters],
    queryFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      let query = supabase
        .from("transactions")
        .select(`
          *,
          category:categories(id, name)
        `)
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false });

      if (filters?.type) {
        query = query.eq("type", filters.type);
      }
      if (filters?.isReconciled !== undefined) {
        query = query.eq("is_reconciled", filters.isReconciled);
      }
      if (filters?.startDate) {
        query = query.gte("transaction_date", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("transaction_date", filters.endDate);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.accountId) {
        query = query.eq("account_id", filters.accountId);
      }
      if (filters?.accountType) {
        // Look up accounts matching this type, then filter transactions
        const { data: matchingAccounts } = await supabase
          .from("accounts")
          .select("id")
          .eq("user_id", user.id)
          .eq("account_type", filters.accountType);

        const ids = (matchingAccounts ?? []).map((a) => a.id);
        if (ids.length === 0) return [];
        query = query.in("account_id", ids);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

export const useUnmatchedTransactions = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["unmatched-transactions", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          category:categories(id, name)
        `)
        .eq("user_id", user.id)
        .eq("is_reconciled", false)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

export const useCreateTransaction = (options?: { silent?: boolean }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const silent = options?.silent ?? false;

  return useMutation({
    mutationFn: async (transaction: Omit<TransactionInsert, "user_id">) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("transactions")
        .insert({ ...transaction, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (!silent) {
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
        toast.success("Transaction added");
      }
    },
    onError: (error: Error) => {
      if (!silent) {
        toast.error(error.message || "Failed to add transaction");
      }
    },
  });
};

export const useUpdateTransaction = (options?: { silent?: boolean }) => {
  const queryClient = useQueryClient();
  const silent = options?.silent ?? false;

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Transaction> & { id: string }) => {
      const { data, error } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (!silent) {
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
        toast.success("Transaction updated");
      }
    },
    onError: (error: Error) => {
      if (!silent) {
        toast.error(error.message || "Failed to update transaction");
      }
    },
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Transaction deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete transaction");
    },
  });
};

export const useBulkDeleteTransactions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .in("id", ids);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`Deleted ${count} transactions`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete transactions");
    },
  });
};

export const useDeleteAllTransactions = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      // Delete transactions first (they reference import_batches via FK)
      const { error: txError } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", user.id);

      if (txError) throw txError;

      // Then delete import batches (now safe, no FK references)
      const { error: batchError } = await supabase
        .from("import_batches")
        .delete()
        .eq("user_id", user.id);

      if (batchError) throw batchError;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("All transactions deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete all transactions");
    },
  });
};

export const useBulkUpdateTransactions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ids,
      updates,
    }: {
      ids: string[];
      updates: Partial<Pick<Transaction, "category_id" | "is_reconciled" | "account_id">>;
    }) => {
      const { error } = await supabase
        .from("transactions")
        .update(updates)
        .in("id", ids);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`Updated ${count} transactions`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update transactions");
    },
  });
};

export const useBulkCategorize = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactionIds: string[]) => {
      const { data, error } = await supabase.functions.invoke("categorize-transaction", {
        body: {
          action: "bulk_categorize",
          transactionIds,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`Categorized ${data?.categorized || 0} transactions`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to categorize transactions");
    },
  });
};
