import { supabase } from "@/integrations/supabase/client";
import { lookupVendor, type VendorLookupResult } from "./vendorLookupService";
import { saveVendorCacheEntry, type VendorCacheEntry } from "./vendorCacheService";

export interface EnrichmentProgress {
  total: number;
  processed: number;
  enriched: number;
  skipped: number;
  failed: number;
  isComplete: boolean;
}

export interface EnrichmentOptions {
  userId: string;
  transactionIds: string[];
  vendorCache: Map<string, VendorCacheEntry>;
  userIndustry?: string;
  userBusinessType?: string;
  onProgress?: (progress: EnrichmentProgress) => void;
}

const MAX_ENRICHMENTS = 50;
const CONCURRENT_LIMIT = 5;
const DELAY_MS = 500;

/**
 * Map AI vat_rate_suggestion to our vat_type format.
 */
function mapAiVatRate(suggestion: string): { vat_type: string; vat_deductible: boolean } {
  const s = suggestion.toLowerCase();
  if (s.includes("23")) return { vat_type: "Standard 23%", vat_deductible: true };
  if (s.includes("13.5") || s.includes("13,5")) return { vat_type: "Reduced 13.5%", vat_deductible: true };
  if (s.includes("9") && !s.includes("23")) return { vat_type: "Second Reduced 9%", vat_deductible: true };
  if (s.includes("zero")) return { vat_type: "Zero", vat_deductible: false };
  if (s.includes("exempt")) return { vat_type: "Exempt", vat_deductible: false };
  return { vat_type: "Standard 23%", vat_deductible: true };
}

/**
 * Async enrichment for low-confidence/uncategorized transactions.
 * Never blocks CSV import — called after sync categorization completes.
 *
 * 1. Fetches uncategorized transactions by ID
 * 2. Deduplicates by vendor description
 * 3. Checks vendor_cache before calling AI (skip if cached)
 * 4. Calls existing vendorLookupService for unknowns
 * 5. Saves results to vendor_cache with source='ai'
 * 6. Updates transactions with enriched categories
 */
export async function enrichLowConfidenceTransactions(
  options: EnrichmentOptions
): Promise<EnrichmentProgress> {
  const { userId, transactionIds, vendorCache, userIndustry, userBusinessType, onProgress } = options;

  const progress: EnrichmentProgress = {
    total: 0,
    processed: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    isComplete: false,
  };

  try {
    // 1. Fetch the transactions that need enrichment
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("id, description, amount, type, category_id")
      .in("id", transactionIds)
      .is("category_id", null);

    if (error || !transactions || transactions.length === 0) {
      progress.isComplete = true;
      onProgress?.(progress);
      return progress;
    }

    // 2. Deduplicate by normalized description (lookup each unique vendor once)
    const vendorMap = new Map<string, { description: string; amount: number; txnIds: string[] }>();
    for (const txn of transactions) {
      const key = txn.description.toLowerCase().trim();
      const existing = vendorMap.get(key);
      if (existing) {
        existing.txnIds.push(txn.id);
      } else {
        vendorMap.set(key, {
          description: txn.description,
          amount: Math.abs(txn.amount),
          txnIds: [txn.id],
        });
      }
    }

    // Cap at MAX_ENRICHMENTS unique vendors
    const uniqueVendors = Array.from(vendorMap.values()).slice(0, MAX_ENRICHMENTS);
    progress.total = uniqueVendors.length;
    onProgress?.(progress);

    // 3. Process in batches with rate limiting
    for (let i = 0; i < uniqueVendors.length; i += CONCURRENT_LIMIT) {
      const batch = uniqueVendors.slice(i, i + CONCURRENT_LIMIT);

      const results = await Promise.allSettled(
        batch.map(async (vendor) => {
          // 3a. Check vendor cache first
          const cacheKey = vendor.description.toLowerCase().trim();
          if (vendorCache.has(cacheKey)) {
            progress.skipped++;
            return null;
          }

          // 3b. Call AI vendor lookup
          try {
            const aiResult = await lookupVendor(
              vendor.description,
              vendor.amount,
              userIndustry,
              userBusinessType
            );

            if (aiResult.confidence < 30) {
              progress.skipped++;
              return null;
            }

            // 3c. Save to vendor_cache
            const { vat_type, vat_deductible } = mapAiVatRate(aiResult.vat_rate_suggestion);
            await saveVendorCacheEntry(userId, {
              vendor_pattern: cacheKey,
              normalized_name: aiResult.vendor_name || vendor.description,
              category: aiResult.category_suggestion,
              vat_type,
              vat_deductible,
              business_purpose: aiResult.explanation,
              confidence: Math.min(aiResult.confidence, 80), // Cap AI confidence at 80
              source: "ai",
              mcc_code: null,
              sector: null,
            });

            // 3d. Update transactions with this vendor
            const { data: categories } = await supabase
              .from("categories")
              .select("id, name")
              .eq("user_id", userId)
              .ilike("name", `%${aiResult.category_suggestion}%`)
              .limit(1);

            if (categories && categories.length > 0) {
              const vatRate = parseFloat(
                aiResult.vat_rate_suggestion.replace(/[^0-9.]/g, "")
              ) || 0;

              await supabase
                .from("transactions")
                .update({
                  category_id: categories[0].id,
                  vat_rate: vatRate,
                  notes: `[AI] ${aiResult.explanation}`,
                })
                .in("id", vendor.txnIds);

              progress.enriched++;
            } else {
              progress.skipped++;
            }

            return aiResult;
          } catch {
            progress.failed++;
            return null;
          }
        })
      );

      progress.processed += batch.length;
      onProgress?.(progress);

      // Rate limit delay between batches
      if (i + CONCURRENT_LIMIT < uniqueVendors.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }
  } catch (error) {
    console.error("[PostImportEnrichment] Failed:", error);
  }

  progress.isComplete = true;
  onProgress?.(progress);
  return progress;
}
