import { useMemo } from "react";
import { useAccounts } from "./useAccounts";
import { findMatchingAccount, getDefaultAccount, Account } from "@/lib/accountMapping";

/**
 * Hook for looking up accounts with caching and helper functions
 */
export function useAccountLookup() {
  const { data: accounts = [], isLoading, error } = useAccounts();

  const accountsByName = useMemo(() => {
    const map = new Map<string, Account>();
    (accounts as Account[]).forEach((a) => {
      map.set(a.name.toLowerCase(), a);
    });
    return map;
  }, [accounts]);

  const accountsByCode = useMemo(() => {
    const map = new Map<string, Account>();
    (accounts as Account[]).forEach((a) => {
      if (a.account_number) {
        map.set(a.account_number.toLowerCase(), a);
      }
    });
    return map;
  }, [accounts]);

  const findByName = (name: string): Account | null => {
    return accountsByName.get(name.toLowerCase()) || null;
  };

  const findByCode = (code: string): Account | null => {
    return accountsByCode.get(code.toLowerCase()) || null;
  };

  const findForTransaction = (
    autocatCategory: string,
    transactionType: "income" | "expense",
    vatRate?: string,
  ): Account | null => {
    return findMatchingAccount(autocatCategory, transactionType, vatRate, accounts as Account[]);
  };

  const getDefault = (transactionType: "income" | "expense"): Account | null => {
    return getDefaultAccount(transactionType, accounts as Account[]);
  };

  return {
    accounts: accounts as Account[],
    isLoading,
    error,
    findByName,
    findByCode,
    findForTransaction,
    getDefault,
  };
}
