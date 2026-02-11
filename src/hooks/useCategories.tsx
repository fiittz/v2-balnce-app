import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { seedDefaultCategories } from "@/lib/seedCategories";

export interface Category {
  id: string;
  name: string;
  type: string;
  account_code: string | null;
  vat_rate: number | null;
  parent_id: string | null;
  user_id: string;
  created_at: string | null;
}

export function useCategories(type?: "income" | "expense") {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["categories", user?.id, type],
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

      let { data, error } = await query;
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

          const { data: refetchedData, error: refetchError } = await refetchQuery;
          if (refetchError) throw refetchError;
          data = refetchedData;
        }
      }

      return data as Category[];
    },
    enabled: !!user,
  });
}

export function useExpenseCategories() {
  return useCategories("expense");
}

export function useIncomeCategories() {
  return useCategories("income");
}
