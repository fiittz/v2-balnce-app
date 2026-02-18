import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface VATWizardData {
  id?: string;
  vat_return_id: string;
  completed_at?: string | null;
  // Section 1: Sales
  all_sales_added: "yes" | "no" | "not_sure" | null;
  unpaid_invoices: boolean;
  unpaid_invoices_list: Array<{ description: string; amount: number }>;
  special_sales: string[];
  special_sales_notes: string;
  // Section 2: Purchases
  all_expenses_added: "yes" | "no" | "not_sure" | null;
  missing_receipts: boolean;
  missing_receipts_list: Array<{ description: string; amount: number }>;
  // Section 3: High-Risk VAT
  food_vat_claim: "no" | "allowed_staff_canteen" | "not_allowed_exclude" | null;
  motor_vat_claim: "fuel_only" | "fuel_and_other" | "none" | null;
  remove_non_allowed_vat: boolean | null;
  remove_non_allowed_reason: string;
  // Section 4: EU Purchases
  eu_purchases: boolean;
  eu_purchase_ids: string[];
  eu_reverse_charge_flags: Record<string, { applies: boolean; country?: string }>;
  // Section 5: Non-EU Purchases
  non_eu_purchases: boolean;
  non_eu_purchase_details: Array<{
    transaction_id: string;
    import_vat_paid: boolean;
    import_vat_amount: number;
    import_type: "goods" | "services";
    deferred_vat: boolean;
    reverse_charge_applies: boolean;
    supplier_tax_id?: string;
  }>;
  // Section 6: Adjustments
  credit_notes: boolean;
  credit_notes_details: Array<{ description: string; amount: number }>;
  manual_adjustments: boolean;
  manual_adjustment_amount: number;
  manual_adjustment_reason: string;
  manual_adjustment_attachment: string;
  late_transactions: boolean;
  late_transactions_list: Array<{ description: string; date: string; amount: number }>;
  // Section 7: Compliance
  reviewed_flagged_transactions: boolean;
  confirm_accuracy: boolean;
  lock_period: boolean;
  vat_notes: string;
  declaration_true_and_complete: boolean;
  declaration_penalties_understood: boolean;
  declaration_period_lock_understood: boolean;
}

export const initialWizardData: VATWizardData = {
  vat_return_id: "",
  all_sales_added: null,
  unpaid_invoices: false,
  unpaid_invoices_list: [],
  special_sales: [],
  special_sales_notes: "",
  all_expenses_added: null,
  missing_receipts: false,
  missing_receipts_list: [],
  food_vat_claim: null,
  motor_vat_claim: null,
  remove_non_allowed_vat: null,
  remove_non_allowed_reason: "",
  eu_purchases: false,
  eu_purchase_ids: [],
  eu_reverse_charge_flags: {},
  non_eu_purchases: false,
  non_eu_purchase_details: [],
  credit_notes: false,
  credit_notes_details: [],
  manual_adjustments: false,
  manual_adjustment_amount: 0,
  manual_adjustment_reason: "",
  manual_adjustment_attachment: "",
  late_transactions: false,
  late_transactions_list: [],
  reviewed_flagged_transactions: false,
  confirm_accuracy: false,
  lock_period: false,
  vat_notes: "",
  declaration_true_and_complete: false,
  declaration_penalties_understood: false,
  declaration_period_lock_understood: false,
};

export function useVATWizardData(vatReturnId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["vat-wizard-data", user?.id, vatReturnId],
    queryFn: async (): Promise<VATWizardData | null> => {
      if (!vatReturnId) return null;

      // Note: vat_finalisation_data table doesn't exist yet
      // Return null until the table is created
      return null;
    },
    enabled: !!user && !!vatReturnId,
  });
}

export function useSaveVATWizard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: VATWizardData) => {
      if (!user) throw new Error("Not authenticated");

      // Note: vat_finalisation_data table doesn't exist yet
      // Just return the data for now
      console.log("VAT Wizard data would be saved:", data);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["vat-wizard-data", user?.id, variables.vat_return_id] });
    },
    onError: (error) => {
      toast.error("Failed to save wizard data");
      console.error(error);
    },
  });
}

export function useFinaliseVATReturn() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vatReturnId, lockPeriod }: { vatReturnId: string; lockPeriod: boolean }) => {
      if (!user) throw new Error("Not authenticated");

      // Update VAT return status
      const { error: returnError } = await supabase
        .from("vat_returns")
        .update({
          status: "ready",
          lock_period: lockPeriod,
        })
        .eq("id", vatReturnId);

      if (returnError) throw returnError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat-returns"] });
      queryClient.invalidateQueries({ queryKey: ["vat-wizard-data"] });
      toast.success("VAT return finalised successfully");
    },
    onError: (error) => {
      toast.error("Failed to finalise VAT return");
      console.error(error);
    },
  });
}

export function useExpensesForPeriod(periodStart: string, periodEnd: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["expenses-for-vat-period", user?.id, periodStart, periodEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, supplier:suppliers(name), category:categories(name)")
        .eq("user_id", user!.id)
        .gte("expense_date", periodStart)
        .lte("expense_date", periodEnd)
        .order("expense_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!periodStart && !!periodEnd,
  });
}
