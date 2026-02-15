import { 
  VAT_RATES, 
  DISALLOWED_VAT_CREDITS, 
  ALLOWED_VAT_CREDITS, 
  RCT_RULES,
  INDUSTRY_VAT_RULES,
  determineVatTreatment,
  applyTwoThirdsRule 
} from './irishVatRules';

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
  "Motor/travel": ["Van Costs", "Vehicle Expenses", "Vehicle Maintenance & Repairs", "Travel & Accommodation", "Fuel", "Tolls & Parking"],
  "Tools": ["Power Tools", "Tools & Equipment", "Hardware & Equipment"],
  "Purchases": ["Materials & Supplies", "Cost of Goods Sold", "Raw Materials"],
  "Materials": ["Timber & Sheet Materials", "Fixings & Consumables", "Materials & Supplies", "Raw Materials"],
  "Cost of Goods Sold": ["Cost of Goods Sold", "Materials & Supplies", "Raw Materials"],
  "Software": ["Subscriptions & Software", "Software & Licenses", "Office Expenses"],
  "Cloud Hosting": ["Cloud Hosting & Infrastructure", "Subscriptions & Software", "Software & Licenses", "API & Third-Party Services"],
  "Payment Processing": ["Payment Processing Fees", "Bank Charges"],
  "Phone": ["Telephone & Internet", "Subscriptions & Software"],
  "Insurance": ["Insurance", "Vehicle Insurance"],
  "Bank fees": ["Bank Charges"],
  "Bank Fees": ["Bank Charges"],
  "Medical": ["Medical Expenses"],
  "Drawings": ["Director's Drawings"],
  "Meals & Entertainment": ["Meals & Entertainment"],
  "Consulting & Accounting": ["Professional Fees"],
  "Wages": ["Subcontractor Payments", "Staff Wages", "Contractor Payments", "Driver Wages"],
  "Labour costs": ["Subcontractor Payments", "Staff Wages", "Contractor Payments"],
  "Sub Con": ["Subcontractor Payments", "Contractor Payments"],
  "Repairs and Maintenance": ["Repairs & Maintenance", "Vehicle Maintenance & Repairs"],
  "Cleaning": ["Cleaning & Hygiene"],
  "General Expenses": [],
  "Advertising": ["Advertising & Marketing"],
  "Marketing": ["Advertising & Marketing"],
  "Subsistence": ["Subsistence", "Travel & Accommodation", "Meals & Entertainment"],
  "Workwear": ["Protective Clothing & PPE"],
  "Tolls & Parking": ["Tolls & Parking", "Vehicle Expenses", "Travel & Accommodation"],
  "Training": ["Training & Certifications", "Training & Conferences", "Training & CPD"],
  "Rent": ["Rent & Rates", "Rent & Co-working"],
  "Equipment": ["Tools & Equipment", "Hardware & Equipment", "Equipment & Furniture", "Machinery & Equipment", "Kitchen Equipment", "Shop Fittings & Equipment", "Audio/Visual Equipment"],
  "Office": ["Office Expenses", "Subscriptions & Software"],
  "other": [],
  // Waste
  "Waste": [],
  // Internal transfers — no matching category, will fall through
  "Internal Transfer": ["Internal Transfers"],
  // Travel & Subsistence
  "Travel & Subsistence": ["Travel & Accommodation", "Vehicle Expenses"],
  // ── Income categories ──
  "Sales": [
    "Contract Work", "Labour Income", "Other Income", "Consultation Fees", "Materials Charged",
    "SaaS Subscription Revenue", "Consulting & Services", "Product Sales", "Food Sales",
    "Delivery Services", "Haulage Income", "Rental Income", "Services",
    "Project Fees", "Retainer Income", "Online Sales", "Wholesale Revenue",
    "Contract Manufacturing", "Catering Income", "Beverage Sales",
    "Management Fees", "Plant Hire Income", "Membership & Subscriptions",
    "Implementation & Onboarding Fees",
    "Software Sales & Licensing", "Development Services", "Maintenance & Support",
    "Event Tickets & Admissions", "Sponsorship Income", "Venue Hire Income", "Catering & Bar Revenue",
  ],
  "RCT": ["Contract Work", "Labour Income"],
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
  accountType?: string
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
    (c) => c.name.toLowerCase() === normalizedAutocat &&
    (!transactionType || c.type === transactionType)
  );
  if (exactMatch) return exactMatch;

  // Then try via mapping in filtered set
  const possibleNames = CATEGORY_NAME_MAP[autocatCategory] || [];
  for (const possibleName of possibleNames) {
    const mapped = filteredCategories.find(
      (c) => c.name.toLowerCase() === possibleName.toLowerCase() &&
      (!transactionType || c.type === transactionType)
    );
    if (mapped) return mapped;
  }

  // Fallback: try all categories if filtered set had no match
  if (accountType) {
    const fallbackExact = dbCategories.find(
      (c) => c.name.toLowerCase() === normalizedAutocat &&
      (!transactionType || c.type === transactionType)
    );
    if (fallbackExact) return fallbackExact;

    for (const possibleName of possibleNames) {
      const mapped = dbCategories.find(
        (c) => c.name.toLowerCase() === possibleName.toLowerCase() &&
        (!transactionType || c.type === transactionType)
      );
      if (mapped) return mapped;
    }
  }

  // No partial/fuzzy match — too error-prone (e.g. "General Expenses" matching
  // "Medical Expenses" on the word "expenses"). If there's no exact or mapped
  // match, return null so the transaction stays uncategorized.
  return null;
}

// =================== MERCHANT RULES ===================
// Based on real Irish VAT categorization rules from user's P&L analysis
// Following Section 59/60 of VAT Consolidation Act 2010

interface MerchantRule {
  patterns: string[];
  category: string;
  vat_type: string;
  vat_deductible: boolean;
  purpose: string;
  needs_receipt?: boolean; // True if receipt required to claim VAT
  isTradeSupplier?: boolean; // True for merchants that are ALWAYS business for trade industries
  isTechSupplier?: boolean; // True for merchants that are ALWAYS business for tech/SaaS industries
  relief_type?: "medical" | "pension" | "health_insurance" | "rent" | "charitable" | "tuition" | null;
  amountLogic?: (amount: number) => { category?: string; confidence?: number; purpose?: string; vat_deductible?: boolean } | null;
}

// Trade industries that should get boosted confidence for trade suppliers
const TRADE_INDUSTRIES = [
  "construction", "carpentry_joinery", "carpentry", "joinery", "electrical",
  "plumbing_heating", "plumbing", "heating", "landscaping_groundworks",
  "painting_decorating", "manufacturing", "maintenance_facilities", "trades"
];

// Tech/SaaS industries that should get boosted confidence for tech suppliers
const TECH_INDUSTRIES = [
  "technology_it", "technology", "software", "saas", "professional_services"
];

const merchantRules: MerchantRule[] = [
  // === REVENUE COMMISSIONERS === (Tax refunds - NOT taxable income)
  {
    patterns: ["revenue", "revenue commissioners", "rev comm", "revenue comm", "collector general", "collector-general", "rev.ie", "ros refund", "revenue refund", "tax refund", "vat refund", "paye refund", "ct refund", "rct refund"],
    category: "Tax Refund",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Tax refund from Revenue Commissioners. Not taxable income — this is a return of previously overpaid tax.",
  },

  // === INTERNAL TRANSFERS === (Not income/expense - internal movement of funds)
  {
    patterns: ["*mobi online saver", "*mobi current", "mobi online saver", "mobi current", "mobi saver", "online saver", "current account", "from current", "to current", "savings transfer", "internal transfer"],
    category: "Internal Transfer",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Internal transfer between accounts. Not actual income or expense - funds movement only.",
  },

  // === SOFTWARE SUBSCRIPTIONS === (VAT Deductible @ 23%)
  {
    patterns: ["openai", "chatgpt", "gpt", "ai subscr"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Software subscription for business operations. VAT deductible under Section 59.",
  },
  {
    patterns: ["surveymonkey", "survey monkey"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Survey software subscription. VAT deductible under Section 59.",
  },
  {
    patterns: ["xero", "sage", "quickbooks"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Accounting software subscription. VAT deductible under Section 59.",
  },
  {
    patterns: ["qr.io", "qr generator"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Digital service subscription. VAT deductible under Section 59.",
  },
  {
    patterns: ["apple.com/bill", "apple.com", "itunes"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Software/app subscription. VAT deductible under Section 59.",
  },
  {
    patterns: ["spotify", "adobe", "microsoft", "shopify", "google storage", "dropbox", "canva", "zoom", "slack"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Software subscription. VAT deductible under Section 59.",
  },

  // === INTERNET/HOSTING SERVICES === (VAT Deductible @ 23%)
  {
    patterns: ["blacknight", "hosting", "domain"],
    category: "Marketing",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Web hosting/internet services for business. VAT deductible under Section 59.",
  },

  // === FUEL STATIONS === (Multi-vendor — sells fuel, food, car washes, etc.)
  // Cannot determine what was purchased without receipt — leave uncategorized
  {
    patterns: ["maxol", "m3 mulhuddart maxol", "m3 maxol"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Fuel station — multi-vendor store. Need receipt to determine purchase (diesel/petrol/food/other).",
  },
  {
    patterns: ["circle k", "circlek"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Fuel station — multi-vendor store. Need receipt to determine purchase.",
  },
  {
    patterns: ["applegreen"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Fuel station — multi-vendor store. Need receipt to determine purchase.",
  },
  {
    patterns: ["texaco"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Fuel station — multi-vendor store. Need receipt to determine purchase.",
  },

  // === CONVENIENCE STORES === (Drawings/personal unless proven otherwise)
  {
    patterns: ["spar", "spar hollystown"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Convenience store — likely personal. Treated as drawings unless receipt proves business supplies.",
  },
  {
    patterns: ["centra", "daybreak"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Convenience store — likely personal food/drink. Treated as drawings.",
  },
  {
    patterns: ["mr price"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Discount retailer — likely personal. Treated as drawings unless receipt proves business use.",
  },

  // === FOOD/DRINK/ENTERTAINMENT === (Meals & Entertainment — VAT NEVER Deductible)
  // Section 60(2)(a)(i) and (iii)
  {
    patterns: ["mcdonalds", "mcdonald", "burger king", "kfc", "subway", "supermacs"],
    category: "Meals & Entertainment",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Food/drink expense. VAT NOT deductible under Section 60(2)(a)(i).",
  },
  {
    patterns: ["kennedys", "murrays bar", "madigans", "the pub", "bar & grill", "bar restaurant", "public house"],
    category: "Meals & Entertainment",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Food/drink/entertainment. VAT NOT deductible under Section 60(2)(a)(i) and (iii).",
  },
  {
    patterns: ["butlers chocolate", "cafe", "coffee", "starbucks", "costa"],
    category: "Meals & Entertainment",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Food/drink expense. VAT NOT deductible under Section 60(2)(a)(i).",
  },
  {
    patterns: ["just eat", "deliveroo", "uber eats"],
    category: "Meals & Entertainment",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Food delivery. VAT NOT deductible under Section 60(2)(a)(i).",
  },
  {
    patterns: ["hotel", "accommodation", "b&b", "airbnb"],
    category: "Subsistence",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Accommodation for staff. VAT NOT deductible under Section 60(2)(a)(i).",
  },

  // === PERSONAL/ENTERTAINMENT === (Drawings — Not Deductible)
  {
    patterns: ["smyths", "smyth toy"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Toy retailer. Personal expense — treated as drawings.",
  },
  {
    patterns: ["playstation", "xbox", "netflix", "amazon prime", "disney"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Entertainment subscription. Personal expense — treated as drawings.",
  },
  {
    patterns: ["lidl", "tesco", "aldi", "dunnes", "supervalu"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Supermarket. Likely personal/food — treated as drawings unless receipt proves business supplies.",
  },
  {
    patterns: ["penneys", "primark", "tk maxx", "zara", "h&m"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Clothing retailer. Personal expense — treated as drawings unless proven workwear.",
  },
  {
    patterns: ["vapevend", "vapeend", "vape"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Personal expense — treated as drawings.",
  },
  {
    patterns: ["planet leisure", "nya*planet"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Entertainment/leisure. Personal expense — treated as drawings.",
  },
  {
    patterns: ["uisce beatha"],
    category: "Meals & Entertainment",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Pub/bar. Food and drink expense. VAT NOT deductible (Section 60(2)(a)(i)).",
  },

  // === TAXI/TRANSPORT === (VAT Deductible @ 13.5%)
  {
    patterns: ["freenow", "free now", "bolt", "uber", "mytaxi"],
    category: "Motor/travel",
    vat_type: "Reduced 13.5%",
    vat_deductible: true,
    needs_receipt: true,
    purpose: "Taxi/transport service. VAT deductible at 13.5% if for business travel (need receipt).",
  },

  // === ACCOMMODATION === (VAT NOT Deductible)
  {
    patterns: ["booking.com", "hotel at booking", "dooleys hotel", "dooleys"],
    category: "Subsistence",
    vat_type: "Reduced 13.5%",
    vat_deductible: false,
    purpose: "Hotel/accommodation. VAT NOT deductible under Section 60(2)(a)(i) unless qualifying conference.",
  },

  // === PORT/FERRY === (Business travel)
  {
    patterns: ["port of waterford", "irish ferries", "stena line"],
    category: "Motor/travel",
    vat_type: "Zero",
    vat_deductible: true,
    purpose: "Port/ferry charges for business travel. Zero-rated transport.",
  },

  // === MISC SHOPS/LOCATIONS ===
  {
    patterns: ["waterfrd", "waterford"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Retail purchase — treated as drawings unless receipt proves business use.",
  },

  // === RETAIL (Could be business supplies) ===
  {
    patterns: ["the range"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Retail store — treated as drawings unless receipt proves business supplies.",
  },

  // === BANK FEES === (Exempt - No VAT)
  {
    patterns: ["revolut business fee", "revolut fee", "basic plan fee"],
    category: "Bank fees",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Financial services are VAT exempt. No VAT to claim.",
  },
  {
    patterns: ["stamp duty", "fee-qtr", "service charge", "account fee", "monthly fee", "bank charge"],
    category: "Bank fees",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Bank fees/charges. Financial services are VAT exempt.",
  },

  // === TOLLS === (Zero-rated - No VAT to claim but expense is deductible)
  {
    patterns: ["eflow", "e-flow", "e flow", "e-toll", "etoll", "barrier free tol", "toll", "m50", "barrier free"],
    category: "Motor/travel",
    vat_type: "Zero",
    vat_deductible: true,
    purpose: "Toll charges for business travel. Zero-rated/exempt - no VAT to claim but expense is deductible.",
  },

  // === PARKING === (VAT Deductible @ 23%)
  {
    patterns: ["parkingpay", "parking", "car park", "ncp"],
    category: "Motor/travel",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Parking for business travel. VAT deductible under Section 59.",
  },

  // === TRADE SUPPLIES === (VAT Deductible @ 23%)
  // These merchants are ALWAYS business for trade industries
  {
    patterns: ["screwfix", "screwfix ireland"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Trade supplies/tools for business. VAT deductible under Section 59.",
    isTradeSupplier: true, // Flag for industry-aware boost
  },
  {
    patterns: ["chadwicks", "chadwick"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Building materials supplier. VAT deductible under Section 59.",
    isTradeSupplier: true,
  },
  {
    patterns: ["woodies", "woodie"],
    category: "Tools",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "DIY/hardware supplies. VAT deductible under Section 59.",
    isTradeSupplier: true,
  },
  {
    patterns: ["mcquillan", "jj mcquillan", "powertoolhub", "howdens", "noyeks", "ptrs"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Trade supplies/materials. VAT deductible under Section 59.",
    isTradeSupplier: true,
  },
  {
    patterns: ["pat mcdonnell paint", "strahan", "hardwood", "timber"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Construction materials. VAT deductible under Section 59.",
    isTradeSupplier: true,
  },
  // Additional carpentry/joinery specific suppliers
  {
    patterns: ["brooks", "brooks timber", "murdock builders", "heiton buckley", "toolstation"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Trade supplies/materials. VAT deductible under Section 59.",
    isTradeSupplier: true,
  },
  {
    patterns: ["harvey norman"],
    category: "Equipment",
    vat_type: "Standard 23%",
    vat_deductible: true,
    needs_receipt: true,
    purpose: "Electronics/equipment. VAT deductible if for business use (need receipt).",
  },

  // === VEHICLE PARTS/REPAIRS === (VAT Deductible @ 23%)
  {
    patterns: ["partsforcars", "parts for cars"],
    category: "Motor/travel",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Vehicle parts for business vehicle. VAT deductible under Section 59.",
  },
  {
    patterns: ["first stop", "fastfit", "kwik fit", "ats euromaster", "halfords"],
    category: "Repairs and Maintenance",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Vehicle maintenance/parts. VAT deductible under Section 59.",
  },
  {
    patterns: ["nct", "road safety", "cvrt"],
    category: "Motor/travel",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Vehicle testing. VAT deductible under Section 59.",
  },

  // === OFFICE/PRINTING === (VAT Deductible @ 23%)
  {
    patterns: ["nya*print", "print copy", "printing"],
    category: "Office",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Printing/office services. VAT deductible under Section 59.",
  },

  // === PHONE/COMMUNICATIONS === (VAT Deductible @ 23%)
  {
    patterns: ["three ireland", "vodafone", "eir", "48", "gomo", "tesco mobile"],
    category: "Phone",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Phone/communications for business. VAT deductible under Section 59.",
  },

  // === BUSINESS INSURANCE === (Exempt)
  {
    patterns: ["axa", "allianz", "fbd", "liberty insurance"],
    category: "Insurance",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Business insurance premium. VAT exempt - no VAT to claim.",
  },

  // === HEALTH INSURANCE === (Exempt — Form 11 relief: health_insurance)
  {
    patterns: ["vhi", "laya healthcare", "laya health", "irish life health", "glo health"],
    category: "Medical",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "health_insurance",
    purpose: "Health insurance premium. Tax relief at source (TRS). Section 470 TCA 1997.",
  },

  // === PHARMACY / CHEMIST === (Form 11 relief: medical @ 20% Section 469)
  {
    patterns: ["pharmacy", "chemist", "boots", "lloyds pharmacy", "mccabes", "hickeys", "sam mccauley", "cara pharmacy", "totalhealth", "allcare"],
    category: "Medical",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "medical",
    purpose: "Pharmacy/prescription expense. Eligible for 20% tax relief under Section 469 TCA 1997.",
  },

  // === MEDICAL (non-routine) === (Form 11 relief: medical @ 20% Section 469)
  {
    patterns: ["physio", "physiotherapy", "dental surgery", "orthodont", "oral surgery", "hospital", "consultant", "surgeon", "dermatolog", "fertility", "ivf", "mater private", "blackrock clinic", "beacon hospital", "st vincent", "galway clinic", "bon secours"],
    category: "Medical",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "medical",
    purpose: "Non-routine medical expense. Eligible for 20% tax relief under Section 469 TCA 1997.",
  },

  // === PENSION FUNDS === (Form 11 relief: pension)
  {
    patterns: ["irish life pension", "zurich pension", "aviva pension", "new ireland", "standard life"],
    category: "Insurance",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "pension",
    purpose: "Pension contribution. Tax relief at marginal rate. Section 774 TCA 1997.",
  },

  // === CHARITABLE DONATIONS === (Form 11 relief: charitable)
  {
    patterns: ["trocaire", "concern worldwide", "goal", "svp", "st vincent de paul", "unicef ireland", "irish cancer society", "pieta house", "barnardos"],
    category: "other",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "charitable",
    purpose: "Charitable donation. Tax relief under Section 848A TCA 1997 (min €250).",
  },

  // === ACCOUNTING === (VAT Deductible @ 23%)
  {
    patterns: ["accountant", "accounting", "tax return", "vat return"],
    category: "Consulting & Accounting",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Accounting/tax services. VAT deductible under Section 59.",
  },

  // === WORKWEAR === (VAT Deductible @ 23%)
  {
    patterns: ["workwear", "work clothes", "hi-vis", "safety boots", "ppe"],
    category: "Workwear",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Workwear/PPE for business. VAT deductible under Section 59.",
  },

  // === ADVERTISING === (VAT Deductible @ 23%)
  {
    patterns: ["facebook ads", "google ads", "instagram", "linkedin", "vistaprint", "advertising"],
    category: "Advertising",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Advertising expense. VAT deductible under Section 59.",
  },

  // === BROADBAND/INTERNET PROVIDERS === (VAT Deductible @ 23% — business portion)
  {
    patterns: ["virgin media", "sky ireland", "pure telecom", "digiweb", "imagine broadband"],
    category: "Phone",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Broadband/internet service. Business portion VAT deductible under Section 59.",
  },

  // === PROFESSIONAL BODY MEMBERSHIPS === (Allowable expense)
  {
    patterns: ["cif", "engineers ireland", "law society", "cpa ireland", "acca", "chartered accountants", "riai", "reci", "cro annual return"],
    category: "Consulting & Accounting",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Professional body membership/registration. Allowable business expense.",
  },

  // === TRAINING & CERTIFICATION === (VAT Deductible @ 23%)
  {
    patterns: ["safe pass", "solas", "cscs card", "qqi", "city & guilds", "fetac", "manual handling", "first aid course", "iosh", "citb"],
    category: "Training",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTradeSupplier: true,
    purpose: "Training/certification for business. VAT deductible under Section 59.",
  },
  {
    patterns: ["ehs international", "ehs intl"],
    category: "Training",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTradeSupplier: true,
    purpose: "Safe Pass / health & safety training and certification. VAT deductible under Section 59.",
  },

  // === MOTOR TAX & VEHICLE ADMIN === (Exempt — business vehicle expense)
  {
    patterns: ["motor tax", "dublin city", "motor tax online", "motortax"],
    category: "Motor Vehicle Expenses",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Motor tax for business vehicle. Exempt from VAT. Allowable business expense.",
  },

  // === SCRAP / VEHICLE PARTS === (VAT Deductible @ 23%)
  {
    patterns: ["car dismantlers", "kilcock car", "scrap yard", "breakers yard", "auto parts", "car parts"],
    category: "Motor/travel",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Vehicle parts/scrap for business vehicle. VAT deductible under Section 59.",
  },

  // === FLOORING / MATERIALS SUPPLIERS === (VAT Deductible @ 23%)
  {
    patterns: ["havwoods", "havwood"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTradeSupplier: true,
    purpose: "Flooring materials supplier. VAT deductible under Section 59.",
  },
  {
    patterns: ["tj o'mahony", "tj omahony", "tj o mahony", "o'mahony", "omahony", "tj o'mahoney", "tj omahoney", "tj o mahoney", "o'mahoney", "omahoney builders"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTradeSupplier: true,
    purpose: "Building materials supplier. VAT deductible under Section 59.",
  },

  // === CONFERENCES === (VAT Deductible @ 23%)
  {
    patterns: ["startupnetwork", "startup network", "conference", "summit", "expo", "convention"],
    category: "Training",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Business conference/networking event. VAT deductible under Section 59.",
  },

  // === BRANDING / LOGO === (VAT Deductible @ 23%)
  {
    patterns: ["looka", "logo maker", "logo design", "brand design", "fiverr", "99designs"],
    category: "Marketing",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Company branding/logo design. VAT deductible under Section 59.",
  },

  // === WASTE DISPOSAL === (VAT Deductible @ 23%)
  {
    patterns: ["barna recycling", "greenstar", "panda waste", "panda", "thorntons recycling", "country clean", "oxigen", "skip hire", "greyhound recycling"],
    category: "Waste",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTradeSupplier: true,
    purpose: "Waste disposal/skip hire. VAT deductible under Section 59.",
  },

  // === TECH / SAAS SUPPLIERS === (VAT via reverse charge — self-account at 23%)
  // These merchants are ALWAYS business for tech/SaaS industries
  {
    patterns: ["aws", "amazon web services", "amazonaws"],
    category: "Cloud Hosting",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Cloud infrastructure (AWS). Reverse charge self-account at 23%. VAT reclaimable.",
  },
  {
    patterns: ["microsoft azure", "azure", "microsoft 365", "microsoft office", "msft"],
    category: "Cloud Hosting",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Cloud infrastructure / SaaS (Microsoft). Reverse charge self-account at 23%. VAT reclaimable.",
  },
  {
    patterns: ["google cloud", "gcp", "google workspace", "google domains"],
    category: "Cloud Hosting",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Cloud infrastructure / SaaS (Google). Reverse charge self-account at 23%. VAT reclaimable.",
  },
  {
    patterns: ["github", "gitlab", "bitbucket"],
    category: "Subscriptions & Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Code repository / DevOps platform. Reverse charge. VAT reclaimable.",
  },
  {
    patterns: ["atlassian", "jira", "confluence", "trello"],
    category: "Subscriptions & Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Project management / collaboration tools. Reverse charge. VAT reclaimable.",
  },
  {
    patterns: ["vercel", "netlify", "heroku", "digitalocean", "digital ocean", "linode", "cloudflare", "render"],
    category: "Cloud Hosting",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Cloud hosting / deployment platform. Reverse charge. VAT reclaimable.",
  },
  {
    patterns: ["stripe", "stripe payments", "stripe ireland"],
    category: "Payment Processing",
    vat_type: "Exempt",
    vat_deductible: false,
    isTechSupplier: true,
    purpose: "Payment processing fees. Financial services — VAT exempt, not reclaimable.",
  },
  {
    patterns: ["hubspot", "salesforce", "pipedrive", "close.com", "apollo.io", "apollo"],
    category: "Subscriptions & Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "CRM / GTM sales platform. Reverse charge. VAT reclaimable.",
  },
  {
    patterns: ["intercom", "drift", "zendesk", "freshdesk", "crisp"],
    category: "Subscriptions & Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Customer support / messaging platform. Reverse charge. VAT reclaimable.",
  },
  {
    patterns: ["slack", "notion", "asana", "monday.com", "clickup", "linear"],
    category: "Subscriptions & Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Team collaboration / productivity tool. Reverse charge. VAT reclaimable.",
  },
  {
    patterns: ["figma", "canva", "adobe", "creative cloud", "sketch", "miro"],
    category: "Subscriptions & Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Design / creative tool. Reverse charge. VAT reclaimable.",
  },
  {
    patterns: ["mailchimp", "sendgrid", "postmark", "customer.io", "brevo", "sendinblue"],
    category: "Advertising",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Email marketing / transactional email platform. Reverse charge. VAT reclaimable.",
  },
  {
    patterns: ["openai", "anthropic", "cohere"],
    category: "Subscriptions & Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "AI / LLM API provider. Reverse charge. VAT reclaimable. May qualify for R&D credit (Section 766).",
  },
  {
    patterns: ["datadog", "sentry", "new relic", "logflare", "logrocket"],
    category: "Subscriptions & Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Monitoring / observability platform. Reverse charge. VAT reclaimable.",
  },
  {
    patterns: ["supabase", "firebase", "planetscale", "neon", "mongodb atlas", "redis cloud"],
    category: "Cloud Hosting",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Database / backend-as-a-service. Reverse charge. VAT reclaimable.",
  },
  {
    patterns: ["twilio", "vonage", "messagebird"],
    category: "Subscriptions & Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Communications API (SMS/voice). Reverse charge. VAT reclaimable.",
  },
  {
    patterns: ["zoom", "loom", "calendly", "cal.com"],
    category: "Subscriptions & Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Video conferencing / scheduling tool. Reverse charge. VAT reclaimable.",
  },
  {
    patterns: ["semrush", "ahrefs", "hotjar", "mixpanel", "amplitude", "posthog", "segment"],
    category: "Advertising",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "SEO / analytics / product analytics platform. Reverse charge. VAT reclaimable.",
  },
  {
    patterns: ["namecheap", "godaddy", "porkbun", "hover"],
    category: "Subscriptions & Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "Domain registration / DNS. Reverse charge. VAT reclaimable.",
  },
  {
    patterns: ["apple developer", "google play developer", "app store"],
    category: "Subscriptions & Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTechSupplier: true,
    purpose: "App store developer account / fees. Reverse charge. VAT reclaimable.",
  },

  // === TUITION FEES === (Form 11 relief: tuition — 20% on amounts over EUR 3,000)
  {
    patterns: ["ucd", "tcd", "trinity college", "dcu", "nuig", "university of galway", "ucc", "maynooth university", "tu dublin", "technological university", "griffith college", "ncad", "rcsi", "dit", "athlone it", "waterford it", "letterkenny it", "sligo it", "carlow it", "dundalk it", "limerick it"],
    category: "other",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "tuition",
    purpose: "Tuition fees. 20% tax relief on qualifying fees over EUR 3,000. Section 473A TCA 1997.",
  },

  // === RENT (PERSONAL) === (Form 11 relief: rent tax credit)
  {
    patterns: ["rent payment", "monthly rent", "residential tenancies", "rtb registration"],
    category: "Rent",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "rent",
    purpose: "Rent payment. Rent tax credit up to EUR 750 (single) / EUR 1,500 (couple). Section 473B TCA 1997.",
  },

  // === INVESTMENT / BROKERAGE === (CGT flag — Section 7 Form 11)
  {
    patterns: ["degiro", "interactive brokers", "trading 212", "etoro", "revolut trading", "ibkr"],
    category: "other",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Investment/brokerage platform. Review for CGT reporting in Form 11 Section 7.",
  },
];

function normalise(text: string | undefined | null): string {
  return (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function matchMerchantRule(desc: string, merchant: string, amount: number): {
  rule: MerchantRule;
  adjustedCategory?: string;
  adjustedConfidence?: number;
  adjustedPurpose?: string;
  adjustedVatDeductible?: boolean;
} | null {
  const haystack = normalise(`${desc} ${merchant}`);
  
  for (const rule of merchantRules) {
    const matched = rule.patterns.some((p) => haystack.includes(p.toLowerCase()));
    if (matched) {
      // Apply amount-based logic if available
      if (rule.amountLogic) {
        const adjustment = rule.amountLogic(amount);
        if (adjustment) {
          return {
            rule,
            adjustedCategory: adjustment.category,
            adjustedConfidence: adjustment.confidence,
            adjustedPurpose: adjustment.purpose,
            adjustedVatDeductible: adjustment.vat_deductible,
          };
        }
      }
      return { rule };
    }
  }
  return null;
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
  const userInConstruction = !!industryContext.match(/construct|carpentry|trades|electrical|plumbing|building|joinery|kitchen|wardrobe|fitting|renovation/);

  // Check for RCT income (construction company payments)
  const isFromCompany = desc.includes("limited") || desc.includes("ltd") ||
                        desc.includes("from") || desc.includes("caracon") ||
                        desc.includes("contractors") || desc.includes("holdings") ||
                        desc.includes("developments") || desc.includes("builders") ||
                        desc.includes("plc") || desc.includes("group");

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

// Check if transaction is a transfer to an individual (not a business)
function isPaymentToIndividual(desc: string): boolean {
  const normalised = normalise(desc);
  // Transfers "To [Name]" that don't contain company indicators
  if (normalised.startsWith("to ") && 
      !normalised.includes("limited") && 
      !normalised.includes("ltd") &&
      !normalised.includes("group") &&
      !normalised.includes("company")) {
    return true;
  }
  return false;
}

export function autoCategorise(tx: TransactionInput): AutoCatResult {
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
    const isRevenueRefund = desc.includes("revenue") || desc.includes("collector general") || desc.includes("collector-general") || desc.includes("rev comm") || desc.includes("ros refund") || desc.includes("tax refund") || desc.includes("vat refund") || desc.includes("paye refund") || desc.includes("ct refund") || desc.includes("rct refund");
    if (isRevenueRefund) {
      return finalizeResult({
        category: "Tax Refund",
        vat_type: "Exempt",
        vat_deductible: false,
        business_purpose: "Tax refund from Revenue Commissioners. Not taxable income — return of overpaid tax.",
        confidence_score: 95,
        notes: "Revenue refund — excluded from taxable income. Not subject to CT or income tax.",
        needs_review: false,
        needs_receipt: false,
        is_business_expense: true,
      }, tx);
    }

    // Check if this is a commercial refund — classify as Other Income
    const isRefund = desc.includes("refund") || desc.includes("reversal") || desc.includes("cashback") || desc.includes("rebate");
    if (isRefund) {
      return finalizeResult({
        category: "Interest Income", // maps to "Other Income" in DB
        vat_type: "Exempt",
        vat_deductible: false,
        business_purpose: "Refund received. Classified as other income.",
        confidence_score: 85,
        notes: "Refund/reversal detected — categorised as Other Income.",
        needs_review: false,
        needs_receipt: false,
        is_business_expense: true,
      }, tx);
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
      // Use industry-specific VAT rate for income
      const industryRules = INDUSTRY_VAT_RULES[userIndustry] || INDUSTRY_VAT_RULES[userBusinessType];
      const outputRate = industryRules?.defaultOutputRate || "standard_23";
      
      category = "Sales";
      vat_type = VAT_RATES[outputRate.toUpperCase().replace("_", "_") as keyof typeof VAT_RATES]?.label || "Standard Rate (23%)";
      vat_deductible = false;
      business_purpose = `Income received. ${industryRules?.specialRules?.[0] || ""}`;
      confidence = 60;
      notes = "Income transaction.";
      is_business_expense = true; // Income is always business
    }

    return finalizeResult({ category, vat_type, vat_deductible, business_purpose, confidence_score: confidence, notes, needs_review, needs_receipt, is_business_expense }, tx);
  }

  // 2) Check for payment to individual (no VAT invoice possible)
  if (isPaymentToIndividual(desc)) {
    return finalizeResult({
      category: "Labour costs",
      vat_type: "N/A",
      vat_deductible: false,
      business_purpose: "Payment to individual. Cannot claim VAT without valid VAT invoice.",
      confidence_score: 75,
      notes: "Transfer to individual - no VAT deduction possible without invoice.",
      needs_review: true,
      needs_receipt: true,
      is_business_expense: null, // Uncertain - could be personal transfer
    }, tx);
  }

  // 3) APPLY IRISH VAT RULES (Section 59/60) — statutory rules BEFORE merchant rules
  const vatTreatment = determineVatTreatment(
    tx.description,
    amountAbs,
    userIndustry || userBusinessType || "general",
    "expense"
  );

  // Check for DIESEL specifically first - VAT IS recoverable
  if (ALLOWED_VAT_CREDITS.DIESEL.keywords!.some(k => desc.includes(k))) {
    return finalizeResult({
      category: "Motor Vehicle Expenses",
      vat_type: "Standard 23%",
      vat_deductible: true,
      business_purpose: "Diesel fuel - VAT IS recoverable (unlike petrol). Section 59.",
      confidence_score: 90,
      notes: "Diesel purchase - VAT deductible.",
      needs_review: false,
      needs_receipt: true,
      is_business_expense: true,
    }, tx);
  }

  {
    const foodWordBoundary = DISALLOWED_VAT_CREDITS.FOOD_DRINK_ACCOMMODATION.wordBoundaryKeywords || [];
    const foodWordMatch = foodWordBoundary.some((k: string) => new RegExp(`\\b${k}\\b`).test(desc));
    const isDisallowedFood = foodWordMatch || DISALLOWED_VAT_CREDITS.FOOD_DRINK_ACCOMMODATION.keywords.some(k => desc.includes(k));
    const isDisallowedEntertainment = DISALLOWED_VAT_CREDITS.ENTERTAINMENT.keywords.some(k => desc.includes(k));
    const isDisallowedPetrol = DISALLOWED_VAT_CREDITS.PETROL.keywords.some(k => desc.includes(k));

    if (isDisallowedFood) {
      return finalizeResult({
        category: "other",
        vat_type: "Standard 23%",
        vat_deductible: false,
        business_purpose: vatTreatment.explanation,
        confidence_score: 90,
        notes: "Section 60(2)(a)(i) - Food/drink/accommodation VAT not recoverable.",
        needs_review: false,
        needs_receipt: false,
        is_business_expense: false,
      }, tx);
    }

    if (isDisallowedEntertainment) {
      return finalizeResult({
        category: "other",
        vat_type: "Standard 23%",
        vat_deductible: false,
        business_purpose: vatTreatment.explanation,
        confidence_score: 90,
        notes: "Section 60(2)(a)(iii) - Entertainment VAT not recoverable.",
        needs_review: false,
        needs_receipt: false,
        is_business_expense: false,
      }, tx);
    }

    if (isDisallowedPetrol) {
      return finalizeResult({
        category: "Motor Vehicle Expenses",
        vat_type: "Standard 23%",
        vat_deductible: false,
        business_purpose: vatTreatment.explanation,
        confidence_score: 85,
        notes: "Section 60(2)(a)(v) - Petrol VAT not recoverable (diesel IS recoverable).",
        needs_review: false,
        needs_receipt: true,
        is_business_expense: true,
      }, tx);
    }
  }

  // 4) Merchant rules — specific vendor matches
  const merchantMatch = matchMerchantRule(desc, merchant, tx.amount);

  // 5) Apply merchant match if found
  
  if (merchantMatch) {
    const { rule, adjustedCategory, adjustedConfidence, adjustedPurpose, adjustedVatDeductible } = merchantMatch;
    
    category = adjustedCategory || rule.category;
    vat_type = rule.vat_type;
    vat_deductible = adjustedVatDeductible ?? rule.vat_deductible;
    business_purpose = adjustedPurpose || rule.purpose;
    confidence = adjustedConfidence || 85;
    notes = `Matched vendor: ${rule.patterns[0]}.`;
    needs_receipt = rule.needs_receipt ?? false;
    relief_type = rule.relief_type ?? null;
    
    // INDUSTRY-AWARE BOOST: If trade/tech supplier + user in matching industry = 95% confidence + definitely business
    const isTradeUser = TRADE_INDUSTRIES.some(ti =>
      userIndustry.includes(ti) || userBusinessType.includes(ti) || userBizDesc.includes(ti)
    );
    const isTechUser = TECH_INDUSTRIES.some(ti =>
      userIndustry.includes(ti) || userBusinessType.includes(ti) || userBizDesc.includes(ti)
    );

    const industryLabel = tx.user_industry || tx.user_business_type;
    const descSuffix = tx.user_business_description ? ` (${tx.user_business_description})` : "";

    if (rule.isTradeSupplier && isTradeUser) {
      confidence = 95;
      is_business_expense = true; // Definitely business for trade users
      vat_deductible = true; // Trade supplies are always VAT deductible for trade users
      notes = `Trade supplier for ${industryLabel} business. Auto-approved.`;
      business_purpose = `${rule.purpose} Industry: ${industryLabel}${descSuffix}.`;
    } else if (rule.isTechSupplier && isTechUser) {
      confidence = 95;
      is_business_expense = true;
      // Preserve original vat_deductible (Stripe is exempt, cloud hosting is reclaimable)
      notes = `Tech/SaaS supplier for ${industryLabel} business. Auto-approved.`;
      business_purpose = `${rule.purpose} Industry: ${industryLabel}${descSuffix}.`;
    } else if (rule.isTechSupplier && !isTechUser) {
      // Tech supplier but user NOT in tech industry - still likely business but lower confidence
      confidence = 75;
      is_business_expense = true; // Most businesses use SaaS tools
      notes = `Tech/SaaS supplier. User industry (${tx.user_industry || "unspecified"}) is not tech — verify business use.`;
    } else if (rule.isTradeSupplier && !isTradeUser) {
      // Trade supplier but user NOT in trade industry - lower confidence, might be personal
      confidence = 65;
      is_business_expense = null; // Uncertain - could be DIY/personal
      needs_review = true;
      notes = `Trade supplier but user industry (${tx.user_industry || "unspecified"}) is not trades. Review if business expense.`;
    } else {
      // Apply VAT treatment based on Irish rules
      if (!vatTreatment.isVatRecoverable && rule.vat_deductible) {
        // Override if Irish VAT rules say not recoverable
        vat_deductible = false;
        notes += ` ${vatTreatment.warnings.join(". ")}`;
      }
      
      // Determine business vs personal based on merchant category
      is_business_expense = determineBusinessExpense(category, vat_deductible, needs_receipt, userIndustry, userBusinessType);
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
    } else if (desc.includes("physio") || desc.includes("dental") || desc.includes("medical") || desc.includes("pharmacy") || desc.includes("chemist")) {
      category = "Medical";
      vat_type = "Exempt";
      vat_deductible = false;
      business_purpose = "Medical expense. May qualify for 20% tax relief under Section 469 TCA 1997.";
      confidence = 70;
      notes = "Description suggests medical expense.";
      is_business_expense = false;
      relief_type = "medical";
    } else if (desc.includes("pension")) {
      category = "Insurance";
      vat_type = "Exempt";
      vat_deductible = false;
      business_purpose = "Pension contribution. Tax relief at marginal rate.";
      confidence = 70;
      notes = "Description suggests pension contribution.";
      is_business_expense = false;
      relief_type = "pension";
    } else if (desc.includes("charity") || desc.includes("donation")) {
      category = "other";
      vat_type = "Exempt";
      vat_deductible = false;
      business_purpose = "Charitable donation. Tax relief under Section 848A TCA 1997.";
      confidence = 70;
      notes = "Description suggests charitable donation.";
      is_business_expense = false;
      relief_type = "charitable";
    } else if (desc.includes("tuition") || desc.includes("college fee") || desc.includes("university fee")) {
      category = "other";
      vat_type = "Exempt";
      vat_deductible = false;
      business_purpose = "Tuition fees. 20% tax relief on qualifying fees over EUR 3,000. Section 473A TCA 1997.";
      confidence = 70;
      notes = "Description suggests tuition fees.";
      is_business_expense = false;
      relief_type = "tuition";
    } else if (desc.includes("rent") && !desc.includes("car rent") && !desc.includes("tool rent") && !desc.includes("equipment rent")) {
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

  return finalizeResult({ category, vat_type, vat_deductible, business_purpose, confidence_score: confidence, notes, needs_review, needs_receipt, is_business_expense, relief_type }, tx);
}

// Helper function to determine if expense is business or personal
// Now considers user industry/business type for better accuracy
function determineBusinessExpense(
  category: string, 
  vatDeductible: boolean, 
  needsReceipt: boolean,
  userIndustry?: string,
  userBusinessType?: string
): boolean | null {
  // DEFINITELY BUSINESS (TRUE)
  const businessCategories = [
    "Materials", "Tools", "Software", "Phone", "Insurance", "Bank fees", "Bank Fees",
    "Consulting & Accounting", "Motor/travel", "Tolls & Parking", "Repairs and Maintenance",
    "Workwear", "Training", "Office", "Equipment", "Advertising", "Marketing",
    "Fuel", "Rent", "Cleaning", "Labour costs", "Sub Con", "Wages", "Motor Vehicle Expenses"
  ];
  
  if (businessCategories.some(bc => category.toLowerCase().includes(bc.toLowerCase()))) {
    return true;
  }

  // Industry-specific business expense detection
  const industry = normalise(userIndustry || userBusinessType || "");
  const isTradeUser = TRADE_INDUSTRIES.some(ti => industry.includes(ti));
  
  // For trade users, materials and tools are always business
  if (isTradeUser && (category.toLowerCase().includes("material") || category.toLowerCase().includes("tool"))) {
    return true;
  }
  
  // DEFINITELY PERSONAL (FALSE) - VAT not deductible AND category is "other" with specific patterns
  // If category is "other" and VAT is not deductible and no receipt needed to verify
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
  
  // Default to business if VAT is deductible
  return vatDeductible ? true : null;
}

// Categories that suggest a business expense when seen on a personal account
const BUSINESS_INDICATOR_CATEGORIES = [
  "materials", "tools", "subcontractor", "vehicle expenses", "fuel",
  "office", "telephone", "training", "advertising", "travel",
  "subsistence", "repairs", "protective clothing", "ppe", "workwear",
  "software", "subscriptions", "equipment", "motor"
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
    looksLikeBusiness = BUSINESS_INDICATOR_CATEGORIES.some(bc => catLower.includes(bc));
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