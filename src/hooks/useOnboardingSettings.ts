import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useOnboardingSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["onboarding-settings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching onboarding settings:", error);
        return null;
      }

      return data;
    },
  });
}
