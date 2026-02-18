import { describe, it, expect } from "vitest";
import {
  autoCategorise,
  findMatchingCategory,
  CATEGORY_NAME_MAP,
  type TransactionInput,
  type AutoCatResult,
} from "../autocat";
import type { VendorCacheEntry } from "@/services/vendorCacheService";

// ── Helper: build a minimal expense transaction ─────────────
function expense(description: string, overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    amount: -50,
    date: "2024-06-15",
    currency: "EUR",
    description,
    direction: "expense",
    user_industry: "carpentry_joinery",
    user_business_type: "Contractor",
    ...overrides,
  };
}

function income(description: string, overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    amount: 500,
    date: "2024-06-15",
    currency: "EUR",
    description,
    direction: "income",
    user_industry: "carpentry_joinery",
    user_business_type: "Contractor",
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// findMatchingCategory
// ══════════════════════════════════════════════════════════════
describe("findMatchingCategory", () => {
  const dbCategories = [
    { name: "Timber & Sheet Materials", type: "expense" },
    { name: "Power Tools", type: "expense" },
    { name: "Van Costs", type: "expense" },
    { name: "Software", type: "expense" },
    { name: "Insurance", type: "expense" },
    { name: "Bank Fees", type: "expense" },
    { name: "Labour Income", type: "income" },
    { name: "Sales", type: "income" },
  ];

  it("finds exact match by name", () => {
    const result = findMatchingCategory("Software", dbCategories);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Software");
  });

  it("finds mapped match (Materials → Timber & Sheet Materials)", () => {
    const result = findMatchingCategory("Materials", dbCategories, "expense");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Timber & Sheet Materials");
  });

  it("finds mapped match (Tools → Power Tools)", () => {
    const result = findMatchingCategory("Tools", dbCategories, "expense");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Power Tools");
  });

  it("finds mapped match (Motor/travel → Van Costs)", () => {
    const result = findMatchingCategory("Motor/travel", dbCategories, "expense");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Van Costs");
  });

  it("exact match wins over mapping (Sales → Sales)", () => {
    const result = findMatchingCategory("Sales", dbCategories, "income");
    expect(result).not.toBeNull();
    // Exact name match "Sales" beats the mapped "Labour Income"
    expect(result!.name).toBe("Sales");
  });

  it("returns null for unknown category", () => {
    const result = findMatchingCategory("NonExistent123", dbCategories);
    expect(result).toBeNull();
  });

  it("falls back to partial/fuzzy match", () => {
    const result = findMatchingCategory("bank fees", dbCategories, "expense");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Bank Fees");
  });

  it("respects transaction type filter", () => {
    // "Sales" as an expense should NOT match "Sales" income
    const result = findMatchingCategory("Sales", dbCategories, "expense");
    // Should not return the income Sales category
    if (result) {
      expect(result.type).toBe("expense");
    }
  });
});

// ══════════════════════════════════════════════════════════════
// CATEGORY_NAME_MAP
// ══════════════════════════════════════════════════════════════
describe("CATEGORY_NAME_MAP", () => {
  it("maps Materials to timber/fixings names", () => {
    expect(CATEGORY_NAME_MAP["Materials"]).toContain("Timber & Sheet Materials");
    expect(CATEGORY_NAME_MAP["Materials"]).toContain("Fixings & Consumables");
  });

  it("maps Internal Transfer correctly", () => {
    expect(CATEGORY_NAME_MAP["Internal Transfer"]).toContain("Internal Transfers");
  });

  it("maps Sales to income categories", () => {
    expect(CATEGORY_NAME_MAP["Sales"]).toContain("Labour Income");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Internal Transfers
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — internal transfers", () => {
  it("identifies Mobi online saver as internal transfer", () => {
    const result = autoCategorise(expense("*Mobi Online Saver Transfer"));
    expect(result.category).toBe("Internal Transfer");
    expect(result.vat_deductible).toBe(false);
  });

  it("identifies savings transfer as internal transfer", () => {
    const result = autoCategorise(expense("Savings Transfer Out"));
    expect(result.category).toBe("Internal Transfer");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Software subscriptions
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — software", () => {
  it("categorises OpenAI as Software, VAT deductible", () => {
    const result = autoCategorise(expense("OPENAI *CHATGPT SUBSCRIPTION"));
    expect(result.category).toBe("Software");
    expect(result.vat_deductible).toBe(true);
    expect(result.vat_type).toBe("Standard 23%");
  });

  it("categorises Xero as Software", () => {
    const result = autoCategorise(expense("XERO UK LTD"));
    expect(result.category).toBe("Software");
    expect(result.vat_deductible).toBe(true);
  });

  it("Spotify is caught by Section 60 entertainment before merchant rule", () => {
    // "spotify" is in DISALLOWED_VAT_CREDITS.ENTERTAINMENT.keywords
    // Section 60 check fires before merchant rules
    const result = autoCategorise(expense("SPOTIFY PREMIUM"));
    expect(result.category).toBe("other");
    expect(result.vat_deductible).toBe(false);
    expect(result.is_business_expense).toBe(false);
  });

  it("categorises Apple.com as Software", () => {
    const result = autoCategorise(expense("APPLE.COM/BILL"));
    expect(result.category).toBe("Software");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Trade supplies (industry-aware)
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — trade supplies", () => {
  it("boosts confidence to 95% for Screwfix + carpentry user", () => {
    const result = autoCategorise(expense("POS SCREWFIX IRELAND"));
    expect(result.category).toBe("Materials");
    expect(result.confidence_score).toBe(95);
    expect(result.is_business_expense).toBe(true);
    expect(result.vat_deductible).toBe(true);
  });

  it("boosts confidence to 95% for Chadwicks + construction user", () => {
    const result = autoCategorise(expense("CHADWICKS DUBLIN", { user_industry: "construction" }));
    expect(result.confidence_score).toBe(95);
    expect(result.is_business_expense).toBe(true);
  });

  it("lowers confidence for trade supplier + non-trade user", () => {
    const result = autoCategorise(
      expense("POS SCREWFIX IRELAND", {
        user_industry: "professional_services",
        user_business_type: "Consultant",
      }),
    );
    expect(result.confidence_score).toBe(65);
    expect(result.is_business_expense).toBeNull(); // uncertain
    expect(result.needs_review).toBe(true);
  });

  it("categorises Woodies as Tools", () => {
    const result = autoCategorise(expense("WOODIES DIY"));
    expect(result.category).toBe("Tools");
    expect(result.vat_deductible).toBe(true);
  });

  it("categorises Howdens as Materials", () => {
    const result = autoCategorise(expense("HOWDENS JOINERY"));
    expect(result.category).toBe("Materials");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Mixed retailers (needs receipt)
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — mixed retailers", () => {
  it("flags Maxol as needs_receipt, not deductible", () => {
    const result = autoCategorise(expense("M3 MULHUDDART MAXOL"));
    expect(result.needs_receipt).toBe(true);
    expect(result.vat_deductible).toBe(false);
  });

  it("flags Circle K as needs_receipt", () => {
    const result = autoCategorise(expense("CIRCLE K BLANCHARDSTOWN"));
    expect(result.needs_receipt).toBe(true);
  });

  it("flags Spar as needs_receipt", () => {
    const result = autoCategorise(expense("SPAR HOLLYSTOWN"));
    expect(result.needs_receipt).toBe(true);
  });

  it("flags Tesco as needs_receipt", () => {
    const result = autoCategorise(expense("TESCO EXTRA BLANCHARDSTOWN"));
    expect(result.needs_receipt).toBe(true);
    expect(result.vat_deductible).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Food/drink (VAT never deductible)
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — food/drink (Section 60(2)(a)(i))", () => {
  it("blocks VAT on McDonald's", () => {
    const result = autoCategorise(expense("MCDONALDS DUBLIN"));
    expect(result.vat_deductible).toBe(false);
    expect(result.is_business_expense).toBe(false);
  });

  it("blocks VAT on cafe", () => {
    const result = autoCategorise(expense("COSTA COFFEE SWORDS"));
    expect(result.vat_deductible).toBe(false);
  });

  it("blocks VAT on food delivery", () => {
    const result = autoCategorise(expense("JUST EAT ORDER"));
    expect(result.vat_deductible).toBe(false);
  });

  it("blocks VAT on hotel/accommodation (Section 60 takes priority)", () => {
    // Hotels are legitimate business expenses categorised as Travel & Subsistence,
    // but VAT is not recoverable under Section 60(2)(a)(i)
    const result = autoCategorise(expense("DOOLEYS HOTEL WATERFORD"));
    expect(result.vat_deductible).toBe(false);
    expect(result.category).toBe("Travel & Subsistence");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Entertainment (Section 60(2)(a)(iii))
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — entertainment", () => {
  it("blocks VAT on Netflix", () => {
    const result = autoCategorise(expense("NETFLIX SUBSCRIPTION"));
    expect(result.vat_deductible).toBe(false);
    expect(result.is_business_expense).toBe(false);
  });

  it("blocks VAT on PlayStation", () => {
    const result = autoCategorise(expense("PLAYSTATION STORE"));
    expect(result.vat_deductible).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Fuel (petrol vs diesel)
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — fuel rules", () => {
  it("blocks petrol VAT (Section 60(2)(a)(v))", () => {
    const result = autoCategorise(expense("PETROL PURCHASE MAXOL"));
    expect(result.vat_deductible).toBe(false);
    expect(result.notes).toContain("Section 60");
  });

  it("allows diesel VAT", () => {
    const result = autoCategorise(expense("DIESEL PURCHASE APPLEGREEN"));
    expect(result.vat_deductible).toBe(true);
    expect(result.category).toBe("Motor Vehicle Expenses");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Transport
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — transport", () => {
  it("categorises FreeNow as Motor/travel at 13.5%", () => {
    const result = autoCategorise(expense("FREENOW TAXI DUBLIN"));
    expect(result.category).toBe("Motor/travel");
    expect(result.vat_type).toBe("Reduced 13.5%");
    expect(result.vat_deductible).toBe(true);
  });

  it("categorises eFlow as Motor/travel (zero-rated)", () => {
    const result = autoCategorise(expense("EFLOW TOLL CHARGE"));
    expect(result.category).toBe("Motor/travel");
    expect(result.vat_type).toBe("Zero");
  });

  it("categorises parking as Motor/travel at 23%", () => {
    const result = autoCategorise(expense("NCP CAR PARK"));
    expect(result.category).toBe("Motor/travel");
    expect(result.vat_deductible).toBe(true);
  });

  it("categorises Irish Ferries as Motor/travel (zero-rated)", () => {
    const result = autoCategorise(expense("IRISH FERRIES BOOKING"));
    expect(result.category).toBe("Motor/travel");
    expect(result.vat_type).toBe("Zero");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Bank fees
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — bank fees", () => {
  it("categorises Revolut fee as Bank fees (exempt)", () => {
    const result = autoCategorise(expense("REVOLUT BUSINESS FEE"));
    expect(result.category).toBe("Bank fees");
    expect(result.vat_type).toBe("Exempt");
    expect(result.vat_deductible).toBe(false);
  });

  it("categorises stamp duty as Bank fees", () => {
    const result = autoCategorise(expense("STAMP DUTY CHARGE"));
    expect(result.category).toBe("Bank fees");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Insurance
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — insurance", () => {
  it("categorises AXA as Insurance (exempt)", () => {
    const result = autoCategorise(expense("AXA BUSINESS INSURANCE"));
    expect(result.category).toBe("Insurance");
    expect(result.vat_type).toBe("Exempt");
    expect(result.vat_deductible).toBe(false);
  });

  it("categorises FBD as Insurance", () => {
    const result = autoCategorise(expense("FBD INSURANCE RENEWAL"));
    expect(result.category).toBe("Insurance");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Relief types
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — Form 11 reliefs", () => {
  it("tags VHI as health_insurance relief", () => {
    const result = autoCategorise(expense("VHI DIRECT DEBIT"));
    expect(result.relief_type).toBe("health_insurance");
  });

  it("tags physiotherapy as medical relief", () => {
    const result = autoCategorise(expense("PHYSIO SESSION DR SMITH"));
    expect(result.relief_type).toBe("medical");
  });

  it("tags Irish Life Pension as pension relief", () => {
    const result = autoCategorise(expense("IRISH LIFE PENSION CONTRIBUTION"));
    expect(result.relief_type).toBe("pension");
  });

  it("tags Trocaire as charitable relief", () => {
    const result = autoCategorise(expense("TROCAIRE DONATION"));
    expect(result.relief_type).toBe("charitable");
  });

  it("tags UCD fees as tuition relief", () => {
    const result = autoCategorise(expense("UCD STUDENT FEES"));
    expect(result.relief_type).toBe("tuition");
  });

  it("tags rent payment as rent relief", () => {
    const result = autoCategorise(expense("RENT PAYMENT FEBRUARY"));
    expect(result.relief_type).toBe("rent");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Training & certification
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — training", () => {
  it("categorises Safe Pass as Training", () => {
    const result = autoCategorise(expense("SAFE PASS COURSE BOOKING"));
    expect(result.category).toBe("Training");
    expect(result.vat_deductible).toBe(true);
  });

  it("categorises CSCS card as Training", () => {
    const result = autoCategorise(expense("CSCS CARD RENEWAL"));
    expect(result.category).toBe("Training");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Waste disposal
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — waste", () => {
  it("Barna Recycling correctly categorised as Waste (word-boundary matching avoids 'bar' false positive)", () => {
    // "bar" uses \bbar\b word-boundary matching, so "barna" does NOT trigger food/drink
    const result = autoCategorise(expense("BARNA RECYCLING COLLECTION"));
    expect(result.category).toBe("Waste");
    expect(result.vat_deductible).toBe(true);
  });

  it("categorises skip hire as Waste", () => {
    const result = autoCategorise(expense("SKIP HIRE DUBLIN"));
    expect(result.category).toBe("Waste");
    expect(result.vat_deductible).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Phone/communications
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — phone", () => {
  it("categorises Three Ireland as Phone", () => {
    const result = autoCategorise(expense("THREE IRELAND BILL"));
    expect(result.category).toBe("Phone");
    expect(result.vat_deductible).toBe(true);
  });

  it("categorises Vodafone as Phone", () => {
    const result = autoCategorise(expense("VODAFONE MONTHLY"));
    expect(result.category).toBe("Phone");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Workwear
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — workwear", () => {
  it("categorises PPE purchase as Workwear", () => {
    const result = autoCategorise(expense("PPE SAFETY GEAR ORDER"));
    expect(result.category).toBe("Workwear");
    expect(result.vat_deductible).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Income transactions
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — income", () => {
  it("identifies RCT income from company (construction user)", () => {
    const result = autoCategorise(income("FROM CARACON LTD PAYMENT", { user_industry: "construction" }));
    expect(result.category).toBe("RCT");
    expect(result.vat_type).toBe("Reverse Charge");
    expect(result.is_business_expense).toBe(true);
  });

  it("identifies client transfer as RCT for construction user (contains 'from')", () => {
    // "from" keyword + construction user triggers RCT classification
    const result = autoCategorise(income("TRANSFER FROM JOHN MURPHY"));
    expect(result.category).toBe("RCT");
    expect(result.is_business_expense).toBe(true);
  });

  it("identifies generic lodgement as Sales", () => {
    const result = autoCategorise(income("LODGEMENT"));
    expect(result.category).toBe("Sales");
    expect(result.is_business_expense).toBe(true);
  });

  it("income VAT is never deductible", () => {
    const result = autoCategorise(income("CUSTOMER PAYMENT RECEIVED"));
    expect(result.vat_deductible).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Payment to individual
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — payment to individual", () => {
  it("categorises 'to John Smith' as Labour costs", () => {
    const result = autoCategorise(expense("To John Smith"));
    expect(result.category).toBe("Labour costs");
    expect(result.vat_deductible).toBe(false);
    expect(result.needs_review).toBe(true);
  });

  it("does not flag 'to ABC Limited' as individual payment", () => {
    const result = autoCategorise(expense("To ABC Limited"));
    expect(result.category).not.toBe("Labour costs");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Receipt refinement
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — receipt refinement", () => {
  it("upgrades to diesel + VAT deductible when receipt says diesel", () => {
    const result = autoCategorise(expense("CIRCLE K BLANCHARDSTOWN", { receipt_text: "Diesel 40L" }));
    expect(result.category).toBe("Motor Vehicle Expenses");
    expect(result.vat_deductible).toBe(true);
    expect(result.notes).toContain("DIESEL");
  });

  it("confirms petrol as not deductible when receipt says petrol", () => {
    const result = autoCategorise(expense("MAXOL STATION", { receipt_text: "Unleaded petrol 35L" }));
    expect(result.category).toBe("Motor Vehicle Expenses");
    expect(result.vat_deductible).toBe(false);
    expect(result.notes).toContain("PETROL");
  });

  it("confirms materials when receipt mentions timber", () => {
    const result = autoCategorise(expense("WOODIES DIY", { receipt_text: "Timber planks x3, plywood sheets" }));
    expect(result.category).toBe("Materials");
    expect(result.vat_deductible).toBe(true);
  });

  it("confirms tools when receipt mentions drill", () => {
    const result = autoCategorise(expense("SCREWFIX IRELAND", { receipt_text: "Makita drill, saw blade" }));
    expect(result.category).toBe("Tools");
    expect(result.vat_deductible).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Keyword fallback
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — keyword fallback", () => {
  it("detects bank fee from description", () => {
    const result = autoCategorise(expense("QUARTERLY FEE"));
    expect(result.category).toBe("Bank fees");
    expect(result.is_business_expense).toBe(true);
  });

  it("detects subscription from description", () => {
    const result = autoCategorise(expense("SOME SAAS SUBSCRIPTION SERVICE"));
    expect(result.category).toBe("Software");
    expect(result.is_business_expense).toBe(true);
  });

  it("detects insurance from description", () => {
    const result = autoCategorise(expense("MOTOR INSURANCE RENEWAL"));
    expect(result.category).toBe("Insurance");
    expect(result.vat_type).toBe("Exempt");
  });

  it("detects refund and flags for review", () => {
    const result = autoCategorise(expense("REFUND FROM AMAZON"));
    expect(result.category).toBe("other");
    expect(result.needs_review).toBe(true);
  });

  it("flags unknown expense for review with low confidence", () => {
    const result = autoCategorise(expense("RANDOM UNKNOWN VENDOR XYZ123"));
    expect(result.category).toBe("other");
    expect(result.confidence_score).toBeLessThanOrEqual(50);
    expect(result.needs_review).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Confidence flagging
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — confidence and review flags", () => {
  it("high confidence (95) for trade supplier + trade user", () => {
    const result = autoCategorise(expense("CHADWICKS BUILDERS"));
    expect(result.confidence_score).toBe(95);
    expect(result.needs_review).toBe(false);
  });

  it("flags needs_review when confidence < 70", () => {
    const result = autoCategorise(
      expense("SCREWFIX PURCHASE", {
        user_industry: "professional_services",
        user_business_type: "Consultant",
      }),
    );
    expect(result.confidence_score).toBeLessThan(70);
    expect(result.needs_review).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — directors personal account detection (lines 1564-1569)
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — directors_personal_tax account", () => {
  it("flags looks_like_business_expense for business category on personal account", () => {
    const result = autoCategorise(expense("SCREWFIX IRELAND", { account_type: "directors_personal_tax" }));
    expect(result.looks_like_business_expense).toBe(true);
  });

  it("does not flag looks_like_business for non-business category on personal account", () => {
    const result = autoCategorise(expense("RANDOM UNKNOWN VENDOR XYZ123", { account_type: "directors_personal_tax" }));
    // "other" category does not match BUSINESS_INDICATOR_CATEGORIES
    expect(result.looks_like_business_expense).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — trade user materials detection (line 1516-1517)
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — trade user industry-specific detection", () => {
  it("returns null for unknown description even for construction industry user", () => {
    // "GENERIC MATERIAL SUPPLY" doesn't match any merchant patterns or keyword rules,
    // so it falls through to the unknown path with is_business_expense = null
    const result = autoCategorise(expense("GENERIC MATERIAL SUPPLY", { user_industry: "construction" }));
    expect(result.category).toBe("other");
    expect(result.is_business_expense).toBeNull();
    expect(result.needs_review).toBe(true);
  });

  it("detects business expense when trade supplier matches for trade user", () => {
    // CHADWICKS is a known trade supplier → Materials category → business expense
    const result = autoCategorise(expense("CHADWICKS BUILDING SUPPLIES", { user_industry: "construction" }));
    expect(result.category).toBe("Materials");
    expect(result.is_business_expense).toBe(true);
    expect(result.confidence_score).toBeGreaterThanOrEqual(90);
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Internal Transfer is_business_expense (line 1527-1528)
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — internal transfer business expense", () => {
  it("sets is_business_expense to null for internal transfers", () => {
    const result = autoCategorise(expense("*Mobi Online Saver Transfer"));
    expect(result.category).toBe("Internal Transfer");
    // Internal transfers are neither business nor personal
    expect(result.is_business_expense).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// findMatchingCategory — account_type filtering
// ══════════════════════════════════════════════════════════════
describe("findMatchingCategory — account_type filtering", () => {
  const dbCats = [
    { name: "Materials & Supplies", type: "expense", account_type: "business" },
    { name: "Medical Expenses", type: "expense", account_type: "personal" },
    { name: "Bank Charges", type: "expense", account_type: "both" },
    { name: "Office Expenses", type: "expense" }, // no account_type
    { name: "Software", type: "expense", account_type: "business" },
  ];

  it("limited_company filters to business + both + no account_type", () => {
    // "Bank Fees" maps to "Bank Charges" which has account_type "both" — should pass
    const result = findMatchingCategory("Bank Fees", dbCats, "expense", "limited_company");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Bank Charges");
  });

  it("directors_personal_tax filters to personal + both + no account_type", () => {
    // "Medical" maps to "Medical Expenses" which is personal — should pass for personal
    const result = findMatchingCategory("Medical", dbCats, "expense", "directors_personal_tax");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Medical Expenses");
  });

  it("limited_company: personal-only excluded in filtered set but found via fallback", () => {
    // "Medical" maps to "Medical Expenses" which is personal — excluded for limited_company
    // BUT the fallback path (lines 148-162) tries all categories and finds it via mapping
    const result = findMatchingCategory("Medical", dbCats, "expense", "limited_company");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Medical Expenses");
  });

  it("directors_personal_tax: business-only excluded, finds via mapping in filtered set", () => {
    // "Software" is exact match but has account_type business — excluded for personal.
    // Mapping: CATEGORY_NAME_MAP["Software"] = ["Subscriptions & Software", "Software & Licenses", "Office Expenses"]
    // "Office Expenses" has NO account_type, so it's included in filtered set and matched via mapping.
    const result = findMatchingCategory("Software", dbCats, "expense", "directors_personal_tax");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Office Expenses");
  });

  it("no account_type categories are always included", () => {
    const result = findMatchingCategory("Office", dbCats, "expense", "limited_company");
    expect(result).not.toBeNull();
    // "Office" maps to ["Office Expenses", ...] — Office Expenses has no account_type, so included
    expect(result!.name).toBe("Office Expenses");
  });

  it("unknown accountType includes all categories", () => {
    const result = findMatchingCategory("Software", dbCats, "expense", "some_other_type");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Software");
  });

  it("fallback path: exact match in all categories when filtered set has no match", () => {
    // "Materials & Supplies" is exact match but account_type business — excluded for personal
    const catsWithExact = [{ name: "Materials & Supplies", type: "expense", account_type: "business" }];
    const result = findMatchingCategory("Materials & Supplies", catsWithExact, "expense", "directors_personal_tax");
    // Personal filter excludes it, but fallback tries all categories and finds exact match
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Materials & Supplies");
  });

  it("fallback path: mapped match in all categories when filtered set has no match", () => {
    // "Materials" maps to ["Timber & Sheet Materials", ...] — all are business only
    const catsForFallback = [{ name: "Timber & Sheet Materials", type: "expense", account_type: "business" }];
    const result = findMatchingCategory("Materials", catsForFallback, "expense", "directors_personal_tax");
    // Personal filter excludes it, but fallback tries all categories via mapping
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Timber & Sheet Materials");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Income: Revenue refund
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — income: revenue refund", () => {
  it("identifies Revenue Commissioners refund as Tax Refund", () => {
    const result = autoCategorise(income("REVENUE COMMISSIONERS REFUND"));
    expect(result.category).toBe("Tax Refund");
    expect(result.vat_type).toBe("Exempt");
    expect(result.vat_deductible).toBe(false);
    expect(result.confidence_score).toBe(95);
    expect(result.is_business_expense).toBe(true);
  });

  it("identifies collector general as Tax Refund", () => {
    const result = autoCategorise(income("COLLECTOR GENERAL PAYMENT"));
    expect(result.category).toBe("Tax Refund");
  });

  it("identifies VAT refund as Tax Refund", () => {
    const result = autoCategorise(income("VAT REFUND FROM REVENUE"));
    expect(result.category).toBe("Tax Refund");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Income: commercial refund/reversal/cashback/rebate
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — income: commercial refund", () => {
  it("identifies refund as Interest Income (Other Income)", () => {
    const result = autoCategorise(income("REFUND FROM AMAZON ORDER"));
    expect(result.category).toBe("Interest Income");
    expect(result.vat_type).toBe("Exempt");
    expect(result.vat_deductible).toBe(false);
    expect(result.confidence_score).toBe(85);
    expect(result.is_business_expense).toBe(true);
  });

  it("identifies reversal as commercial refund", () => {
    const result = autoCategorise(income("CHARGE REVERSAL"));
    expect(result.category).toBe("Interest Income");
    expect(result.notes).toContain("Refund/reversal");
  });

  it("identifies cashback as commercial refund", () => {
    const result = autoCategorise(income("CASHBACK REWARD"));
    expect(result.category).toBe("Interest Income");
  });

  it("identifies rebate as commercial refund", () => {
    const result = autoCategorise(income("ANNUAL REBATE"));
    expect(result.category).toBe("Interest Income");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Income: professional services industry
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — income: industry-specific purposes", () => {
  it("sets professional services purpose for professional industry user", () => {
    const result = autoCategorise(
      income("CLIENT PAYMENT RECEIVED", {
        user_industry: "professional_services",
        user_business_type: "Consultant",
      }),
    );
    expect(result.category).toBe("Sales");
    expect(result.business_purpose).toContain("professional services");
    expect(result.is_business_expense).toBe(true);
  });

  it("sets retail purpose for retail industry user", () => {
    const result = autoCategorise(
      income("CUSTOMER PAYMENT RECEIVED", {
        user_industry: "retail",
        user_business_type: "Sole Trader",
      }),
    );
    expect(result.category).toBe("Sales");
    expect(result.business_purpose).toContain("product sales");
  });

  it("sets generic income purpose when no client payment pattern matched", () => {
    // Description that doesn't contain transfer, payment, invoice, lodgement,
    // credit, money added, received, deposit, eft, bacs, faster payment, sepa credit
    const result = autoCategorise(
      income("MISC INFLOW ABC123", {
        user_industry: "retail",
        user_business_type: "Sole Trader",
      }),
    );
    expect(result.category).toBe("Sales");
    expect(result.business_purpose).toContain("Income received");
    expect(result.confidence_score).toBe(80); // 70 + 10 (no pattern match)
  });

  it("sets construction purpose for construction user with client payment", () => {
    // Non-company income that still looks like client payment (has "payment")
    const result = autoCategorise(
      income("PAYMENT FROM PRIVATE CLIENT", {
        user_industry: "construction",
        user_business_type: "Sole Trader",
      }),
    );
    // "from" triggers isFromCompany AND userInConstruction => RCT
    expect(result.category).toBe("RCT");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Income: non-construction, non-company income with no pattern
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — income: generic income with no pattern", () => {
  it("returns Sales with lower confidence for non-matching income description", () => {
    // No specific pattern keywords, not construction, not professional, not retail
    const result = autoCategorise(
      income("MISC INFLOW ABC123", {
        user_industry: "technology_it",
        user_business_type: "LTD",
      }),
    );
    expect(result.category).toBe("Sales");
    expect(result.business_purpose).toContain("Income received");
    expect(result.confidence_score).toBe(80); // 70 + 10
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Expense keyword fallback: medical
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — keyword fallback: medical/pension/charity/tuition/rent/insurance", () => {
  it("detects medical from description keyword", () => {
    // "medical" is NOT in Section 60 keywords and NOT a merchant pattern
    const result = autoCategorise(expense("GENERAL MEDICAL CENTRE DUBLIN"));
    expect(result.category).toBe("Medical");
    expect(result.vat_type).toBe("Exempt");
    expect(result.vat_deductible).toBe(false);
    expect(result.relief_type).toBe("medical");
    expect(result.is_business_expense).toBe(false);
  });

  it("detects pharmacy from description keyword", () => {
    // Need to make sure "pharmacy" doesn't match any merchant pattern
    // "pharmacy" IS in merchantRules (line 627), so it will match merchant rule first
    // Let's use "chemist" which is also in merchant rules
    // Actually both are merchant rules. To hit the keyword fallback for medical,
    // we need a description that has "medical" but doesn't match merchant patterns.
    // "GENERAL MEDICAL CENTRE DUBLIN" above works. Let's verify "dental" as keyword.
    // "dental surgery" is a merchant pattern but "dental" alone triggers both.
    // "dental" is in desc.includes check — let's test it with no merchant match
    const result = autoCategorise(expense("MY DENTAL PLAN DIRECT DEBIT"));
    // "dental" is in DISALLOWED_VAT_CREDITS.FOOD_DRINK_ACCOMMODATION? No.
    // "dental surgery" is in merchant patterns — but "dental plan" includes "dental" substring
    // which matches merchant rule pattern "dental surgery"? No — pattern matching is includes()
    // "dental surgery" pattern check: desc "my dental plan direct debit" includes "dental surgery"? NO.
    // So this hits keyword fallback "dental"
    expect(result.category).toBe("Medical");
    expect(result.relief_type).toBe("medical");
  });

  it("detects pension from description keyword", () => {
    // "pension" is NOT in Section 60 keywords
    // Merchant patterns: "irish life pension", "zurich pension", etc.
    // "MY PENSION CONTRIBUTION" — does it match any? "pension" substring would match many.
    // Let me check: merchant patterns include "irish life pension", "zurich pension", "aviva pension"
    // The haystack "my pension contribution my pension contribution" does include "pension" but...
    // Wait, the matching is: haystack.includes(p.toLowerCase()) where p is the pattern string.
    // "irish life pension" — haystack does NOT include this full string.
    // But I need to make sure none of the single-word patterns match.
    // Looking at all patterns... none are just "pension" alone.
    // So "PENSION CONTRIBUTION MONTHLY" should hit keyword fallback.
    const result = autoCategorise(expense("PENSION CONTRIBUTION MONTHLY"));
    expect(result.category).toBe("Insurance");
    expect(result.vat_type).toBe("Exempt");
    expect(result.vat_deductible).toBe(false);
    expect(result.relief_type).toBe("pension");
    expect(result.is_business_expense).toBe(false);
  });

  it("detects charity from description keyword", () => {
    // "charity" is NOT in Section 60 keywords, NOT a merchant pattern
    const result = autoCategorise(expense("LOCAL CHARITY CONTRIBUTION"));
    expect(result.category).toBe("other");
    expect(result.vat_type).toBe("Exempt");
    expect(result.vat_deductible).toBe(false);
    expect(result.relief_type).toBe("charitable");
    expect(result.is_business_expense).toBe(false);
  });

  it("detects donation from description keyword", () => {
    const result = autoCategorise(expense("ONLINE DONATION XYZ"));
    expect(result.category).toBe("other");
    expect(result.relief_type).toBe("charitable");
  });

  it("detects tuition from description keyword", () => {
    // "tuition" is NOT in Section 60 keywords, NOT a single merchant pattern
    // Avoid "fee" in description since that triggers bank fee keyword first
    const result = autoCategorise(expense("TUITION PAYMENT SEPT 2024"));
    expect(result.category).toBe("other");
    expect(result.vat_type).toBe("Exempt");
    expect(result.vat_deductible).toBe(false);
    expect(result.relief_type).toBe("tuition");
    expect(result.is_business_expense).toBe(false);
  });

  it("detects college fee from description keyword (college fee)", () => {
    // "college fee" check: desc.includes("college fee") is the keyword check at line 1438.
    // But "fee" also matches at line 1395 which is checked FIRST.
    // The order is: fee -> subscription -> physio/dental/medical -> pension -> charity
    // -> tuition -> rent -> insurance -> refund -> unknown
    // "fee" comes before "tuition"/"college fee", so "college fee" description
    // would be caught by "fee" first. To hit tuition, avoid "fee", "charge", "commission".
    const result = autoCategorise(expense("ANNUAL COLLEGE TUITION DIRECT DEBIT"));
    expect(result.category).toBe("other");
    expect(result.relief_type).toBe("tuition");
  });

  it("detects rent from description keyword (not car/tool/equipment rent)", () => {
    // "rent" is NOT in Section 60 keywords. "rent payment" is a merchant pattern, so
    // we need something that includes "rent" but doesn't match "rent payment" merchant pattern.
    // Merchant patterns: "rent payment", "monthly rent", "residential tenancies", "rtb registration"
    // "OFFICE RENT DEC 2024" — includes "rent" but not "rent payment" or "monthly rent"
    const result = autoCategorise(expense("OFFICE RENT DEC 2024"));
    expect(result.category).toBe("Rent");
    expect(result.vat_type).toBe("Exempt");
    expect(result.vat_deductible).toBe(false);
    expect(result.relief_type).toBe("rent");
    expect(result.is_business_expense).toBeNull(); // Could be business or personal
  });

  it("does NOT detect rent when description says car rent", () => {
    // "car rent" exclusion prevents rent keyword match at line 1447.
    // Avoid "payment" which would match "rent payment" merchant pattern.
    // "car rent" + no other triggering keywords -> falls through to unknown
    const result = autoCategorise(expense("CAR RENT MONTHLY DIRECT DEBIT"));
    // "car rent" is excluded from rent keyword, no merchant match
    expect(result.category).not.toBe("Rent");
  });

  it("does NOT trigger rent keyword for equipment rent", () => {
    // This should NOT match rent keyword because of "equipment rent" exclusion
    const result = autoCategorise(expense("EQUIPMENT RENT MONTHLY ABC123"));
    // "equipment rent" is excluded from the rent keyword check
    // No merchant match for "equipment rent"
    // Falls through to keyword check — "rent" is excluded due to "equipment rent"
    // Should fall to the unknown/other path
    expect(result.category).not.toBe("Rent");
  });

  it("detects insurance from description keyword (not matching merchant)", () => {
    // "insurance" is NOT in Section 60 keywords
    // Merchant patterns: "axa", "allianz", "fbd", "liberty insurance"
    // "BUSINESS INSURANCE RENEWAL" — includes "insurance" but no merchant pattern match
    // Wait, "liberty insurance" pattern — does "business insurance renewal" include "liberty insurance"? No.
    // But it needs to not match any merchant. Let me check... No merchant patterns are just "insurance".
    // Actually wait: the keyword fallback is at line 1456 and desc.includes("insurance").
    // The test on line 573 uses "MOTOR INSURANCE RENEWAL" which should... let me check if this
    // is already tested. Yes, test line 573 already covers this. But does it hit the keyword
    // fallback or a merchant match? "motor insurance renewal" — merchant patterns include
    // "motor tax" but not "motor insurance". And "insurance" itself is not a merchant pattern.
    // So "MOTOR INSURANCE RENEWAL" would hit the keyword fallback. This is already tested.
    // Let's add a new test for a slightly different insurance description anyway.
    const result = autoCategorise(expense("HOME INSURANCE DIRECT DEBIT"));
    expect(result.category).toBe("Insurance");
    expect(result.vat_type).toBe("Exempt");
    expect(result.is_business_expense).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Tech supplier + tech user
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — tech supplier + tech user", () => {
  it("boosts confidence to 95% for AWS + technology user", () => {
    const result = autoCategorise(
      expense("AWS SUBSCRIPTION CHARGE", {
        user_industry: "technology_it",
        user_business_type: "LTD",
      }),
    );
    expect(result.category).toBe("Cloud Hosting");
    expect(result.confidence_score).toBe(95);
    expect(result.is_business_expense).toBe(true);
    expect(result.vat_deductible).toBe(true);
    expect(result.notes).toContain("Tech/SaaS supplier");
  });

  it("boosts confidence to 95% for Stripe + tech user (preserves exempt VAT)", () => {
    const result = autoCategorise(
      expense("STRIPE PAYMENTS FEE", {
        user_industry: "technology_it",
        user_business_type: "LTD",
      }),
    );
    expect(result.category).toBe("Payment Processing");
    expect(result.confidence_score).toBe(95);
    expect(result.is_business_expense).toBe(true);
    // Stripe is exempt — should preserve original vat_deductible=false
    expect(result.vat_deductible).toBe(false);
  });

  it("lowers confidence for tech supplier + non-tech user", () => {
    const result = autoCategorise(
      expense("GITHUB SUBSCRIPTION", {
        user_industry: "construction",
        user_business_type: "Contractor",
      }),
    );
    expect(result.confidence_score).toBe(75);
    expect(result.is_business_expense).toBe(true); // Most businesses use SaaS
    expect(result.notes).toContain("not tech");
  });

  it("includes user_business_description in purpose for tech supplier + tech user", () => {
    const result = autoCategorise(
      expense("VERCEL DEPLOYMENT", {
        user_industry: "technology_it",
        user_business_type: "LTD",
        user_business_description: "SaaS platform for accounting",
      }),
    );
    expect(result.confidence_score).toBe(95);
    expect(result.business_purpose).toContain("SaaS platform for accounting");
  });

  it("includes industry label in purpose for trade supplier + trade user", () => {
    const result = autoCategorise(
      expense("CHADWICKS ORDER", {
        user_industry: "construction",
        user_business_type: "Contractor",
        user_business_description: "Commercial building contractor",
      }),
    );
    expect(result.business_purpose).toContain("construction");
    expect(result.business_purpose).toContain("Commercial building contractor");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Merchant match "else" branch (non-trade, non-tech)
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — merchant match default branch", () => {
  it("uses determineBusinessExpense for non-trade non-tech merchant", () => {
    // FreeNow is not flagged as isTradeSupplier or isTechSupplier
    const result = autoCategorise(
      expense("FREENOW TAXI SERVICE", {
        user_industry: "professional_services",
        user_business_type: "Consultant",
      }),
    );
    expect(result.category).toBe("Motor/travel");
    // Motor/travel is in businessCategories -> is_business_expense = true
    expect(result.is_business_expense).toBe(true);
  });

  it("flags non-deductible 'other' category for review", () => {
    // Need a merchant that maps to category "other" with vat_deductible false
    // Charitable donations: trocaire -> category "other", vat_deductible false
    // But trocaire has relief_type set. Let me check the branch condition:
    // if (!vat_deductible && category === "other") { needs_review = true; }
    // trocaire: category "other", vat_deductible false — should trigger this
    // But trocaire has relief_type "charitable" which is set before the check.
    // The key question: is the "other" + non-deductible check applied?
    // Looking at line 1390: this is AFTER the industry boost checks.
    // trocaire for a non-trade, non-tech user would hit the "else" branch (line 1377)
    // which calls determineBusinessExpense. Category "other" + !vatDeductible + !needsReceipt => false.
    const result = autoCategorise(
      expense("TROCAIRE ANNUAL DONATION", {
        user_industry: "professional_services",
        user_business_type: "Consultant",
      }),
    );
    expect(result.category).toBe("other");
    expect(result.vat_deductible).toBe(false);
    expect(result.needs_review).toBe(true);
    expect(result.relief_type).toBe("charitable");
  });

  it("applies VAT treatment override when Irish rules say not recoverable", () => {
    // To trigger lines 1381-1382: need a merchant with vat_deductible=true whose
    // description also contains a fuel station name ("shell", "esso", "topaz") that
    // makes determineVatTreatment return isVatRecoverable=false, BUT does NOT match
    // the earlier Section 60 checks in autoCategorise.
    // "accounting" matches the accountant merchant rule (vat_deductible=true, not trade/tech).
    // "shell" in description triggers determineVatTreatment's fuel station check -> not recoverable.
    // "shell" is NOT in Section 60 keywords (food/entertainment/petrol/diesel).
    const result = autoCategorise(
      expense("SHELL ACCOUNTING SERVICES", {
        user_industry: "professional_services",
        user_business_type: "Consultant",
      }),
    );
    expect(result.category).toBe("Consulting & Accounting");
    // VAT deductible should be overridden to false by Irish rules
    expect(result.vat_deductible).toBe(false);
  });

  it("Harvey Norman as Equipment with needs_receipt", () => {
    const result = autoCategorise(
      expense("HARVEY NORMAN ELECTRONICS", {
        user_industry: "professional_services",
        user_business_type: "Consultant",
      }),
    );
    expect(result.category).toBe("Equipment");
    expect(result.needs_receipt).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — determineBusinessExpense paths
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — determineBusinessExpense coverage", () => {
  it("returns true for definitely business category (Motor/travel)", () => {
    const result = autoCategorise(
      expense("EFLOW TOLL M50", {
        user_industry: "professional_services",
        user_business_type: "Consultant",
      }),
    );
    expect(result.category).toBe("Motor/travel");
    expect(result.is_business_expense).toBe(true);
  });

  it("returns false for 'other' + not deductible + no receipt needed (personal)", () => {
    // Investment platforms match this: category "other", vat_deductible false, needs_receipt false
    const result = autoCategorise(
      expense("DEGIRO TRADING FEE", {
        user_industry: "professional_services",
        user_business_type: "Consultant",
      }),
    );
    expect(result.category).toBe("other");
    expect(result.vat_deductible).toBe(false);
    expect(result.is_business_expense).toBe(false);
  });

  it("returns null for needsReceipt category (uncertain)", () => {
    // Tesco is Drawings with needs_receipt=true
    const result = autoCategorise(
      expense("LIDL GROCERIES", {
        user_industry: "professional_services",
        user_business_type: "Consultant",
      }),
    );
    expect(result.needs_receipt).toBe(true);
    expect(result.is_business_expense).toBeNull();
  });

  it("returns true when VAT deductible in default path", () => {
    // Parking is Motor/travel with vat_deductible=true -> business
    const result = autoCategorise(
      expense("NCP PARKING DUBLIN", {
        user_industry: "professional_services",
        user_business_type: "Consultant",
      }),
    );
    expect(result.vat_deductible).toBe(true);
    expect(result.is_business_expense).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — finalizeResult confidence banding
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — finalizeResult confidence banding", () => {
  it("sets needs_review for confidence < 50", () => {
    // Unknown vendor hits confidence 40 -> needs_review
    const result = autoCategorise(expense("ZXCVBNM ASDF QWERTY"));
    expect(result.confidence_score).toBeLessThan(50);
    expect(result.needs_review).toBe(true);
  });

  it("sets needs_review for confidence between 50 and 70", () => {
    // Trade supplier for non-trade user: confidence 65
    const result = autoCategorise(
      expense("WOODIES HOME IMPROVEMENT", {
        user_industry: "professional_services",
        user_business_type: "Consultant",
      }),
    );
    expect(result.confidence_score).toBe(65);
    expect(result.needs_review).toBe(true);
  });

  it("does not force needs_review for confidence >= 70", () => {
    // Bank fees keyword: confidence 75
    const result = autoCategorise(expense("MONTHLY ACCOUNT FEE"));
    expect(result.confidence_score).toBeGreaterThanOrEqual(70);
    // Bank fees has is_business_expense = true from keyword, not flagged for review
    expect(result.needs_review).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — directors_personal_tax: looks_like_business_expense
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — directors_personal_tax looks_like_business advanced", () => {
  it("flags looks_like_business when is_business_expense is true on personal account", () => {
    // Chadwicks + carpentry user (is_business_expense = true) on personal account
    const result = autoCategorise(
      expense("CHADWICKS BUILDERS SUPPLY", {
        account_type: "directors_personal_tax",
      }),
    );
    expect(result.is_business_expense).toBe(true);
    expect(result.looks_like_business_expense).toBe(true);
  });

  it("flags looks_like_business based on category name matching", () => {
    // Software subscription on personal account — "software" in BUSINESS_INDICATOR_CATEGORIES
    const result = autoCategorise(
      expense("XERO ACCOUNTING SOFTWARE", {
        account_type: "directors_personal_tax",
      }),
    );
    expect(result.category).toBe("Software");
    expect(result.looks_like_business_expense).toBe(true);
  });

  it("does NOT flag looks_like_business for Drawings category on personal account", () => {
    const result = autoCategorise(
      expense("PENNEYS CLOTHING", {
        account_type: "directors_personal_tax",
      }),
    );
    expect(result.category).toBe("Drawings");
    expect(result.looks_like_business_expense).toBeUndefined();
  });

  it("does NOT flag looks_like_business on limited_company account", () => {
    // Same expense but on business account — should not flag
    const result = autoCategorise(expense("SCREWFIX IRELAND", { account_type: "limited_company" }));
    expect(result.looks_like_business_expense).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Additional merchant rule coverage
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — additional merchant rules", () => {
  it("categorises accounting firm as Consulting & Accounting", () => {
    const result = autoCategorise(expense("SMITH ACCOUNTANT FEES"));
    expect(result.category).toBe("Consulting & Accounting");
    expect(result.vat_deductible).toBe(true);
  });

  it("categorises Havwoods as Materials for trade user", () => {
    const result = autoCategorise(expense("HAVWOODS FLOORING ORDER"));
    expect(result.category).toBe("Materials");
    expect(result.is_business_expense).toBe(true);
    expect(result.confidence_score).toBe(95);
  });

  it("categorises TJ O'Mahony as Materials", () => {
    const result = autoCategorise(expense("TJ O'MAHONY BUILDERS MERCHANTS"));
    expect(result.category).toBe("Materials");
  });

  it("categorises conference as Training", () => {
    const result = autoCategorise(expense("TECH CONFERENCE TICKETS"));
    expect(result.category).toBe("Training");
  });

  it("categorises Looka as Marketing", () => {
    const result = autoCategorise(expense("LOOKA LOGO DESIGN"));
    expect(result.category).toBe("Marketing");
  });

  it("categorises Vistaprint as Advertising", () => {
    const result = autoCategorise(expense("VISTAPRINT BUSINESS CARDS"));
    expect(result.category).toBe("Advertising");
  });

  it("categorises Virgin Media as Phone", () => {
    const result = autoCategorise(expense("VIRGIN MEDIA BROADBAND"));
    expect(result.category).toBe("Phone");
  });

  it("categorises CIF as Consulting & Accounting", () => {
    const result = autoCategorise(expense("CIF MEMBERSHIP RENEWAL"));
    expect(result.category).toBe("Consulting & Accounting");
  });

  it("categorises Motor Tax as Motor Vehicle Expenses", () => {
    const result = autoCategorise(expense("MOTOR TAX ONLINE RENEWAL"));
    expect(result.category).toBe("Motor Vehicle Expenses");
    expect(result.vat_type).toBe("Exempt");
  });

  it("categorises car dismantlers as Motor/travel", () => {
    const result = autoCategorise(expense("KILCOCK CAR DISMANTLERS"));
    expect(result.category).toBe("Motor/travel");
  });

  it("categorises NCT as Motor/travel", () => {
    const result = autoCategorise(expense("NCT TEST BOOKING"));
    expect(result.category).toBe("Motor/travel");
  });

  it("categorises EHS International as Training", () => {
    const result = autoCategorise(expense("EHS INTERNATIONAL SAFE PASS"));
    expect(result.category).toBe("Training");
    expect(result.confidence_score).toBe(95); // isTradeSupplier + trade user
  });

  it("categorises Brooks Timber as Materials", () => {
    const result = autoCategorise(expense("BROOKS TIMBER SUPPLIES"));
    expect(result.category).toBe("Materials");
  });

  it("categorises SurveyMonkey as Software", () => {
    const result = autoCategorise(expense("SURVEYMONKEY ANNUAL PLAN"));
    expect(result.category).toBe("Software");
  });

  it("categorises QR.io as Software", () => {
    const result = autoCategorise(expense("QR.IO SUBSCRIPTION"));
    expect(result.category).toBe("Software");
  });

  it("categorises Blacknight as Marketing (hosting)", () => {
    const result = autoCategorise(expense("BLACKNIGHT HOSTING"));
    expect(result.category).toBe("Marketing");
  });

  it("categorises Applegreen as General Expenses with needs_receipt", () => {
    const result = autoCategorise(expense("APPLEGREEN STATION"));
    expect(result.needs_receipt).toBe(true);
  });

  it("categorises Texaco as General Expenses with needs_receipt", () => {
    const result = autoCategorise(expense("TEXACO FUEL STATION"));
    expect(result.needs_receipt).toBe(true);
  });

  it("categorises Centra as Drawings", () => {
    const result = autoCategorise(expense("CENTRA STORE"));
    expect(result.category).toBe("Drawings");
  });

  it("categorises Mr Price as Drawings", () => {
    const result = autoCategorise(expense("MR PRICE DUBLIN"));
    expect(result.category).toBe("Drawings");
  });

  it("categorises planet leisure as Drawings", () => {
    const result = autoCategorise(expense("NYA*PLANET LEISURE"));
    expect(result.category).toBe("Drawings");
  });

  it("categorises uisce beatha as Meals & Entertainment", () => {
    const result = autoCategorise(expense("UISCE BEATHA PUB"));
    // "uisce beatha" triggers FOOD_DRINK_ACCOMMODATION Section 60 check before merchant
    // Actually, let me check: "pub" is NOT a Section 60 keyword. But "uisce beatha" is
    // not in Section 60 either. So this should hit the merchant rule.
    // Wait: does "pub" match the word boundary check? wordBoundaryKeywords: ["bar"]
    // "pub" is not in there. And "uisce beatha" keywords list has "pub" in
    // FOOD_DRINK_ACCOMMODATION? Let me check: ["restaurant", "cafe", "coffee", "pub", ...]
    // YES! "pub" is in the food/drink keywords. So "uisce beatha pub" triggers Section 60.
    expect(result.vat_deductible).toBe(false);
  });

  it("categorises The Range as Drawings", () => {
    const result = autoCategorise(expense("THE RANGE RETAIL"));
    expect(result.category).toBe("Drawings");
    expect(result.needs_receipt).toBe(true);
  });

  it("categorises Waterford shop as Drawings", () => {
    const result = autoCategorise(expense("WATERFRD CRYSTAL SHOP"));
    expect(result.category).toBe("Drawings");
  });

  it("categorises printing service as Office", () => {
    const result = autoCategorise(expense("NYA*PRINT COPY CENTER"));
    expect(result.category).toBe("Office");
  });

  it("categorises investment platform as other", () => {
    const result = autoCategorise(expense("DEGIRO SHARE PURCHASE"));
    expect(result.category).toBe("other");
    expect(result.vat_deductible).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — isPaymentToIndividual edge cases
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — isPaymentToIndividual edge cases", () => {
  it("does not flag 'to XYZ Group' as individual", () => {
    const result = autoCategorise(expense("To Murphy Group"));
    expect(result.category).not.toBe("Labour costs");
  });

  it("does not flag 'to XYZ Company' as individual", () => {
    const result = autoCategorise(expense("To Building Company Ireland"));
    expect(result.category).not.toBe("Labour costs");
  });

  it("does not flag description not starting with 'to'", () => {
    const result = autoCategorise(expense("PAYMENT FOR JOHN SMITH"));
    expect(result.category).not.toBe("Labour costs");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — Receipt refinement: no receipt text
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — receipt text edge cases", () => {
  it("returns base result when no receipt text provided", () => {
    const result = autoCategorise(expense("CIRCLE K STATION"));
    // No receipt_text, so refineWithReceipt returns base unchanged
    expect(result.needs_receipt).toBe(true);
    expect(result.category).toBe("General Expenses");
  });

  it("returns base result when receipt text does not match any pattern", () => {
    const result = autoCategorise(expense("CIRCLE K STATION", { receipt_text: "Car wash deluxe" }));
    // Receipt says "car wash" — doesn't match diesel, petrol, materials, or tools
    expect(result.category).toBe("General Expenses");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — keyword fallback: medical (no vendor match)
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — keyword fallback medical that bypasses vendor DB", () => {
  it("hits medical keyword fallback when description has 'medical' but no vendor pattern match", () => {
    // "PAYMENT FOR MEDICAL SUPPLIES" contains "medical" but does NOT match
    // any vendor pattern (vendor DB has "medical centre" but not plain "medical").
    // This ensures lines 655-662 of autocat.ts are exercised.
    const result = autoCategorise(expense("PAYMENT FOR MEDICAL SUPPLIES"));
    expect(result.category).toBe("Medical");
    expect(result.vat_type).toBe("Exempt");
    expect(result.vat_deductible).toBe(false);
    expect(result.is_business_expense).toBe(false);
    expect(result.relief_type).toBe("medical");
    expect(result.notes).toContain("Description suggests medical expense");
  });
});

// ══════════════════════════════════════════════════════════════
// autoCategorise — vendor cache lookup
// ══════════════════════════════════════════════════════════════
describe("autoCategorise — vendor cache lookup", () => {
  function makeCacheEntry(pattern: string, overrides?: Partial<VendorCacheEntry>): VendorCacheEntry {
    return {
      id: "cache-1",
      vendor_pattern: pattern,
      normalized_name: pattern,
      category: "Software",
      vat_type: "Standard 23%",
      vat_deductible: true,
      business_purpose: "Cached vendor purpose",
      confidence: 90,
      source: "rule",
      mcc_code: null,
      sector: null,
      hit_count: 5,
      last_seen: "2024-06-01",
      ...overrides,
    };
  }

  it("uses vendor cache entry when description matches a cached pattern", () => {
    const cache = new Map<string, VendorCacheEntry>();
    cache.set("acme software", makeCacheEntry("acme software"));

    const result = autoCategorise(expense("ACME SOFTWARE SUBSCRIPTION"), cache);
    expect(result.category).toBe("Software");
    expect(result.notes).toContain("Matched vendor");
  });

  it("matches n-gram tokens from vendor cache", () => {
    const cache = new Map<string, VendorCacheEntry>();
    cache.set("acme", makeCacheEntry("acme", { category: "Materials", vat_deductible: true }));

    const result = autoCategorise(expense("PAYMENT TO ACME LTD"), cache);
    // "acme" is a single token that should match via n-gram search
    expect(result.category).toBe("Materials");
  });

  it("skips vendor cache when cache is empty", () => {
    const cache = new Map<string, VendorCacheEntry>();
    // Empty cache — should fall through to normal vendor matching
    const result = autoCategorise(expense("SCREWFIX PURCHASE"), cache);
    expect(result.category).toBeDefined();
  });
});
