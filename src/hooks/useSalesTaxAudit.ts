import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { generateSalesTaxAuditReport, downloadCSV, SalesTaxAuditReport } from "@/lib/salesTaxAuditReport";
import { toast } from "sonner";

export function useSalesTaxAudit() {
  const { user, profile } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const fetchReportData = async (startDate: Date, endDate: Date) => {
    if (!user) throw new Error("Not authenticated");

    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    // Fetch transactions with categories and accounts for Section 59/60 deductibility
    const { data: transactions, error: txnError } = await supabase
      .from("transactions")
      .select(
        `
        id,
        transaction_date,
        description,
        amount,
        type,
        vat_rate,
        vat_amount,
        net_amount,
        bank_reference,
        is_business_expense,
        category:categories(id, name),
        account:accounts(name)
      `,
      )
      .eq("user_id", user.id)
      .gte("transaction_date", startStr)
      .lte("transaction_date", endStr)
      .order("transaction_date", { ascending: true });

    if (txnError) throw txnError;

    // Fetch expenses with categories and suppliers
    const { data: expenses, error: expError } = await supabase
      .from("expenses")
      .select(
        `
        id,
        expense_date,
        description,
        total_amount,
        vat_rate,
        vat_amount,
        net_amount,
        invoice_number,
        category:categories(id, name),
        supplier:suppliers(name)
      `,
      )
      .eq("user_id", user.id)
      .gte("expense_date", startStr)
      .lte("expense_date", endStr)
      .order("expense_date", { ascending: true });

    if (expError) throw expError;

    // Fetch invoices with customers and items
    const { data: invoices, error: invError } = await supabase
      .from("invoices")
      .select(
        `
        id,
        issue_date,
        invoice_number,
        total,
        vat_amount,
        subtotal,
        customer:customers(name),
        items:invoice_items(
          description,
          vat_rate,
          vat_amount,
          net_amount,
          total_amount
        )
      `,
      )
      .eq("user_id", user.id)
      .gte("issue_date", startStr)
      .lte("issue_date", endStr)
      .not("status", "eq", "cancelled")
      .order("issue_date", { ascending: true });

    if (invError) throw invError;

    return {
      transactions: transactions || [],
      expenses: expenses || [],
      invoices: invoices || [],
    };
  };

  const generateReport = async (startDate: Date, endDate: Date): Promise<SalesTaxAuditReport> => {
    const { transactions, expenses, invoices } = await fetchReportData(startDate, endDate);

    const businessName = profile?.business_name || "Business";

    return generateSalesTaxAuditReport(
      businessName,
      startDate,
      endDate,
      transactions as unknown[],
      expenses as unknown[],
      invoices as unknown[],
    );
  };

  const exportReport = async (startDate: Date, endDate: Date) => {
    setIsExporting(true);
    try {
      const report = await generateReport(startDate, endDate);
      downloadCSV(report);
      toast.success("Sales Tax Audit Report exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export report");
    } finally {
      setIsExporting(false);
    }
  };

  return {
    generateReport,
    exportReport,
    isExporting,
  };
}
