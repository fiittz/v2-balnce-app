import { describe, it, expect } from "vitest";
import {
  EU_COUNTRIES,
  UK_RULES,
  INTRA_COMMUNITY_SUPPLIES,
  REPORTING_OBLIGATIONS,
  OSS_RULES,
  PLACE_OF_SUPPLY_SERVICES,
  IMPORTS_EXPORTS,
  VAT3_EU_BOXES,
  determineCrossBorderVAT,
  validateEUVATFormat,
  calculateImportVAT,
  checkOSSThreshold,
  checkIntrastatThreshold,
} from "../euVatRules";

// ══════════════════════════════════════════════════════════════
// EU_COUNTRIES
// ══════════════════════════════════════════════════════════════
describe("EU_COUNTRIES", () => {
  it("has 26 EU member states (excluding Ireland)", () => {
    expect(EU_COUNTRIES).toHaveLength(26);
  });

  it("each country has code, name, and vatPrefix", () => {
    for (const country of EU_COUNTRIES) {
      expect(country.code).toBeTruthy();
      expect(country.name).toBeTruthy();
      expect(country.vatPrefix).toBeTruthy();
    }
  });

  it("does not include Ireland", () => {
    const codes = EU_COUNTRIES.map(c => c.code);
    expect(codes).not.toContain("IE");
  });

  it("includes key trading partners", () => {
    const codes = EU_COUNTRIES.map(c => c.code);
    expect(codes).toContain("DE");
    expect(codes).toContain("FR");
    expect(codes).toContain("NL");
    expect(codes).toContain("ES");
  });

  it("Greece uses EL prefix (not GR)", () => {
    const greece = EU_COUNTRIES.find(c => c.code === "GR");
    expect(greece?.vatPrefix).toBe("EL");
  });
});

// ══════════════════════════════════════════════════════════════
// UK_RULES
// ══════════════════════════════════════════════════════════════
describe("UK_RULES", () => {
  it("GB is non-EU for goods", () => {
    expect(UK_RULES.gb.goods).toBe("non_eu");
  });

  it("GB is non-EU for services", () => {
    expect(UK_RULES.gb.services).toBe("non_eu");
  });

  it("NI is EU for goods", () => {
    expect(UK_RULES.ni.goods).toBe("eu");
  });

  it("NI is non-EU for services", () => {
    expect(UK_RULES.ni.services).toBe("non_eu");
  });

  it("NI uses XI VAT prefix", () => {
    expect(UK_RULES.vatPrefixes.ni).toBe("XI");
  });
});

// ══════════════════════════════════════════════════════════════
// determineCrossBorderVAT
// ══════════════════════════════════════════════════════════════
describe("determineCrossBorderVAT", () => {
  it("B2B goods sale to EU = zero-rated ICS", () => {
    const result = determineCrossBorderVAT({
      direction: "sale",
      counterpartyLocation: "eu",
      supplyType: "goods",
      customerType: "b2b",
    });
    expect(result.treatment).toBe("zero_rated");
    expect(result.vat3Boxes).toContain("E1");
    expect(result.reportingObligations).toContain("VIES return (quarterly)");
  });

  it("B2B services sale to EU = zero-rated with reverse charge", () => {
    const result = determineCrossBorderVAT({
      direction: "sale",
      counterpartyLocation: "eu",
      supplyType: "services",
      customerType: "b2b",
    });
    expect(result.treatment).toBe("zero_rated");
    expect(result.vat3Boxes).toContain("ES1");
  });

  it("B2C goods sale to EU = OSS destination", () => {
    const result = determineCrossBorderVAT({
      direction: "sale",
      counterpartyLocation: "eu",
      supplyType: "goods",
      customerType: "b2c",
    });
    expect(result.treatment).toBe("oss_destination");
  });

  it("export to non-EU = zero-rated", () => {
    const result = determineCrossBorderVAT({
      direction: "sale",
      counterpartyLocation: "non_eu",
      supplyType: "goods",
      customerType: "b2b",
    });
    expect(result.treatment).toBe("zero_rated");
    expect(result.vat3Boxes).toContain("E2");
  });

  it("export to GB = zero-rated (post-Brexit)", () => {
    const result = determineCrossBorderVAT({
      direction: "sale",
      counterpartyLocation: "gb",
      supplyType: "goods",
      customerType: "b2b",
    });
    expect(result.treatment).toBe("zero_rated");
    expect(result.vat3Boxes).toContain("E2");
  });

  it("goods sale to NI = intra-community (EU rules)", () => {
    const result = determineCrossBorderVAT({
      direction: "sale",
      counterpartyLocation: "ni",
      supplyType: "goods",
      customerType: "b2b",
    });
    expect(result.treatment).toBe("zero_rated");
    expect(result.vat3Boxes).toContain("E1");
  });

  it("services from EU = reverse charge on purchase", () => {
    const result = determineCrossBorderVAT({
      direction: "purchase",
      counterpartyLocation: "eu",
      supplyType: "services",
      customerType: "b2b",
    });
    expect(result.treatment).toBe("reverse_charge");
    expect(result.vat3Boxes).toContain("ES2");
  });

  it("goods from EU = self-accounting ICA", () => {
    const result = determineCrossBorderVAT({
      direction: "purchase",
      counterpartyLocation: "eu",
      supplyType: "goods",
      customerType: "b2b",
    });
    expect(result.treatment).toBe("self_accounting");
    expect(result.vat3Boxes).toContain("T1");
    expect(result.vat3Boxes).toContain("T2");
  });

  it("goods import from GB = postponed accounting", () => {
    const result = determineCrossBorderVAT({
      direction: "purchase",
      counterpartyLocation: "gb",
      supplyType: "goods",
      customerType: "b2b",
    });
    expect(result.treatment).toBe("postponed_accounting");
    expect(result.vat3Boxes).toContain("PA1");
  });

  it("goods from NI = intra-community acquisition", () => {
    const result = determineCrossBorderVAT({
      direction: "purchase",
      counterpartyLocation: "ni",
      supplyType: "goods",
      customerType: "b2b",
    });
    expect(result.treatment).toBe("self_accounting");
    expect(result.vat3Boxes).toContain("T1");
  });

  it("services from non-EU = reverse charge (not postponed accounting)", () => {
    const result = determineCrossBorderVAT({
      direction: "purchase",
      counterpartyLocation: "non_eu",
      supplyType: "services",
      customerType: "b2b",
    });
    expect(result.treatment).toBe("reverse_charge");
    expect(result.vat3Boxes).toContain("T1");
    expect(result.vat3Boxes).toContain("T2");
    expect(result.vat3Boxes).not.toContain("PA1");
  });

  it("services from GB = reverse charge", () => {
    const result = determineCrossBorderVAT({
      direction: "purchase",
      counterpartyLocation: "gb",
      supplyType: "services",
      customerType: "b2b",
    });
    expect(result.treatment).toBe("reverse_charge");
    expect(result.vat3Boxes).toContain("T1");
    expect(result.vat3Boxes).toContain("T2");
  });

  it("services from NI = reverse charge (NI services are non-EU)", () => {
    const result = determineCrossBorderVAT({
      direction: "purchase",
      counterpartyLocation: "ni",
      supplyType: "services",
      customerType: "b2b",
    });
    expect(result.treatment).toBe("reverse_charge");
    expect(result.vat3Boxes).toContain("T1");
    expect(result.vat3Boxes).toContain("T2");
  });

  it("goods from non-EU = postponed accounting (unchanged)", () => {
    const result = determineCrossBorderVAT({
      direction: "purchase",
      counterpartyLocation: "non_eu",
      supplyType: "goods",
      customerType: "b2b",
    });
    expect(result.treatment).toBe("postponed_accounting");
    expect(result.vat3Boxes).toContain("PA1");
    expect(result.vat3Boxes).not.toContain("T1");
  });
});

// ══════════════════════════════════════════════════════════════
// validateEUVATFormat
// ══════════════════════════════════════════════════════════════
describe("validateEUVATFormat", () => {
  it("validates a correct German VAT number", () => {
    const result = validateEUVATFormat("DE123456789", "DE");
    expect(result.valid).toBe(true);
  });

  it("rejects an invalid German VAT number", () => {
    const result = validateEUVATFormat("DE12345", "DE");
    expect(result.valid).toBe(false);
  });

  it("validates a correct French VAT number", () => {
    const result = validateEUVATFormat("FRXX999999999", "FR");
    expect(result.valid).toBe(true);
  });

  it("rejects unknown country code", () => {
    const result = validateEUVATFormat("ZZ12345", "ZZ");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Unknown country code");
  });

  it("handles whitespace in VAT number", () => {
    const result = validateEUVATFormat("DE 123 456 789", "DE");
    expect(result.valid).toBe(true);
  });

  it("validates Austrian VAT number with ATU prefix", () => {
    const result = validateEUVATFormat("ATU12345678", "AT");
    expect(result.valid).toBe(true);
  });

  it("returns descriptive error for known country with invalid format", () => {
    const result = validateEUVATFormat("AT12345", "AT");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Invalid format for Austria");
    expect(result.message).toContain("ATU");
  });
});

// ══════════════════════════════════════════════════════════════
// calculateImportVAT
// ══════════════════════════════════════════════════════════════
describe("calculateImportVAT", () => {
  it("calculates VAT on CIF value alone", () => {
    const result = calculateImportVAT({ cifValue: 10000 });
    expect(result.vatBase).toBe(10000);
    expect(result.vatAmount).toBe(2300);
    expect(result.totalCost).toBe(12300);
  });

  it("includes customs duty in VAT base", () => {
    const result = calculateImportVAT({ cifValue: 10000, customsDuty: 500 });
    expect(result.vatBase).toBe(10500);
    expect(result.vatAmount).toBeCloseTo(2415, 2);
    expect(result.totalCost).toBeCloseTo(12915, 2);
  });

  it("includes both customs and excise duty", () => {
    const result = calculateImportVAT({ cifValue: 10000, customsDuty: 500, exciseDuty: 200 });
    expect(result.vatBase).toBe(10700);
    expect(result.vatAmount).toBeCloseTo(2461, 0);
  });

  it("uses reduced rate when specified", () => {
    const result = calculateImportVAT({ cifValue: 10000, vatRate: 0.135 });
    expect(result.vatAmount).toBe(1350);
  });
});

// ══════════════════════════════════════════════════════════════
// checkOSSThreshold
// ══════════════════════════════════════════════════════════════
describe("checkOSSThreshold", () => {
  it("below threshold = no OSS required", () => {
    const result = checkOSSThreshold(5000);
    expect(result.exceeds).toBe(false);
    expect(result.recommendation).toContain("below");
  });

  it("above threshold = OSS required", () => {
    const result = checkOSSThreshold(15000);
    expect(result.exceeds).toBe(true);
    expect(result.recommendation).toContain("must register");
  });

  it("exactly at threshold = not exceeded", () => {
    const result = checkOSSThreshold(10000);
    expect(result.exceeds).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// checkIntrastatThreshold
// ══════════════════════════════════════════════════════════════
describe("checkIntrastatThreshold", () => {
  it("below threshold for both = no filing", () => {
    const result = checkIntrastatThreshold({ arrivalsTotal: 100000, dispatchesTotal: 200000 });
    expect(result.arrivalsRequired).toBe(false);
    expect(result.dispatchesRequired).toBe(false);
    expect(result.recommendation).toContain("below");
  });

  it("arrivals above threshold = filing required", () => {
    const result = checkIntrastatThreshold({ arrivalsTotal: 800000, dispatchesTotal: 100000 });
    expect(result.arrivalsRequired).toBe(true);
    expect(result.dispatchesRequired).toBe(false);
  });

  it("both above threshold = both required", () => {
    const result = checkIntrastatThreshold({ arrivalsTotal: 1000000, dispatchesTotal: 900000 });
    expect(result.arrivalsRequired).toBe(true);
    expect(result.dispatchesRequired).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// Knowledge base constants
// ══════════════════════════════════════════════════════════════
describe("Knowledge base constants", () => {
  it("VIES has no threshold", () => {
    expect(REPORTING_OBLIGATIONS.vies.threshold).toBe(0);
  });

  it("Intrastat threshold is €750,000", () => {
    expect(REPORTING_OBLIGATIONS.intrastat.arrivals_threshold).toBe(750000);
    expect(REPORTING_OBLIGATIONS.intrastat.dispatches_threshold).toBe(750000);
  });

  it("OSS threshold is €10,000", () => {
    expect(OSS_RULES.threshold).toBe(10000);
  });

  it("VAT3 box descriptions are complete", () => {
    expect(VAT3_EU_BOXES.T1).toBeTruthy();
    expect(VAT3_EU_BOXES.T2).toBeTruthy();
    expect(VAT3_EU_BOXES.E1).toBeTruthy();
    expect(VAT3_EU_BOXES.E2).toBeTruthy();
    expect(VAT3_EU_BOXES.ES1).toBeTruthy();
    expect(VAT3_EU_BOXES.ES2).toBeTruthy();
    expect(VAT3_EU_BOXES.PA1).toBeTruthy();
  });

  it("ICS is zero-rated", () => {
    expect(INTRA_COMMUNITY_SUPPLIES.ics.treatment).toBe("zero_rated");
  });

  it("exports are zero-rated", () => {
    expect(IMPORTS_EXPORTS.exports.treatment).toBe("zero_rated");
  });

  it("place of supply B2B services = customer location", () => {
    expect(PLACE_OF_SUPPLY_SERVICES.general_rule.b2b.rule).toContain("customer");
  });

  it("place of supply B2C services = supplier location", () => {
    expect(PLACE_OF_SUPPLY_SERVICES.general_rule.b2c.rule).toContain("supplier");
  });
});

// ══════════════════════════════════════════════════════════════
// determineCrossBorderVAT — B2C services to EU (line 349)
// ══════════════════════════════════════════════════════════════
describe("determineCrossBorderVAT — B2C services to EU", () => {
  it("B2C services sale to EU = standard rated with digital service warning", () => {
    const result = determineCrossBorderVAT({
      direction: "sale",
      counterpartyLocation: "eu",
      supplyType: "services",
      customerType: "b2c",
    });
    expect(result.treatment).toBe("standard_rated");
    expect(result.warnings).toContain("Check if this is a digital/electronic service — different rules apply");
  });
});

// ══════════════════════════════════════════════════════════════
// determineCrossBorderVAT — fallback default (line 443)
// ══════════════════════════════════════════════════════════════
describe("determineCrossBorderVAT — fallback default treatment", () => {
  it("treats B2C EU goods purchase as intra-community acquisition (same as B2B)", () => {
    // EU goods purchase matches regardless of customerType — ICA rules apply
    const result = determineCrossBorderVAT({
      direction: "purchase",
      counterpartyLocation: "eu",
      supplyType: "goods",
      customerType: "b2c",
    });
    expect(result.treatment).toBe("self_accounting");
  });

  it("services sale to NI = zero-rated (services follow non-EU rules)", () => {
    const result = determineCrossBorderVAT({
      direction: "sale",
      counterpartyLocation: "ni",
      supplyType: "services",
      customerType: "b2b",
    });
    expect(result.treatment).toBe("zero_rated");
    expect(result.explanation).toContain("outside scope of Irish VAT");
    expect(result.vat3Boxes).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("goods sale to non-EU = zero-rated with E2 and customs warning", () => {
    const result = determineCrossBorderVAT({
      direction: "sale",
      counterpartyLocation: "non_eu",
      supplyType: "goods",
      customerType: "b2c",
    });
    expect(result.treatment).toBe("zero_rated");
    expect(result.vat3Boxes).toContain("E2");
    expect(result.warnings).toContain("Retain customs export documentation");
  });

  it("returns standard_rated with advisor warning for truly unmatched combinations", () => {
    // Use an invalid direction to hit the default fallback
    const result = determineCrossBorderVAT({
      direction: "other" as "purchase",
      counterpartyLocation: "eu",
      supplyType: "goods",
      customerType: "b2c",
    });
    expect(result.treatment).toBe("standard_rated");
    expect(result.warnings).toContain("Consult a tax advisor for the correct treatment");
  });
});
