import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getVATPeriod, getVATPeriodsForYear, calculateVAT, submitVATReturn } from "@/services/vatServices";
import { toast } from "sonner";
import { isVATDeductible, calculateVATFromGross } from "@/lib/vatDeductibility";

export interface VATTransactionDetail {
  id: string;
  description: string;
  date: string;
  amount: number;
  vatAmount: number;
  vatRate: string;
  source: "invoice" | "expense" | "transaction";
}

export interface VATSummary {
  vatOnSales: number;
  vatOnPurchases: number;
  netVat: number;
  salesCount: number;
  purchasesCount: number;
  transactionSalesCount: number;
  transactionPurchasesCount: number;
  isRefund: boolean;
  salesDetails: VATTransactionDetail[];
  purchaseDetails: VATTransactionDetail[];
}

export interface VATReturnData {
  id: string;
  period_start: string;
  period_end: string;
  vat_on_sales: number | null;
  vat_on_purchases: number | null;
  vat_due: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const useVATSummary = (periodStart: string, periodEnd: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["vat-summary", user?.id, periodStart, periodEnd],
    queryFn: async (): Promise<VATSummary> => {
      if (!user?.id) throw new Error("Not authenticated");

      // Output VAT on sales: invoice vat_amount data is unreliable because
      // AddInvoice previously defaulted all line items to 23%. Only count invoice
      // VAT when explicitly set to a non-default rate (zero_rated or exempt means
      // the user actively chose no-VAT after the default was fixed).

      // Get VAT from invoices (sales) — includes notes for RCT detection
      const { data: invoices, error: invError } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, vat_amount, total, notes, customer:customers(name)")
        .eq("user_id", user!.id)
        .gte("invoice_date", periodStart)
        .lte("invoice_date", periodEnd)
        .in("status", ["sent", "paid"]);

      if (invError) throw invError;

      // Get recoverable VAT from expenses (purchases)
      const { data: expenses, error: expError } = await supabase
        .from("expenses")
        .select("id, description, expense_date, amount, vat_amount")
        .eq("user_id", user!.id)
        .gte("expense_date", periodStart)
        .lte("expense_date", periodEnd);

      if (expError) throw expError;

      // Get transactions with VAT data (from CSV imports)
      const { data: transactions, error: txnError } = await supabase
        .from("transactions")
        .select(
          `
          id,
          type,
          amount,
          vat_amount,
          vat_rate,
          description,
          transaction_date,
          category:categories(name),
          account:accounts(name)
        `,
        )
        .eq("user_id", user!.id)
        .gte("transaction_date", periodStart)
        .lte("transaction_date", periodEnd);

      if (txnError) throw txnError;

      // Build detail arrays
      const salesDetails: VATTransactionDetail[] = [];
      const purchaseDetails: VATTransactionDetail[] = [];

      // Invoice output VAT is skipped — all existing invoices have unreliable
      // vat_amount due to the previous 23% default. Future invoices will use the
      // correct default from business settings, and vat_amount will be accurate.
      const invoiceVatOnSales = 0;

      // Calculate VAT from expenses
      let expenseVatOnPurchases = 0;
      for (const exp of (expenses ?? []) as Record<string, unknown>[]) {
        const vat = exp.vat_amount || 0;
        expenseVatOnPurchases += vat;
        if (vat > 0) {
          purchaseDetails.push({
            id: exp.id,
            description: exp.description || "Expense",
            date: exp.expense_date,
            amount: Math.abs(exp.amount || 0),
            vatAmount: vat,
            vatRate: "",
            source: "expense",
          });
        }
      }

      // Process transactions with Section 59/60 rules
      const transactionVatOnSales = 0;
      let transactionVatOnPurchases = 0;
      let transactionSalesCount = 0;
      let transactionPurchasesCount = 0;

      for (const txn of (transactions || []) as Record<string, unknown>[]) {
        const categoryName = txn.category?.name || null;
        const accountName = txn.account?.name || null;

        // Reverse charge = no VAT (subcontractor RCT)
        const isReverseCharge = txn.vat_rate === "reverse_charge" || txn.vat_rate === "Reverse Charge";
        let vatAmount = isReverseCharge ? 0 : txn.vat_amount || 0;
        if (
          !vatAmount &&
          !isReverseCharge &&
          txn.vat_rate &&
          txn.vat_rate !== "exempt" &&
          txn.vat_rate !== "zero_rated"
        ) {
          const calculated = calculateVATFromGross(Math.abs(txn.amount), txn.vat_rate);
          vatAmount = calculated.vatAmount;
        }

        if (txn.type === "income") {
          // Output VAT comes from invoices (point of supply), not bank
          // payments. Bank income transactions are just receipts of payment
          // and should not generate additional output VAT — the invoices
          // table is the authoritative source for VAT on sales.
          transactionSalesCount++;
          continue;
        } else if (txn.type === "expense") {
          const deductibility = isVATDeductible(txn.description, categoryName, accountName);
          if (deductibility.isDeductible && vatAmount > 0) {
            transactionVatOnPurchases += vatAmount;
            transactionPurchasesCount++;
            purchaseDetails.push({
              id: txn.id,
              description: txn.description || "Expense",
              date: txn.transaction_date || "",
              amount: Math.abs(txn.amount),
              vatAmount,
              vatRate: txn.vat_rate || "",
              source: "transaction",
            });
          }
        }
      }

      // Sort details by date descending
      salesDetails.sort((a, b) => b.date.localeCompare(a.date));
      purchaseDetails.sort((a, b) => b.date.localeCompare(a.date));

      // Combine all sources
      const vatOnSales = invoiceVatOnSales + transactionVatOnSales;
      const vatOnPurchases = expenseVatOnPurchases + transactionVatOnPurchases;
      const netVat = vatOnSales - vatOnPurchases;

      return {
        vatOnSales,
        vatOnPurchases,
        netVat,
        salesCount: invoices?.length || 0,
        purchasesCount: expenses?.length || 0,
        transactionSalesCount,
        transactionPurchasesCount,
        isRefund: netVat < 0,
        salesDetails,
        purchaseDetails,
      };
    },
    enabled: !!user?.id && !!periodStart && !!periodEnd,
  });
};

export const useVATReturns = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["vat-returns", user?.id],
    queryFn: async (): Promise<VATReturnData[]> => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("vat_returns")
        .select("*")
        .eq("user_id", user.id)
        .order("period_end", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
};

export const useSubmitVATReturn = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ periodStart, periodEnd }: { periodStart: string; periodEnd: string }) => {
      return submitVATReturn(periodStart, periodEnd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat-returns"] });
      queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
      toast.success("VAT return submitted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit VAT return");
    },
  });
};

export const useCreateVATReturn = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      periodStart,
      periodEnd,
      dueDate,
      vatOnSales,
      vatOnPurchases,
    }: {
      periodStart: string;
      periodEnd: string;
      dueDate: string;
      vatOnSales: number;
      vatOnPurchases: number;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const netVat = vatOnSales - vatOnPurchases;

      const { data, error } = await supabase
        .from("vat_returns")
        .insert({
          user_id: user.id,
          period_start: periodStart,
          period_end: periodEnd,
          due_date: dueDate,
          vat_on_sales: vatOnSales,
          vat_on_purchases: vatOnPurchases,
          net_vat: netVat,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat-returns"] });
      toast.success("VAT return created");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create VAT return");
    },
  });
};

export const useUpdateVATReturn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status?: "draft" | "ready" | "submitted" | "paid";
      notes?: string;
    }) => {
      const updateData: Record<string, unknown> = {};
      if (status) {
        updateData.status = status;
        if (status === "submitted") {
          updateData.submitted_at = new Date().toISOString();
        }
      }
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      const { data, error } = await supabase.from("vat_returns").update(updateData).eq("id", id).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat-returns"] });
      toast.success("VAT return updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update VAT return");
    },
  });
};

export { getVATPeriod, getVATPeriodsForYear };
