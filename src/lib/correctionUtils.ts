/** Shared types and pure functions for user corrections — no Supabase dependency. */

export interface UserCorrection {
  id: string;
  user_id: string;
  vendor_pattern: string;
  original_category: string | null;
  corrected_category: string;
  corrected_category_id: string;
  corrected_vat_rate: number | null;
  transaction_count: number;
  promoted_to_cache: boolean;
}

/** Confidence thresholds for promotion logic. */
const CORRECTION_CONFIDENCE_2 = 80;
const CORRECTION_CONFIDENCE_3 = 90;
export const PROMOTION_THRESHOLD = 3;

/**
 * Extract a vendor pattern from a transaction description.
 * Takes the first 3 meaningful tokens, lowercased.
 */
export function extractVendorPattern(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 3)
    .join(" ")
    .trim();
}

/**
 * Get the confidence for a user correction based on transaction_count.
 */
export function getCorrectionConfidence(correction: UserCorrection): number {
  if (correction.transaction_count >= PROMOTION_THRESHOLD) return CORRECTION_CONFIDENCE_3;
  if (correction.transaction_count >= 2) return CORRECTION_CONFIDENCE_2;
  return 0; // 1 correction = not used
}
