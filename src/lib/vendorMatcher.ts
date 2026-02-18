// Vendor matching engine: exact → fuzzy → MCC fallback.
// All synchronous, no network calls. Performance target: <1ms per transaction.

import { vendorDatabase, type VendorEntry } from "./vendorDatabase";
import { lookupMCCWithFallback, type MCCMapping } from "./mccCodes";

export interface VendorMatchResult {
  vendor: VendorEntry;
  matchType: "exact" | "fuzzy" | "mcc";
  matchedPattern?: string;
  confidence: number; // 0-100, adjusted based on match type
  /** For fuzzy matches, the similarity score (0-1) */
  similarity?: number;
  /** Amount-based overrides if applicable */
  adjustedCategory?: string;
  adjustedConfidence?: number;
  adjustedPurpose?: string;
  adjustedVatDeductible?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// TEXT NORMALIZATION
// ═══════════════════════════════════════════════════════════════

function normalise(text: string | undefined | null): string {
  return (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

// ═══════════════════════════════════════════════════════════════
// LEVENSHTEIN DISTANCE (no external dependency)
// ═══════════════════════════════════════════════════════════════

/** Calculate Levenshtein distance between two strings. */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Early exits
  if (m === 0) return n;
  if (n === 0) return m;

  // Use single-row optimization (O(min(m,n)) space)
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/** Calculate similarity ratio (0-1) between two strings. */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

// ═══════════════════════════════════════════════════════════════
// MATCHING ENGINE
// ═══════════════════════════════════════════════════════════════

// Pre-build optimized data structure for exact matching
// (patterns indexed for O(1) check would need trie; for now linear scan is fast enough for <200 entries)

const BASE_EXACT_CONFIDENCE = 85;
const BASE_FUZZY_CONFIDENCE = 75;
const BASE_MCC_CONFIDENCE = 65;
const FUZZY_THRESHOLD = 0.85;

/**
 * Match a transaction description against the vendor database.
 *
 * Pipeline: exact substring → fuzzy (token-based Levenshtein) → MCC fallback.
 *
 * @param description Raw transaction description
 * @param merchantName Optional merchant name field
 * @param amount Transaction amount (for amount-based logic)
 * @param mccCode Optional MCC code from bank feed
 * @returns Match result or null if no match found
 */
export function matchVendor(
  description: string,
  merchantName?: string,
  amount: number = 0,
  mccCode?: number,
): VendorMatchResult | null {
  const haystack = normalise(`${description} ${merchantName ?? ""}`);
  if (!haystack) return null;

  // Phase 1: Exact substring match (same as original matchMerchantRule)
  const exactMatch = matchExact(haystack, amount);
  if (exactMatch) return exactMatch;

  // Phase 2: Fuzzy token-based match
  const fuzzyMatch = matchFuzzy(haystack, amount);
  if (fuzzyMatch) return fuzzyMatch;

  // Phase 3: MCC code fallback
  if (mccCode !== undefined) {
    const mccMatch = matchMCC(mccCode);
    if (mccMatch) return mccMatch;
  }

  return null;
}

/** Phase 1: Exact substring match — same logic as original matchMerchantRule. */
function matchExact(haystack: string, amount: number): VendorMatchResult | null {
  for (const vendor of vendorDatabase) {
    for (const pattern of vendor.patterns) {
      if (haystack.includes(pattern)) {
        const result: VendorMatchResult = {
          vendor,
          matchType: "exact",
          matchedPattern: pattern,
          confidence: BASE_EXACT_CONFIDENCE,
        };

        // Apply amount-based logic if available
        if (vendor.amountLogic) {
          const adjustment = vendor.amountLogic(amount);
          if (adjustment) {
            result.adjustedCategory = adjustment.category;
            result.adjustedConfidence = adjustment.confidence;
            result.adjustedPurpose = adjustment.purpose;
            result.adjustedVatDeductible = adjustment.vat_deductible;
          }
        }

        return result;
      }
    }
  }
  return null;
}

/** Phase 2: Fuzzy match — split description into tokens, compare each to vendor patterns. */
function matchFuzzy(haystack: string, amount: number): VendorMatchResult | null {
  // Split into tokens (words)
  const tokens = haystack.split(/\s+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) return null;

  let bestMatch: VendorMatchResult | null = null;
  let bestSimilarity = 0;

  for (const vendor of vendorDatabase) {
    for (const pattern of vendor.patterns) {
      // Skip very short patterns for fuzzy matching (too many false positives)
      if (pattern.length < 4) continue;

      // Check each token against this pattern
      const patternTokens = pattern.split(/\s+/);

      if (patternTokens.length === 1) {
        // Single-word pattern: compare against each token
        for (const token of tokens) {
          const sim = similarity(token, pattern);
          if (sim >= FUZZY_THRESHOLD && sim > bestSimilarity) {
            bestSimilarity = sim;
            bestMatch = {
              vendor,
              matchType: "fuzzy",
              matchedPattern: pattern,
              confidence: BASE_FUZZY_CONFIDENCE,
              similarity: sim,
            };
          }
        }
      } else {
        // Multi-word pattern: build n-grams from tokens and compare
        for (let i = 0; i <= tokens.length - patternTokens.length; i++) {
          const ngram = tokens.slice(i, i + patternTokens.length).join(" ");
          const sim = similarity(ngram, pattern);
          if (sim >= FUZZY_THRESHOLD && sim > bestSimilarity) {
            bestSimilarity = sim;
            bestMatch = {
              vendor,
              matchType: "fuzzy",
              matchedPattern: pattern,
              confidence: BASE_FUZZY_CONFIDENCE,
              similarity: sim,
            };
          }
        }
      }
    }
  }

  // Apply amount-based logic if we found a match
  if (bestMatch && bestMatch.vendor.amountLogic) {
    const adjustment = bestMatch.vendor.amountLogic(amount);
    if (adjustment) {
      bestMatch.adjustedCategory = adjustment.category;
      bestMatch.adjustedConfidence = adjustment.confidence;
      bestMatch.adjustedPurpose = adjustment.purpose;
      bestMatch.adjustedVatDeductible = adjustment.vat_deductible;
    }
  }

  return bestMatch;
}

/** Phase 3: MCC code fallback. */
function matchMCC(mccCode: number): VendorMatchResult | null {
  const mapping = lookupMCCWithFallback(mccCode);
  if (!mapping) return null;

  // Create a synthetic VendorEntry from the MCC mapping
  const vendor: VendorEntry = {
    name: mapping.description,
    patterns: [],
    category: mapping.category,
    vat_type: mapping.vat_type,
    vat_deductible: mapping.vat_deductible,
    purpose: `MCC ${mccCode}: ${mapping.description}. Category assigned by merchant category code.`,
    isTradeSupplier: mapping.isTradeSupplier,
    needs_receipt: mapping.needs_receipt,
    relief_type: mapping.relief_type,
  };

  return {
    vendor,
    matchType: "mcc",
    confidence: BASE_MCC_CONFIDENCE,
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS FOR TESTING
// ═══════════════════════════════════════════════════════════════

export { levenshteinDistance, similarity, normalise, FUZZY_THRESHOLD };
