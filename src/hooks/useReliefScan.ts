import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { scanForReliefs, type ReliefScanResult } from "@/lib/reliefScanner";

/**
 * Scans transactions for the relevant tax year
 * and returns auto-detected Form 11 relief amounts.
 *
 * Pass `accountType` to restrict the scan to a specific account type
 * (e.g. "directors_personal_tax"). If omitted, scans all transactions.
 */
export function useReliefScan(options?: { accountType?: string }) {
  // Same tax-year logic as useForm11Data
  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const startDate = `${taxYear}-01-01`;
  const endDate = `${taxYear}-12-31`;

  const { data: expenses, isLoading } = useTransactions({
    type: "expense",
    startDate,
    endDate,
    accountType: options?.accountType,
  });

  const reliefs = useMemo<ReliefScanResult | null>(() => {
    if (!expenses) return null;
    return scanForReliefs(expenses);
  }, [expenses]);

  return { reliefs, isLoading, taxYear };
}
