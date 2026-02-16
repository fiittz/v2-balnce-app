// Structured vendor database for autocat engine.
// Extracted from inline merchantRules + expanded with ~250 new Irish vendors.

export interface VendorEntry {
  /** Human-readable vendor name */
  name: string;
  /** Lowercase patterns to match against transaction descriptions */
  patterns: string[];
  /** Autocat category (maps to CATEGORY_NAME_MAP) */
  category: string;
  /** Irish VAT rate label */
  vat_type: string;
  /** Whether VAT is deductible under Section 59 */
  vat_deductible: boolean;
  /** Business purpose / explanation */
  purpose: string;
  /** True if receipt required to determine correct category/VAT */
  needs_receipt?: boolean;
  /** True for merchants that are ALWAYS business for trade industries */
  isTradeSupplier?: boolean;
  /** True for merchants that are ALWAYS business for tech/SaaS industries */
  isTechSupplier?: boolean;
  /** Form 11 relief type if applicable */
  relief_type?: "medical" | "pension" | "health_insurance" | "rent" | "charitable" | "tuition" | null;
  /** Optional amount-based logic override */
  amountLogic?: (amount: number) => { category?: string; confidence?: number; purpose?: string; vat_deductible?: boolean } | null;
  /** Vendor sector for grouping */
  sector?: string;
  /** Optional MCC codes associated with this vendor */
  mcc_codes?: number[];
}

// ═══════════════════════════════════════════════════════════════
// VENDOR DATABASE
// ═══════════════════════════════════════════════════════════════

export const vendorDatabase: VendorEntry[] = [

  // ────────────────────────────────────────────────────────────
  // REVENUE COMMISSIONERS (Tax refunds - NOT taxable income)
  // ────────────────────────────────────────────────────────────
  {
    name: "Revenue Commissioners",
    patterns: ["revenue", "revenue commissioners", "rev comm", "revenue comm", "collector general", "collector-general", "rev.ie", "ros refund", "revenue refund", "tax refund", "vat refund", "paye refund", "ct refund", "rct refund"],
    category: "Tax Refund",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Tax refund from Revenue Commissioners. Not taxable income — this is a return of previously overpaid tax.",
    sector: "government",
  },

  // ────────────────────────────────────────────────────────────
  // INTERNAL TRANSFERS (Not income/expense)
  // ────────────────────────────────────────────────────────────
  {
    name: "Internal Transfer",
    patterns: ["*mobi online saver", "*mobi current", "mobi online saver", "mobi current", "mobi saver", "online saver", "current account", "from current", "to current", "savings transfer", "internal transfer"],
    category: "Internal Transfer",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Internal transfer between accounts. Not actual income or expense - funds movement only.",
    sector: "banking",
  },

  // ────────────────────────────────────────────────────────────
  // SOFTWARE SUBSCRIPTIONS (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "OpenAI / ChatGPT",
    patterns: ["openai", "chatgpt", "gpt", "ai subscr"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Software subscription for business operations. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "SurveyMonkey",
    patterns: ["surveymonkey", "survey monkey"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Survey software subscription. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Accounting Software",
    patterns: ["xero", "sage", "quickbooks"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Accounting software subscription. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "QR.io",
    patterns: ["qr.io", "qr generator"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Digital service subscription. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Apple",
    patterns: ["apple.com/bill", "apple.com", "itunes"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Software/app subscription. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Software Subscriptions",
    patterns: ["spotify", "adobe", "microsoft", "shopify", "google storage", "dropbox", "canva", "zoom", "slack"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Software subscription. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  // NEW: Additional SaaS vendors
  {
    name: "Atlassian",
    patterns: ["atlassian", "jira", "confluence", "bitbucket", "trello"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Project management/collaboration software. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "GitHub",
    patterns: ["github", "git hub"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Developer tools subscription. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Amazon Web Services",
    patterns: ["aws", "amazon web services", "amazonaws"],
    category: "Cloud Hosting",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Cloud hosting/services. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Google Cloud / Workspace",
    patterns: ["google cloud", "google workspace", "google gsuite", "g suite", "google one"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Cloud services/productivity suite. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Notion",
    patterns: ["notion", "notion.so"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Productivity software subscription. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Figma",
    patterns: ["figma"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Design software subscription. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Mailchimp",
    patterns: ["mailchimp", "mail chimp", "intuit mailchimp"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Email marketing software. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "HubSpot",
    patterns: ["hubspot"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "CRM/marketing software. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Stripe",
    patterns: ["stripe"],
    category: "Payment Processing",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Payment processing fees. Financial services exempt from VAT.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Twilio",
    patterns: ["twilio", "sendgrid"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Communications platform. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Calendly",
    patterns: ["calendly"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Scheduling software. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Miro",
    patterns: ["miro", "miro.com"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Collaboration whiteboard software. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Monday.com",
    patterns: ["monday.com", "monday com"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Project management software. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Asana",
    patterns: ["asana"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Project management software. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "1Password / LastPass",
    patterns: ["1password", "lastpass", "dashlane", "bitwarden"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Password management software. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Grammarly",
    patterns: ["grammarly"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Writing assistance software. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Wix / Squarespace",
    patterns: ["wix", "squarespace", "wordpress.com", "godaddy", "namecheap"],
    category: "Marketing",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Website builder/hosting. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Anthropic / Claude",
    patterns: ["anthropic", "claude.ai"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "AI software subscription. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Vercel / Netlify",
    patterns: ["vercel", "netlify"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Web hosting/deployment platform. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Freshbooks / Wave",
    patterns: ["freshbooks", "wave accounting", "waveapps"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Accounting/invoicing software. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Intercom / Zendesk",
    patterns: ["intercom", "zendesk"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Customer support software. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "DocuSign",
    patterns: ["docusign"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "E-signature software. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Loom / Vimeo",
    patterns: ["loom", "vimeo"],
    category: "Software",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Video platform subscription. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "Hootsuite / Buffer",
    patterns: ["hootsuite", "buffer"],
    category: "Marketing",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Social media management software. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },
  {
    name: "SEMrush / Ahrefs",
    patterns: ["semrush", "ahrefs"],
    category: "Marketing",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "SEO/marketing analytics software. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },

  // ────────────────────────────────────────────────────────────
  // INTERNET/HOSTING SERVICES (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Web Hosting",
    patterns: ["blacknight", "hosting", "domain"],
    category: "Marketing",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Web hosting/internet services for business. VAT deductible under Section 59.",
    isTechSupplier: true,
    sector: "software",
  },

  // ────────────────────────────────────────────────────────────
  // FUEL STATIONS (Multi-vendor — needs receipt)
  // ────────────────────────────────────────────────────────────
  {
    name: "Maxol",
    patterns: ["maxol", "m3 mulhuddart maxol", "m3 maxol"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Fuel station — multi-vendor store. Need receipt to determine purchase (diesel/petrol/food/other).",
    sector: "fuel",
  },
  {
    name: "Circle K",
    patterns: ["circle k", "circlek"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Fuel station — multi-vendor store. Need receipt to determine purchase.",
    sector: "fuel",
  },
  {
    name: "Applegreen",
    patterns: ["applegreen"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Fuel station — multi-vendor store. Need receipt to determine purchase.",
    sector: "fuel",
  },
  {
    name: "Texaco",
    patterns: ["texaco"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Fuel station — multi-vendor store. Need receipt to determine purchase.",
    sector: "fuel",
  },
  // NEW: Additional fuel stations
  {
    name: "Top Oil",
    patterns: ["top oil", "topoil"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Fuel station — multi-vendor store. Need receipt to determine purchase.",
    sector: "fuel",
  },
  {
    name: "Inver / DCC Energy",
    patterns: ["inver", "dcc energy"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Fuel/energy supplier. Need receipt to determine purchase.",
    sector: "fuel",
  },
  {
    name: "Shell",
    patterns: ["shell fuel", "shell garage", "shell service", "shell station", "shell petrol", "shell diesel"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Fuel station — multi-vendor store. Need receipt to determine purchase.",
    sector: "fuel",
  },
  {
    name: "Esso",
    patterns: ["esso"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Fuel station — multi-vendor store. Need receipt to determine purchase.",
    sector: "fuel",
  },
  {
    name: "Go Fuel",
    patterns: ["go fuel", "go petrol"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Fuel station. Need receipt to determine purchase.",
    sector: "fuel",
  },
  {
    name: "Certa",
    patterns: ["certa"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Fuel/heating oil supplier. Need receipt to determine purchase.",
    sector: "fuel",
  },

  // ────────────────────────────────────────────────────────────
  // CONVENIENCE STORES (Drawings/personal unless proven otherwise)
  // ────────────────────────────────────────────────────────────
  {
    name: "Spar",
    patterns: ["spar", "spar hollystown"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Convenience store — likely personal. Treated as drawings unless receipt proves business supplies.",
    sector: "retail",
  },
  {
    name: "Centra / Daybreak",
    patterns: ["centra", "daybreak"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Convenience store — likely personal food/drink. Treated as drawings.",
    sector: "retail",
  },
  {
    name: "Mr Price",
    patterns: ["mr price"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Discount retailer — likely personal. Treated as drawings unless receipt proves business use.",
    sector: "retail",
  },
  // NEW: Additional convenience stores
  {
    name: "EuroGiant / Dealz",
    patterns: ["eurogiant", "euro giant", "dealz", "poundland"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Discount retailer — likely personal. Treated as drawings unless receipt proves business supplies.",
    sector: "retail",
  },
  {
    name: "Londis / Mace",
    patterns: ["londis", "mace"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Convenience store — likely personal. Treated as drawings.",
    sector: "retail",
  },
  {
    name: "Costcutter",
    patterns: ["costcutter"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Convenience store — likely personal. Treated as drawings.",
    sector: "retail",
  },

  // ────────────────────────────────────────────────────────────
  // FOOD/DRINK/ENTERTAINMENT (VAT NEVER Deductible - Section 60(2)(a)(i) and (iii))
  // ────────────────────────────────────────────────────────────
  {
    name: "Fast Food",
    patterns: ["mcdonalds", "mcdonald", "burger king", "kfc", "subway", "supermacs"],
    category: "Meals & Entertainment",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Food/drink expense. VAT NOT deductible under Section 60(2)(a)(i).",
    sector: "food",
  },
  {
    name: "Pubs & Bars",
    patterns: ["kennedys", "murrays bar", "madigans", "the pub", "bar & grill", "bar restaurant", "public house"],
    category: "Meals & Entertainment",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Food/drink/entertainment. VAT NOT deductible under Section 60(2)(a)(i) and (iii).",
    sector: "food",
  },
  {
    name: "Coffee / Cafe",
    patterns: ["butlers chocolate", "cafe", "coffee", "starbucks", "costa"],
    category: "Meals & Entertainment",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Food/drink expense. VAT NOT deductible under Section 60(2)(a)(i).",
    sector: "food",
  },
  {
    name: "Food Delivery",
    patterns: ["just eat", "deliveroo", "uber eats"],
    category: "Meals & Entertainment",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Food delivery. VAT NOT deductible under Section 60(2)(a)(i).",
    sector: "food",
  },
  {
    name: "Hotels / Accommodation",
    patterns: ["hotel", "accommodation", "b&b", "airbnb"],
    category: "Subsistence",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Accommodation for staff. VAT NOT deductible under Section 60(2)(a)(i).",
    sector: "accommodation",
  },
  // NEW: Additional food/drink
  {
    name: "Nandos",
    patterns: ["nandos", "nando's"],
    category: "Meals & Entertainment",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Restaurant/food expense. VAT NOT deductible under Section 60(2)(a)(i).",
    sector: "food",
  },
  {
    name: "Dominos / Pizza",
    patterns: ["dominos", "domino's", "pizza hut", "apache pizza", "four star pizza"],
    category: "Meals & Entertainment",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Food delivery/restaurant. VAT NOT deductible under Section 60(2)(a)(i).",
    sector: "food",
  },
  {
    name: "Insomnia Coffee",
    patterns: ["insomnia coffee", "insomnia"],
    category: "Meals & Entertainment",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Coffee shop. VAT NOT deductible under Section 60(2)(a)(i).",
    sector: "food",
  },

  // ────────────────────────────────────────────────────────────
  // PERSONAL/ENTERTAINMENT (Drawings)
  // ────────────────────────────────────────────────────────────
  {
    name: "Smyths Toys",
    patterns: ["smyths", "smyth toy"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Toy retailer. Personal expense — treated as drawings.",
    sector: "retail",
  },
  {
    name: "Entertainment Subscriptions",
    patterns: ["playstation", "xbox", "netflix", "amazon prime", "disney"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Entertainment subscription. Personal expense — treated as drawings.",
    sector: "entertainment",
  },
  {
    name: "Supermarkets",
    patterns: ["lidl", "tesco", "aldi", "dunnes", "supervalu"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Supermarket. Likely personal/food — treated as drawings unless receipt proves business supplies.",
    sector: "retail",
  },
  {
    name: "Fashion Retailers",
    patterns: ["penneys", "primark", "tk maxx", "zara", "h&m"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Clothing retailer. Personal expense — treated as drawings unless proven workwear.",
    sector: "retail",
  },
  {
    name: "Vape",
    patterns: ["vapevend", "vapeend", "vape"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Personal expense — treated as drawings.",
    sector: "personal",
  },
  {
    name: "Planet Leisure",
    patterns: ["planet leisure", "nya*planet"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Entertainment/leisure. Personal expense — treated as drawings.",
    sector: "entertainment",
  },
  {
    name: "Uisce Beatha",
    patterns: ["uisce beatha"],
    category: "Meals & Entertainment",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Pub/bar. Food and drink expense. VAT NOT deductible (Section 60(2)(a)(i)).",
    sector: "food",
  },
  // NEW: Additional personal/entertainment
  {
    name: "Cinema",
    patterns: ["cineworld", "vue cinema", "omniplex", "movies@", "imc cinema", "odeon"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Cinema. Personal entertainment — treated as drawings.",
    sector: "entertainment",
  },
  {
    name: "Gym / Fitness",
    patterns: ["flyefit", "ben dunne gym", "gym plus", "westwood gym", "platinum gym", "anytime fitness"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Gym membership. Personal expense — treated as drawings.",
    sector: "personal",
  },
  {
    name: "Arnotts / Brown Thomas",
    patterns: ["arnotts", "brown thomas", "bt2"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Department store. Personal expense — treated as drawings unless proven business purchase.",
    sector: "retail",
  },
  {
    name: "Sports Retailers",
    patterns: ["elverys", "intersport", "life style sports", "jd sports", "sports direct"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    purpose: "Sports retailer. Personal expense — treated as drawings.",
    sector: "retail",
  },
  {
    name: "EZ Living / Furniture",
    patterns: ["ez living", "ikea", "harvey norman furniture", "dem", "meadows & byrne"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Furniture retailer. Likely personal — treated as drawings unless receipt proves office furniture.",
    sector: "retail",
  },
  // Note: Amazon not included as vendor — too diverse (could be business or personal,
  // refunds, marketplace, AWS, etc.) Best handled by receipt review or keyword fallback.

  // ────────────────────────────────────────────────────────────
  // TAXI/TRANSPORT (VAT Deductible @ 13.5%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Taxi Services",
    patterns: ["freenow", "free now", "bolt", "uber", "mytaxi"],
    category: "Motor/travel",
    vat_type: "Reduced 13.5%",
    vat_deductible: true,
    needs_receipt: true,
    purpose: "Taxi/transport service. VAT deductible at 13.5% if for business travel (need receipt).",
    sector: "transport",
  },

  // ────────────────────────────────────────────────────────────
  // ACCOMMODATION (VAT NOT Deductible)
  // ────────────────────────────────────────────────────────────
  {
    name: "Booking.com / Hotels",
    patterns: ["booking.com", "hotel at booking", "dooleys hotel", "dooleys"],
    category: "Subsistence",
    vat_type: "Reduced 13.5%",
    vat_deductible: false,
    purpose: "Hotel/accommodation. VAT NOT deductible under Section 60(2)(a)(i) unless qualifying conference.",
    sector: "accommodation",
  },

  // ────────────────────────────────────────────────────────────
  // PORT/FERRY (Business travel - Zero rated)
  // ────────────────────────────────────────────────────────────
  {
    name: "Port / Ferry",
    patterns: ["port of waterford", "irish ferries", "stena line"],
    category: "Motor/travel",
    vat_type: "Zero",
    vat_deductible: true,
    purpose: "Port/ferry charges for business travel. Zero-rated transport.",
    sector: "transport",
  },

  // ────────────────────────────────────────────────────────────
  // MISC SHOPS/LOCATIONS
  // ────────────────────────────────────────────────────────────
  {
    name: "Waterford",
    patterns: ["waterfrd", "waterford"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Retail purchase — treated as drawings unless receipt proves business use.",
    sector: "retail",
  },
  {
    name: "The Range",
    patterns: ["the range"],
    category: "Drawings",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Retail store — treated as drawings unless receipt proves business supplies.",
    sector: "retail",
  },

  // ────────────────────────────────────────────────────────────
  // BANK FEES (Exempt - No VAT)
  // ────────────────────────────────────────────────────────────
  {
    name: "Revolut Fees",
    patterns: ["revolut business fee", "revolut fee", "basic plan fee"],
    category: "Bank fees",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Financial services are VAT exempt. No VAT to claim.",
    sector: "banking",
  },
  {
    name: "Bank Charges",
    patterns: ["stamp duty", "fee-qtr", "service charge", "account fee", "monthly fee", "bank charge"],
    category: "Bank fees",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Bank fees/charges. Financial services are VAT exempt.",
    sector: "banking",
  },
  // NEW: Additional bank fees
  {
    name: "AIB Fees",
    patterns: ["aib fee", "aib charge", "allied irish"],
    category: "Bank fees",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Bank fees. Financial services are VAT exempt.",
    sector: "banking",
  },
  {
    name: "BOI Fees",
    patterns: ["boi fee", "bank of ireland fee", "bank of ireland charge"],
    category: "Bank fees",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Bank fees. Financial services are VAT exempt.",
    sector: "banking",
  },
  {
    name: "PTSB Fees",
    patterns: ["ptsb fee", "permanent tsb fee", "permanent tsb charge"],
    category: "Bank fees",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Bank fees. Financial services are VAT exempt.",
    sector: "banking",
  },
  {
    name: "N26 Fees",
    patterns: ["n26 fee", "n26 charge"],
    category: "Bank fees",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Bank fees. Financial services are VAT exempt.",
    sector: "banking",
  },

  // ────────────────────────────────────────────────────────────
  // TOLLS (Zero-rated)
  // ────────────────────────────────────────────────────────────
  {
    name: "Tolls",
    patterns: ["eflow", "e-flow", "e flow", "e-toll", "etoll", "barrier free tol", "toll", "m50", "barrier free"],
    category: "Motor/travel",
    vat_type: "Zero",
    vat_deductible: true,
    purpose: "Toll charges for business travel. Zero-rated/exempt - no VAT to claim but expense is deductible.",
    sector: "transport",
  },

  // ────────────────────────────────────────────────────────────
  // PARKING (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Parking",
    patterns: ["parkingpay", "parking", "car park", "ncp"],
    category: "Motor/travel",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Parking for business travel. VAT deductible under Section 59.",
    sector: "transport",
  },

  // ────────────────────────────────────────────────────────────
  // TRADE SUPPLIES (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Screwfix",
    patterns: ["screwfix", "screwfix ireland"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Trade supplies/tools for business. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Chadwicks",
    patterns: ["chadwicks", "chadwick"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Building materials supplier. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Woodies",
    patterns: ["woodies", "woodie"],
    category: "Tools",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "DIY/hardware supplies. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "McQuillan / Trade Suppliers",
    patterns: ["mcquillan", "jj mcquillan", "powertoolhub", "howdens", "noyeks", "ptrs"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Trade supplies/materials. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Paint / Timber Suppliers",
    patterns: ["pat mcdonnell paint", "strahan", "hardwood", "timber"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Construction materials. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Brooks / Builders Merchants",
    patterns: ["brooks", "brooks timber", "murdock builders", "heiton buckley", "toolstation"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Trade supplies/materials. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Harvey Norman",
    patterns: ["harvey norman"],
    category: "Equipment",
    vat_type: "Standard 23%",
    vat_deductible: true,
    needs_receipt: true,
    purpose: "Electronics/equipment. VAT deductible if for business use (need receipt).",
    sector: "retail",
  },
  // NEW: Additional trade suppliers
  {
    name: "Grafton Group",
    patterns: ["grafton", "grafton merchanting", "grafton group"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Building materials supplier (Grafton Group). VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Heatmerchants",
    patterns: ["heatmerchants", "heat merchants", "heatmerch"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Plumbing/heating supplies. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Tile Merchant",
    patterns: ["tile merchant", "tilemerchant", "national tile"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Tiling materials. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "JS McCarthy",
    patterns: ["js mccarthy", "j s mccarthy", "mccarthy builders"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Builders merchants. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Davies",
    patterns: ["davies diy", "davies builders"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "DIY/trade supplies. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Murdock's",
    patterns: ["murdock", "murdocks"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Builders merchants. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "McMahon Builders",
    patterns: ["mcmahon builders", "mcmahon buildprov", "mcmahon's"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Builders providers. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Topline",
    patterns: ["topline"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Hardware/building materials. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Dulux / Crown Paints",
    patterns: ["dulux", "crown paint", "fleetwood paint"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Paint supplier. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Wavin / Polypipe",
    patterns: ["wavin", "polypipe"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Piping/drainage materials. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Keystone Lintels",
    patterns: ["keystone", "keystone lintel"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Construction materials (lintels). VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Quinn Building Products",
    patterns: ["quinn building", "quinn cement", "quinn products"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Building products/cement. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Irish Cement / CRH",
    patterns: ["irish cement", "crh", "roadstone"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Cement/aggregates supplier. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Kingspan",
    patterns: ["kingspan"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Insulation/building materials. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Xtratherm",
    patterns: ["xtratherm"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Insulation materials. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Saint-Gobain / Gyproc",
    patterns: ["saint-gobain", "gyproc", "isover", "weber"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Building materials (plasterboard/insulation). VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Bostik / Henkel",
    patterns: ["bostik", "henkel"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Adhesives/sealants. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Hilti",
    patterns: ["hilti"],
    category: "Tools",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Professional power tools. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Makita",
    patterns: ["makita"],
    category: "Tools",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Power tools. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "DeWalt",
    patterns: ["dewalt", "de walt"],
    category: "Tools",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Power tools. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Milwaukee Tools",
    patterns: ["milwaukee tool", "milwaukee"],
    category: "Tools",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Power tools. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Bosch Professional",
    patterns: ["bosch"],
    category: "Tools",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Power tools. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Stanley / Black & Decker",
    patterns: ["stanley", "black & decker", "black and decker"],
    category: "Tools",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Tools. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Ridgid",
    patterns: ["ridgid"],
    category: "Tools",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Professional tools. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "O'Brien's Building Supplies",
    patterns: ["o'brien building", "obriens building", "obrien building"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Building materials. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Mac's Warehouse",
    patterns: ["mac's warehouse", "macs warehouse"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Building/plumbing supplies. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },
  {
    name: "Kelly's Hardware",
    patterns: ["kellys hardware", "kelly hardware"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Hardware supplies. VAT deductible under Section 59.",
    isTradeSupplier: true,
    sector: "trade",
  },

  // ────────────────────────────────────────────────────────────
  // VEHICLE PARTS/REPAIRS (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Vehicle Parts",
    patterns: ["partsforcars", "parts for cars"],
    category: "Motor/travel",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Vehicle parts for business vehicle. VAT deductible under Section 59.",
    sector: "motor",
  },
  {
    name: "Vehicle Repairs / Tyres",
    patterns: ["first stop", "fastfit", "kwik fit", "ats euromaster", "halfords"],
    category: "Repairs and Maintenance",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Vehicle maintenance/parts. VAT deductible under Section 59.",
    sector: "motor",
  },
  {
    name: "Vehicle Testing",
    patterns: ["nct", "road safety", "cvrt"],
    category: "Motor/travel",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Vehicle testing. VAT deductible under Section 59.",
    sector: "motor",
  },
  // NEW: Additional motor
  {
    name: "Advance Pitstop",
    patterns: ["advance pitstop", "advance pit stop"],
    category: "Repairs and Maintenance",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Vehicle service/tyres. VAT deductible under Section 59.",
    sector: "motor",
  },
  {
    name: "Mangan's Auto",
    patterns: ["mangans", "mangan auto"],
    category: "Repairs and Maintenance",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Vehicle repair/service. VAT deductible under Section 59.",
    sector: "motor",
  },

  // ────────────────────────────────────────────────────────────
  // OFFICE/PRINTING (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Printing Services",
    patterns: ["nya*print", "print copy", "printing"],
    category: "Office",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Printing/office services. VAT deductible under Section 59.",
    sector: "office",
  },
  // NEW: Additional office
  {
    name: "Viking Direct",
    patterns: ["viking direct", "viking office"],
    category: "Office",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Office supplies. VAT deductible under Section 59.",
    sector: "office",
  },
  {
    name: "Staples",
    patterns: ["staples"],
    category: "Office",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Office supplies. VAT deductible under Section 59.",
    sector: "office",
  },

  // ────────────────────────────────────────────────────────────
  // PHONE/COMMUNICATIONS (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Mobile Operators",
    patterns: ["three ireland", "vodafone", "eir mobile", "eir broadband", "eir bill", "eir.ie", "eir account", "48", "gomo", "tesco mobile"],
    category: "Phone",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Phone/communications for business. VAT deductible under Section 59.",
    sector: "telecoms",
  },
  // NEW: Additional telecoms
  {
    name: "Lycamobile / iD Mobile",
    patterns: ["lycamobile", "id mobile"],
    category: "Phone",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Mobile phone service. VAT deductible under Section 59.",
    sector: "telecoms",
  },

  // ────────────────────────────────────────────────────────────
  // BUSINESS INSURANCE (Exempt)
  // ────────────────────────────────────────────────────────────
  {
    name: "Business Insurance",
    patterns: ["axa", "allianz", "fbd", "liberty insurance"],
    category: "Insurance",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Business insurance premium. VAT exempt - no VAT to claim.",
    sector: "insurance",
  },
  // NEW: Additional insurers
  {
    name: "Zurich Insurance",
    patterns: ["zurich insurance", "zurich general"],
    category: "Insurance",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Business insurance premium. VAT exempt.",
    sector: "insurance",
  },
  {
    name: "Aviva Insurance",
    patterns: ["aviva insurance", "aviva general"],
    category: "Insurance",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Business insurance premium. VAT exempt.",
    sector: "insurance",
  },
  {
    name: "RSA Insurance",
    patterns: ["rsa insurance", "rsa ireland"],
    category: "Insurance",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Business insurance premium. VAT exempt.",
    sector: "insurance",
  },
  {
    name: "Chubb Insurance",
    patterns: ["chubb"],
    category: "Insurance",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Business insurance premium. VAT exempt.",
    sector: "insurance",
  },

  // ────────────────────────────────────────────────────────────
  // HEALTH INSURANCE (Exempt — Form 11 relief: health_insurance)
  // ────────────────────────────────────────────────────────────
  {
    name: "Health Insurance",
    patterns: ["vhi", "laya healthcare", "laya health", "irish life health", "glo health"],
    category: "Medical",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "health_insurance",
    purpose: "Health insurance premium. Tax relief at source (TRS). Section 470 TCA 1997.",
    sector: "health",
  },

  // ────────────────────────────────────────────────────────────
  // PHARMACY / CHEMIST (Form 11 relief: medical @ 20% Section 469)
  // ────────────────────────────────────────────────────────────
  {
    name: "Pharmacy / Chemist",
    patterns: ["pharmacy", "chemist", "boots", "lloyds pharmacy", "mccabes", "hickeys", "sam mccauley", "cara pharmacy", "totalhealth", "allcare"],
    category: "Medical",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "medical",
    purpose: "Pharmacy/prescription expense. Eligible for 20% tax relief under Section 469 TCA 1997.",
    sector: "health",
  },

  // ────────────────────────────────────────────────────────────
  // MEDICAL (non-routine) (Form 11 relief: medical @ 20%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Medical / Hospital",
    patterns: ["physio", "physiotherapy", "dental surgery", "orthodont", "oral surgery", "hospital", "consultant", "surgeon", "dermatolog", "fertility", "ivf", "mater private", "blackrock clinic", "beacon hospital", "st vincent", "galway clinic", "bon secours"],
    category: "Medical",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "medical",
    purpose: "Non-routine medical expense. Eligible for 20% tax relief under Section 469 TCA 1997.",
    sector: "health",
  },
  // NEW: Additional medical
  {
    name: "Specsavers / Vision Express",
    patterns: ["specsavers", "vision express"],
    category: "Medical",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "medical",
    purpose: "Optician services. Eligible for 20% tax relief under Section 469 TCA 1997.",
    sector: "health",
  },
  {
    name: "Dental Practices",
    patterns: ["dental", "dentist", "dental care", "dental clinic"],
    category: "Medical",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "medical",
    purpose: "Dental expense. Eligible for 20% tax relief under Section 469 TCA 1997.",
    sector: "health",
  },
  {
    name: "Smiles Dental",
    patterns: ["smiles dental"],
    category: "Medical",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "medical",
    purpose: "Dental chain. Eligible for 20% tax relief under Section 469 TCA 1997.",
    sector: "health",
  },
  {
    name: "GP / Doctor",
    patterns: ["medical centre", "health centre", "gp surgery", "doctor", "dr "],
    category: "Medical",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "medical",
    purpose: "GP/doctor visit. Eligible for 20% tax relief under Section 469 TCA 1997.",
    sector: "health",
  },

  // ────────────────────────────────────────────────────────────
  // PENSION FUNDS (Form 11 relief: pension)
  // ────────────────────────────────────────────────────────────
  {
    name: "Pension Providers",
    patterns: ["irish life pension", "zurich pension", "aviva pension", "new ireland", "standard life"],
    category: "Insurance",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "pension",
    purpose: "Pension contribution. Tax relief at marginal rate. Section 774 TCA 1997.",
    sector: "finance",
  },

  // ────────────────────────────────────────────────────────────
  // CHARITABLE DONATIONS (Form 11 relief: charitable)
  // ────────────────────────────────────────────────────────────
  {
    name: "Charities",
    patterns: ["trocaire", "concern worldwide", "goal", "svp", "st vincent de paul", "unicef ireland", "irish cancer society", "pieta house", "barnardos"],
    category: "other",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "charitable",
    purpose: "Charitable donation. Tax relief under Section 848A TCA 1997 (min €250).",
    sector: "charity",
  },
  // NEW: Additional charities
  {
    name: "Additional Charities",
    patterns: ["oxfam", "amnesty", "irish heart", "irish red cross", "irish guide dogs", "focus ireland", "simon community", "alone", "temple street", "crumlin hospital"],
    category: "other",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "charitable",
    purpose: "Charitable donation. Tax relief under Section 848A TCA 1997 (min €250).",
    sector: "charity",
  },

  // ────────────────────────────────────────────────────────────
  // ACCOUNTING (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Accounting / Tax Services",
    patterns: ["accountant", "accounting", "tax return", "vat return"],
    category: "Consulting & Accounting",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Accounting/tax services. VAT deductible under Section 59.",
    sector: "professional",
  },
  // NEW: Additional professional services
  {
    name: "Solicitor / Legal",
    patterns: ["solicitor", "solicitors", "legal fee", "law firm", "barrister"],
    category: "Consulting & Accounting",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Legal/professional services. VAT deductible under Section 59.",
    sector: "professional",
  },
  {
    name: "Architects / Engineers",
    patterns: ["architect", "engineering consultants", "quantity surveyor", "surveyor"],
    category: "Consulting & Accounting",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Professional services. VAT deductible under Section 59.",
    sector: "professional",
  },

  // ────────────────────────────────────────────────────────────
  // WORKWEAR (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Workwear / PPE",
    patterns: ["workwear", "work clothes", "hi-vis", "safety boots", "ppe"],
    category: "Workwear",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Workwear/PPE for business. VAT deductible under Section 59.",
    sector: "trade",
  },

  // ────────────────────────────────────────────────────────────
  // ADVERTISING (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Advertising Platforms",
    patterns: ["facebook ads", "google ads", "instagram", "linkedin", "vistaprint", "advertising"],
    category: "Advertising",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Advertising expense. VAT deductible under Section 59.",
    sector: "marketing",
  },
  // NEW: Additional advertising
  {
    name: "TikTok / Pinterest Ads",
    patterns: ["tiktok ads", "pinterest ads", "twitter ads", "x ads"],
    category: "Advertising",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Social media advertising. VAT deductible under Section 59.",
    sector: "marketing",
  },
  {
    name: "Golden Pages / Yell",
    patterns: ["golden pages", "yell.com", "yell ireland"],
    category: "Advertising",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Business directory advertising. VAT deductible under Section 59.",
    sector: "marketing",
  },

  // ────────────────────────────────────────────────────────────
  // BROADBAND/INTERNET PROVIDERS (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Broadband Providers",
    patterns: ["virgin media", "sky ireland", "pure telecom", "digiweb", "imagine broadband"],
    category: "Phone",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Broadband/internet service. Business portion VAT deductible under Section 59.",
    sector: "telecoms",
  },
  // NEW: Additional broadband
  {
    name: "SIRO / National Broadband",
    patterns: ["siro", "national broadband", "nbi"],
    category: "Phone",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Broadband service. Business portion VAT deductible under Section 59.",
    sector: "telecoms",
  },

  // ────────────────────────────────────────────────────────────
  // PROFESSIONAL BODY MEMBERSHIPS (Allowable expense)
  // ────────────────────────────────────────────────────────────
  {
    name: "Professional Bodies",
    patterns: ["cif", "engineers ireland", "law society", "cpa ireland", "acca", "chartered accountants", "riai", "reci", "cro annual return"],
    category: "Consulting & Accounting",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Professional body membership/registration. Allowable business expense.",
    sector: "professional",
  },

  // ────────────────────────────────────────────────────────────
  // TRAINING & CERTIFICATION (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Training / Certification",
    patterns: ["safe pass", "solas", "cscs card", "qqi", "city & guilds", "fetac", "manual handling", "first aid course", "iosh", "citb"],
    category: "Training",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTradeSupplier: true,
    purpose: "Training/certification for business. VAT deductible under Section 59.",
    sector: "training",
  },
  {
    name: "EHS International",
    patterns: ["ehs international", "ehs intl"],
    category: "Training",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTradeSupplier: true,
    purpose: "Safe Pass / health & safety training and certification. VAT deductible under Section 59.",
    sector: "training",
  },

  // ────────────────────────────────────────────────────────────
  // MOTOR TAX & VEHICLE ADMIN (Exempt)
  // ────────────────────────────────────────────────────────────
  {
    name: "Motor Tax",
    patterns: ["motor tax", "dublin city", "motor tax online", "motortax"],
    category: "Motor Vehicle Expenses",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Motor tax for business vehicle. Exempt from VAT. Allowable business expense.",
    sector: "motor",
  },

  // ────────────────────────────────────────────────────────────
  // SCRAP / VEHICLE PARTS (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Vehicle Parts / Scrap",
    patterns: ["car dismantlers", "kilcock car", "scrap yard", "breakers yard", "auto parts", "car parts"],
    category: "Motor/travel",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Vehicle parts/scrap for business vehicle. VAT deductible under Section 59.",
    sector: "motor",
  },

  // ────────────────────────────────────────────────────────────
  // FLOORING / MATERIALS SUPPLIERS (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Havwoods",
    patterns: ["havwoods", "havwood"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTradeSupplier: true,
    purpose: "Flooring materials supplier. VAT deductible under Section 59.",
    sector: "trade",
  },
  {
    name: "TJ O'Mahony",
    patterns: ["tj o'mahony", "tj omahony", "tj o mahony", "o'mahony", "omahony", "tj o'mahoney", "tj omahoney", "tj o mahoney", "o'mahoney", "omahoney builders"],
    category: "Materials",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTradeSupplier: true,
    purpose: "Building materials supplier. VAT deductible under Section 59.",
    sector: "trade",
  },

  // ────────────────────────────────────────────────────────────
  // CONFERENCES (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Conferences / Events",
    patterns: ["startupnetwork", "startup network", "conference", "summit", "expo", "convention"],
    category: "Training",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Business conference/networking event. VAT deductible under Section 59.",
    sector: "training",
  },

  // ────────────────────────────────────────────────────────────
  // BRANDING / LOGO (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Branding / Design",
    patterns: ["looka", "logo maker", "logo design", "brand design", "fiverr", "99designs"],
    category: "Marketing",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Company branding/logo design. VAT deductible under Section 59.",
    sector: "marketing",
  },

  // ────────────────────────────────────────────────────────────
  // WASTE DISPOSAL (VAT Deductible @ 23%)
  // ────────────────────────────────────────────────────────────
  {
    name: "Waste Disposal",
    patterns: ["barna recycling", "greenstar", "panda waste", "panda", "thorntons recycling", "country clean", "oxigen", "skip hire", "greyhound recycling"],
    category: "Waste",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTradeSupplier: true,
    purpose: "Waste disposal/skip hire. VAT deductible under Section 59.",
    sector: "waste",
  },
  // NEW: Additional waste
  {
    name: "City Bin / KeyWaste",
    patterns: ["city bin", "keywaste", "key waste"],
    category: "Waste",
    vat_type: "Standard 23%",
    vat_deductible: true,
    isTradeSupplier: true,
    purpose: "Waste collection. VAT deductible under Section 59.",
    sector: "waste",
  },

  // ────────────────────────────────────────────────────────────
  // TUITION FEES (Form 11 relief: tuition)
  // ────────────────────────────────────────────────────────────
  {
    name: "Universities / Colleges",
    patterns: ["ucd", "tcd", "trinity college", "dcu", "nuig", "university of galway", "ucc", "maynooth university", "tu dublin", "technological university", "griffith college", "ncad", "rcsi", "dit", "athlone it", "waterford it", "letterkenny it", "sligo it", "carlow it", "dundalk it", "limerick it"],
    category: "other",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "tuition",
    purpose: "Tuition fees. 20% tax relief on qualifying fees over EUR 3,000. Section 473A TCA 1997.",
    sector: "education",
  },
  // NEW: Additional education
  {
    name: "Technological Universities",
    patterns: ["atu", "mtu", "setu", "tus"],
    category: "other",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "tuition",
    purpose: "Tuition fees. 20% tax relief on qualifying fees over EUR 3,000. Section 473A TCA 1997.",
    sector: "education",
  },

  // ────────────────────────────────────────────────────────────
  // RENT (PERSONAL) (Form 11 relief: rent tax credit)
  // ────────────────────────────────────────────────────────────
  {
    name: "Rent Payments",
    patterns: ["rent payment", "monthly rent", "residential tenancies", "rtb registration"],
    category: "Rent",
    vat_type: "Exempt",
    vat_deductible: false,
    relief_type: "rent",
    purpose: "Rent payment. Rent tax credit up to EUR 750 (single) / EUR 1,500 (couple). Section 473B TCA 1997.",
    sector: "property",
  },

  // ────────────────────────────────────────────────────────────
  // INVESTMENT / BROKERAGE (CGT flag)
  // ────────────────────────────────────────────────────────────
  {
    name: "Investment Platforms",
    patterns: ["degiro", "interactive brokers", "trading 212", "etoro", "revolut trading", "ibkr"],
    category: "other",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Investment/brokerage platform. Review for CGT reporting in Form 11 Section 7.",
    sector: "finance",
  },

  // ────────────────────────────────────────────────────────────
  // IRISH UTILITIES / SERVICES (NEW)
  // ────────────────────────────────────────────────────────────
  {
    name: "ESB / Electric Ireland",
    patterns: ["esb", "electric ireland", "esb networks"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: true,
    needs_receipt: true,
    purpose: "Electricity supply. Business portion VAT deductible under Section 59.",
    sector: "utilities",
  },
  {
    name: "Bord Gais / Gas Networks",
    patterns: ["bord gais", "bord gáis", "gas networks", "flogas", "calor gas"],
    category: "General Expenses",
    vat_type: "Reduced 13.5%",
    vat_deductible: true,
    needs_receipt: true,
    purpose: "Gas supply. Business portion VAT deductible under Section 59.",
    sector: "utilities",
  },
  {
    name: "Irish Water",
    patterns: ["irish water", "uisce eireann", "uisce éireann"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Water supply. Business portion VAT deductible under Section 59.",
    sector: "utilities",
  },
  {
    name: "An Post",
    patterns: ["an post", "anpost", "post office"],
    category: "Office",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Postal services. VAT deductible under Section 59.",
    sector: "utilities",
  },
  {
    name: "SSE Airtricity",
    patterns: ["sse airtricity", "airtricity"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: true,
    needs_receipt: true,
    purpose: "Electricity/gas supply. Business portion VAT deductible under Section 59.",
    sector: "utilities",
  },
  {
    name: "Panda Power / Pinergy",
    patterns: ["panda power", "pinergy", "energia"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: true,
    needs_receipt: true,
    purpose: "Energy supply. Business portion VAT deductible under Section 59.",
    sector: "utilities",
  },
  {
    name: "DHL / Fastway / Courier",
    patterns: ["dhl", "fastway", "dpd", "gls", "fedex", "ups", "parcel motel"],
    category: "Office",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Courier/delivery service. VAT deductible under Section 59.",
    sector: "logistics",
  },

  // ────────────────────────────────────────────────────────────
  // IRISH GOVERNMENT / REGULATORY (NEW)
  // ────────────────────────────────────────────────────────────
  {
    name: "Companies Registration Office",
    patterns: ["cro", "companies registration", "company registration"],
    category: "Consulting & Accounting",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Company registration/annual return filing. Allowable business expense.",
    sector: "government",
  },
  {
    name: "NSAI",
    patterns: ["nsai", "national standards authority"],
    category: "Consulting & Accounting",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Standards certification. Allowable business expense.",
    sector: "government",
  },
  {
    name: "HSA",
    patterns: ["health and safety authority", "hsa fee"],
    category: "Training",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Health & Safety Authority fee. Allowable business expense.",
    sector: "government",
  },
  {
    name: "SEAI",
    patterns: ["seai", "sustainable energy authority"],
    category: "Training",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "SEAI registration/BER certification. Allowable business expense.",
    sector: "government",
  },
  {
    name: "Local Authority / County Council",
    patterns: ["county council", "city council", "local authority", "planning permission", "comhairle"],
    category: "Consulting & Accounting",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Local authority fees/charges. Allowable business expense.",
    sector: "government",
  },

  // ────────────────────────────────────────────────────────────
  // IRISH TRANSPORT (NEW)
  // ────────────────────────────────────────────────────────────
  {
    name: "Bus Eireann",
    patterns: ["bus eireann", "bus éireann", "buseireann"],
    category: "Motor/travel",
    vat_type: "Zero",
    vat_deductible: true,
    purpose: "Public transport. Zero-rated.",
    sector: "transport",
  },
  {
    name: "Dublin Bus / Go-Ahead",
    patterns: ["dublin bus", "go-ahead ireland", "go ahead"],
    category: "Motor/travel",
    vat_type: "Zero",
    vat_deductible: true,
    purpose: "Public transport. Zero-rated.",
    sector: "transport",
  },
  {
    name: "Luas",
    patterns: ["luas", "transdev"],
    category: "Motor/travel",
    vat_type: "Zero",
    vat_deductible: true,
    purpose: "Luas tram service. Zero-rated public transport.",
    sector: "transport",
  },
  {
    name: "Irish Rail / Iarnrod Eireann",
    patterns: ["iarnrod eireann", "iarnród éireann", "irish rail", "dart"],
    category: "Motor/travel",
    vat_type: "Zero",
    vat_deductible: true,
    purpose: "Train service. Zero-rated public transport.",
    sector: "transport",
  },
  {
    name: "Ryanair",
    patterns: ["ryanair"],
    category: "Travel & Subsistence",
    vat_type: "Zero",
    vat_deductible: true,
    purpose: "Flight booking. Zero-rated international transport.",
    sector: "transport",
  },
  {
    name: "Aer Lingus",
    patterns: ["aer lingus", "aerlingus"],
    category: "Travel & Subsistence",
    vat_type: "Zero",
    vat_deductible: true,
    purpose: "Flight booking. Zero-rated international transport.",
    sector: "transport",
  },
  {
    name: "Leap Card",
    patterns: ["leap card", "leap top", "tfi leap"],
    category: "Motor/travel",
    vat_type: "Zero",
    vat_deductible: true,
    purpose: "Public transport top-up. Zero-rated.",
    sector: "transport",
  },
  {
    name: "Enterprise Car Hire",
    patterns: ["enterprise rent", "hertz", "europcar", "sixt", "avis", "budget car"],
    category: "Motor/travel",
    vat_type: "Standard 23%",
    vat_deductible: true,
    needs_receipt: true,
    purpose: "Vehicle rental for business. VAT deductible under Section 59.",
    sector: "transport",
  },

  // ────────────────────────────────────────────────────────────
  // PAYMENT PROCESSORS (NEW)
  // ────────────────────────────────────────────────────────────
  {
    name: "PayPal",
    patterns: ["paypal"],
    category: "Bank fees",
    vat_type: "Exempt",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Payment processor. Review: could be fee or purchase. Financial services are VAT exempt.",
    isTechSupplier: true,
    sector: "payments",
  },
  {
    name: "Wise (TransferWise)",
    patterns: ["wise", "transferwise", "wise.com"],
    category: "Bank fees",
    vat_type: "Exempt",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Money transfer service. Financial services are VAT exempt.",
    isTechSupplier: true,
    sector: "payments",
  },
  {
    name: "Revolut Transfer",
    patterns: ["revolut transfer", "revolut payment", "revolut to"],
    category: "Internal Transfer",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Revolut transfer. Review if internal transfer or payment.",
    isTechSupplier: true,
    sector: "payments",
  },
  {
    name: "SumUp",
    patterns: ["sumup", "sum up"],
    category: "Bank fees",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Card payment terminal fees. Financial services are VAT exempt.",
    isTechSupplier: true,
    sector: "payments",
  },
  {
    name: "Square",
    patterns: ["square", "sq *"],
    category: "Bank fees",
    vat_type: "Exempt",
    vat_deductible: false,
    purpose: "Card payment processing fees. Financial services are VAT exempt.",
    isTechSupplier: true,
    sector: "payments",
  },

  // ────────────────────────────────────────────────────────────
  // CLEANING / FACILITY SERVICES (NEW)
  // ────────────────────────────────────────────────────────────
  {
    name: "Cleaning Services",
    patterns: ["cleaning service", "commercial cleaning", "office cleaning", "janitor"],
    category: "Cleaning",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Cleaning services. VAT deductible under Section 59.",
    sector: "services",
  },

  // ────────────────────────────────────────────────────────────
  // STATIONERY / PRINTING (NEW)
  // ────────────────────────────────────────────────────────────
  {
    name: "Reads / Eason",
    patterns: ["reads", "eason", "easons"],
    category: "Office",
    vat_type: "Standard 23%",
    vat_deductible: true,
    needs_receipt: true,
    purpose: "Stationery/books. VAT deductible if for business use.",
    sector: "office",
  },

  // ────────────────────────────────────────────────────────────
  // SECURITY (NEW)
  // ────────────────────────────────────────────────────────────
  {
    name: "Security Services",
    patterns: ["chubb security", "securitas", "g4s", "manguard", "security alarm"],
    category: "General Expenses",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Security services/alarm monitoring. VAT deductible under Section 59.",
    sector: "services",
  },

  // ────────────────────────────────────────────────────────────
  // CAR DEALERS / LEASING (NEW)
  // ────────────────────────────────────────────────────────────
  {
    name: "Car Dealers",
    patterns: ["joe duffy", "windsor motor", "spirit motor", "msl motor", "frank keane"],
    category: "Motor Vehicle Expenses",
    vat_type: "Standard 23%",
    vat_deductible: false,
    needs_receipt: true,
    purpose: "Vehicle dealer. Review: purchase vs servicing. Note: VAT on vehicle purchase not deductible for most businesses.",
    sector: "motor",
  },
  {
    name: "Vehicle Leasing",
    patterns: ["ayvens", "leasplan", "ald automotive", "arval", "vehicle leasing"],
    category: "Motor Vehicle Expenses",
    vat_type: "Standard 23%",
    vat_deductible: true,
    purpose: "Vehicle leasing. VAT deductible (up to limits) for business vehicles.",
    sector: "motor",
  },
];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Count total unique patterns across all vendors */
export function getTotalPatternCount(): number {
  return vendorDatabase.reduce((sum, v) => sum + v.patterns.length, 0);
}

/** Get all unique categories used in the database */
export function getUsedCategories(): string[] {
  return [...new Set(vendorDatabase.map(v => v.category))];
}

/** Get all vendors for a given sector */
export function getVendorsBySector(sector: string): VendorEntry[] {
  return vendorDatabase.filter(v => v.sector === sector);
}

/** Validate that all vendor entries have required fields */
export function validateVendorDatabase(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const vendor of vendorDatabase) {
    if (!vendor.name) errors.push(`Missing name for vendor`);
    if (!vendor.patterns || vendor.patterns.length === 0) errors.push(`${vendor.name}: no patterns`);
    if (!vendor.category) errors.push(`${vendor.name}: no category`);
    if (!vendor.vat_type) errors.push(`${vendor.name}: no vat_type`);
    if (!vendor.purpose) errors.push(`${vendor.name}: no purpose`);

    // All patterns must be lowercase
    for (const p of vendor.patterns) {
      if (p !== p.toLowerCase()) {
        errors.push(`${vendor.name}: pattern "${p}" is not lowercase`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
