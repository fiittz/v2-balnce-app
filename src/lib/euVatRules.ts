/**
 * EU & International VAT Rules Knowledge Base
 * Based on Irish Revenue Guidelines, EU VAT Directive 2006/112/EC,
 * and post-Brexit UK trade arrangements.
 *
 * Reference: VAT Consolidation Act 2010, EU VAT Directive, Northern Ireland Protocol
 */

// =================== EU MEMBER STATES (excl. Ireland) ===================
export interface EUCountry {
  code: string;
  name: string;
  vatPrefix: string;
}

export const EU_COUNTRIES: EUCountry[] = [
  { code: "AT", name: "Austria", vatPrefix: "ATU" },
  { code: "BE", name: "Belgium", vatPrefix: "BE" },
  { code: "BG", name: "Bulgaria", vatPrefix: "BG" },
  { code: "HR", name: "Croatia", vatPrefix: "HR" },
  { code: "CY", name: "Cyprus", vatPrefix: "CY" },
  { code: "CZ", name: "Czech Republic", vatPrefix: "CZ" },
  { code: "DK", name: "Denmark", vatPrefix: "DK" },
  { code: "EE", name: "Estonia", vatPrefix: "EE" },
  { code: "FI", name: "Finland", vatPrefix: "FI" },
  { code: "FR", name: "France", vatPrefix: "FR" },
  { code: "DE", name: "Germany", vatPrefix: "DE" },
  { code: "GR", name: "Greece", vatPrefix: "EL" },
  { code: "HU", name: "Hungary", vatPrefix: "HU" },
  { code: "IT", name: "Italy", vatPrefix: "IT" },
  { code: "LV", name: "Latvia", vatPrefix: "LV" },
  { code: "LT", name: "Lithuania", vatPrefix: "LT" },
  { code: "LU", name: "Luxembourg", vatPrefix: "LU" },
  { code: "MT", name: "Malta", vatPrefix: "MT" },
  { code: "NL", name: "Netherlands", vatPrefix: "NL" },
  { code: "PL", name: "Poland", vatPrefix: "PL" },
  { code: "PT", name: "Portugal", vatPrefix: "PT" },
  { code: "RO", name: "Romania", vatPrefix: "RO" },
  { code: "SK", name: "Slovakia", vatPrefix: "SK" },
  { code: "SI", name: "Slovenia", vatPrefix: "SI" },
  { code: "ES", name: "Spain", vatPrefix: "ES" },
  { code: "SE", name: "Sweden", vatPrefix: "SE" },
];

// =================== UK POST-BREXIT RULES ===================
export const UK_RULES = {
  description: "Post-Brexit, GB is a third country. Northern Ireland remains in EU single market for goods under the Windsor Framework.",
  gb: {
    goods: "non_eu" as const,
    services: "non_eu" as const,
    note: "Great Britain (England, Scotland, Wales) — treated as non-EU for both goods and services. Import VAT applies on goods, reverse charge on services.",
  },
  ni: {
    goods: "eu" as const,
    services: "non_eu" as const,
    note: "Northern Ireland — EU single market for goods (XI prefix VAT numbers), but non-EU for services. Intra-community rules apply to goods.",
  },
  vatPrefixes: {
    gb: "GB",
    ni: "XI",
  },
};

// =================== INTRA-COMMUNITY SUPPLIES ===================
export const INTRA_COMMUNITY_SUPPLIES = {
  ics: {
    title: "Intra-Community Supplies (ICS) — Selling goods to EU",
    treatment: "zero_rated",
    conditions: [
      "Goods must be physically transported from Ireland to another EU member state",
      "Customer must provide a valid EU VAT registration number",
      "Irish supplier must verify VAT number via VIES before zero-rating",
      "Supplier must retain proof of transport (CMR, bill of lading, carrier confirmation)",
      "Supply must be reported on VIES return",
    ],
    vat3Box: "E1",
    warning: "If conditions not met, Irish VAT must be charged at the applicable rate.",
  },
  ica: {
    title: "Intra-Community Acquisitions (ICA) — Buying goods from EU",
    treatment: "self_accounting",
    description: "Irish purchaser self-accounts for VAT on the acquisition. VAT is both charged and deducted on the same return (net zero if fully deductible).",
    vat3Boxes: { output: "T1", input: "T2" },
    note: "The EU supplier invoices at 0% (zero-rated ICS from their side). You declare Irish VAT at the applicable rate on your VAT3.",
  },
  triangulation: {
    title: "Triangulation (ABC supplies)",
    description: "Simplification for three-party transactions across three EU states. The intermediary (B) avoids VAT registration in the destination state.",
    conditions: [
      "Three parties in three different EU member states",
      "Goods shipped directly from A's state to C's state",
      "B issues zero-rated invoice to C with triangulation note",
      "C self-accounts for VAT",
    ],
  },
};

// =================== REPORTING OBLIGATIONS ===================
export const REPORTING_OBLIGATIONS = {
  vies: {
    title: "VIES Return (VAT Information Exchange System)",
    threshold: 0,
    frequency: "quarterly",
    description: "Must report all intra-community supplies of goods and services to VAT-registered customers in other EU states.",
    deadline: "By the 23rd of the month following the quarter-end",
    note: "No minimum threshold — all qualifying supplies must be reported.",
    penalty: "€4,000 per return for late/non-filing.",
  },
  intrastat: {
    title: "Intrastat Returns",
    arrivals_threshold: 750000,
    dispatches_threshold: 750000,
    description: "Statistical return for movement of goods between EU states. Required when annual arrivals or dispatches exceed €750,000.",
    frequency: "monthly",
    deadline: "By the 23rd of the month following the reference period",
  },
};

// =================== ONE STOP SHOP (OSS) ===================
export const OSS_RULES = {
  threshold: 10000,
  title: "One Stop Shop (OSS) — Distance selling to EU consumers",
  description: "When B2C sales of goods or digital services to other EU states exceed €10,000/year (combined across all EU states), you must charge VAT at the destination country's rate.",
  schemes: {
    union: {
      name: "Union OSS",
      scope: "Intra-EU distance sales of goods and B2C supplies of services",
      registration: "Register via Revenue's OSS portal in Ireland",
      returns: "Quarterly OSS return (not on your Irish VAT3)",
    },
    non_union: {
      name: "Non-Union OSS",
      scope: "B2C supplies of services by non-EU businesses to EU consumers",
      note: "Not applicable to Irish-established businesses",
    },
    ioss: {
      name: "Import One Stop Shop (IOSS)",
      scope: "Distance sales of imported goods valued ≤€150 to EU consumers",
      description: "Allows charging and collecting VAT at point of sale instead of import. Goods clear customs VAT-free.",
    },
  },
  deemed_supplier: {
    description: "Electronic interfaces (marketplaces) facilitating B2C sales may be deemed the supplier and responsible for collecting VAT.",
    applies_to: ["Online marketplaces", "Platform operators"],
  },
  below_threshold: "If total EU B2C sales below €10,000, you may charge Irish VAT rates instead of destination rates.",
};

// =================== PLACE OF SUPPLY — SERVICES ===================
export const PLACE_OF_SUPPLY_SERVICES = {
  general_rule: {
    b2b: {
      rule: "Where the customer is established (reverse charge applies)",
      description: "For B2B services, the customer self-accounts for VAT in their country. Irish supplier invoices without VAT and notes 'Reverse charge — Article 196 EU VAT Directive'.",
    },
    b2c: {
      rule: "Where the supplier is established",
      description: "For B2C services, Irish VAT applies unless an exception below applies.",
    },
  },
  exceptions: [
    {
      type: "digital_services",
      title: "Electronically supplied services (ESS)",
      b2c_rule: "Where the customer is located (destination principle)",
      note: "SaaS, streaming, e-books, online courses. Use OSS if above €10,000 threshold.",
      examples: ["SaaS subscriptions", "Streaming services", "Online courses", "App downloads", "Web hosting"],
    },
    {
      type: "property_related",
      title: "Services related to immovable property",
      rule: "Where the property is located",
      examples: ["Construction work", "Architecture", "Estate agents", "Property valuation", "Accommodation"],
    },
    {
      type: "transport_passengers",
      title: "Passenger transport",
      rule: "Where the transport takes place (proportional if cross-border)",
      examples: ["Bus", "Rail", "Air (intra-EU)"],
    },
    {
      type: "events_admission",
      title: "Admission to events",
      rule: "Where the event physically takes place",
      examples: ["Conferences", "Exhibitions", "Sports events", "Concerts"],
    },
    {
      type: "catering",
      title: "Restaurant and catering services",
      rule: "Where physically performed",
      examples: ["On-site catering", "Restaurant meals"],
    },
    {
      type: "hire_transport",
      title: "Short-term hire of transport",
      rule: "Where the transport is put at the customer's disposal (≤30 days, ≤90 for vessels)",
      examples: ["Car hire", "Van rental"],
    },
    {
      type: "intermediary",
      title: "Intermediary services",
      b2c_rule: "Where the underlying transaction takes place",
      examples: ["Agents", "Brokers acting in someone else's name"],
    },
  ],
};

// =================== IMPORTS & EXPORTS ===================
export const IMPORTS_EXPORTS = {
  exports: {
    title: "Exports to non-EU countries",
    treatment: "zero_rated",
    conditions: [
      "Goods must physically leave the EU",
      "Retain proof of export (customs declaration, shipping docs)",
      "Report on VAT3 box E2",
    ],
    vat3Box: "E2",
  },
  imports: {
    title: "Imports from non-EU countries",
    description: "VAT is charged on importation. The taxable amount is CIF value + customs duty + excise duty.",
    vatBase: "CIF (cost + insurance + freight) + customs duty + excise duty",
    rate: "Irish VAT rate applicable to the goods",
    payment: "Normally payable at point of import unless postponed accounting applies",
  },
  postponed_accounting: {
    title: "Postponed Accounting (PA1)",
    description: "Allows registered traders to account for import VAT on their VAT3 return instead of paying at the point of import. Both output and input VAT declared on the same return.",
    eligibility: "Must be VAT-registered and hold a Customs & Excise (C&E) number. Apply via Revenue's online system.",
    vat3Box: "PA1",
    benefit: "No cash-flow impact — VAT is self-accounted (charged and reclaimed on the same return).",
  },
  section_56: {
    title: "Section 56 Authorisation",
    description: "Allows qualifying persons to receive goods and services without VAT being charged. Primarily used by exporters whose inputs mainly relate to zero-rated exports.",
    eligibility: "At least 75% of taxable supplies must be zero-rated (exports or ICS).",
    note: "Apply to Revenue for a Section 56 authorisation number. Suppliers invoice at 0% quoting the authorisation.",
  },
};

// =================== VAT3 EU-RELATED BOXES ===================
export const VAT3_EU_BOXES = {
  T1: "VAT on intra-community acquisitions (goods received from EU)",
  T2: "VAT on intra-community acquisitions — input credit (self-accounted)",
  E1: "Intra-community supplies of goods (zero-rated sales to EU)",
  E2: "Exports of goods to non-EU countries (zero-rated)",
  ES1: "Intra-community supplies of services to EU businesses",
  ES2: "Intra-community acquisitions of services from EU businesses (reverse charge)",
  PA1: "Postponed accounting — import VAT self-accounted",
};

// =================== VAT NUMBER FORMAT PATTERNS ===================
const VAT_FORMAT_PATTERNS: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/,
  BE: /^BE[01]\d{9}$/,
  BG: /^BG\d{9,10}$/,
  HR: /^HR\d{11}$/,
  CY: /^CY\d{8}[A-Z]$/,
  CZ: /^CZ\d{8,10}$/,
  DK: /^DK\d{8}$/,
  EE: /^EE\d{9}$/,
  FI: /^FI\d{8}$/,
  FR: /^FR[A-Z0-9]{2}\d{9}$/,
  DE: /^DE\d{9}$/,
  GR: /^EL\d{9}$/,
  HU: /^HU\d{8}$/,
  IE: /^IE\d{7}[A-Z]{1,2}$|^IE\d[A-Z]\d{5}[A-Z]$/,
  IT: /^IT\d{11}$/,
  LV: /^LV\d{11}$/,
  LT: /^LT(\d{9}|\d{12})$/,
  LU: /^LU\d{8}$/,
  MT: /^MT\d{8}$/,
  NL: /^NL\d{9}B\d{2}$/,
  PL: /^PL\d{10}$/,
  PT: /^PT\d{9}$/,
  RO: /^RO\d{2,10}$/,
  SK: /^SK\d{10}$/,
  SI: /^SI\d{8}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  SE: /^SE\d{12}$/,
  GB: /^GB(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
  XI: /^XI(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
};

// =================== HELPER FUNCTIONS ===================

export type SupplyType = "goods" | "services";
export type CustomerType = "b2b" | "b2c";
export type CounterpartyLocation = "eu" | "non_eu" | "gb" | "ni";
export type Direction = "sale" | "purchase";

export interface CrossBorderVATResult {
  treatment: "zero_rated" | "reverse_charge" | "standard_rated" | "self_accounting" | "postponed_accounting" | "oss_destination";
  explanation: string;
  vat3Boxes: string[];
  reportingObligations: string[];
  warnings: string[];
}

/**
 * Determine the VAT treatment for a cross-border transaction
 */
export function determineCrossBorderVAT(params: {
  direction: Direction;
  counterpartyLocation: CounterpartyLocation;
  supplyType: SupplyType;
  customerType: CustomerType;
}): CrossBorderVATResult {
  const { direction, counterpartyLocation, supplyType, customerType } = params;

  // SALES
  if (direction === "sale") {
    // Selling goods to EU B2B
    if (counterpartyLocation === "eu" && supplyType === "goods" && customerType === "b2b") {
      return {
        treatment: "zero_rated",
        explanation: "Intra-Community Supply (ICS) — zero-rated. Customer must provide valid EU VAT number, verified via VIES. Retain proof of transport.",
        vat3Boxes: ["E1"],
        reportingObligations: ["VIES return (quarterly)"],
        warnings: ["Verify customer's VAT number on VIES before zero-rating"],
      };
    }

    // Selling goods to EU B2C (distance selling / OSS)
    if (counterpartyLocation === "eu" && supplyType === "goods" && customerType === "b2c") {
      return {
        treatment: "oss_destination",
        explanation: "Distance selling to EU consumers — if total EU B2C sales exceed €10,000, charge destination country VAT via OSS. Below threshold, Irish VAT may apply.",
        vat3Boxes: [],
        reportingObligations: ["OSS return (quarterly) if above threshold"],
        warnings: ["Check if total EU B2C sales exceed €10,000 threshold"],
      };
    }

    // Selling services to EU B2B
    if (counterpartyLocation === "eu" && supplyType === "services" && customerType === "b2b") {
      return {
        treatment: "zero_rated",
        explanation: "B2B services to EU — reverse charge applies. Invoice without VAT, noting 'Reverse charge — Article 196'. Customer self-accounts in their country.",
        vat3Boxes: ["ES1"],
        reportingObligations: ["VIES return (quarterly)"],
        warnings: [],
      };
    }

    // Selling services to EU B2C
    if (counterpartyLocation === "eu" && supplyType === "services" && customerType === "b2c") {
      return {
        treatment: "standard_rated",
        explanation: "B2C services — generally subject to Irish VAT (supplier's country). Exception: digital/electronic services use destination country rate via OSS if above €10,000.",
        vat3Boxes: [],
        reportingObligations: [],
        warnings: ["Check if this is a digital/electronic service — different rules apply"],
      };
    }

    // Selling to NI — goods follow EU rules, services follow non-EU
    if (counterpartyLocation === "ni" && supplyType === "goods") {
      return {
        treatment: "zero_rated",
        explanation: "Northern Ireland — EU single market for goods. Intra-community supply rules apply. Customer uses XI-prefixed VAT number.",
        vat3Boxes: ["E1"],
        reportingObligations: ["VIES return (quarterly)"],
        warnings: ["Verify XI-prefixed VAT number via VIES"],
      };
    }

    // Selling to GB or non-EU (exports)
    if (counterpartyLocation === "non_eu" || counterpartyLocation === "gb" ||
        (counterpartyLocation === "ni" && supplyType === "services")) {
      return {
        treatment: "zero_rated",
        explanation: supplyType === "goods"
          ? "Export to non-EU country — zero-rated. Retain proof of export (customs declaration, shipping documentation)."
          : "Services to non-EU business — outside scope of Irish VAT. Invoice without VAT.",
        vat3Boxes: supplyType === "goods" ? ["E2"] : [],
        reportingObligations: [],
        warnings: supplyType === "goods" ? ["Retain customs export documentation"] : [],
      };
    }
  }

  // PURCHASES
  if (direction === "purchase") {
    // Buying goods from EU
    if (counterpartyLocation === "eu" && supplyType === "goods") {
      return {
        treatment: "self_accounting",
        explanation: "Intra-Community Acquisition (ICA) — self-account for Irish VAT. EU supplier invoices at 0%. Declare both output (T1) and input (T2) VAT on your VAT3 (net zero if fully deductible).",
        vat3Boxes: ["T1", "T2"],
        reportingObligations: [],
        warnings: [],
      };
    }

    // Buying services from EU (reverse charge)
    if (counterpartyLocation === "eu" && supplyType === "services") {
      return {
        treatment: "reverse_charge",
        explanation: "Reverse charge on EU services received — self-account for Irish VAT. Declare as both output (ES2) and input on your VAT3.",
        vat3Boxes: ["ES2"],
        reportingObligations: [],
        warnings: [],
      };
    }

    // Buying from NI — goods follow EU rules
    if (counterpartyLocation === "ni" && supplyType === "goods") {
      return {
        treatment: "self_accounting",
        explanation: "Northern Ireland goods — intra-community acquisition rules apply (same as EU). Self-account for VAT on your VAT3.",
        vat3Boxes: ["T1", "T2"],
        reportingObligations: [],
        warnings: [],
      };
    }

    // Buying services from GB, non-EU, or NI (reverse charge — same as EU services)
    if ((counterpartyLocation === "non_eu" || counterpartyLocation === "gb" ||
        (counterpartyLocation === "ni")) && supplyType === "services") {
      return {
        treatment: "reverse_charge",
        explanation: "Services from non-EU supplier — self-account for Irish VAT at the applicable rate. Same reverse charge mechanism as EU services. Declare output VAT (T1) and input credit (T2) on your VAT3.",
        vat3Boxes: ["T1", "T2"],
        reportingObligations: [],
        warnings: [],
      };
    }

    // Buying goods from GB or non-EU (imports — postponed accounting)
    if ((counterpartyLocation === "non_eu" || counterpartyLocation === "gb") && supplyType === "goods") {
      return {
        treatment: "postponed_accounting",
        explanation: "Import from non-EU — import VAT applies on CIF + duties. Use postponed accounting (PA1) to avoid cash-flow impact.",
        vat3Boxes: ["PA1"],
        reportingObligations: [],
        warnings: ["Consider applying for postponed accounting if not already authorised"],
      };
    }
  }

  return {
    treatment: "standard_rated",
    explanation: "Unable to determine specific treatment — apply standard Irish VAT rate and consult your accountant.",
    vat3Boxes: [],
    reportingObligations: [],
    warnings: ["Consult a tax advisor for the correct treatment"],
  };
}

/**
 * Validate an EU VAT number format for a given country code
 */
export function validateEUVATFormat(vatNumber: string, countryCode: string): {
  valid: boolean;
  message: string;
} {
  const pattern = VAT_FORMAT_PATTERNS[countryCode];
  if (!pattern) {
    return { valid: false, message: `Unknown country code: ${countryCode}` };
  }

  const cleaned = vatNumber.replace(/[\s.-]/g, "").toUpperCase();
  if (pattern.test(cleaned)) {
    return { valid: true, message: `Valid ${countryCode} VAT number format` };
  }

  const country = EU_COUNTRIES.find(c => c.code === countryCode);
  return {
    valid: false,
    message: `Invalid format for ${country?.name || countryCode}. Expected pattern: ${country?.vatPrefix || countryCode} followed by the required digits.`,
  };
}

/**
 * Calculate import VAT on goods from non-EU countries
 */
export function calculateImportVAT(params: {
  cifValue: number;
  customsDuty?: number;
  exciseDuty?: number;
  vatRate?: number;
}): {
  vatBase: number;
  vatAmount: number;
  totalCost: number;
} {
  const { cifValue, customsDuty = 0, exciseDuty = 0, vatRate = 0.23 } = params;
  const vatBase = cifValue + customsDuty + exciseDuty;
  const vatAmount = vatBase * vatRate;
  const totalCost = vatBase + vatAmount;

  return { vatBase, vatAmount, totalCost };
}

/**
 * Check if the OSS threshold has been exceeded
 */
export function checkOSSThreshold(euB2CSalesTotal: number): {
  exceeds: boolean;
  recommendation: string;
} {
  const threshold = OSS_RULES.threshold;
  if (euB2CSalesTotal > threshold) {
    return {
      exceeds: true,
      recommendation: `EU B2C sales (€${euB2CSalesTotal.toLocaleString()}) exceed the €${threshold.toLocaleString()} OSS threshold. You must register for OSS and charge destination country VAT rates.`,
    };
  }
  return {
    exceeds: false,
    recommendation: `EU B2C sales (€${euB2CSalesTotal.toLocaleString()}) are below the €${threshold.toLocaleString()} OSS threshold. You may charge Irish VAT rates, but can voluntarily register for OSS.`,
  };
}

/**
 * Check if Intrastat filing is required
 */
export function checkIntrastatThreshold(params: {
  arrivalsTotal: number;
  dispatchesTotal: number;
}): {
  arrivalsRequired: boolean;
  dispatchesRequired: boolean;
  recommendation: string;
} {
  const { arrivalsTotal, dispatchesTotal } = params;
  const threshold = REPORTING_OBLIGATIONS.intrastat.arrivals_threshold;
  const arrivalsRequired = arrivalsTotal >= threshold;
  const dispatchesRequired = dispatchesTotal >= threshold;

  const parts: string[] = [];
  if (arrivalsRequired) {
    parts.push(`Arrivals (€${arrivalsTotal.toLocaleString()}) exceed Intrastat threshold — monthly filing required.`);
  }
  if (dispatchesRequired) {
    parts.push(`Dispatches (€${dispatchesTotal.toLocaleString()}) exceed Intrastat threshold — monthly filing required.`);
  }
  if (parts.length === 0) {
    parts.push(`Both arrivals (€${arrivalsTotal.toLocaleString()}) and dispatches (€${dispatchesTotal.toLocaleString()}) are below the €${threshold.toLocaleString()} Intrastat threshold. No filing required.`);
  }

  return {
    arrivalsRequired,
    dispatchesRequired,
    recommendation: parts.join(" "),
  };
}
