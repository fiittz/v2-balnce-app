import { supabase } from "@/integrations/supabase/client";

const LOCAL_STORAGE_KEY = "balnce_financial_accounts";
const MIGRATION_FLAG = "balnce_accounts_migrated";

/**
 * One-time migration: moves localStorage accounts into Supabase
 * and assigns orphaned transactions (account_id IS NULL) to the
 * default business account.
 */
export async function migrateLocalAccounts(userId: string): Promise<void> {
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) return;

    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      await assignOrphanedTransactions(userId);
      localStorage.setItem(MIGRATION_FLAG, "1");
      return;
    }

    let localAccounts: { id: string; name: string; type?: string; description?: string }[];
    try {
      localAccounts = JSON.parse(raw);
    } catch {
      localStorage.setItem(MIGRATION_FLAG, "1");
      return;
    }

    if (!Array.isArray(localAccounts) || localAccounts.length === 0) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      await assignOrphanedTransactions(userId);
      localStorage.setItem(MIGRATION_FLAG, "1");
      return;
    }

    const { data: existing } = await supabase
      .from("accounts")
      .select("name")
      .eq("user_id", userId);

    const existingNames = new Set((existing ?? []).map((a) => a.name.toLowerCase()));

    const toInsert = localAccounts
      .filter((la) => !existingNames.has(la.name.toLowerCase()))
      .map((la) => ({
        user_id: userId,
        name: la.name,
        account_type: la.type || "limited_company",
        currency: "EUR",
        balance: 0,
        is_default: false,
      }));

    if (toInsert.length > 0) {
      await supabase.from("accounts").insert(toInsert);
    }

    localStorage.removeItem(LOCAL_STORAGE_KEY);
    await assignOrphanedTransactions(userId);
    localStorage.setItem(MIGRATION_FLAG, "1");
  } catch (err) {
    console.error("migrateLocalAccounts failed (non-fatal):", err);
    localStorage.setItem(MIGRATION_FLAG, "1");
  }
}

/**
 * Assigns all transactions with account_id = NULL to the user's
 * default (is_default = true) business account.
 */
async function assignOrphanedTransactions(userId: string): Promise<void> {
  const { data: defaultAccount } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  if (!defaultAccount) return;

  await supabase
    .from("transactions")
    .update({ account_id: defaultAccount.id })
    .eq("user_id", userId)
    .is("account_id", null);
}
