import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { seedDefaultCategories, ensureNewCategories } from "@/lib/seedCategories";

export interface Category {
  id: string;
  name: string;
  type: string;
  account_code: string | null;
  account_type: string;
  vat_rate: number | null;
  parent_id: string | null;
  user_id: string;
  created_at: string | null;
}

/**
 * accountType filter:
 * - "limited_company" → returns categories where account_type IN ('business', 'both')
 * - "directors_personal_tax" → returns categories where account_type IN ('personal', 'both')
 * - undefined → returns all categories (backwards compatible)
 */
export function useCategories(type?: "income" | "expense", accountType?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["categories", user?.id, type, accountType],
    queryFn: async () => {
      // First, check if categories exist
      let query = supabase
        .from("categories")
        .select("*")
        .eq("user_id", user!.id)
        .order("name");

      if (type) {
        query = query.eq("type", type);
      }

      // Filter by account type
      if (accountType === "limited_company") {
        query = query.in("account_type", ["business", "both"]);
      } else if (accountType === "directors_personal_tax") {
        query = query.in("account_type", ["personal", "both"]);
      }

      const { data: initialData, error } = await query;
      let data = initialData;
      if (error) throw error;

      // If no categories exist, seed defaults and refetch
      if ((!data || data.length === 0) && user?.id) {
        console.log("No categories found, seeding defaults...");
        const seeded = await seedDefaultCategories(user.id);
        if (seeded) {
          // Refetch after seeding
          let refetchQuery = supabase
            .from("categories")
            .select("*")
            .eq("user_id", user!.id)
            .order("name");

          if (type) {
            refetchQuery = refetchQuery.eq("type", type);
          }

          if (accountType === "limited_company") {
            refetchQuery = refetchQuery.in("account_type", ["business", "both"]);
          } else if (accountType === "directors_personal_tax") {
            refetchQuery = refetchQuery.in("account_type", ["personal", "both"]);
          }

          const { data: refetchedData, error: refetchError } = await refetchQuery;
          if (refetchError) throw refetchError;
          data = refetchedData;
        }
      } else if (data && data.length > 0 && user?.id) {
        // Ensure newer categories (Subsistence, personal categories, etc.) exist for existing users
        await ensureNewCategories(user.id);
        // Re-fetch in case new categories were added
        let refetchQuery = supabase
          .from("categories")
          .select("*")
          .eq("user_id", user!.id)
          .order("name");
        if (type) {
          refetchQuery = refetchQuery.eq("type", type);
        }
        if (accountType === "limited_company") {
          refetchQuery = refetchQuery.in("account_type", ["business", "both"]);
        } else if (accountType === "directors_personal_tax") {
          refetchQuery = refetchQuery.in("account_type", ["personal", "both"]);
        }
        const { data: updated } = await refetchQuery;
        if (updated) data = updated;
      }

      return data as Category[];
    },
    enabled: !!user,
  });
}

export function useExpenseCategories(accountType?: string) {
  return useCategories("expense", accountType);
}

export function useIncomeCategories(accountType?: string) {
  return useCategories("income", accountType);
}
