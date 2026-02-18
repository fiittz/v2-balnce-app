import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
type InvoiceInsert = Database["public"]["Tables"]["invoices"]["Insert"];

export function useInvoices(options?: { limit?: number; status?: string; account_id?: string }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["invoices", user?.id, options],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select(
          `
          *,
          customer:customers(id, name, email, phone, address, vat_number)
        `,
        )
        .eq("user_id", user!.id)
        .order("invoice_date", { ascending: false });

      if (options?.status) {
        query = query.eq("status", options.status);
      }
      if (options?.account_id) {
        query = query.eq("account_id", options.account_id);
      }
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

export function useCreateInvoice() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoice }: { invoice: Omit<InvoiceInsert, "user_id" | "invoice_number"> }) => {
      if (!user) throw new Error("Not authenticated");

      // Generate simple invoice number
      const invoiceNumber = `INV-${Date.now()}`;

      // Create invoice
      const { data: newInvoice, error: invError } = await supabase
        .from("invoices")
        .insert({
          ...invoice,
          user_id: user.id,
          invoice_number: invoiceNumber,
        })
        .select()
        .single();

      if (invError) throw invError;

      return newInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Invoice created successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create invoice");
    },
  });
}

export function useInvoice(id?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["invoice", user?.id, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id!)
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Invoice> & { id: string }) => {
      const { data, error } = await supabase.from("invoices").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice"] });
      toast.success("Invoice updated");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update invoice");
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice deleted");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete invoice");
    },
  });
}

export function useInvoiceStats(periodStart?: string, periodEnd?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["invoice-stats", user?.id, periodStart, periodEnd],
    queryFn: async () => {
      let query = supabase.from("invoices").select("total, vat_amount, status").eq("user_id", user!.id);

      if (periodStart) {
        query = query.gte("issue_date", periodStart);
      }
      if (periodEnd) {
        query = query.lte("issue_date", periodEnd);
      }

      const { data, error } = await query;
      if (error) throw error;

      const totalIncome = data?.reduce((sum, inv) => sum + Number(inv.total || 0), 0) || 0;
      const vatCollected = data?.reduce((sum, inv) => sum + Number(inv.vat_amount || 0), 0) || 0;
      const unpaidCount = data?.filter((inv) => inv.status !== "paid").length || 0;

      return { totalIncome, vatCollected, count: data?.length || 0, unpaidCount };
    },
    enabled: !!user,
  });
}
