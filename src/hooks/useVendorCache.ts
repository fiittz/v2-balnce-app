import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { loadVendorCache, type VendorCacheEntry } from "@/services/vendorCacheService";

/**
 * React Query hook to preload the vendor cache on page load.
 * The cache is loaded asynchronously but used synchronously inside autoCategorise().
 *
 * Usage:
 *   const { vendorCache, isLoading } = useVendorCache();
 *   // Pass vendorCache to autoCategorise() or import workflows
 */
export function useVendorCache() {
  const { user } = useAuth();

  const { data: vendorCache, isLoading, error } = useQuery({
    queryKey: ["vendor-cache", user?.id],
    queryFn: () => loadVendorCache(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });

  return {
    vendorCache: vendorCache ?? new Map<string, VendorCacheEntry>(),
    isLoading,
    error,
  };
}
