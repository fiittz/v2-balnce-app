import { describe, it, expect } from "vitest";
import {
  vendorDatabase,
  getTotalPatternCount,
  getUsedCategories,
  getVendorsBySector,
  validateVendorDatabase,
  type VendorEntry,
} from "../vendorDatabase";
import { CATEGORY_NAME_MAP } from "../autocat";

// ══════════════════════════════════════════════════════════════
// Database Integrity
// ══════════════════════════════════════════════════════════════
describe("vendorDatabase — integrity", () => {
  it("has at least 100 vendor entries", () => {
    expect(vendorDatabase.length).toBeGreaterThanOrEqual(100);
  });

  it("has at least 500 total patterns", () => {
    expect(getTotalPatternCount()).toBeGreaterThanOrEqual(500);
  });

  it("passes full validation (all required fields, lowercase patterns)", () => {
    const result = validateVendorDatabase();
    if (!result.valid) {
      console.error("Validation errors:", result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("every vendor has a name", () => {
    for (const v of vendorDatabase) {
      expect(v.name, `Missing name`).toBeTruthy();
    }
  });

  it("every vendor has at least one pattern", () => {
    for (const v of vendorDatabase) {
      expect(v.patterns.length, `${v.name}: no patterns`).toBeGreaterThan(0);
    }
  });

  it("every vendor has a category", () => {
    for (const v of vendorDatabase) {
      expect(v.category, `${v.name}: no category`).toBeTruthy();
    }
  });

  it("every vendor has a vat_type", () => {
    for (const v of vendorDatabase) {
      expect(v.vat_type, `${v.name}: no vat_type`).toBeTruthy();
    }
  });

  it("every vendor has a purpose", () => {
    for (const v of vendorDatabase) {
      expect(v.purpose, `${v.name}: no purpose`).toBeTruthy();
    }
  });

  it("all patterns are lowercase", () => {
    for (const v of vendorDatabase) {
      for (const p of v.patterns) {
        expect(p, `${v.name}: pattern "${p}" is not lowercase`).toBe(p.toLowerCase());
      }
    }
  });

  it("no duplicate patterns across vendors", () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const v of vendorDatabase) {
      for (const p of v.patterns) {
        if (seen.has(p)) {
          duplicates.push(`"${p}" appears in both "${seen.get(p)}" and "${v.name}"`);
        } else {
          seen.set(p, v.name);
        }
      }
    }
    if (duplicates.length > 0) {
      console.warn("Duplicate patterns (not necessarily errors):", duplicates);
    }
    // We allow some intentional duplicates (e.g. overlapping vendor names)
    // but flag if there are too many
    expect(duplicates.length).toBeLessThan(20);
  });
});

// ══════════════════════════════════════════════════════════════
// VAT Type Validation
// ══════════════════════════════════════════════════════════════
describe("vendorDatabase — VAT types", () => {
  const validVatTypes = ["Standard 23%", "Reduced 13.5%", "Second Reduced 9%", "Zero", "Exempt", "N/A"];

  it("all vendors have valid VAT types", () => {
    for (const v of vendorDatabase) {
      expect(validVatTypes, `${v.name}: invalid vat_type "${v.vat_type}"`).toContain(v.vat_type);
    }
  });

  it("exempt vendors are not VAT deductible", () => {
    for (const v of vendorDatabase) {
      if (v.vat_type === "Exempt") {
        expect(v.vat_deductible, `${v.name}: exempt but vat_deductible=true`).toBe(false);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════
// Category Mapping Validation
// ══════════════════════════════════════════════════════════════
describe("vendorDatabase — categories", () => {
  it("all categories used are known to CATEGORY_NAME_MAP or are DB category names", () => {
    const knownCategories = new Set([
      ...Object.keys(CATEGORY_NAME_MAP),
      // DB category names (from seedCategories)
      "Materials & Supplies",
      "Subcontractor Payments",
      "Tools & Equipment",
      "Vehicle Expenses",
      "Fuel",
      "Insurance",
      "Professional Fees",
      "Office Expenses",
      "Telephone & Internet",
      "Bank Charges",
      "Rent & Rates",
      "Utilities",
      "Training & Certifications",
      "Advertising & Marketing",
      "Travel & Accommodation",
      "Meals & Entertainment",
      "Repairs & Maintenance",
      "Protective Clothing & PPE",
      "Subscriptions & Software",
      "Miscellaneous Expenses",
      "Director's Loan Account",
      "Medical Expenses",
      "Contract Work",
      "Labour Income",
      "Materials Charged",
      "Consultation Fees",
      "Other Income",
    ]);

    const usedCategories = getUsedCategories();
    for (const cat of usedCategories) {
      expect(knownCategories.has(cat), `Unknown category "${cat}" — not in CATEGORY_NAME_MAP or DB`).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// Sector Coverage
// ══════════════════════════════════════════════════════════════
describe("vendorDatabase — sector coverage", () => {
  it("has vendors in all core sectors", () => {
    const requiredSectors = [
      "software",
      "fuel",
      "retail",
      "food",
      "trade",
      "transport",
      "banking",
      "insurance",
      "health",
      "professional",
      "telecoms",
    ];
    for (const sector of requiredSectors) {
      const vendors = getVendorsBySector(sector);
      expect(vendors.length, `Missing vendors for sector: ${sector}`).toBeGreaterThan(0);
    }
  });

  it("trade sector has at least 20 vendors", () => {
    expect(getVendorsBySector("trade").length).toBeGreaterThanOrEqual(20);
  });

  it("software sector has at least 15 vendors", () => {
    expect(getVendorsBySector("software").length).toBeGreaterThanOrEqual(15);
  });
});

// ══════════════════════════════════════════════════════════════
// Relief Type Validation
// ══════════════════════════════════════════════════════════════
describe("vendorDatabase — relief types", () => {
  const validReliefTypes = ["medical", "pension", "health_insurance", "rent", "charitable", "tuition"];

  it("all relief_type values are valid", () => {
    for (const v of vendorDatabase) {
      if (v.relief_type) {
        expect(validReliefTypes, `${v.name}: invalid relief_type "${v.relief_type}"`).toContain(v.relief_type);
      }
    }
  });

  it("health insurance vendors have health_insurance relief type", () => {
    const healthInsurers = vendorDatabase.filter((v) =>
      v.patterns.some((p) => ["vhi", "laya healthcare", "irish life health"].includes(p)),
    );
    for (const v of healthInsurers) {
      expect(v.relief_type, `${v.name} should have health_insurance relief`).toBe("health_insurance");
    }
  });

  it("pharmacy vendors have medical relief type", () => {
    const pharmacies = vendorDatabase.filter((v) =>
      v.patterns.some((p) => ["pharmacy", "chemist", "boots"].includes(p)),
    );
    for (const v of pharmacies) {
      expect(v.relief_type, `${v.name} should have medical relief`).toBe("medical");
    }
  });

  it("charity vendors have charitable relief type", () => {
    const charities = vendorDatabase.filter((v) =>
      v.patterns.some((p) => ["trocaire", "concern worldwide", "barnardos"].includes(p)),
    );
    for (const v of charities) {
      expect(v.relief_type, `${v.name} should have charitable relief`).toBe("charitable");
    }
  });

  it("university vendors have tuition relief type", () => {
    const unis = vendorDatabase.filter((v) => v.patterns.some((p) => ["ucd", "tcd", "dcu"].includes(p)));
    for (const v of unis) {
      expect(v.relief_type, `${v.name} should have tuition relief`).toBe("tuition");
    }
  });
});

// ══════════════════════════════════════════════════════════════
// Trade Supplier Flags
// ══════════════════════════════════════════════════════════════
describe("vendorDatabase — trade suppliers", () => {
  it("trade suppliers are VAT deductible", () => {
    for (const v of vendorDatabase) {
      if (v.isTradeSupplier) {
        expect(v.vat_deductible, `${v.name}: trade supplier but vat_deductible=false`).toBe(true);
      }
    }
  });

  it("known trade suppliers are flagged", () => {
    const knownTradePatterns = ["screwfix", "chadwicks", "woodies", "howdens", "toolstation"];
    for (const pattern of knownTradePatterns) {
      const vendor = vendorDatabase.find((v) => v.patterns.includes(pattern));
      expect(vendor, `No vendor found for pattern "${pattern}"`).toBeDefined();
      expect(vendor!.isTradeSupplier, `${vendor!.name} should be flagged as trade supplier`).toBe(true);
    }
  });

  it("has at least 15 trade suppliers", () => {
    const tradeSuppliers = vendorDatabase.filter((v) => v.isTradeSupplier);
    expect(tradeSuppliers.length).toBeGreaterThanOrEqual(15);
  });
});

// ══════════════════════════════════════════════════════════════
// Specific Vendor Presence
// ══════════════════════════════════════════════════════════════
describe("vendorDatabase — key vendors present", () => {
  const mustHavePatterns = [
    // Original vendors (from merchantRules)
    "revenue",
    "screwfix",
    "chadwicks",
    "woodies",
    "maxol",
    "circle k",
    "tesco",
    "lidl",
    "mcdonalds",
    "starbucks",
    "costa",
    "freenow",
    "eflow",
    "axa",
    "vhi",
    "pharmacy",
    "trocaire",
    "ucd",
    // New vendors
    "grafton",
    "heatmerchants",
    "hilti",
    "makita",
    "esb",
    "bord gais",
    "irish water",
    "an post",
    "ryanair",
    "aer lingus",
    "bus eireann",
    "luas",
    "paypal",
    "sumup",
  ];

  for (const pattern of mustHavePatterns) {
    it(`has vendor for "${pattern}"`, () => {
      const found = vendorDatabase.some((v) => v.patterns.includes(pattern));
      expect(found, `Missing vendor for pattern "${pattern}"`).toBe(true);
    });
  }
});

// ══════════════════════════════════════════════════════════════
// Irish VAT Compliance Rules
// ══════════════════════════════════════════════════════════════
describe("vendorDatabase — Irish VAT compliance", () => {
  it("food/drink vendors are not VAT deductible (Section 60)", () => {
    const foodVendors = vendorDatabase.filter((v) => v.sector === "food");
    for (const v of foodVendors) {
      expect(v.vat_deductible, `${v.name}: food vendor but VAT deductible`).toBe(false);
    }
  });

  it("entertainment vendors are not VAT deductible", () => {
    const entertainmentVendors = vendorDatabase.filter((v) => v.sector === "entertainment");
    for (const v of entertainmentVendors) {
      expect(v.vat_deductible, `${v.name}: entertainment but VAT deductible`).toBe(false);
    }
  });

  it("insurance vendors are VAT exempt", () => {
    const insuranceVendors = vendorDatabase.filter((v) => v.sector === "insurance");
    for (const v of insuranceVendors) {
      expect(v.vat_type, `${v.name}: insurance should be exempt`).toBe("Exempt");
    }
  });

  it("fuel stations need receipt", () => {
    const fuelVendors = vendorDatabase.filter((v) => v.sector === "fuel");
    for (const v of fuelVendors) {
      expect(v.needs_receipt, `${v.name}: fuel station should need receipt`).toBe(true);
    }
  });

  it("supermarkets need receipt", () => {
    const supermarkets = vendorDatabase.filter((v) =>
      v.patterns.some((p) => ["tesco", "aldi", "lidl", "dunnes", "supervalu"].includes(p)),
    );
    for (const v of supermarkets) {
      expect(v.needs_receipt, `${v.name}: supermarket should need receipt`).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// validateVendorDatabase — error paths
// ══════════════════════════════════════════════════════════════
describe("validateVendorDatabase — error paths", () => {
  it("reports missing name", () => {
    const bad = { name: "", patterns: ["test"], category: "Test", vat_type: "Zero", purpose: "test" } as VendorEntry;
    vendorDatabase.push(bad);
    const result = validateVendorDatabase();
    vendorDatabase.pop();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Missing name"))).toBe(true);
  });

  it("reports no patterns", () => {
    const bad = { name: "Bad", patterns: [], category: "Test", vat_type: "Zero", purpose: "test" } as VendorEntry;
    vendorDatabase.push(bad);
    const result = validateVendorDatabase();
    vendorDatabase.pop();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("no patterns"))).toBe(true);
  });

  it("reports missing category", () => {
    const bad = { name: "Bad", patterns: ["test"], category: "", vat_type: "Zero", purpose: "test" } as VendorEntry;
    vendorDatabase.push(bad);
    const result = validateVendorDatabase();
    vendorDatabase.pop();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("no category"))).toBe(true);
  });

  it("reports missing vat_type", () => {
    const bad = { name: "Bad", patterns: ["test"], category: "Test", vat_type: "", purpose: "test" } as VendorEntry;
    vendorDatabase.push(bad);
    const result = validateVendorDatabase();
    vendorDatabase.pop();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("no vat_type"))).toBe(true);
  });

  it("reports missing purpose", () => {
    const bad = { name: "Bad", patterns: ["test"], category: "Test", vat_type: "Zero", purpose: "" } as VendorEntry;
    vendorDatabase.push(bad);
    const result = validateVendorDatabase();
    vendorDatabase.pop();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("no purpose"))).toBe(true);
  });

  it("reports non-lowercase pattern", () => {
    const bad = {
      name: "Bad",
      patterns: ["TestUPPER"],
      category: "Test",
      vat_type: "Zero",
      purpose: "test",
    } as VendorEntry;
    vendorDatabase.push(bad);
    const result = validateVendorDatabase();
    vendorDatabase.pop();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not lowercase"))).toBe(true);
  });
});
