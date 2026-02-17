/**
 * VAT Deductibility Helper
 * Applies Irish VAT Section 59/60 rules to determine if VAT is recoverable
 */

import { DISALLOWED_VAT_CREDITS, ALLOWED_VAT_CREDITS } from "./irishVatRules";

export interface VATDeductibilityResult {
  isDeductible: boolean;
  reason: string;
  section?: string;
}

/**
 * Determines if VAT on an expense transaction is deductible
 * Based on Section 60(2) VAT Consolidation Act 2010
 */
export function isVATDeductible(
  description: string,
  categoryName?: string | null,
  accountName?: string | null
): VATDeductibilityResult {
  const descLower = (description || "").toLowerCase();
  const catLower = (categoryName || "").toLowerCase();
  const accLower = (accountName || "").toLowerCase();
  const combined = `${descLower} ${catLower} ${accLower}`;

  // ── Section 60 keyword checks (description-based, fire first) ──

  // Section 60(2)(a)(i) - Food, drink, accommodation
  if (DISALLOWED_VAT_CREDITS.FOOD_DRINK_ACCOMMODATION.keywords.some(k => combined.includes(k))) {
    return {
      isDeductible: false,
      reason: "Food, drink or accommodation - VAT NOT recoverable",
      section: "Section 60(2)(a)(i)"
    };
  }

  // Section 60(2)(a)(iii) - Entertainment
  if (DISALLOWED_VAT_CREDITS.ENTERTAINMENT.keywords.some(k => combined.includes(k))) {
    return {
      isDeductible: false,
      reason: "Entertainment expense - VAT NOT recoverable",
      section: "Section 60(2)(a)(iii)"
    };
  }

  // Section 60(2)(a)(iv) - Passenger motor vehicles
  if (DISALLOWED_VAT_CREDITS.PASSENGER_VEHICLES.keywords.some(k => combined.includes(k))) {
    return {
      isDeductible: false,
      reason: "Passenger vehicle purchase/hire - VAT NOT recoverable",
      section: "Section 60(2)(a)(iv)"
    };
  }

  // Section 60(2)(a)(v) - Petrol (but not diesel!)
  const hasPetrol = DISALLOWED_VAT_CREDITS.PETROL.keywords.some(k => combined.includes(k));
  const hasDiesel = ALLOWED_VAT_CREDITS.DIESEL.keywords!.some(k => combined.includes(k));

  if (hasPetrol && !hasDiesel) {
    return {
      isDeductible: false,
      reason: "Petrol - VAT NOT recoverable (diesel IS deductible)",
      section: "Section 60(2)(a)(v)"
    };
  }

  // Diesel IS deductible
  if (hasDiesel) {
    return {
      isDeductible: true,
      reason: "Diesel fuel - VAT IS recoverable"
    };
  }

  // Mixed fuel retailers without receipt - conservative approach
  const fuelStations = ["maxol", "circle k", "applegreen", "texaco", "esso", "shell", "topaz", "spar", "centra"];
  if (fuelStations.some(f => combined.includes(f))) {
    if (combined.includes("diesel") || (combined.includes("fuel") && !combined.includes("petrol"))) {
      return {
        isDeductible: true,
        reason: "Fuel purchase - categorized as deductible"
      };
    }
    return {
      isDeductible: false,
      reason: "Mixed retailer - cannot claim VAT without receipt proving diesel",
      section: "Section 60"
    };
  }

  // Non-business expenses
  if (combined.includes("personal") || combined.includes("private") || combined.includes("non-business")) {
    return {
      isDeductible: false,
      reason: "Non-business expense - VAT NOT recoverable",
      section: "Section 59"
    };
  }

  // Bank charges and fees - VAT exempt, VAT NOT recoverable
  if (combined.includes("bank") && (combined.includes("fee") || combined.includes("charge"))) {
    return {
      isDeductible: false,
      reason: "Bank charges — VAT exempt supply, VAT not recoverable"
    };
  }

  // Insurance - VAT exempt, VAT NOT recoverable
  if (combined.includes("insurance") && !combined.includes("motor tax")) {
    return {
      isDeductible: false,
      reason: "Insurance — VAT exempt supply, VAT not recoverable"
    };
  }

  // ── Category-based checks ──

  // Meals & Entertainment — not an allowable tax deduction
  if (catLower.includes("meals") || catLower === "entertainment") {
    return {
      isDeductible: false,
      reason: "Meals & Entertainment — not an allowable tax deduction",
      section: "Section 60(2)(a)(i)/(iii)"
    };
  }

  // Fines & Penalties — never deductible for tax purposes
  if (catLower.includes("fine") || catLower.includes("penalt") ||
      /\bfines?\b/.test(descLower) || /\bpenalt(y|ies)\b/.test(descLower)) {
    return {
      isDeductible: false,
      reason: "Fines & penalties are not allowable tax deductions",
    };
  }

  // Director's Drawings — capital withdrawals, not a business expense
  if (catLower.includes("drawing") || catLower.includes("director's draw")) {
    return {
      isDeductible: false,
      reason: "Director's Drawings — capital withdrawal, not a business expense",
    };
  }

  // Default: assume deductible for business expenses
  return {
    isDeductible: true,
    reason: "Business expense - VAT recoverable"
  };
}

/**
 * Calculate VAT amount from a gross amount using reverse calculation.
 * Accepts either a string key ("standard_23") or a numeric rate (23, 13.5, etc.).
 */
export function calculateVATFromGross(
  grossAmount: number,
  vatRateKey: string | number
): { netAmount: number; vatAmount: number } {
  const rates: Record<string, number> = {
    standard_23: 0.23,
    reduced_13_5: 0.135,
    second_reduced_9: 0.09,
    livestock_4_8: 0.048,
    zero_rated: 0,
    exempt: 0
  };

  let rate: number;
  if (typeof vatRateKey === "number") {
    // Numeric rate from DB (e.g. 23, 13.5, 9, 4.8, 0)
    rate = vatRateKey / 100;
  } else {
    rate = rates[vatRateKey] ?? 0.23;
  }
  
  if (rate === 0) {
    return { netAmount: grossAmount, vatAmount: 0 };
  }

  const vatAmount = Number((grossAmount * rate / (1 + rate)).toFixed(2));
  const netAmount = Number((grossAmount - vatAmount).toFixed(2));
  
  return { netAmount, vatAmount };
}
