import {
  VAT_RATES,
  DISALLOWED_VAT_CREDITS,
  ALLOWED_VAT_CREDITS,
  RCT_RULES,
  INDUSTRY_VAT_RULES,
  determineVatTreatment,
  applyTwoThirdsRule,
} from "./irishVatRules";
import { matchVendor, type VendorMatchResult } from "./vendorMatcher";
import type { VendorCacheEntry } from "@/services/vendorCacheService";
import { extractVendorPattern, getCorrectionConfidence, type UserCorrection } from "./correctionUtils";

export type TransactionDirection = "income" | "expense";

export interface TransactionInput {
  amount: number;
  date: string; // ISO string
  currency: string;
  description: string; // raw bank/CSV description
  merchant_name?: string;
  transaction_type?: string; // card, sepa, cash, etc.
  direction: TransactionDirection;
  user_industry: string; // e.g. Construction, Hospitality
  user_business_type: string; // e.g. Sole Trader, Contractor, LTD
  receipt_text?: string; // optional OCR text
  account_type?: string; // "limited_company" | "directors_personal_tax" — filters category matching
  user_business_description?: string; // free-text description of what the business does (max 40 words)
  mcc_code?: number; // optional MCC code from bank feed
  director_names?: string[]; // director names from onboarding — used to detect salary payments vs subcontractor
  director_reliefs?: string[]; // from onboarding: ["pension_contributions", "medical_expenses", ...] — gates personal categories
  director_income_sources?: string[]; // from onboarding: ["rental_income", "dividends", ...]
}

export interface AutoCatResult {
  category: string;
  vat_type: string;
  vat_deductible: boolean;
  business_purpose: string;
  confidence_score: number; // 0–100
  notes: string;
  needs_review?: boolean;
  needs_receipt?: boolean; // Flag for transactions that need receipt to claim VAT
  is_business_expense: boolean | null; // TRUE = business, FALSE = personal, NULL = needs review
  relief_type?: "medical" | "pension" | "health_insurance" | "rent" | "charitable" | "tuition" | null;
  looks_like_business_expense?: boolean; // Flagged when personal account expense matches business patterns
}

// Re-export VAT rules for use elsewhere
export { VAT_RATES, DISALLOWED_VAT_CREDITS, ALLOWED_VAT_CREDITS, RCT_RULES, INDUSTRY_VAT_RULES, applyTwoThirdsRule };

// Map autocat category names → possible database category names (in priority order)
// These mappings bridge autocat output strings to the actual seeded DB category names,
// which vary by industry (construction, technology, hospitality, etc.)
export const CATEGORY_NAME_MAP: Record<string, string[]> = {
  // ── Expense categories ──
  "Motor Vehicle Expenses": ["Vehicle Expenses", "Fuel", "Vehicle Maintenance & Repairs", "Travel & Accommodation"],
  "Motor/travel": [
    "Van Costs",
    "Vehicle Expenses",
    "Vehicle Maintenance & Repairs",
    "Travel & Accommodation",
    "Fuel",
    "Tolls & Parking",
  ],
  Tools: ["Power Tools", "Tools & Equipment", "Hardware & Equipment"],
  Purchases: ["Materials & Supplies", "Cost of Goods Sold", "Raw Materials"],
  Materials: ["Timber & Sheet Materials", "Fixings & Consumables", "Materials & Supplies", "Raw Materials"],
  "Cost of Goods Sold": ["Cost of Goods Sold", "Materials & Supplies", "Raw Materials"],
  Software: ["Subscriptions & Software", "Software & Licenses", "Office Expenses"],
  "Cloud Hosting": [
    "Cloud Hosting & Infrastructure",
    "Subscriptions & Software",
    "Software & Licenses",
    "API & Third-Party Services",
  ],
  "Payment Processing": ["Payment Processing Fees", "Bank Charges"],
  Phone: ["Telephone & Internet", "Subscriptions & Software"],
  Insurance: ["Insurance", "Vehicle Insurance"],
  "Bank fees": ["Bank Charges"],
  "Bank Fees": ["Bank Charges"],
  Medical: ["Medical Expenses"],
  Drawings: ["Director's Loan Account"],
  "Director's Loan Account": ["Director's Loan Account"],
  "Director's Salary": ["Director's Salary", "Staff Wages"],
  Dividends: ["Dividends"],
  "Meals & Entertainment": ["Meals & Entertainment"],
  "Consulting & Accounting": ["Professional Fees"],
  Wages: ["Subcontractor Payments", "Staff Wages", "Contractor Payments", "Driver Wages"],
  "Labour costs": ["Subcontractor Payments", "Staff Wages", "Contractor Payments"],
  "Sub Con": ["Subcontractor Payments", "Contractor Payments"],
  "Repairs and Maintenance": ["Repairs & Maintenance", "Vehicle Maintenance & Repairs"],
  Cleaning: ["Cleaning & Hygiene"],
  "General Expenses": [],
  Uncategorised: [],
  Advertising: ["Advertising & Marketing"],
  Marketing: ["Advertising & Marketing"],
  Subsistence: ["Subsistence", "Travel & Accommodation", "Meals & Entertainment"],
  Workwear: ["Protective Clothing & PPE"],
  "Tolls & Parking": ["Tolls & Parking", "Vehicle Expenses", "Travel & Accommodation"],
  Training: ["Training & Certifications", "Training & Conferences", "Training & CPD"],
  Rent: ["Rent & Rates", "Rent & Co-working"],
  Equipment: [
    "Tools & Equipment",
    "Hardware & Equipment",
    "Equipment & Furniture",
    "Machinery & Equipment",
    "Kitchen Equipment",
    "Shop Fittings & Equipment",
    "Audio/Visual Equipment",
  ],
  Office: ["Office Expenses", "Subscriptions & Software"],
  other: [],
  // Waste
  Waste: [],
  // Internal transfers — no matching category, will fall through
  "Internal Transfer": ["Internal Transfers"],
  // Travel & Subsistence
  "Travel & Subsistence": ["Travel & Accommodation", "Vehicle Expenses"],
  // ── Income categories ──
  Sales: [
    "Contract Work",
    "Labour Income",
    "Other Income",
    "Consultation Fees",
    "Materials Charged",
    "SaaS Subscription Revenue",
    "Consulting & Services",
    "Product Sales",
    "Food Sales",
    "Delivery Services",
    "Haulage Income",
    "Rental Income",
    "Services",
    "Project Fees",
    "Retainer Income",
    "Online Sales",
    "Wholesale Revenue",
    "Contract Manufacturing",
    "Catering Income",
    "Beverage Sales",
    "Management Fees",
    "Plant Hire Income",
    "Membership & Subscriptions",
    "Implementation & Onboarding Fees",
    "Software Sales & Licensing",
    "Development Services",
    "Maintenance & Support",
    "Event Tickets & Admissions",
    "Sponsorship Income",
    "Venue Hire Income",
    "Catering & Bar Revenue",
  ],
  RCT: ["Contract Work", "Labour Income"],
  "Interest Income": ["Other Income"],
  "Subscription Income": ["Other Income", "SaaS Subscription Revenue", "Membership & Subscriptions"],
  "Tax Refund": ["Other Income"],
};

// Find matching category from database using the mapping
// accountType: "limited_company" → prefer business+both, "directors_personal_tax" → prefer personal+both
export function findMatchingCategory<T extends { name: string; type?: string; account_type?: string }>(
  autocatCategory: string,
  dbCategories: T[],
  transactionType?: "income" | "expense",
  accountType?: string,
): T | null {
  const normalizedAutocat = autocatCategory.toLowerCase().trim();

  // Filter categories by account type if provided
  const filteredCategories = accountType
    ? dbCategories.filter((c) => {
        if (!c.account_type) return true; // No account_type = include
        if (accountType === "limited_company") {
          return c.account_type === "business" || c.account_type === "both";
        }
        if (accountType === "directors_personal_tax") {
          return c.account_type === "personal" || c.account_type === "both";
        }
        return true;
      })
    : dbCategories;

  // First try exact match in filtered set
  const exactMatch = filteredCategories.find(
    (c) => c.name.toLowerCase() === normalizedAutocat && (!transactionType || c.type === transactionType),
  );
  if (exactMatch) return exactMatch;

  // Then try via mapping in filtered set
  const possibleNames = CATEGORY_NAME_MAP[autocatCategory] || [];
  for (const possibleName of possibleNames) {
    const mapped = filteredCategories.find(
      (c) => c.name.toLowerCase() === possibleName.toLowerCase() && (!transactionType || c.type === transactionType),
    );
    if (mapped) return mapped;
  }

  // Fallback: try all categories if filtered set had no match
  if (accountType) {
    const fallbackExact = dbCategories.find(
      (c) => c.name.toLowerCase() === normalizedAutocat && (!transactionType || c.type === transactionType),
    );
    if (fallbackExact) return fallbackExact;

    for (const possibleName of possibleNames) {
      const mapped = dbCategories.find(
        (c) => c.name.toLowerCase() === possibleName.toLowerCase() && (!transactionType || c.type === transactionType),
      );
      if (mapped) return mapped;
    }
  }

  // No partial/fuzzy match — too error-prone (e.g. "General Expenses" matching
  // "Medical Expenses" on the word "expenses"). If there's no exact or mapped
  // match, return null so the transaction stays uncategorized.
  return null;
}

// =================== VENDOR MATCHING ===================
// Vendor database with 500+ patterns, fuzzy matching, and MCC fallback
// replaces the old inline merchantRules[] array.

// Trade industries that should get boosted confidence for trade suppliers
const TRADE_INDUSTRIES = [
  "construction",
  "carpentry_joinery",
  "carpentry",
  "joinery",
  "electrical",
  "plumbing_heating",
  "plumbing",
  "heating",
  "landscaping_groundworks",
  "painting_decorating",
  "manufacturing",
  "maintenance_facilities",
  "trades",
];

// Tech/SaaS industries that should get boosted confidence for tech suppliers
const TECH_INDUSTRIES = ["technology_it", "technology", "software", "saas", "professional_services"];

function normalise(text: string | undefined | null): string {
  return (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function inferIncomeCategory(tx: TransactionInput): {
  category: string;
  business_purpose: string;
  confidenceBoost: number;
  isRCT: boolean;
} | null {
  const desc = normalise(tx.description);

  if (tx.direction !== "income") return null;

  const industry = normalise(tx.user_industry);
  const bizDesc = normalise(tx.user_business_description);
  const industryContext = `${industry} ${bizDesc}`;
  const userInConstruction = !!industryContext.match(
    /construct|carpentry|trades|electrical|plumbing|building|joinery|kitchen|wardrobe|fitting|renovation/,
  );

  // Check for RCT income (construction company payments)
  const isFromCompany =
    desc.includes("limited") ||
    desc.includes("ltd") ||
    desc.includes("from") ||
    desc.includes("caracon") ||
    desc.includes("contractors") ||
    desc.includes("holdings") ||
    desc.includes("developments") ||
    desc.includes("builders") ||
    desc.includes("plc") ||
    desc.includes("group");

  if (isFromCompany && userInConstruction) {
    return {
      category: "RCT",
      business_purpose: "Income from principal contractor. Subject to RCT reverse charge - you do not charge VAT.",
      confidenceBoost: 25,
      isRCT: true,
    };
  }

  // Check for common income patterns in Irish bank statements
  const looksLikeClientPayment =
    desc.includes("transfer") ||
    desc.includes("payment") ||
    desc.includes("invoice") ||
    desc.includes("lodgement") ||
    desc.includes("credit") ||
    desc.includes("money added") ||
    desc.includes("received") ||
    desc.includes("deposit") ||
    desc.includes("eft") ||
    desc.includes("bacs") ||
    desc.includes("faster payment") ||
    desc.includes("sepa credit");

  const category = "Sales";
  let purpose = "Client payment received.";
  const confidenceBoost = looksLikeClientPayment ? 20 : 10;

  if (userInConstruction) {
    purpose = "Client payment for construction/trades work.";
  } else if (industry.includes("professional") || industry.includes("consult")) {
    purpose = "Client payment for professional services.";
  } else if (industry.includes("retail")) {
    purpose = "Customer payment for product sales.";
  }

  // If no specific pattern matched but it IS income, still return a match
  // with lower confidence boost — the CSV parser already determined it's income
  if (!looksLikeClientPayment) {
    purpose = "Income received.";
  }

  return {
    category,
    business_purpose: purpose,
    confidenceBoost,
    isRCT: false,
  };
}

function refineWithReceipt(base: AutoCatResult, tx: TransactionInput): AutoCatResult {
  const receipt = normalise(tx.receipt_text);
  if (!receipt) return base;

  const result = { ...base };

  // If receipt proves diesel (not petrol), allow VAT claim
  if (receipt.match(/diesel|derv/) && !receipt.match(/petrol|unleaded|gasoline/)) {
    result.category = "Motor Vehicle Expenses";
    result.vat_type = "Standard 23%";
    result.vat_deductible = true;
    result.confidence_score = Math.min(100, result.confidence_score + 15);
    result.notes += " Receipt confirms DIESEL purchase - VAT deductible.";
    result.needs_receipt = false;
    return result;
  }

  // Petrol is NEVER deductible - Section 60(2)(a)(v)
  if (receipt.match(/petrol|unleaded|gasoline/)) {
    result.category = "Motor Vehicle Expenses";
    result.vat_type = "Standard 23%";
    result.vat_deductible = false;
    result.confidence_score = Math.min(100, result.confidence_score + 10);
    result.notes += " Receipt shows PETROL - VAT NOT deductible (Section 60(2)(a)(v)).";
    result.needs_receipt = false;
    return result;
  }

  // Materials confirmation
  if (receipt.match(/timber|plywood|mdf|cement|screws|adhesive|plaster|sand|gravel/)) {
    result.category = "Materials";
    result.vat_type = "Standard 23%";
    result.vat_deductible = true;
    result.confidence_score = Math.min(100, result.confidence_score + 10);
    result.notes += " Receipt confirms construction materials.";
    return result;
  }

  // Tools confirmation
  if (receipt.match(/tool|drill|saw|hammer|screwdriver|blade|sander/)) {
    result.category = "Tools";
    result.vat_type = "Standard 23%";
    result.vat_deductible = true;
    result.confidence_score = Math.min(100, result.confidence_score + 10);
    result.notes += " Receipt confirms tools purchase.";
    return result;
  }

  return result;
}

// Check if description explicitly says "Director's Loan" or "DLA" — unambiguous
function isExplicitDLA(desc: string): boolean {
  const normalised = normalise(desc);
  return (
    normalised.includes("dla ") ||
    normalised.includes("directors loan") ||
    normalised.includes("director loan")
  );
}

// Check if transaction looks like it MIGHT be a DLA debit but is ambiguous —
// ATM withdrawals, personal transfers, etc. could be petty cash or business.
function isAmbiguousDLA(desc: string, tx: TransactionInput): boolean {
  const normalised = normalise(desc);
  const isBusinessAccount = tx.account_type === "limited_company";

  if (
    normalised.includes("personal transfer") ||
    normalised.includes("transfer to self") ||
    normalised.includes("own account") ||
    normalised.includes("drawings")
  ) {
    return true;
  }

  if (isBusinessAccount) {
    if (
      normalised.includes("atm") ||
      normalised.includes("cash withdrawal") ||
      normalised.includes("cash machine") ||
      normalised.includes("counter withdrawal") ||
      normalised.includes("self service withdrawal")
    ) {
      return true;
    }
  }

  return false;
}

// Check if transaction is a transfer to an individual (not a business)
function isPaymentToIndividual(desc: string): boolean {
  const normalised = normalise(desc);
  // Transfers "To [Name]" that don't contain company indicators
  if (
    normalised.startsWith("to ") &&
    !normalised.includes("limited") &&
    !normalised.includes("ltd") &&
    !normalised.includes("group") &&
    !normalised.includes("company")
  ) {
    return true;
  }
  return false;
}

export function autoCategorise(
  tx: TransactionInput,
  vendorCache?: Map<string, VendorCacheEntry>,
  userCorrections?: Map<string, UserCorrection>,
): AutoCatResult {
  const desc = normalise(tx.description);
  const merchant = normalise(tx.merchant_name ?? tx.description);
  const amountAbs = Math.abs(tx.amount);

  let category = "General Expenses";
  let vat_type = "Standard 23%";
  let vat_deductible = true;
  let business_purpose = "";
  let confidence = 50;
  let notes = "";
  let needs_review = false;
  let needs_receipt = false;
  let is_business_expense: boolean | null = null; // Default uncertain
  let relief_type: AutoCatResult["relief_type"] = null;

  // Get user industry for VAT rules
  const userIndustry = normalise(tx.user_industry);
  const userBusinessType = normalise(tx.user_business_type);
  const userBizDesc = normalise(tx.user_business_description);

  // 1) Income handling
  if (tx.direction === "income") {
    // Check if this is a Revenue Commissioners refund — NOT taxable income
    const isRevenueRefund =
      desc.includes("revenue") ||
      desc.includes("collector general") ||
      desc.includes("collector-general") ||
      desc.includes("rev comm") ||
      desc.includes("ros refund") ||
      desc.includes("tax refund") ||
      desc.includes("vat refund") ||
      desc.includes("paye refund") ||
      desc.includes("ct refund") ||
      desc.includes("rct refund");
    if (isRevenueRefund) {
      return finalizeResult(
        {
          category: "Tax Refund",
          vat_type: "Exempt",
          vat_deductible: false,
          business_purpose: "Tax refund from Revenue Commissioners. Not taxable income — return of overpaid tax.",
          confidence_score: 95,
          notes: "Revenue refund — excluded from taxable income. Not subject to CT or income tax.",
          needs_review: false,
          needs_receipt: false,
          is_business_expense: true,
        },
        tx,
      );
    }

    // Check if this is a commercial refund — classify as Other Income
    const isRefund =
      desc.includes("refund") || desc.includes("reversal") || desc.includes("cashback") || desc.includes("rebate");
    if (isRefund) {
      return finalizeResult(
        {
          category: "Interest Income", // maps to "Other Income" in DB
          vat_type: "Exempt",
          vat_deductible: false,
          business_purpose: "Refund received. Classified as other income.",
          confidence_score: 85,
          notes: "Refund/reversal detected — categorised as Other Income.",
          needs_review: false,
          needs_receipt: false,
          is_business_expense: true,
        },
        tx,
      );
    }

    const incomeGuess = inferIncomeCategory(tx);
    if (incomeGuess) {
      category = incomeGuess.category;
      vat_type = incomeGuess.isRCT ? "Reverse Charge" : "Standard 23%";
      vat_deductible = false; // Income doesn't have deductible VAT
      business_purpose = incomeGuess.business_purpose;
      confidence = 70 + incomeGuess.confidenceBoost;
      notes = incomeGuess.isRCT ? "RCT income - reverse charge applies." : "Recognised as client payment.";
      is_business_expense = true; // Income is always business
    } else {
      /* v8 ignore start -- unreachable: inferIncomeCategory always returns a result for income transactions */
      // Use industry-specific VAT rate for income
      const industryRules = INDUSTRY_VAT_RULES[userIndustry] || INDUSTRY_VAT_RULES[userBusinessType];
      const outputRate = industryRules?.defaultOutputRate || "standard_23";

      category = "Sales";
      vat_type =
        VAT_RATES[outputRate.toUpperCase().replace("_", "_") as keyof typeof VAT_RATES]?.label || "Standard Rate (23%)";
      vat_deductible = false;
      business_purpose = `Income received. ${industryRules?.specialRules?.[0] || ""}`;
      confidence = 60;
      notes = "Income transaction.";
      is_business_expense = true; // Income is always business
      /* v8 ignore stop */
    }

    return finalizeResult(
      {
        category,
        vat_type,
        vat_deductible,
        business_purpose,
        confidence_score: confidence,
        notes,
        needs_review,
        needs_receipt,
        is_business_expense,
      },
      tx,
    );
  }

  // 2) Check for explicit DLA keywords ("directors loan", "dla") — unambiguous
  if (isExplicitDLA(desc)) {
    return finalizeResult(
      {
        category: "Director's Loan Account",
        vat_type: "N/A",
        vat_deductible: false,
        business_purpose: "Director's Loan Account — personal withdrawal. Not a P&L expense. Debits the DLA on the balance sheet.",
        confidence_score: 90,
        notes: "Director's Loan Account debit. Not deductible for Corporation Tax. If DLA is overdrawn, S.239 TCA benefit-in-kind may apply.",
        needs_review: false,
        needs_receipt: false,
        is_business_expense: false,
      },
      tx,
    );
  }

  // 2a) Ambiguous DLA-like transactions (ATM, personal transfer, etc.) → Uncategorised for review
  if (isAmbiguousDLA(desc, tx)) {
    return finalizeResult(
      {
        category: "Uncategorised",
        vat_type: "N/A",
        vat_deductible: false,
        business_purpose: "Could be personal (DLA debit) or business (petty cash). Review required.",
        confidence_score: 50,
        notes: "Ambiguous transaction — could be Director's Loan Account or business use. Please review and categorise.",
        needs_review: true,
        needs_receipt: false,
        is_business_expense: null,
      },
      tx,
    );
  }

  // 2.1) Check for payment to individual
  if (isPaymentToIndividual(desc)) {
    // If director names are provided, check if this transfer is to a director → Salary
    if (tx.director_names && tx.director_names.length > 0) {
      const transferTarget = normalise(desc).replace(/^to\s+/, "");
      const isDirector = tx.director_names.some((name) => {
        const normalName = normalise(name);
        if (!normalName) return false;
        // Match full name or surname
        const parts = normalName.split(/\s+/);
        const surname = parts[parts.length - 1];
        return transferTarget.includes(normalName) || (surname.length > 2 && transferTarget.includes(surname));
      });

      if (isDirector) {
        return finalizeResult(
          {
            category: "Director's Salary",
            vat_type: "N/A",
            vat_deductible: false,
            business_purpose: "Director's salary payment. Subject to PAYE, PRSI, and USC through payroll.",
            confidence_score: 90,
            notes: "Payment to director — classified as salary. Deductible for Corporation Tax.",
            needs_review: false,
            needs_receipt: false,
            is_business_expense: true,
          },
          tx,
        );
      }
    }

    // Ltd company + no director names on file: no basis to classify, send to Uncategorised
    if (tx.account_type === "limited_company" && (!tx.director_names || tx.director_names.length === 0)) {
      return finalizeResult(
        {
          category: "Uncategorised",
          vat_type: "N/A",
          vat_deductible: false,
          business_purpose: "Payment to individual from company account. No director names on file — cannot determine if this is director salary or subcontractor payment.",
          confidence_score: 50,
          notes: "No director names on file. Add director names in onboarding to enable auto-detection.",
          needs_review: true,
          needs_receipt: false,
          is_business_expense: null,
        },
        tx,
      );
    }

    return finalizeResult(
      {
        category: "Labour costs",
        vat_type: "N/A",
        vat_deductible: false,
        business_purpose: "Payment to individual. Cannot claim VAT without valid VAT invoice.",
        confidence_score: 75,
        notes: "Transfer to individual - no VAT deduction possible without invoice.",
        needs_review: true,
        needs_receipt: true,
        is_business_expense: null, // Uncertain - could be personal transfer
      },
      tx,
    );
  }

  // 2.5) User corrections lookup — highest priority after statutory rules
  let correctionHit: UserCorrection | undefined;
  if (userCorrections && userCorrections.size > 0) {
    const vendorPattern = extractVendorPattern(tx.description);
    if (vendorPattern && userCorrections.has(vendorPattern)) {
      const correction = userCorrections.get(vendorPattern)!;
      const correctionConfidence = getCorrectionConfidence(correction);
      if (correctionConfidence > 0) {
        correctionHit = correction;
      }
    }
  }

  if (correctionHit) {
    const correctionConfidence = getCorrectionConfidence(correctionHit);
    return finalizeResult(
      {
        category: correctionHit.corrected_category,
        vat_type:
          correctionHit.corrected_vat_rate != null
            ? correctionHit.corrected_vat_rate === 23
              ? "Standard 23%"
              : correctionHit.corrected_vat_rate === 13.5
                ? "Reduced 13.5%"
                : correctionHit.corrected_vat_rate === 9
                  ? "Second Reduced 9%"
                  : correctionHit.corrected_vat_rate === 0
                    ? "Zero"
                    : "Standard 23%"
            : "N/A",
        vat_deductible: correctionHit.corrected_vat_rate != null && correctionHit.corrected_vat_rate > 0,
        business_purpose: `User-corrected category (${correctionHit.transaction_count} corrections).`,
        confidence_score: correctionConfidence,
        notes: `Applied user correction for "${correctionHit.vendor_pattern}".`,
        needs_review: false,
        is_business_expense: true,
      },
      tx,
    );
  }

  // 2.7) Staff entertainment keywords — must fire before Section 60 food/drink check
  //       Staff entertainment is CT deductible (s.840 TCA exception) but VAT blocked (s.60 VATCA)
  const staffEntertainmentKeywords = [
    "staff night",
    "staff party",
    "staff event",
    "staff outing",
    "team night",
    "team event",
    "team building",
    "christmas party",
    "xmas party",
    "employee event",
  ];
  if (staffEntertainmentKeywords.some((k) => desc.includes(k))) {
    return finalizeResult(
      {
        category: "Meals & Entertainment",
        vat_type: "Standard 23%",
        vat_deductible: false,
        business_purpose:
          "Staff entertainment. CT deductible under s.840 TCA exception (bona fide staff entertainment). VAT NOT recoverable (s.60 VATCA — food/drink/entertainment). Must be open to all staff, reasonable cost, not incidental to client entertainment.",
        confidence_score: 75,
        notes:
          "Staff entertainment — review conditions: open to all staff, reasonable cost, max 3–4 events/year, no clients attending.",
        needs_review: true,
        needs_receipt: true,
        is_business_expense: true,
      },
      tx,
    );
  }

  // 3) Vendor cache lookup — check cached entries before hardcoded rules
  let cacheHit: VendorCacheEntry | undefined;
  if (vendorCache && vendorCache.size > 0) {
    const tokens = desc.split(/\s+/);
    // Try progressively longer n-grams (longest match wins)
    for (let len = tokens.length; len >= 1 && !cacheHit; len--) {
      for (let i = 0; i <= tokens.length - len && !cacheHit; i++) {
        const ngram = tokens.slice(i, i + len).join(" ");
        if (vendorCache.has(ngram)) {
          cacheHit = vendorCache.get(ngram);
        }
      }
    }
  }

  // 3.5) Vendor match — uses vendorDatabase (exact → fuzzy → MCC fallback)
  const vendorMatch: VendorMatchResult | null = cacheHit
    ? {
        vendor: {
          name: cacheHit.normalized_name,
          patterns: [cacheHit.vendor_pattern],
          category: cacheHit.category,
          vat_type: cacheHit.vat_type,
          vat_deductible: cacheHit.vat_deductible,
          purpose: cacheHit.business_purpose ?? "",
          sector: cacheHit.sector ?? undefined,
        },
        matchType: "exact",
        matchedPattern: cacheHit.vendor_pattern,
        confidence: cacheHit.confidence,
      }
    : matchVendor(tx.description, tx.merchant_name, tx.amount, tx.mcc_code);

  // 4) APPLY IRISH VAT RULES (Section 59/60) — statutory rules ALWAYS take priority
  //    These fire regardless of vendor match because Section 60 is law.
  const vatTreatment = determineVatTreatment(
    tx.description,
    amountAbs,
    userIndustry || userBusinessType || "general",
    "expense",
  );

  const foodWordBoundary = DISALLOWED_VAT_CREDITS.FOOD_DRINK_ACCOMMODATION.wordBoundaryKeywords || [];
  const foodWordMatch = foodWordBoundary.some((k: string) => new RegExp(`\\b${k}\\b`).test(desc));
  const allFoodAccomKeywords = DISALLOWED_VAT_CREDITS.FOOD_DRINK_ACCOMMODATION.keywords;

  // Separate accommodation from food/drink — both have VAT blocked under Section 60,
  // but accommodation is a legitimate business expense categorised as Travel & Subsistence,
  // while food/drink falls under "other".
  const ACCOMMODATION_KEYWORDS = [
    "hotel",
    "accommodation",
    "airbnb",
    "b&b",
    "guesthouse",
    "guest house",
    "hostel",
    "lodge",
    "booking.com",
  ];
  const isAccommodation = ACCOMMODATION_KEYWORDS.some((k) => desc.includes(k));
  const isFoodDrink = !isAccommodation && (foodWordMatch || allFoodAccomKeywords.some((k) => desc.includes(k)));

  const isDisallowedEntertainment = DISALLOWED_VAT_CREDITS.ENTERTAINMENT.keywords.some((k) => desc.includes(k));
  const isDisallowedPetrol = DISALLOWED_VAT_CREDITS.PETROL.keywords.some((k) => desc.includes(k));
  const isDiesel = ALLOWED_VAT_CREDITS.DIESEL.keywords!.some((k) => desc.includes(k));

  // Check for DIESEL specifically first - VAT IS recoverable
  if (isDiesel) {
    return finalizeResult(
      {
        category: "Motor Vehicle Expenses",
        vat_type: "Standard 23%",
        vat_deductible: true,
        business_purpose: "Diesel fuel - VAT IS recoverable (unlike petrol). Section 59.",
        confidence_score: 90,
        notes: "Diesel purchase - VAT deductible.",
        needs_review: false,
        needs_receipt: true,
        is_business_expense: true,
      },
      tx,
    );
  }

  // Accommodation: categorise as Travel & Subsistence (maps to "Travel & Accommodation" in DB)
  // VAT rate is 9% (second reduced rate for accommodation in Ireland)
  // VAT is blocked per Section 60, but the expense IS deductible for Corporation Tax
  if (isAccommodation) {
    return finalizeResult(
      {
        category: "Travel & Subsistence",
        vat_type: "Second Reduced 9%",
        vat_deductible: false,
        business_purpose: "Business accommodation - 9% VAT rate, not recoverable under Section 60(2)(a)(i).",
        confidence_score: 90,
        notes:
          "Section 60(2)(a)(i) - Accommodation VAT not recoverable. Expense is deductible for Corporation Tax / Income Tax.",
        needs_review: false,
        needs_receipt: true,
        is_business_expense: true,
      },
      tx,
    );
  }

  // Food & drink: not a business expense category, falls to "other"
  if (isFoodDrink) {
    return finalizeResult(
      {
        category: "other",
        vat_type: "Standard 23%",
        vat_deductible: false,
        business_purpose: vatTreatment.explanation,
        confidence_score: 90,
        notes: "Section 60(2)(a)(i) - Food/drink VAT not recoverable.",
        needs_review: false,
        needs_receipt: false,
        is_business_expense: false,
      },
      tx,
    );
  }

  if (isDisallowedEntertainment) {
    return finalizeResult(
      {
        category: "other",
        vat_type: "Standard 23%",
        vat_deductible: false,
        business_purpose: vatTreatment.explanation,
        confidence_score: 90,
        notes: "Section 60(2)(a)(iii) - Entertainment VAT not recoverable.",
        needs_review: false,
        needs_receipt: false,
        is_business_expense: false,
      },
      tx,
    );
  }

  if (isDisallowedPetrol) {
    return finalizeResult(
      {
        category: "Motor Vehicle Expenses",
        vat_type: "Standard 23%",
        vat_deductible: false,
        business_purpose: vatTreatment.explanation,
        confidence_score: 85,
        notes: "Section 60(2)(a)(v) - Petrol VAT not recoverable (diesel IS recoverable).",
        needs_review: false,
        needs_receipt: true,
        is_business_expense: true,
      },
      tx,
    );
  }

  // 5) Apply vendor match if found
  if (vendorMatch) {
    const { vendor, adjustedCategory, adjustedConfidence, adjustedPurpose, adjustedVatDeductible } = vendorMatch;

    category = adjustedCategory || vendor.category;
    vat_type = vendor.vat_type;
    vat_deductible = adjustedVatDeductible ?? vendor.vat_deductible;
    business_purpose = adjustedPurpose || vendor.purpose;
    confidence = adjustedConfidence || vendorMatch.confidence;
    notes = vendorMatch.matchedPattern
      ? `Matched vendor: ${vendorMatch.matchedPattern}${vendorMatch.matchType === "fuzzy" ? ` (fuzzy ~${Math.round((vendorMatch.similarity ?? 0) * 100)}%)` : ""}.`
      : `Matched via MCC code.`;
    needs_receipt = vendor.needs_receipt ?? false;
    relief_type = vendor.relief_type ?? null;

    // INDUSTRY-AWARE BOOST: If trade/tech supplier + user in matching industry = 95% confidence + definitely business
    const isTradeUser = TRADE_INDUSTRIES.some(
      (ti) => userIndustry.includes(ti) || userBusinessType.includes(ti) || userBizDesc.includes(ti),
    );
    const isTechUser = TECH_INDUSTRIES.some(
      (ti) => userIndustry.includes(ti) || userBusinessType.includes(ti) || userBizDesc.includes(ti),
    );

    const industryLabel = tx.user_industry || tx.user_business_type;
    const descSuffix = tx.user_business_description ? ` (${tx.user_business_description})` : "";

    if (vendor.isTradeSupplier && isTradeUser) {
      confidence = 95;
      is_business_expense = true; // Definitely business for trade users
      vat_deductible = true; // Trade supplies are always VAT deductible for trade users
      notes = `Trade supplier for ${industryLabel} business. Auto-approved.`;
      business_purpose = `${vendor.purpose} Industry: ${industryLabel}${descSuffix}.`;
    } else if (vendor.isTechSupplier && isTechUser) {
      confidence = 95;
      is_business_expense = true;
      // Preserve original vat_deductible (Stripe is exempt, cloud hosting is reclaimable)
      notes = `Tech/SaaS supplier for ${industryLabel} business. Auto-approved.`;
      business_purpose = `${vendor.purpose} Industry: ${industryLabel}${descSuffix}.`;
    } else if (vendor.isTechSupplier && !isTechUser) {
      // Tech supplier but user NOT in tech industry - still likely business but lower confidence
      confidence = 75;
      is_business_expense = true; // Most businesses use SaaS tools
      notes = `Tech/SaaS supplier. User industry (${tx.user_industry || "unspecified"}) is not tech — verify business use.`;
    } else if (vendor.isTradeSupplier && !isTradeUser) {
      // Trade supplier but user NOT in trade industry - lower confidence, might be personal
      confidence = 65;
      is_business_expense = null; // Uncertain - could be DIY/personal
      needs_review = true;
      notes = `Trade supplier but user industry (${tx.user_industry || "unspecified"}) is not trades. Review if business expense.`;
    } else {
      // Apply VAT treatment based on Irish rules
      if (!vatTreatment.isVatRecoverable && vendor.vat_deductible) {
        // Override if Irish VAT rules say not recoverable
        vat_deductible = false;
        notes += ` ${vatTreatment.warnings.join(". ")}`;
      }

      // Determine business vs personal based on merchant category
      is_business_expense = determineBusinessExpense(
        category,
        vat_deductible,
        needs_receipt,
        userIndustry,
        userBusinessType,
      );
    }

    // Ltd company + "Drawings" vendor: can't determine business vs personal without receipt.
    // "Drawings" is a sole trader concept — doesn't exist for limited companies.
    // Could be office supplies, client catering, or personal spending (DLA).
    if (category === "Drawings" && tx.account_type === "limited_company") {
      category = "Uncategorised";
      is_business_expense = null;
      needs_review = true;
      needs_receipt = true;
      confidence = 50;
      business_purpose = "Purchase from personal-use retailer on company account. Upload receipt to determine if business expense or Director's Loan Account debit.";
      notes = "Receipt required — cannot distinguish business vs personal without proof of purchase.";
    }

    // Flag non-deductible expenses for review
    if (!vat_deductible && category === "other") {
      needs_review = true;
    }
  } else {
    // 6) Keyword-based fallback for expenses
    if (desc.includes("fee") || desc.includes("charge") || desc.includes("commission")) {
      category = "Bank fees";
      vat_type = "Exempt";
      vat_deductible = false;
      business_purpose = "Bank fees/charges. Financial services exempt from VAT.";
      confidence = 75;
      notes = "Description suggests bank fees.";
      is_business_expense = true; // Bank fees are business
    } else if (desc.includes("subscription") || desc.includes("subscr") || desc.includes("saas")) {
      category = "Software";
      vat_type = "Standard 23%";
      vat_deductible = true;
      business_purpose = "Software/SaaS subscription. VAT deductible under Section 59.";
      confidence = 70;
      notes = "Description suggests subscription.";
      is_business_expense = true; // Software is business
    } else if (
      (desc.includes("physio") ||
        desc.includes("dental") ||
        desc.includes("medical") ||
        desc.includes("pharmacy") ||
        desc.includes("chemist")) &&
      (!tx.director_reliefs || tx.director_reliefs.includes("medical_expenses"))
    ) {
      category = "Medical";
      vat_type = "Exempt";
      vat_deductible = false;
      business_purpose = "Medical expense. May qualify for 20% tax relief under Section 469 TCA 1997.";
      confidence = 70;
      notes = "Description suggests medical expense.";
      is_business_expense = false;
      relief_type = "medical";
    } else if (
      desc.includes("pension") &&
      (!tx.director_reliefs || tx.director_reliefs.includes("pension_contributions"))
    ) {
      category = "Insurance";
      vat_type = "Exempt";
      vat_deductible = false;
      business_purpose = "Pension contribution. Tax relief at marginal rate.";
      confidence = 70;
      notes = "Description suggests pension contribution.";
      is_business_expense = false;
      relief_type = "pension";
    } else if (
      (desc.includes("charity") || desc.includes("donation")) &&
      (!tx.director_reliefs || tx.director_reliefs.includes("charitable_donations"))
    ) {
      category = "other";
      vat_type = "Exempt";
      vat_deductible = false;
      business_purpose = "Charitable donation. Tax relief under Section 848A TCA 1997.";
      confidence = 70;
      notes = "Description suggests charitable donation.";
      is_business_expense = false;
      relief_type = "charitable";
    } else if (
      (desc.includes("tuition") || desc.includes("college fee") || desc.includes("university fee")) &&
      (!tx.director_reliefs || tx.director_reliefs.includes("tuition_fees"))
    ) {
      category = "other";
      vat_type = "Exempt";
      vat_deductible = false;
      business_purpose = "Tuition fees. 20% tax relief on qualifying fees over EUR 3,000. Section 473A TCA 1997.";
      confidence = 70;
      notes = "Description suggests tuition fees.";
      is_business_expense = false;
      relief_type = "tuition";
    } else if (
      desc.includes("rent") &&
      !desc.includes("car rent") &&
      !desc.includes("tool rent") &&
      !desc.includes("equipment rent") &&
      (!tx.director_reliefs || tx.director_reliefs.includes("rent_mortgage_interest"))
    ) {
      category = "Rent";
      vat_type = "Exempt";
      vat_deductible = false;
      business_purpose = "Rent payment. May qualify for rent tax credit. Section 473B TCA 1997.";
      confidence = 60;
      notes = "Description mentions rent. Review if personal (relief) or business (expense).";
      is_business_expense = null; // Could be business or personal rent
      relief_type = "rent";
    } else if (desc.includes("insurance")) {
      category = "Insurance";
      vat_type = "Exempt";
      vat_deductible = false;
      business_purpose = "Insurance premium. VAT exempt.";
      confidence = 75;
      notes = "Description mentions insurance.";
      is_business_expense = true; // Insurance is business
    } else if (desc.includes("refund")) {
      category = "other";
      vat_type = "Standard 23%";
      vat_deductible = false;
      business_purpose = "Refund received. May need to reverse previously claimed VAT.";
      confidence = 70;
      notes = "Refund transaction - review VAT implications.";
      needs_review = true;
      is_business_expense = null; // Uncertain
    } else {
      // Apply Irish VAT rules for unknown expenses
      category = "other";
      vat_type = VAT_RATES[vatTreatment.suggestedRate.toUpperCase() as keyof typeof VAT_RATES]?.label || "Standard 23%";
      vat_deductible = vatTreatment.isVatRecoverable;
      business_purpose = vatTreatment.explanation;
      confidence = 40;
      notes = `${vatTreatment.warnings.join(". ")} Review required.`;
      needs_review = true;
      needs_receipt = vatTreatment.needsReceipt;
      is_business_expense = null; // Unknown
    }
  }

  // Gate personal relief categories by director onboarding selections.
  // When director_reliefs is provided and the matching relief is NOT in the list,
  // downgrade to "other" / General Expenses. This applies to both vendor-matched
  // and keyword-matched results. When director_reliefs is undefined, behaviour
  // is unchanged (backwards compatible).
  if (tx.director_reliefs && relief_type) {
    const reliefToOnboarding: Record<string, string> = {
      medical: "medical_expenses",
      pension: "pension_contributions",
      health_insurance: "health_insurance",
      tuition: "tuition_fees",
      rent: "rent_mortgage_interest",
      charitable: "charitable_donations",
    };
    const requiredRelief = reliefToOnboarding[relief_type];
    if (requiredRelief && !tx.director_reliefs.includes(requiredRelief)) {
      category = "other";
      relief_type = null;
      is_business_expense = null;
      confidence = 40;
      needs_review = true;
      notes = "Director did not select this relief in onboarding. Review required.";
      business_purpose = "Possible personal expense — relief not selected during onboarding.";
    }
  }

  return finalizeResult(
    {
      category,
      vat_type,
      vat_deductible,
      business_purpose,
      confidence_score: confidence,
      notes,
      needs_review,
      needs_receipt,
      is_business_expense,
      relief_type,
    },
    tx,
  );
}

// Helper function to determine if expense is business or personal
// Now considers user industry/business type for better accuracy
function determineBusinessExpense(
  category: string,
  vatDeductible: boolean,
  needsReceipt: boolean,
  userIndustry?: string,
  userBusinessType?: string,
): boolean | null {
  // DEFINITELY BUSINESS (TRUE)
  const businessCategories = [
    "Materials",
    "Tools",
    "Software",
    "Phone",
    "Insurance",
    "Bank fees",
    "Bank Fees",
    "Consulting & Accounting",
    "Motor/travel",
    "Tolls & Parking",
    "Repairs and Maintenance",
    "Workwear",
    "Training",
    "Office",
    "Equipment",
    "Advertising",
    "Marketing",
    "Fuel",
    "Rent",
    "Cleaning",
    "Labour costs",
    "Sub Con",
    "Wages",
    "Director's Salary",
    "Motor Vehicle Expenses",
  ];

  if (businessCategories.some((bc) => category.toLowerCase().includes(bc.toLowerCase()))) {
    return true;
  }

  // Industry-specific business expense detection
  const industry = normalise(userIndustry || userBusinessType || "");
  const isTradeUser = TRADE_INDUSTRIES.some((ti) => industry.includes(ti));

  // For trade users, materials and tools are always business
  if (isTradeUser && (category.toLowerCase().includes("material") || category.toLowerCase().includes("tool"))) {
    /* v8 ignore start -- safety net: "Materials"/"Tools" already matched above by businessCategories */
    return true;
    /* v8 ignore stop */
  }

  // DEFINITELY PERSONAL (FALSE) - Form 11 relief categories are personal expenses (not business)
  // Director's Loan Account debits are balance sheet items, not business expenses
  const personalReliefCategories = ["Medical", "Pension", "Health Insurance", "Charitable", "Tuition", "Director's Loan Account", "Drawings", "Dividends"];
  if (personalReliefCategories.some((pc) => category.toLowerCase().includes(pc.toLowerCase()))) {
    return false; // Personal — Form 11 relief
  }

  // VAT not deductible AND category is "other" with specific patterns
  if (category === "other" && !vatDeductible && !needsReceipt) {
    return false; // Personal
  }

  // Internal transfers are not business expenses (they're not expenses at all)
  if (category === "Internal Transfer") {
    return null; // Neither business nor personal - it's a transfer
  }

  // UNCERTAIN (NULL) - mixed retailers, supermarkets, needs receipt to determine
  if (needsReceipt || category === "other") {
    return null;
  }

  /* v8 ignore start -- default fallback: only reachable for categories not in any known list */
  // Default to business if VAT is deductible
  return vatDeductible ? true : null;
  /* v8 ignore stop */
}

// Categories that suggest a business expense when seen on a personal account
const BUSINESS_INDICATOR_CATEGORIES = [
  "materials",
  "tools",
  "subcontractor",
  "vehicle expenses",
  "fuel",
  "office",
  "telephone",
  "training",
  "advertising",
  "travel",
  "subsistence",
  "repairs",
  "protective clothing",
  "ppe",
  "workwear",
  "software",
  "subscriptions",
  "equipment",
  "motor",
];

function finalizeResult(base: AutoCatResult, tx: TransactionInput): AutoCatResult {
  // Refine with receipt if available
  const withReceipt = refineWithReceipt(base, tx);

  // Confidence band-based review flagging
  let finalNeedsReview = withReceipt.needs_review ?? false;
  const finalConfidence = Math.max(0, Math.min(100, withReceipt.confidence_score));

  if (finalConfidence < 50) {
    finalNeedsReview = true;
  } else if (finalConfidence >= 50 && finalConfidence < 70) {
    finalNeedsReview = true;
  }

  // Detect potential business expenses on personal accounts
  let looksLikeBusiness = false;
  if (tx.account_type === "directors_personal_tax") {
    const catLower = withReceipt.category.toLowerCase();
    looksLikeBusiness = BUSINESS_INDICATOR_CATEGORIES.some((bc) => catLower.includes(bc));
    // Also flag if a trade supplier was matched
    if (withReceipt.is_business_expense === true) {
      looksLikeBusiness = true;
    }
  }

  return {
    ...withReceipt,
    confidence_score: finalConfidence,
    notes: withReceipt.notes.trim(),
    needs_review: finalNeedsReview,
    is_business_expense: withReceipt.is_business_expense,
    looks_like_business_expense: looksLikeBusiness || undefined,
  };
}
