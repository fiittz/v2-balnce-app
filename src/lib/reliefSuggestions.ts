/**
 * Relief Suggestions Engine — proactively suggests tax reliefs
 * based on the user's industry, marital status, and existing claims.
 *
 * Pure TypeScript, no React dependencies.
 */

import type { IndustryGroup } from "@/lib/industryGroups";

// ── Types ────────────────────────────────────────────────────

export type TaxBenefit = "company" | "personal" | "both";

export interface ReliefSuggestion {
  id: string;
  title: string;
  description: string;
  taxBenefit: TaxBenefit;
  industries: IndustryGroup[] | "all";
  condition?: (ctx: SuggestionContext) => boolean;
}

export interface SuggestionContext {
  industryGroup: IndustryGroup;
  maritalStatus: "single" | "married" | "separated" | "widowed";
  hasBIK: boolean;
  hasPension: boolean;
  salary: number;
  isVATRegistered: boolean;
  isRCTRegistered: boolean;
  companyAgeYears: number;
  detectedReliefs: string[];
}

export interface FilteredSuggestions {
  company: ReliefSuggestion[];
  personal: ReliefSuggestion[];
}

// ── Master relief list ───────────────────────────────────────

export const RELIEF_SUGGESTIONS: ReliefSuggestion[] = [
  // ── Company (CT1) — 10 reliefs ─────────────────────────────

  {
    id: "rd_tax_credit",
    title: "R&D Tax Credit (S.766)",
    description: "30% credit on qualifying R&D expenditure — can generate a cash refund even if no CT liability.",
    taxBenefit: "company",
    industries: ["technology", "software_dev", "manufacturing", "health"],
  },
  {
    id: "knowledge_dev_box",
    title: "Knowledge Development Box",
    description: "10% CT rate on qualifying IP income instead of standard 12.5%.",
    taxBenefit: "company",
    industries: ["technology", "software_dev", "manufacturing"],
  },
  {
    id: "startup_relief",
    title: "Start-Up Relief (S.486C)",
    description: "CT exemption for the first 5 years if CT liability is under €40,000 per year.",
    taxBenefit: "company",
    industries: "all",
    condition: (ctx) => ctx.companyAgeYears <= 5,
  },
  {
    id: "capital_allowances",
    title: "Capital Allowances",
    description: "12.5% annual write-down on plant & machinery over 8 years — reduces taxable profit.",
    taxBenefit: "company",
    industries: "all",
  },
  {
    id: "accelerated_capital_allowances",
    title: "Accelerated Capital Allowances",
    description: "100% year-1 write-off for energy-efficient equipment — immediate tax deduction.",
    taxBenefit: "company",
    industries: ["construction", "manufacturing", "transport", "hospitality", "retail"],
  },
  {
    id: "loss_relief",
    title: "Loss Relief (S.396)",
    description: "Carry forward trading losses indefinitely to offset future profits.",
    taxBenefit: "company",
    industries: "all",
  },
  {
    id: "training_costs",
    title: "Training Costs",
    description: "Staff training and upskilling costs are fully deductible as a trading expense.",
    taxBenefit: "company",
    industries: "all",
  },
  {
    id: "employer_pension",
    title: "Employer Pension Contribution",
    description: "100% deductible for the company, no BIK for the recipient — the most tax-efficient way to extract profit.",
    taxBenefit: "company",
    industries: "all",
    condition: (ctx) => !ctx.hasPension,
  },
  {
    id: "eii_scheme",
    title: "EII Scheme (Employment & Investment Incentive)",
    description: "Raise equity with 40% income tax relief for investors — no cost to the company.",
    taxBenefit: "company",
    industries: "all",
  },
  {
    id: "company_donations",
    title: "Company Donations (S.848A)",
    description: "Donations of €250+ to approved charities are deductible as a trading expense.",
    taxBenefit: "company",
    industries: "all",
  },

  // ── Personal (Form 11) — 10 reliefs ────────────────────────

  {
    id: "personal_pension",
    title: "Personal Pension Contributions",
    description: "Marginal rate relief (40%) on contributions — age-based limits from 15% to 40% of earnings.",
    taxBenefit: "personal",
    industries: "all",
    condition: (ctx) => !ctx.hasPension,
  },
  {
    id: "medical_expenses",
    title: "Medical Expenses (S.469)",
    description: "20% tax credit on qualifying non-routine medical expenses — keep all receipts.",
    taxBenefit: "personal",
    industries: "all",
    condition: (ctx) => !ctx.detectedReliefs.includes("medical"),
  },
  {
    id: "health_insurance",
    title: "Health Insurance (S.470)",
    description: "20% tax credit on health insurance premiums — applied at source by most providers.",
    taxBenefit: "personal",
    industries: "all",
    condition: (ctx) => !ctx.detectedReliefs.includes("healthInsurance"),
  },
  {
    id: "rent_tax_credit",
    title: "Rent Tax Credit (S.473B)",
    description: "€1,000 single / €2,000 couple per year for qualifying rent payments.",
    taxBenefit: "personal",
    industries: "all",
    condition: (ctx) => !ctx.detectedReliefs.includes("rent"),
  },
  {
    id: "remote_working",
    title: "Remote Working Relief",
    description: "30% of heat, light, and broadband costs for days worked from home.",
    taxBenefit: "personal",
    industries: "all",
    condition: (ctx) => !ctx.detectedReliefs.includes("remoteWorking"),
  },
  {
    id: "tuition_fees",
    title: "Tuition Fees (S.473A)",
    description: "20% relief on qualifying tuition fees over the €3,000 disregard amount.",
    taxBenefit: "personal",
    industries: "all",
    condition: (ctx) => !ctx.detectedReliefs.includes("tuition"),
  },
  {
    id: "home_carer",
    title: "Home Carer Credit",
    description: "€1,950 tax credit where one spouse works in the home caring for a dependant.",
    taxBenefit: "personal",
    industries: "all",
    condition: (ctx) => ctx.maritalStatus === "married" && !ctx.detectedReliefs.includes("homeCarer"),
  },
  {
    id: "flat_rate_expenses",
    title: "Flat Rate Expenses",
    description: "Revenue-approved trade-specific deduction — no receipts needed. Check Revenue's list for your trade.",
    taxBenefit: "personal",
    industries: ["construction", "manufacturing", "health", "transport"],
  },
  {
    id: "mileage_subsistence",
    title: "Mileage & Subsistence",
    description: "Revenue civil service rates for business travel — mileage, overnight, and day subsistence allowances.",
    taxBenefit: "personal",
    industries: "all",
  },
  {
    id: "charitable_donations",
    title: "Charitable Donations",
    description: "Donations of €250+ to approved charities — the charity claims the tax back on your behalf.",
    taxBenefit: "personal",
    industries: "all",
    condition: (ctx) => !ctx.detectedReliefs.includes("charitable"),
  },

  // ── Both (company + personal) — 4 reliefs ──────────────────

  {
    id: "small_benefit_exemption",
    title: "Small Benefit Exemption",
    description: "Up to 5 non-cash vouchers/year, max €1,500 total — tax-free for director, deductible for company.",
    taxBenefit: "both",
    industries: "all",
  },
  {
    id: "ev_bik_exemption",
    title: "EV BIK Exemption",
    description: "€35,000 OMV reduction for BIK calculation on electric vehicles (2025).",
    taxBenefit: "both",
    industries: "all",
    condition: (ctx) => ctx.hasBIK,
  },
  {
    id: "ev_charging_point",
    title: "EV Charging Point",
    description: "No BIK on employer-provided home charging point for electric vehicles.",
    taxBenefit: "both",
    industries: "all",
    condition: (ctx) => ctx.hasBIK,
  },
  {
    id: "employer_pension_both",
    title: "Employer Pension (Both Sides)",
    description: "Company deducts 100% of contribution, director pays zero BIK — the optimal extraction strategy.",
    taxBenefit: "both",
    industries: "all",
    condition: (ctx) => !ctx.hasPension,
  },
];

// ── Filtering logic ──────────────────────────────────────────

export function getReliefSuggestions(context: SuggestionContext): FilteredSuggestions {
  const matching = RELIEF_SUGGESTIONS.filter((s) => {
    // Filter by industry
    if (s.industries !== "all" && !s.industries.includes(context.industryGroup)) {
      return false;
    }
    // Filter by condition
    if (s.condition && !s.condition(context)) {
      return false;
    }
    return true;
  });

  return {
    company: matching.filter((s) => s.taxBenefit === "company" || s.taxBenefit === "both"),
    personal: matching.filter((s) => s.taxBenefit === "personal" || s.taxBenefit === "both"),
  };
}
