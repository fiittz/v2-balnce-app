import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useDirectorOnboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["director-onboarding", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("director_onboarding")
        .select("*")
        .eq("user_id", user!.id)
        .order("director_number", { ascending: true });

      if (error) {
        console.error("Error fetching director onboarding:", error);
        return [];
      }

      return data ?? [];
    },
  });

  // Stable reference — only changes when query.data changes
  const getDirector = useCallback(
    (directorNumber: number) => {
      const row = query.data?.find((d) => d.director_number === directorNumber);
      if (!row?.onboarding_data) return null;
      return row.onboarding_data as Record<string, unknown>;
    },
    [query.data],
  );

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["director-onboarding", user?.id] }),
    [queryClient, user?.id],
  );

  return { ...query, getDirector, invalidate };
}
