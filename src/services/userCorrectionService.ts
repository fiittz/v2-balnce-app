import { supabase } from "@/integrations/supabase/client";
import { saveVendorCacheEntry } from "./vendorCacheService";
import {
  extractVendorPattern,
  getCorrectionConfidence,
  PROMOTION_THRESHOLD,
  type UserCorrection,
} from "@/lib/correctionUtils";

// Re-export for consumers that import from the service
export { extractVendorPattern, getCorrectionConfidence, type UserCorrection };

/**
 * Record a user correction when they manually change a transaction's category.
 * If the same vendor pattern was corrected before, increment transaction_count.
 * At 3+ corrections, auto-promote to vendor_cache.
 */
export async function recordCorrection(
  userId: string,
  description: string,
  originalCategory: string | null,
  correctedCategory: string,
  correctedCategoryId: string,
  correctedVatRate: number | null
): Promise<void> {
  const vendorPattern = extractVendorPattern(description);
  if (!vendorPattern) return;

  try {
    const { data: existing } = await supabase
      .from("user_corrections")
      .select("*")
      .eq("user_id", userId)
      .eq("vendor_pattern", vendorPattern)
      .maybeSingle();

    if (existing) {
      const newCount = (existing.transaction_count ?? 1) + 1;

      await supabase
        .from("user_corrections")
        .update({
          corrected_category: correctedCategory,
          corrected_category_id: correctedCategoryId,
          corrected_vat_rate: correctedVatRate,
          transaction_count: newCount,
        })
        .eq("id", existing.id);

      if (newCount >= PROMOTION_THRESHOLD && !existing.promoted_to_cache) {
        await promoteToVendorCache(userId, vendorPattern, correctedCategory, correctedVatRate);

        await supabase
          .from("user_corrections")
          .update({ promoted_to_cache: true })
          .eq("id", existing.id);

        console.log(`[UserCorrections] Promoted "${vendorPattern}" to vendor cache (${newCount} corrections)`);
      }
    } else {
      await supabase.from("user_corrections").insert({
        user_id: userId,
        vendor_pattern: vendorPattern,
        original_category: originalCategory,
        corrected_category: correctedCategory,
        corrected_category_id: correctedCategoryId,
        corrected_vat_rate: correctedVatRate,
        transaction_count: 1,
      });
    }
  } catch (error) {
    console.error("[UserCorrections] Failed to record:", error);
  }
}

/**
 * Load all user corrections as a Map keyed by vendor_pattern.
 * Only returns corrections with transaction_count >= 2 (minimum to be actionable).
 */
export async function loadUserCorrections(
  userId: string
): Promise<Map<string, UserCorrection>> {
  try {
    const { data, error } = await supabase
      .from("user_corrections")
      .select("*")
      .eq("user_id", userId)
      .gte("transaction_count", 2);

    if (error) {
      console.error("[UserCorrections] Load error:", error);
      return new Map();
    }

    const map = new Map<string, UserCorrection>();
    for (const row of data ?? []) {
      map.set(row.vendor_pattern, row as UserCorrection);
    }

    console.log(`[UserCorrections] Loaded ${map.size} corrections for user`);
    return map;
  } catch (error) {
    console.error("[UserCorrections] Failed to load:", error);
    return new Map();
  }
}

/**
 * Promote a correction to the vendor_cache table.
 */
async function promoteToVendorCache(
  userId: string,
  vendorPattern: string,
  category: string,
  vatRate: number | null
): Promise<void> {
  let vatType = "Standard 23%";
  if (vatRate === 13.5) vatType = "Reduced 13.5%";
  else if (vatRate === 9) vatType = "Second Reduced 9%";
  else if (vatRate === 0) vatType = "Zero";
  else if (vatRate === null) vatType = "N/A";

  await saveVendorCacheEntry(userId, {
    vendor_pattern: vendorPattern,
    normalized_name: vendorPattern,
    category,
    vat_type: vatType,
    vat_deductible: vatRate !== null && vatRate > 0,
    business_purpose: `User-corrected category (${PROMOTION_THRESHOLD}+ corrections).`,
    confidence: 90,
    source: "user",
    mcc_code: null,
    sector: null,
  });
}
