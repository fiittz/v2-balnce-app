import { supabase } from "@/integrations/supabase/client";

export interface VendorCacheEntry {
  id: string;
  vendor_pattern: string;
  normalized_name: string;
  category: string;
  vat_type: string;
  vat_deductible: boolean;
  business_purpose: string | null;
  confidence: number;
  source: string; // 'rule' | 'ai' | 'user' | 'cross_user'
  mcc_code: number | null;
  sector: string | null;
  hit_count: number;
  last_seen: string;
}

/**
 * Load the full vendor cache for a user.
 * Returns both global entries (user_id IS NULL) and user-specific entries.
 * User entries override global entries for the same pattern.
 *
 * Returns a Map keyed by normalized vendor_pattern for O(1) lookup.
 */
export async function loadVendorCache(userId: string): Promise<Map<string, VendorCacheEntry>> {
  try {
    // RLS handles filtering: global (user_id IS NULL) + user's own entries
    const { data, error } = await supabase
      .from("vendor_cache")
      .select("*")
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order("source", { ascending: true }); // rule < ai < user — user overrides

    if (error) {
      console.error("[VendorCache] Load error:", error);
      return new Map();
    }

    const cache = new Map<string, VendorCacheEntry>();
    for (const row of data ?? []) {
      // Later entries (user-specific) override earlier ones (global)
      cache.set(row.vendor_pattern, row as VendorCacheEntry);
    }

    console.log(`[VendorCache] Loaded ${cache.size} entries for user`);
    return cache;
  } catch (error) {
    console.error("[VendorCache] Failed to load:", error);
    return new Map();
  }
}

/**
 * Save or upsert a single vendor cache entry for a user.
 */
export async function saveVendorCacheEntry(
  userId: string,
  entry: Omit<VendorCacheEntry, "id" | "hit_count" | "last_seen">,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("vendor_cache").upsert(
      {
        vendor_pattern: entry.vendor_pattern,
        normalized_name: entry.normalized_name,
        category: entry.category,
        vat_type: entry.vat_type,
        vat_deductible: entry.vat_deductible,
        business_purpose: entry.business_purpose,
        confidence: entry.confidence,
        source: entry.source,
        user_id: userId,
        mcc_code: entry.mcc_code,
        sector: entry.sector,
        hit_count: 1,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "vendor_pattern,user_id" },
    );

    if (error) {
      console.error("[VendorCache] Save error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[VendorCache] Failed to save:", error);
    return false;
  }
}

/**
 * Record a cache hit: increment hit_count and update last_seen.
 * Fire-and-forget — errors are logged but don't affect the caller.
 */
export async function recordCacheHit(entryId: string): Promise<void> {
  try {
    // Use RPC or raw update. Since Supabase doesn't support increment natively
    // in the JS client, we fetch + update.
    const { data, error: fetchError } = await supabase
      .from("vendor_cache")
      .select("hit_count")
      .eq("id", entryId)
      .single();

    if (fetchError || !data) return;

    await supabase
      .from("vendor_cache")
      .update({
        hit_count: (data.hit_count ?? 0) + 1,
        last_seen: new Date().toISOString(),
      })
      .eq("id", entryId);
  } catch {
    // Fire-and-forget
  }
}

/**
 * Save multiple vendor cache entries in a batch (for seeding).
 */
export async function saveVendorCacheBatch(
  userId: string,
  entries: Array<Omit<VendorCacheEntry, "id" | "hit_count" | "last_seen">>,
): Promise<number> {
  if (entries.length === 0) return 0;

  try {
    const rows = entries.map((e) => ({
      vendor_pattern: e.vendor_pattern,
      normalized_name: e.normalized_name,
      category: e.category,
      vat_type: e.vat_type,
      vat_deductible: e.vat_deductible,
      business_purpose: e.business_purpose,
      confidence: e.confidence,
      source: e.source,
      user_id: userId,
      mcc_code: e.mcc_code,
      sector: e.sector,
      hit_count: 0,
      last_seen: new Date().toISOString(),
    }));

    // Upsert in batches of 50 to avoid payload limits
    const BATCH_SIZE = 50;
    let saved = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("vendor_cache").upsert(batch, { onConflict: "vendor_pattern,user_id" });

      if (error) {
        console.error(`[VendorCache] Batch save error at offset ${i}:`, error);
      } else {
        saved += batch.length;
      }
    }

    console.log(`[VendorCache] Seeded ${saved}/${entries.length} entries`);
    return saved;
  } catch (error) {
    console.error("[VendorCache] Batch save failed:", error);
    return 0;
  }
}
