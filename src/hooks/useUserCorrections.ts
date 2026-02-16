import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { loadUserCorrections, type UserCorrection } from "@/services/userCorrectionService";

/**
 * React Query hook to preload user corrections on page load.
 * Corrections with transaction_count >= 2 are used in autoCategorise().
 */
export function useUserCorrections() {
  const { user } = useAuth();

  const { data: userCorrections, isLoading, error } = useQuery({
    queryKey: ["user-corrections", user?.id],
    queryFn: () => loadUserCorrections(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    userCorrections: userCorrections ?? new Map<string, UserCorrection>(),
    isLoading,
    error,
  };
}
