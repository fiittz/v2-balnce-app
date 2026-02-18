import { describe, it, expect } from "vitest";

// ══════════════════════════════════════════════════════════════
// Re-implementations of edge-function pure functions for testing.
//
// Edge functions run in Deno and cannot be directly imported into
// Vitest.  We copy the security-critical pure logic verbatim so
// that regressions in escaping, sanitisation, and input
// validation are caught by CI.
// ══════════════════════════════════════════════════════════════

// ── From generate-invoice-pdf/index.ts  (line 150) ──────────
function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── From lookup-vendor/index.ts  (line 33) ───────────────────
function extractVendorName(rawDescription: string): string {
  let cleaned = rawDescription
    .replace(/^(VDP-|VDC-|VDA-|POS |DD |D\/D |STO |BGC |TFR |FPI |FPO |CHQ )/i, "")
    .replace(/\d{6,}/g, "") // Remove long numbers (account refs, card numbers)
    .replace(/\s+\d{2}\/\d{2}\/\d{2,4}/g, "") // Remove dates
    .replace(/\s+[A-Z]{2}\d{2}[A-Z0-9]{10,}/g, "") // Remove IBANs
    .replace(/\s{2,}/g, " ")
    .trim();

  // Take first meaningful part (often company name)
  const parts = cleaned.split(/\s+/);
  if (parts.length > 3) {
    cleaned = parts.slice(0, 3).join(" ");
  }

  return cleaned;
}

// ── From categorize-transaction/index.ts  (line 99) ──────────
// Known-merchant database (subset kept for testing)
const KNOWN_MERCHANTS: Record<
  string,
  {
    name: string;
    category: string;
    businessType: string;
    vatRate: string;
    keywords: string[];
  }
> = {
  chadwicks: {
    name: "Chadwicks",
    category: "Materials",
    businessType: "builders_merchant",
    vatRate: "standard_23",
    keywords: ["chadwick"],
  },
  screwfix: {
    name: "Screwfix",
    category: "Tools & Equipment",
    businessType: "tools_store",
    vatRate: "standard_23",
    keywords: ["screwfix"],
  },
  "circle k": {
    name: "Circle K",
    category: "Fuel & Transport",
    businessType: "fuel_station",
    vatRate: "standard_23",
    keywords: ["circle", "circlk"],
  },
  maxol: {
    name: "Maxol",
    category: "Fuel & Transport",
    businessType: "fuel_station",
    vatRate: "standard_23",
    keywords: ["maxol"],
  },
  adobe: {
    name: "Adobe",
    category: "Software & Subscriptions",
    businessType: "software",
    vatRate: "standard_23",
    keywords: ["adobe", "creative cloud"],
  },
  vodafone: {
    name: "Vodafone",
    category: "Utilities",
    businessType: "telecom",
    vatRate: "standard_23",
    keywords: ["vodafone"],
  },
  revolut: {
    name: "Revolut",
    category: "Bank Fees",
    businessType: "fintech",
    vatRate: "exempt",
    keywords: ["revolut"],
  },
  halfords: {
    name: "Halfords",
    category: "Vehicle Costs",
    businessType: "vehicle_parts",
    vatRate: "standard_23",
    keywords: ["halfords"],
  },
};

function extractMerchantName(description: string): {
  cleanName: string;
  matchedMerchant: (typeof KNOWN_MERCHANTS)[string] | null;
} {
  const desc = description
    .toLowerCase()
    .replace(/pos\s+/gi, "")
    .replace(/card\s+/gi, "")
    .replace(/debit\s+/gi, "")
    .replace(/credit\s+/gi, "")
    .replace(/payment\s+to\s+/gi, "")
    .replace(/ie$/gi, "")
    .replace(/ireland$/gi, "")
    .replace(/dublin\s*\d*/gi, "")
    .replace(/\d{2}\/\d{2}\/\d{4}/g, "") // Remove dates
    .replace(/[^\w\s]/g, " ")
    .trim();

  // Try to match against known merchants
  for (const [key, merchant] of Object.entries(KNOWN_MERCHANTS)) {
    if (desc.includes(key)) {
      return { cleanName: merchant.name, matchedMerchant: merchant };
    }
    for (const keyword of merchant.keywords) {
      if (desc.includes(keyword)) {
        return { cleanName: merchant.name, matchedMerchant: merchant };
      }
    }
  }

  // Clean up the description for display
  const words = desc.split(/\s+/).filter((w) => w.length > 1);
  const cleanName = words
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return { cleanName: cleanName || description, matchedMerchant: null };
}

// ── Input-validation helpers (patterns from multiple edge fns) ─
// From lookup-vendor/index.ts  (lines 83-95)
function validateVendorName(vendor_name: unknown): { valid: true } | { valid: false; error: string } {
  if (!vendor_name || typeof vendor_name !== "string" || (vendor_name as string).trim().length === 0) {
    return { valid: false, error: "vendor_name is required" };
  }
  if ((vendor_name as string).length > 500) {
    return {
      valid: false,
      error: "vendor_name must be 500 characters or fewer",
    };
  }
  return { valid: true };
}

// From categorize-transaction/index.ts  (line 168)
function validateAction(action: unknown): { valid: true } | { valid: false; error: string } {
  const ALLOWED_ACTIONS = ["categorize", "match", "detect_anomaly"];
  if (!action || !ALLOWED_ACTIONS.includes(action as string)) {
    return {
      valid: false,
      error: "action must be one of: categorize, match, detect_anomaly",
    };
  }
  return { valid: true };
}

// From auto-match-transactions/index.ts  (line 62)
function validateTransactionIds(transactionIds: unknown): { valid: true } | { valid: false; error: string } {
  if (transactionIds && Array.isArray(transactionIds) && transactionIds.length > 100) {
    return {
      valid: false,
      error: "Maximum batch size is 100 transactions",
    };
  }
  return { valid: true };
}

// From process-receipt/index.ts  (line 47)
function validateImageBase64(imageBase64: unknown): { valid: true } | { valid: false; error: string } {
  if (imageBase64 && typeof imageBase64 === "string" && imageBase64.length > 14_000_000) {
    return {
      valid: false,
      error: "Image too large. Maximum size is 10MB.",
    };
  }
  return { valid: true };
}

// ══════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════

// ── escapeHtml  (XSS Prevention) ─────────────────────────────
describe("escapeHtml (XSS Prevention)", () => {
  it("returns empty string for null", () => {
    expect(escapeHtml(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(escapeHtml(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("escapes < and > (script tags)", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml("a < b > c")).toBe("a &lt; b &gt; c");
  });

  it("escapes & (ampersand)", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it('escapes " (double quotes)', () => {
    expect(escapeHtml('class="red"')).toBe("class=&quot;red&quot;");
  });

  it("escapes ' (single quotes)", () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it("full XSS payload is rendered safe", () => {
    const payload = "<script>alert('xss')</script>";
    const escaped = escapeHtml(payload);
    expect(escaped).toBe("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
    expect(escaped).not.toContain("<");
    expect(escaped).not.toContain(">");
  });

  it("handles normal text without escaping", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
    expect(escapeHtml("Chadwicks Building Supplies")).toBe("Chadwicks Building Supplies");
  });

  it("handles numbers converted to string", () => {
    // The function accepts string | null | undefined but the
    // String() coercion inside handles non-string truthy values
    // that might slip past TypeScript at runtime.
    expect(escapeHtml(123 as unknown as string)).toBe("123");
    expect(escapeHtml(0 as unknown as string)).toBe(""); // 0 is falsy
  });

  it("escapes nested HTML / img onerror injection", () => {
    const payload = '<img onerror="alert(1)" src=x>';
    const escaped = escapeHtml(payload);
    expect(escaped).toBe("&lt;img onerror=&quot;alert(1)&quot; src=x&gt;");
    expect(escaped).not.toContain("<img");
  });

  it("escapes event-handler injection via attribute breakout", () => {
    const payload = '" onmouseover="alert(1)';
    const escaped = escapeHtml(payload);
    expect(escaped).toBe("&quot; onmouseover=&quot;alert(1)");
    expect(escaped).not.toContain('"');
  });

  it("handles multiple special characters in one string", () => {
    const payload = `<div class="a" title='b'>&copy;</div>`;
    const escaped = escapeHtml(payload);
    expect(escaped).toBe("&lt;div class=&quot;a&quot; title=&#039;b&#039;&gt;&amp;copy;&lt;/div&gt;");
    // Verify none of the dangerous raw characters remain
    expect(escaped).not.toMatch(/[<>"']/);
    // Ampersands should only appear as entity prefixes
    expect(escaped.replace(/&(amp|lt|gt|quot|#039);/g, "")).not.toContain("&");
  });

  it("escapes javascript: URI scheme in attributes", () => {
    const payload = '<a href="javascript:alert(1)">click</a>';
    const escaped = escapeHtml(payload);
    // The angle brackets are escaped so the browser cannot parse it as HTML
    expect(escaped).not.toContain("<a");
    expect(escaped).not.toContain("<");
    expect(escaped).not.toContain(">");
    expect(escaped).toBe("&lt;a href=&quot;javascript:alert(1)&quot;&gt;click&lt;/a&gt;");
  });

  it("escapes SVG-based XSS vectors", () => {
    const payload = '<svg onload="alert(1)">';
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain("<svg");
  });
});

// ── extractVendorName  (Bank Description Cleaning) ───────────
describe("extractVendorName (Bank Description Cleaning)", () => {
  it("strips VDP- prefix", () => {
    expect(extractVendorName("VDP-CHADWICKS DUBLIN")).toBe("CHADWICKS DUBLIN");
  });

  it("strips VDC- prefix", () => {
    expect(extractVendorName("VDC-SCREWFIX LTD")).toBe("SCREWFIX LTD");
  });

  it("strips POS prefix", () => {
    expect(extractVendorName("POS CIRCLE K LUCAN")).toBe("CIRCLE K LUCAN");
  });

  it("strips DD prefix", () => {
    expect(extractVendorName("DD ELECTRIC IRELAND")).toBe("ELECTRIC IRELAND");
  });

  it("strips D/D prefix", () => {
    expect(extractVendorName("D/D VODAFONE IRELAND")).toBe("VODAFONE IRELAND");
  });

  it("strips VDA- prefix", () => {
    expect(extractVendorName("VDA-MAXOL SERVICES")).toBe("MAXOL SERVICES");
  });

  it("strips STO prefix", () => {
    expect(extractVendorName("STO ALLIANZ INSURANCE")).toBe("ALLIANZ INSURANCE");
  });

  it("removes long numbers (card / account refs)", () => {
    expect(extractVendorName("CHADWICKS 12345678 REF")).toBe("CHADWICKS REF");
  });

  it("removes dates in DD/MM/YYYY format", () => {
    expect(extractVendorName("MAXOL LUCAN 15/03/2024")).toBe("MAXOL LUCAN");
  });

  it("removes dates in DD/MM/YY format", () => {
    expect(extractVendorName("CIRCLE K 15/03/24")).toBe("CIRCLE K");
  });

  it("removes IBANs (partial — long-number regex strips digits first)", () => {
    // The \d{6,} regex runs before the IBAN regex, so the numeric tail
    // "93115212345678" is stripped first, leaving "IE29AIBK" which no
    // longer matches the IBAN pattern [A-Z]{2}\d{2}[A-Z0-9]{10,}.
    expect(extractVendorName("TFR PAYMENT IE29AIBK93115212345678")).toBe("PAYMENT IE29AIBK");
  });

  it("trims to first 3 words when description is long", () => {
    const result = extractVendorName("CHADWICKS BUILDING SUPPLIES DUBLIN NORTH");
    expect(result).toBe("CHADWICKS BUILDING SUPPLIES");
  });

  it("returns all words when 3 or fewer", () => {
    expect(extractVendorName("SCREWFIX LTD")).toBe("SCREWFIX LTD");
    expect(extractVendorName("ADOBE")).toBe("ADOBE");
  });

  it("handles already clean names", () => {
    expect(extractVendorName("Chadwicks")).toBe("Chadwicks");
  });

  it("handles empty string", () => {
    expect(extractVendorName("")).toBe("");
  });

  it("collapses multiple whitespace", () => {
    expect(extractVendorName("VDP-CHADWICKS   DUBLIN    STORE")).toBe("CHADWICKS DUBLIN STORE");
  });

  it("handles combined prefix + number + date removal", () => {
    const raw = "VDP-SCREWFIX 87654321 01/06/2024 PURCHASE";
    const result = extractVendorName(raw);
    // After stripping: "SCREWFIX  PURCHASE" -> trimmed -> "SCREWFIX PURCHASE"
    expect(result).toBe("SCREWFIX PURCHASE");
  });
});

// ── extractMerchantName  (Merchant Matching) ─────────────────
describe("extractMerchantName (Merchant Matching)", () => {
  it("matches known Irish merchant by key: chadwicks", () => {
    const { cleanName, matchedMerchant } = extractMerchantName("CHADWICKS DUBLIN 4");
    expect(cleanName).toBe("Chadwicks");
    expect(matchedMerchant).not.toBeNull();
    expect(matchedMerchant!.category).toBe("Materials");
  });

  it("matches by keyword: chadwick (partial)", () => {
    const { cleanName, matchedMerchant } = extractMerchantName("CHADWICK BUILDERS MERCHANTS");
    expect(cleanName).toBe("Chadwicks");
    expect(matchedMerchant).not.toBeNull();
  });

  it("matches screwfix by key", () => {
    const { cleanName, matchedMerchant } = extractMerchantName("POS SCREWFIX STORE 123");
    expect(cleanName).toBe("Screwfix");
    expect(matchedMerchant!.businessType).toBe("tools_store");
  });

  it("matches circle k by key", () => {
    const { cleanName, matchedMerchant } = extractMerchantName("CARD CIRCLE K LUCAN");
    expect(cleanName).toBe("Circle K");
    expect(matchedMerchant!.category).toBe("Fuel & Transport");
  });

  it("strips POS prefix before matching", () => {
    const { cleanName } = extractMerchantName("POS VODAFONE IRELAND");
    expect(cleanName).toBe("Vodafone");
  });

  it("strips CARD prefix before matching", () => {
    const { cleanName } = extractMerchantName("CARD MAXOL LUCAN");
    expect(cleanName).toBe("Maxol");
  });

  it("strips DEBIT prefix before matching", () => {
    const { cleanName } = extractMerchantName("DEBIT ADOBE CREATIVE CLOUD");
    expect(cleanName).toBe("Adobe");
  });

  it("strips CREDIT prefix before matching", () => {
    const { cleanName } = extractMerchantName("CREDIT REVOLUT TRANSFER");
    expect(cleanName).toBe("Revolut");
  });

  it("strips 'payment to' prefix before matching", () => {
    const { cleanName } = extractMerchantName("PAYMENT TO HALFORDS IE");
    expect(cleanName).toBe("Halfords");
  });

  it("returns cleaned name for unknown merchants", () => {
    const { cleanName, matchedMerchant } = extractMerchantName("SOME RANDOM SHOP");
    expect(matchedMerchant).toBeNull();
    expect(cleanName).toBe("Some Random Shop");
  });

  it("case-insensitive matching", () => {
    const lower = extractMerchantName("chadwicks dublin");
    const upper = extractMerchantName("CHADWICKS DUBLIN");
    const mixed = extractMerchantName("Chadwicks Dublin");
    expect(lower.cleanName).toBe("Chadwicks");
    expect(upper.cleanName).toBe("Chadwicks");
    expect(mixed.cleanName).toBe("Chadwicks");
  });

  it("removes dates from description before matching", () => {
    const { cleanName } = extractMerchantName("POS SCREWFIX 01/06/2024 STORE");
    expect(cleanName).toBe("Screwfix");
  });

  it("strips trailing 'ie' country code", () => {
    const { cleanName, matchedMerchant } = extractMerchantName("ADOBE SYSTEMS IE");
    expect(cleanName).toBe("Adobe");
    expect(matchedMerchant).not.toBeNull();
  });

  it("strips trailing 'ireland'", () => {
    const { cleanName } = extractMerchantName("VODAFONE IRELAND");
    expect(cleanName).toBe("Vodafone");
  });

  it("strips Dublin + district number", () => {
    const { cleanName, matchedMerchant } = extractMerchantName("CHADWICKS DUBLIN 12");
    expect(cleanName).toBe("Chadwicks");
    expect(matchedMerchant).not.toBeNull();
  });

  it("returns original description when cleaning produces empty string", () => {
    // Edge case: if all words are filtered out, fall back to original
    const { cleanName } = extractMerchantName("X");
    // Single char "x" is filtered by .filter(w => w.length > 1)
    // so cleanName falls back to original description
    expect(cleanName).toBe("X");
  });

  it("limits unknown merchant name to first 3 words, title-cased", () => {
    const { cleanName, matchedMerchant } = extractMerchantName("ACME WIDGETS MANUFACTURING CORPORATION LTD");
    expect(matchedMerchant).toBeNull();
    expect(cleanName).toBe("Acme Widgets Manufacturing");
  });
});

// ── Input Validation Patterns ────────────────────────────────
describe("Input Validation Patterns", () => {
  describe("vendor_name validation (lookup-vendor)", () => {
    it("rejects null", () => {
      const result = validateVendorName(null);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toMatch(/required/i);
    });

    it("rejects undefined", () => {
      const result = validateVendorName(undefined);
      expect(result.valid).toBe(false);
    });

    it("rejects empty string", () => {
      const result = validateVendorName("");
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toMatch(/required/i);
    });

    it("rejects whitespace-only string", () => {
      const result = validateVendorName("   ");
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toMatch(/required/i);
    });

    it("rejects non-string types (number)", () => {
      const result = validateVendorName(42);
      expect(result.valid).toBe(false);
    });

    it("rejects non-string types (boolean)", () => {
      const result = validateVendorName(true);
      expect(result.valid).toBe(false);
    });

    it("rejects non-string types (object)", () => {
      const result = validateVendorName({ name: "test" });
      expect(result.valid).toBe(false);
    });

    it("rejects non-string types (array)", () => {
      const result = validateVendorName(["test"]);
      expect(result.valid).toBe(false);
    });

    it("accepts a valid short name", () => {
      expect(validateVendorName("Chadwicks").valid).toBe(true);
    });

    it("accepts a name exactly at the 500-char limit", () => {
      const name = "A".repeat(500);
      expect(validateVendorName(name).valid).toBe(true);
    });

    it("rejects a name exceeding 500 chars", () => {
      const name = "A".repeat(501);
      const result = validateVendorName(name);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toMatch(/500/);
    });

    it("rejects a very long payload (potential DoS)", () => {
      const name = "X".repeat(10_000);
      const result = validateVendorName(name);
      expect(result.valid).toBe(false);
    });
  });

  describe("action validation (categorize-transaction)", () => {
    it('accepts "categorize"', () => {
      expect(validateAction("categorize").valid).toBe(true);
    });

    it('accepts "match"', () => {
      expect(validateAction("match").valid).toBe(true);
    });

    it('accepts "detect_anomaly"', () => {
      expect(validateAction("detect_anomaly").valid).toBe(true);
    });

    it("rejects null", () => {
      expect(validateAction(null).valid).toBe(false);
    });

    it("rejects undefined", () => {
      expect(validateAction(undefined).valid).toBe(false);
    });

    it("rejects empty string", () => {
      expect(validateAction("").valid).toBe(false);
    });

    it('rejects unknown action "delete"', () => {
      const result = validateAction("delete");
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toMatch(/categorize/);
    });

    it('rejects unknown action "admin"', () => {
      expect(validateAction("admin").valid).toBe(false);
    });

    it("rejects non-string type (number)", () => {
      expect(validateAction(1).valid).toBe(false);
    });

    it("is case-sensitive (CATEGORIZE is rejected)", () => {
      expect(validateAction("CATEGORIZE").valid).toBe(false);
    });

    it("rejects action with trailing whitespace", () => {
      expect(validateAction("categorize ").valid).toBe(false);
    });
  });

  describe("transactionIds batch limit (auto-match-transactions)", () => {
    it("accepts null / undefined (single-transaction mode)", () => {
      expect(validateTransactionIds(null).valid).toBe(true);
      expect(validateTransactionIds(undefined).valid).toBe(true);
    });

    it("accepts an empty array", () => {
      expect(validateTransactionIds([]).valid).toBe(true);
    });

    it("accepts a single-element array", () => {
      expect(validateTransactionIds(["abc-123"]).valid).toBe(true);
    });

    it("accepts exactly 100 items", () => {
      const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`);
      expect(validateTransactionIds(ids).valid).toBe(true);
    });

    it("rejects 101 items", () => {
      const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`);
      const result = validateTransactionIds(ids);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toMatch(/100/);
    });

    it("rejects 1000 items (large batch)", () => {
      const ids = Array.from({ length: 1000 }, (_, i) => `id-${i}`);
      expect(validateTransactionIds(ids).valid).toBe(false);
    });

    it("accepts non-array value (not an array, so guard does not trigger)", () => {
      // The edge function guard is: if (transactionIds && Array.isArray(...) && .length > 100)
      // A non-array truthy value passes because Array.isArray is false.
      expect(validateTransactionIds("not-an-array").valid).toBe(true);
    });
  });

  describe("imageBase64 size limit (process-receipt)", () => {
    it("accepts null / undefined", () => {
      expect(validateImageBase64(null).valid).toBe(true);
      expect(validateImageBase64(undefined).valid).toBe(true);
    });

    it("accepts an empty string", () => {
      expect(validateImageBase64("").valid).toBe(true);
    });

    it("accepts a normal-sized base64 string (1 MB)", () => {
      const b64 = "A".repeat(1_000_000);
      expect(validateImageBase64(b64).valid).toBe(true);
    });

    it("accepts exactly 14,000,000 chars (boundary)", () => {
      const b64 = "A".repeat(14_000_000);
      expect(validateImageBase64(b64).valid).toBe(true);
    });

    it("rejects 14,000,001 chars (just over limit)", () => {
      const b64 = "A".repeat(14_000_001);
      const result = validateImageBase64(b64);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toMatch(/10MB/i);
    });

    it("rejects a very large payload (20 MB)", () => {
      const b64 = "A".repeat(20_000_000);
      expect(validateImageBase64(b64).valid).toBe(false);
    });

    it("accepts non-string truthy value (number, guard skips)", () => {
      // Guard checks typeof === "string", so a number bypasses it
      expect(validateImageBase64(12345).valid).toBe(true);
    });
  });
});

// ── Composability: extractVendorName piped into extractMerchantName ──
describe("Pipeline: extractVendorName -> extractMerchantName", () => {
  it("raw bank description flows through both cleaners to a known match", () => {
    const raw = "VDP-CHADWICKS DUBLIN 987654 01/01/2024";
    const vendorCleaned = extractVendorName(raw);
    const { cleanName, matchedMerchant } = extractMerchantName(vendorCleaned);
    expect(cleanName).toBe("Chadwicks");
    expect(matchedMerchant).not.toBeNull();
    expect(matchedMerchant!.category).toBe("Materials");
  });

  it("unknown vendor still produces a usable cleaned name", () => {
    const raw = "VDC-JOES PLUMBING SUPPLIES 44332211";
    const vendorCleaned = extractVendorName(raw);
    const { cleanName, matchedMerchant } = extractMerchantName(vendorCleaned);
    expect(matchedMerchant).toBeNull();
    expect(cleanName.length).toBeGreaterThan(0);
    // Should be title-cased
    expect(cleanName.charAt(0)).toMatch(/[A-Z]/);
  });

  it("POS prefix bank description matches fuel station", () => {
    const raw = "POS CIRCLE K MOTORWAY 15/02/2024";
    const vendorCleaned = extractVendorName(raw);
    const { cleanName, matchedMerchant } = extractMerchantName(vendorCleaned);
    expect(cleanName).toBe("Circle K");
    expect(matchedMerchant!.businessType).toBe("fuel_station");
  });
});

// ── escapeHtml applied to realistic invoice data ─────────────
describe("escapeHtml in invoice context", () => {
  it("escapes a customer name containing HTML", () => {
    const malicious = 'O\'Brien & Sons <script>alert("xss")</script>';
    const escaped = escapeHtml(malicious);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("O&#039;Brien &amp; Sons");
  });

  it("escapes a business address with HTML injection attempt", () => {
    const address = '123 Main St<img src=x onerror="alert(1)">';
    const escaped = escapeHtml(address);
    expect(escaped).not.toContain("<img");
    expect(escaped).toContain("123 Main St");
  });

  it("escapes a VAT number field with special chars", () => {
    const vatNum = 'IE1234567T" onclick="steal()';
    const escaped = escapeHtml(vatNum);
    expect(escaped).not.toContain('"');
    expect(escaped).toContain("IE1234567T");
  });

  it("escapes invoice description with line item injection", () => {
    const description = "Timber 4x2 <td><script>document.cookie</script></td>";
    const escaped = escapeHtml(description);
    expect(escaped).not.toContain("<td>");
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("Timber 4x2");
  });
});
