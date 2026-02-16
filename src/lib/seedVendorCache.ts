import { vendorDatabase } from "./vendorDatabase";
import { saveVendorCacheBatch, type VendorCacheEntry } from "@/services/vendorCacheService";

/**
 * One-time seed: populate the vendor_cache table from the hardcoded vendorDatabase.
 * Each vendor's patterns become individual cache entries.
 * Idempotent — uses upsert, so safe to run multiple times.
 */
export async function seedVendorCacheFromDatabase(userId: string): Promise<number> {
  const entries: Array<Omit<VendorCacheEntry, "id" | "hit_count" | "last_seen">> = [];

  for (const vendor of vendorDatabase) {
    for (const pattern of vendor.patterns) {
      entries.push({
        vendor_pattern: pattern,
        normalized_name: vendor.name,
        category: vendor.category,
        vat_type: vendor.vat_type,
        vat_deductible: vendor.vat_deductible,
        business_purpose: vendor.purpose,
        confidence: 85, // Rule-based entries get high confidence
        source: "rule",
        mcc_code: vendor.mcc_codes?.[0] ?? null,
        sector: vendor.sector ?? null,
      });
    }
  }

  console.log(`[SeedVendorCache] Preparing ${entries.length} entries from ${vendorDatabase.length} vendors`);
  return saveVendorCacheBatch(userId, entries);
}
