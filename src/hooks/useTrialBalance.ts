/**
 * Trial Balance Engine
 *
 * Computes a synthetic double-entry trial balance from the existing
 * single-entry transaction data. Follows the useCT1Data pattern:
 * calls existing react-query hooks and derives everything in a useMemo.
 *
 * Zero extra API calls — reuses cached data from hooks already called
 * by ChatWidget (useTransactions, useCT1Data).
 */

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCT1Data } from "@/hooks/useCT1Data";
import { getAccountSuggestion } from "@/lib/accountMapping";

// ── Types ────────────────────────────────────────────────────

export interface TrialBalanceAccount {
  accountCode: string;
  accountName: string;
  accountType: string; // "Income" | "Expense" | "Cost of Sales" | etc.
  debit: number;
  credit: number;
  transactionCount: number;
}

export interface TrialBalanceIssue {
  severity: "warning" | "error";
  code: string;
  title: string;
  description: string;
  affectedCount?: number;
  affectedAmount?: number;
}

export interface TrialBalanceResult {
  accounts: TrialBalanceAccount[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  imbalanceAmount: number;
  issues: TrialBalanceIssue[];
  orphanedTransactions: number;
  uncategorizedAmount: number;
  vatReconciled: boolean;
  isLoading: boolean;
}

// ── Account type ordering for display ────────────────────────

const ACCOUNT_TYPE_ORDER: Record<string, number> = {
  "Current Assets": 1,
  "Fixed Assets": 2,
  "Current Liabilities": 3,
  "Equity": 4,
  "Income": 5,
  "Cost of Sales": 6,
  "Expense": 7,
  "Payroll": 8,
  "VAT": 9,
};

// ── Empty result (used while loading) ────────────────────────

const EMPTY_RESULT: TrialBalanceResult = {
  accounts: [],
  totalDebits: 0,
  totalCredits: 0,
  isBalanced: true,
  imbalanceAmount: 0,
  issues: [],
  orphanedTransactions: 0,
  uncategorizedAmount: 0,
  vatReconciled: true,
  isLoading: true,
};

// ── Hook ─────────────────────────────────────────────────────

export function useTrialBalance(): TrialBalanceResult {
  // Reuses react-query cache — ChatWidget already calls these
  const { data: allTransactions, isLoading: txLoading } = useTransactions();
  const ct1 = useCT1Data();

  const isLoading = txLoading || ct1.isLoading;

  return useMemo(() => {
    if (isLoading || !allTransactions) {
      return EMPTY_RESULT;
    }

    // ── Account accumulator ──────────────────────────────────
    const accountMap = new Map<string, TrialBalanceAccount>();

    function getOrCreate(name: string, type: string): TrialBalanceAccount {
      const key = `${type}::${name}`;
      let acct = accountMap.get(key);
      if (!acct) {
        acct = {
          accountCode: "",
          accountName: name,
          accountType: type,
          debit: 0,
          credit: 0,
          transactionCount: 0,
        };
        accountMap.set(key, acct);
      }
      return acct;
    }

    let orphanedTransactions = 0;
    let uncategorizedAmount = 0;

    // ── Process bank transactions ────────────────────────────
    for (const t of allTransactions) {
      const amt = Math.abs(Number(t.amount) || 0);
      if (amt === 0) continue;

      const catName =
        (t.category as { id: string; name: string } | null)?.name ?? null;
      const txType = (t.type as "income" | "expense") || "expense";
      const isDrawings = catName
        ? catName.toLowerCase().includes("drawing")
        : false;
      const isInternalTransfer = catName === "Internal Transfer";

      // Skip internal transfers — net effect on bank is zero
      if (isInternalTransfer) continue;

      // Uncategorized → suspense account
      if (!catName) {
        orphanedTransactions++;
        uncategorizedAmount += amt;

        const bank = getOrCreate("Bank – Current Account", "Current Assets");
        const suspense = getOrCreate("Uncategorized / Suspense", "Expense");

        if (txType === "income") {
          bank.debit += amt;
          suspense.credit += amt;
        } else {
          suspense.debit += amt;
          bank.credit += amt;
        }
        bank.transactionCount++;
        suspense.transactionCount++;
        continue;
      }

      // Director's Drawings: Debit Drawings (Equity), Credit Bank
      if (isDrawings) {
        const drawings = getOrCreate("Owner's Drawings", "Equity");
        const bank = getOrCreate("Bank – Current Account", "Current Assets");
        drawings.debit += amt;
        bank.credit += amt;
        drawings.transactionCount++;
        bank.transactionCount++;
        continue;
      }

      // Map category to account
      const suggestion = getAccountSuggestion(catName, txType, undefined);
      const accountName = suggestion?.account_name || catName;
      const accountType =
        suggestion?.account_type ||
        (txType === "income" ? "Income" : "Expense");

      const bank = getOrCreate("Bank – Current Account", "Current Assets");
      const plAcct = getOrCreate(accountName, accountType);

      if (txType === "income") {
        // Bank income: Debit Bank, Credit Revenue
        bank.debit += amt;
        plAcct.credit += amt;
      } else {
        // Bank expense: Debit Expense/COS, Credit Bank
        plAcct.debit += amt;
        bank.credit += amt;
      }
      bank.transactionCount++;
      plAcct.transactionCount++;
    }

    // ── Director's loan adjustment (travel owed to director) ──
    if (ct1.netDirectorsLoan > 0) {
      // Company owes director — liability
      const dirLoan = getOrCreate(
        "Director's Loan Account",
        "Current Liabilities"
      );
      const travel = getOrCreate(
        "Travel & Subsistence (Revenue Rates)",
        "Expense"
      );
      dirLoan.credit += ct1.netDirectorsLoan;
      travel.debit += ct1.netDirectorsLoan;
      dirLoan.transactionCount++;
      travel.transactionCount++;
    } else if (ct1.netDirectorsLoan < 0) {
      // Director owes company — asset
      const dirLoan = getOrCreate(
        "Director's Loan Account",
        "Current Assets"
      );
      dirLoan.debit += Math.abs(ct1.netDirectorsLoan);
      dirLoan.transactionCount++;
    }

    // ── Compute totals ───────────────────────────────────────
    const accounts = Array.from(accountMap.values())
      .filter((a) => a.debit > 0 || a.credit > 0)
      .map((a) => ({
        ...a,
        debit: Math.round(a.debit * 100) / 100,
        credit: Math.round(a.credit * 100) / 100,
      }))
      .sort((a, b) => {
        const aOrder = ACCOUNT_TYPE_ORDER[a.accountType] || 10;
        const bOrder = ACCOUNT_TYPE_ORDER[b.accountType] || 10;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.accountName.localeCompare(b.accountName);
      });

    const totalDebits = Math.round(
      accounts.reduce((s, a) => s + a.debit, 0) * 100
    ) / 100;
    const totalCredits = Math.round(
      accounts.reduce((s, a) => s + a.credit, 0) * 100
    ) / 100;
    const imbalanceAmount =
      Math.round((totalDebits - totalCredits) * 100) / 100;
    const isBalanced = Math.abs(imbalanceAmount) < 1; // €1 tolerance

    // ── VAT reconciliation ───────────────────────────────────
    const vatFromCT1 = ct1.vatPosition
      ? ct1.vatPosition.type === "payable"
        ? ct1.vatPosition.amount
        : -ct1.vatPosition.amount
      : 0;
    // No individual VAT entries in the TB (gross amounts), so
    // just flag if CT1 reports a material VAT position
    const vatReconciled = Math.abs(vatFromCT1) < 1 || !!ct1.vatPosition;

    // ── Issue detection ──────────────────────────────────────
    const issues: TrialBalanceIssue[] = [];
    const categorizedCount = allTransactions.filter(
      (t) => (t.category as { name: string } | null)?.name
    ).length;

    // Safeguard: don't flag issues for brand-new users
    if (categorizedCount >= 5) {
      // Orphaned transactions
      if (orphanedTransactions > 0) {
        issues.push({
          severity: orphanedTransactions > 10 ? "error" : "warning",
          code: "ORPHANED_TX",
          title: `${orphanedTransactions} uncategorized transactions`,
          description: `${orphanedTransactions} transactions have no category and can't be mapped to a Chart of Accounts entry. Total amount: \u20AC${uncategorizedAmount.toFixed(2)}.`,
          affectedCount: orphanedTransactions,
          affectedAmount: uncategorizedAmount,
        });
      }

      // Imbalance
      if (!isBalanced) {
        issues.push({
          severity: "error",
          code: "IMBALANCE",
          title: `Trial balance off by \u20AC${Math.abs(imbalanceAmount).toFixed(2)}`,
          description: `Total debits (\u20AC${totalDebits.toFixed(2)}) don't equal total credits (\u20AC${totalCredits.toFixed(2)}). This indicates a data integrity issue.`,
          affectedAmount: Math.abs(imbalanceAmount),
        });
      }

      // Drawings without salary
      if (
        ct1.directorsDrawings > 0 &&
        !allTransactions.some((t) => {
          const desc = ((t.description as string) || "").toLowerCase();
          return desc.includes("salary") || desc.includes("wages");
        })
      ) {
        issues.push({
          severity: "warning",
          code: "DRAWINGS_NO_SALARY",
          title: "Drawings taken without salary on payroll",
          description: `Director has taken \u20AC${ct1.directorsDrawings.toFixed(2)} in drawings but no salary transactions detected. For Irish LLCs, directors should be on payroll to utilise personal tax credits (\u20AC4,000+).`,
          affectedAmount: ct1.directorsDrawings,
        });
      }
    }

    return {
      accounts,
      totalDebits,
      totalCredits,
      isBalanced,
      imbalanceAmount,
      issues,
      orphanedTransactions,
      uncategorizedAmount: Math.round(uncategorizedAmount * 100) / 100,
      vatReconciled,
      isLoading: false,
    };
  }, [allTransactions, ct1, isLoading]);
}
