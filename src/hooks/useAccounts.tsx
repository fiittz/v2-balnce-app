import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";
import { seedDefaultAccount } from "@/lib/seedAccounts";
import { migrateLocalAccounts } from "@/lib/migrateLocalAccounts";
import { toast } from "sonner";

export type Account = Database["public"]["Tables"]["accounts"]["Row"];

export function useAccounts(typeFilter?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["accounts", user?.id, typeFilter],
    queryFn: async () => {
      // One-time migration from localStorage accounts
      await migrateLocalAccounts(user!.id);

      let query = supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user!.id)
        .order("account_type")
        .order("name");

      if (typeFilter) {
        query = query.eq("account_type", typeFilter);
      }

      const { data: initialData, error } = await query;
      let data = initialData;
      if (error) throw error;

      // If no accounts exist, create a default one and refetch
      if ((!data || data.length === 0) && user?.id) {
        console.log("No accounts found, creating default...");
        const accountId = await seedDefaultAccount(user.id);
        if (accountId) {
          // Refetch after seeding
          let refetchQuery = supabase
            .from("accounts")
            .select("*")
            .eq("user_id", user!.id)
            .order("account_type")
            .order("name");

          if (typeFilter) {
            refetchQuery = refetchQuery.eq("account_type", typeFilter);
          }

          const { data: refetchedData, error: refetchError } = await refetchQuery;
          if (refetchError) throw refetchError;
          data = refetchedData;
        }
      }

      return data;
    },
    enabled: !!user,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (account: Omit<Account, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("accounts")
        .insert({ ...account, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Account> & { id: string }) => {
      const { data, error } = await supabase
        .from("accounts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Unlink transactions from this account before deleting
      const { error: unlinkError } = await supabase
        .from("transactions")
        .update({ account_id: null })
        .eq("account_id", id);
      if (unlinkError) throw unlinkError;

      const { error } = await supabase
        .from("accounts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Account deleted");
    },
  });
}
