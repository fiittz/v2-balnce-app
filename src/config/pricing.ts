export interface PricingFeature {
  text: string;
  included: boolean;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string;
  tagline: string;
  transactionLimit: number | null; // null = unlimited
  transactionLimitPeriod: "year" | "month" | null;
  receiptScansPerMonth: number | null; // null = unlimited
  maxUsers: number | null; // null = unlimited
  features: PricingFeature[];
  idealFor: string[];
  highlighted: boolean;
  variant: "default" | "highlighted" | "premium";
}

export interface UsageTrigger {
  threshold: number;
  type: "warning" | "block";
  message: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    currency: "€",
    period: "month",
    tagline: "For sole traders and low-volume self-employed users.",
    transactionLimit: 150,
    transactionLimitPeriod: "year",
    receiptScansPerMonth: 10,
    maxUsers: 1,
    features: [
      { text: "Unlimited invoices", included: true },
      { text: "Unlimited quotes/estimates", included: true },
      { text: "Up to 150 transactions per year", included: true },
      { text: "Basic categorisation", included: true },
      { text: "VAT calculations", included: true },
      { text: "10 receipt scans per month", included: true },
      { text: "Simple dashboard", included: true },
      { text: "Export to PDF/CSV", included: true },
      { text: "Email support", included: true },
      { text: "Single user", included: true },
    ],
    idealFor: [
      "New sole traders",
      "Side-hustlers",
      "Low-volume subcontractors",
      "Users who want clean books without automation",
    ],
    highlighted: false,
    variant: "default",
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    currency: "€",
    period: "month",
    tagline: "Your best value plan — bookkeeping automation for real businesses.",
    transactionLimit: 700,
    transactionLimitPeriod: "year",
    receiptScansPerMonth: null, // unlimited
    maxUsers: 3,
    features: [
      { text: "Everything in Starter, plus:", included: true },
      { text: "Up to 700 transactions per year", included: true },
      { text: "Smart auto-categorisation (AI)", included: true },
      { text: "Unlimited receipt scanning", included: true },
      { text: "Bank feeds + automatic matching", included: true },
      { text: "Industry-specific VAT rules", included: true },
      { text: "RCT automation", included: true },
      { text: "Reverse-charge logic", included: true },
      { text: "Multi-rate invoices", included: true },
      { text: "Light project & job tagging", included: true },
      { text: "Priority support", included: true },
      { text: "Up to 3 users", included: true },
    ],
    idealFor: [
      "Tradespeople",
      "Contractors",
      "Small LTDs",
      "Growing businesses",
      "Anyone who wants automation without paying for a full bookkeeper",
    ],
    highlighted: true,
    variant: "highlighted",
  },
  {
    id: "ultimate",
    name: "Ultimate",
    price: 99,
    currency: "€",
    period: "month",
    tagline: "For high-volume businesses, contractors with staff, or LTDs needing full finance automation.",
    transactionLimit: null, // unlimited
    transactionLimitPeriod: null,
    receiptScansPerMonth: null, // unlimited
    maxUsers: null, // unlimited
    features: [
      { text: "Everything in Pro, plus:", included: true },
      { text: "Unlimited transactions", included: true },
      { text: "Accountant portal access", included: true },
      { text: "Payroll import + payslip matching", included: true },
      { text: "VAT & RCT filing assistant", included: true },
      { text: "Forecasting & insights", included: true },
      { text: "Advanced job costing", included: true },
      { text: "Unlimited users", included: true },
      { text: "Priority onboarding", included: true },
      { text: "Full audit trail", included: true },
      { text: "Monthly data snapshots/backups", included: true },
      { text: "Premium support (same-day)", included: true },
    ],
    idealFor: [
      "Busy LTDs",
      "Contractors with subcontractors or staff",
      "High-volume retailers",
      "Growing SMEs",
      "Businesses that want zero manual bookkeeping",
    ],
    highlighted: false,
    variant: "premium",
  },
];

// Transaction types that count towards the limit
export const COUNTABLE_TRANSACTION_TYPES = [
  "bank_transaction",
  "logged_expense",
  "expense_receipt",
  "issued_invoice",
  "invoice_payment",
  "journal_entry",
] as const;

// Usage triggers for Pro plan
export const PRO_USAGE_TRIGGERS: UsageTrigger[] = [
  {
    threshold: 650,
    type: "warning",
    message: "You're nearing your yearly limit — upgrade to Ultimate for unlimited transactions.",
  },
  {
    threshold: 700,
    type: "block",
    message: "You've reached your yearly transaction limit. Upgrade to Ultimate to continue adding transactions.",
  },
];

// Expected customer distribution
export const EXPECTED_CUSTOMER_SPLIT = {
  starter: 0.2, // 20%
  pro: 0.6, // 60% - Core revenue driver
  ultimate: 0.2, // 20%
};

// Helper functions
export const getPlanById = (id: string): PricingPlan | undefined => {
  return PRICING_PLANS.find((plan) => plan.id === id);
};

export const getHighlightedPlan = (): PricingPlan | undefined => {
  return PRICING_PLANS.find((plan) => plan.highlighted);
};

export const formatPrice = (plan: PricingPlan): string => {
  return `${plan.currency}${plan.price}/${plan.period}`;
};

export const getTransactionLimitDisplay = (plan: PricingPlan): string => {
  if (plan.transactionLimit === null) {
    return "Unlimited";
  }
  return `${plan.transactionLimit} per ${plan.transactionLimitPeriod}`;
};

export const getUserLimitDisplay = (plan: PricingPlan): string => {
  if (plan.maxUsers === null) {
    return "Unlimited users";
  }
  if (plan.maxUsers === 1) {
    return "Single user";
  }
  return `Up to ${plan.maxUsers} users`;
};

export const getReceiptScansDisplay = (plan: PricingPlan): string => {
  if (plan.receiptScansPerMonth === null) {
    return "Unlimited";
  }
  return `${plan.receiptScansPerMonth} per month`;
};
