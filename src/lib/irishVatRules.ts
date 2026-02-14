/**
 * Irish VAT Rules Configuration
 * Based on ICTC Indirect Tax Syllabus 2025 and Irish Revenue Guidelines
 * 
 * Reference: VAT Consolidation Act 2010 (Sections 59, 60)
 */

// =================== VAT RATES ===================
export const VAT_RATES = {
  STANDARD_23: {
    key: "standard_23",
    rate: 0.23,
    label: "Standard Rate (23%)",
    description: "All other taxable goods and services not listed under other rates"
  },
  REDUCED_13_5: {
    key: "reduced_13_5",
    rate: 0.135,
    label: "Reduced Rate (13.5%)",
    description: "Construction labour, renovation, repairs, energy, cleaning, tourism, photography, hairdressing"
  },
  SECOND_REDUCED_9: {
    key: "second_reduced_9",
    rate: 0.09,
    label: "Second Reduced Rate (9%)",
    description: "Newspapers, periodicals, e-books, admission to cultural/sports events, gas & electric (until 30/04/2025)"
  },
  LIVESTOCK_4_8: {
    key: "livestock_4_8",
    rate: 0.048,
    label: "Livestock Rate (4.8%)",
    description: "Livestock for food production, certain agricultural supplies"
  },
  ZERO_RATED: {
    key: "zero_rated",
    rate: 0,
    label: "Zero Rated (0%)",
    description: "Exports, intra-EU B2B, children's clothing, most food, books, medicines, feminine hygiene"
  },
  EXEMPT: {
    key: "exempt",
    rate: 0,
    label: "Exempt",
    description: "Financial services, insurance, medical/dental/optical, education, childcare, undertaking"
  }
} as const;

// =================== VAT THRESHOLDS ===================
export const VAT_THRESHOLDS = {
  GOODS: 85000, // €85,000 for goods (where 90%+ turnover is goods)
  SERVICES: 42500, // €42,500 for services
  INTRA_EU_DISTANCE_SALES: 10000, // €10,000 for distance sales
  INTRA_EU_ACQUISITIONS: 41000, // €41,000 for acquisitions
  CASH_RECEIPTS_BASIS: 1000000, // €1,000,000 turnover limit for cash receipts basis
};

// =================== DISALLOWED INPUT CREDITS ===================
// Section 60(2) VAT Consolidation Act 2010
export const DISALLOWED_VAT_CREDITS = {
  // Section 60(2)(a)(i) - Food, drink, accommodation
  FOOD_DRINK_ACCOMMODATION: {
    description: "Food, drink, or accommodation supplied to taxable person, agents or employees",
    exception: "Accommodation for qualifying conferences is allowed",
    vatRecoverable: false,
    keywords: [
      "restaurant", "cafe", "coffee", "pub", "hotel", "accommodation",
      "food", "meal", "lunch", "dinner", "breakfast", "catering", "takeaway",
      "mcdonalds", "burger king", "kfc", "subway", "supermacs", "starbucks",
      "costa", "deliveroo", "just eat", "uber eats", "airbnb", "b&b"
    ],
    // Short keywords that need word-boundary matching to avoid false positives
    // (e.g. "bar" matching "barrier" in "Eflow Barrier Free Tol")
    wordBoundaryKeywords: ["bar"]
  },

  // Section 60(2)(a)(iii) - Entertainment
  ENTERTAINMENT: {
    description: "Entertainment expenses incurred by the taxable person, agents or employees",
    vatRecoverable: false,
    keywords: [
      "entertainment", "cinema", "theatre", "concert", "event tickets",
      "netflix", "disney", "spotify", "amazon prime", "playstation", "xbox",
      "smyths", "toys", "games", "amusement"
    ]
  },

  // Section 60(2)(a)(iv) - Passenger motor vehicles
  PASSENGER_VEHICLES: {
    description: "Purchase, hire or lease of passenger motor vehicles",
    exception: "Allowed for car hire/rental businesses as trade stock",
    vatRecoverable: false,
    keywords: [
      "car purchase", "car lease", "car hire", "car rental",
      "motor finance", "pcp", "hp car"
    ]
  },

  // Section 60(2)(a)(v) - Petrol
  PETROL: {
    description: "Purchase of petrol otherwise than as stock-in-trade",
    note: "DIESEL IS ALLOWED - only petrol is blocked",
    vatRecoverable: false,
    keywords: ["petrol", "unleaded", "gasoline"]
  },

  // Non-business use
  NON_BUSINESS: {
    description: "Goods or services used for non-business purposes",
    vatRecoverable: false,
    keywords: ["personal", "private", "non-business", "domestic"]
  }
};

// =================== ALLOWED VAT CREDITS ===================
export const ALLOWED_VAT_CREDITS = {
  // Trade supplies
  TRADE_MATERIALS: {
    description: "Materials and supplies used exclusively for taxable business",
    vatRate: "standard_23",
    vatRecoverable: true
  },
  
  // Diesel fuel
  DIESEL: {
    description: "Diesel fuel for business vehicles",
    note: "Unlike petrol, diesel VAT IS recoverable",
    vatRate: "standard_23",
    vatRecoverable: true,
    keywords: ["diesel", "derv", "adblue"]
  },

  // Vehicle repairs/maintenance
  VEHICLE_REPAIRS: {
    description: "Repairs and maintenance of commercial vehicles",
    vatRate: "standard_23",
    vatRecoverable: true,
    keywords: ["repair", "service", "maintenance", "tyres", "nct", "cvrt"]
  },

  // Software/subscriptions
  SOFTWARE: {
    description: "Business software and subscriptions",
    vatRate: "standard_23",
    vatRecoverable: true
  },

  // Professional services
  PROFESSIONAL_SERVICES: {
    description: "Accounting, legal, consulting services",
    vatRate: "standard_23",
    vatRecoverable: true
  },

  // Communications
  TELECOMMUNICATIONS: {
    description: "Phone, internet, communications",
    vatRate: "standard_23",
    vatRecoverable: true
  }
};

// =================== EXEMPT SUPPLIES ===================
// No VAT charged, no input credit allowed
export const EXEMPT_SUPPLIES = [
  "Financial services (banking, lending, insurance)",
  "Medical, dental, optical services",
  "Education and training (certain exempt)",
  "Childcare services",
  "Undertaking/funeral services",
  "Certain passenger transport",
  "Letting of immovable goods"
];

// =================== TWO-THIRDS RULE ===================
/**
 * The Two-Thirds Rule for repairs
 * 
 * Repairs of moveable goods = service at 13.5%
 * However, if parts cost > 2/3 of total charge (excl VAT):
 * - If parts < 2/3: Apply 13.5% to entire supply (service)
 * - If parts ≥ 2/3: Apply 23% to entire supply (goods)
 * 
 * Note: "Cost of parts" = VAT-exclusive cost TO THE SUPPLIER
 */
export function applyTwoThirdsRule(partsVatExclusiveCost: number, totalChargeVatExclusive: number): {
  applicableRate: string;
  isServiceSupply: boolean;
  explanation: string;
} {
  const partsRatio = partsVatExclusiveCost / totalChargeVatExclusive;
  
  if (partsRatio < 2/3) {
    return {
      applicableRate: "reduced_13_5",
      isServiceSupply: true,
      explanation: `Parts cost (€${partsVatExclusiveCost.toFixed(2)}) is ${(partsRatio * 100).toFixed(1)}% of total - less than 2/3, so 13.5% service rate applies`
    };
  } else {
    return {
      applicableRate: "standard_23",
      isServiceSupply: false,
      explanation: `Parts cost (€${partsVatExclusiveCost.toFixed(2)}) is ${(partsRatio * 100).toFixed(1)}% of total - 2/3 or more, so 23% goods rate applies`
    };
  }
}

// =================== RCT (Relevant Contracts Tax) RULES ===================
export const RCT_RULES = {
  description: "Subcontractors providing construction services to principal contractors",
  reverseChargeVAT: true,
  note: "Subcontractors do NOT charge VAT on construction services to principals. Principal accounts for VAT as if they supplied the service.",
  rates: {
    COMPLIANT: 0, // 0% - fully tax compliant subcontractor
    STANDARD: 20, // 20% - standard rate
    NON_COMPLIANT: 35 // 35% - non-compliant subcontractor
  },
  applicableIndustries: [
    "construction",
    "carpentry_joinery",
    "electrical",
    "plumbing_heating",
    "painting_decorating",
    "landscaping_groundworks"
  ]
};

// =================== VAT FILING RULES ===================
export const VAT_FILING = {
  PERIODS: "Bi-monthly (Jan-Feb, Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec)",
  PAYMENT_DUE: "19th of month following VAT period",
  PAYMENT_DUE_ROS: "23rd of month following VAT period (if filing via ROS)",
  LATE_INTEREST_RATE: 0.0219, // 0.0219% per day (approx 8% per annum)
  RECORD_RETENTION: "6 years"
};

// =================== INDUSTRY-SPECIFIC VAT GUIDANCE ===================
export const INDUSTRY_VAT_RULES: Record<string, {
  defaultOutputRate: string;
  commonInputRates: string[];
  specialRules: string[];
}> = {
  construction: {
    defaultOutputRate: "reduced_13_5",
    commonInputRates: ["standard_23", "reduced_13_5"],
    specialRules: [
      "Construction services to private dwellings at 13.5%",
      "Materials at 23%",
      "RCT reverse charge for subcontractor payments",
      "Two-thirds rule applies to repair work"
    ]
  },
  carpentry_joinery: {
    defaultOutputRate: "reduced_13_5",
    commonInputRates: ["standard_23", "reduced_13_5"],
    specialRules: [
      "Labour/installation at 13.5%",
      "Materials (timber, hardware) at 23%",
      "RCT applies if working as subcontractor"
    ]
  },
  electrical: {
    defaultOutputRate: "reduced_13_5",
    commonInputRates: ["standard_23", "reduced_13_5"],
    specialRules: [
      "Electrical services at 13.5%",
      "Electrical supplies/materials at 23%",
      "RCT applies to subcontract work"
    ]
  },
  plumbing_heating: {
    defaultOutputRate: "reduced_13_5",
    commonInputRates: ["standard_23", "reduced_13_5"],
    specialRules: [
      "Plumbing/heating services at 13.5%",
      "Heat pump supply and installation at 9% (temporary until 30/04/2025)",
      "Plumbing supplies at 23%"
    ]
  },
  hospitality: {
    defaultOutputRate: "second_reduced_9",
    commonInputRates: ["standard_23", "second_reduced_9", "zero_rated"],
    specialRules: [
      "Restaurant/catering at 9%",
      "Hotel accommodation at 9%",
      "Alcoholic beverages at 23%",
      "Food purchases may be zero-rated"
    ]
  },
  retail_ecommerce: {
    defaultOutputRate: "standard_23",
    commonInputRates: ["standard_23", "zero_rated"],
    specialRules: [
      "Most retail goods at 23%",
      "Children's clothing/shoes at 0%",
      "Books at 0%",
      "Most food at 0%"
    ]
  },
  professional_services: {
    defaultOutputRate: "standard_23",
    commonInputRates: ["standard_23", "exempt"],
    specialRules: [
      "Professional services at 23%",
      "Some financial services exempt"
    ]
  }
};

// =================== CATEGORIZATION HELPER ===================
export function determineVatTreatment(
  description: string,
  amount: number,
  industry: string,
  transactionType: "income" | "expense"
): {
  suggestedRate: string;
  isVatRecoverable: boolean;
  needsReceipt: boolean;
  explanation: string;
  warnings: string[];
} {
  const descLower = description.toLowerCase();
  const warnings: string[] = [];

  // Check for disallowed input credits first (for expenses)
  if (transactionType === "expense") {
    // Check food/drink/accommodation
    const foodWordBoundary = DISALLOWED_VAT_CREDITS.FOOD_DRINK_ACCOMMODATION.wordBoundaryKeywords || [];
    const foodWordMatch = foodWordBoundary.some((k: string) => new RegExp(`\\b${k}\\b`).test(descLower));
    if (foodWordMatch || DISALLOWED_VAT_CREDITS.FOOD_DRINK_ACCOMMODATION.keywords.some(k => descLower.includes(k))) {
      return {
        suggestedRate: "standard_23",
        isVatRecoverable: false,
        needsReceipt: false,
        explanation: "Food, drink or accommodation - VAT NOT recoverable under Section 60(2)(a)(i)",
        warnings: ["VAT on food/drink/accommodation is never deductible"]
      };
    }

    // Check entertainment
    if (DISALLOWED_VAT_CREDITS.ENTERTAINMENT.keywords.some(k => descLower.includes(k))) {
      return {
        suggestedRate: "standard_23",
        isVatRecoverable: false,
        needsReceipt: false,
        explanation: "Entertainment expense - VAT NOT recoverable under Section 60(2)(a)(iii)",
        warnings: ["VAT on entertainment is never deductible"]
      };
    }

    // Check petrol (but not diesel)
    if (DISALLOWED_VAT_CREDITS.PETROL.keywords.some(k => descLower.includes(k)) && 
        !ALLOWED_VAT_CREDITS.DIESEL.keywords!.some(k => descLower.includes(k))) {
      return {
        suggestedRate: "standard_23",
        isVatRecoverable: false,
        needsReceipt: true,
        explanation: "Petrol purchase - VAT NOT recoverable under Section 60(2)(a)(v). Note: Diesel IS deductible.",
        warnings: ["Only petrol VAT is blocked - diesel VAT is recoverable"]
      };
    }

    // Check diesel - this IS recoverable
    if (ALLOWED_VAT_CREDITS.DIESEL.keywords!.some(k => descLower.includes(k))) {
      return {
        suggestedRate: "standard_23",
        isVatRecoverable: true,
        needsReceipt: true,
        explanation: "Diesel fuel - VAT IS recoverable (unlike petrol)",
        warnings: []
      };
    }

    // Check for mixed fuel retailers - need receipt to determine diesel vs petrol
    const fuelStations = ["maxol", "circle k", "applegreen", "texaco", "esso", "shell", "topaz"];
    if (fuelStations.some(f => descLower.includes(f))) {
      return {
        suggestedRate: "standard_23",
        isVatRecoverable: false,
        needsReceipt: true,
        explanation: "Fuel station - need receipt to determine if diesel (VAT recoverable) or petrol/food (not recoverable)",
        warnings: ["Mixed retailer - cannot claim VAT without receipt proving diesel purchase"]
      };
    }
  }

  // Get industry-specific rules
  const industryRules = INDUSTRY_VAT_RULES[industry];
  
  if (transactionType === "income") {
    return {
      suggestedRate: industryRules?.defaultOutputRate || "standard_23",
      isVatRecoverable: false, // Not applicable for income
      needsReceipt: false,
      explanation: `Output VAT at ${industryRules?.defaultOutputRate || "standard 23%"} rate for ${industry}`,
      warnings: []
    };
  }

  // Default for unknown expenses
  return {
    suggestedRate: "standard_23",
    isVatRecoverable: true,
    needsReceipt: true,
    explanation: "Standard rate assumed - verify with receipt",
    warnings: ["Verify business purpose and correct VAT rate with receipt"]
  };
}

// =================== BAD DEBT RELIEF ===================
export const BAD_DEBT_RELIEF = {
  description: "VAT input credit allowed when debt is written off as irrecoverable",
  requirement: "Debt must be actually written off in the books",
  timing: "Credit taken in VAT period when debt is written off"
};

// =================== GIFTS & PROMOTIONAL ITEMS ===================
export const GIFTS_RULES = {
  threshold: 20, // €20
  underThreshold: "No VAT liability on gifts costing €20 or less (excl VAT)",
  overThreshold: "VAT due on cost of gift as output tax if over €20",
  advertisingGoods: "Tax-free if branded for business use (beer mats, display stands, etc.)"
};

export default {
  VAT_RATES,
  VAT_THRESHOLDS,
  DISALLOWED_VAT_CREDITS,
  ALLOWED_VAT_CREDITS,
  EXEMPT_SUPPLIES,
  RCT_RULES,
  VAT_FILING,
  INDUSTRY_VAT_RULES,
  applyTwoThirdsRule,
  determineVatTreatment,
  BAD_DEBT_RELIEF,
  GIFTS_RULES
};
