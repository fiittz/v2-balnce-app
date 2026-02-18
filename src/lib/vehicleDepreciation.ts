// ──────────────────────────────────────────────────────────────
// Vehicle Depreciation & Capital Allowances (Irish Tax Law)
// ──────────────────────────────────────────────────────────────
//
// Irish rules for motor vehicles:
//  - Capital allowances: 12.5% straight-line over 8 years
//  - Maximum qualifying cost for cars: €24,000 (TCA 1997 s.373)
//  - Business use apportionment applies
//  - Net book value = cost - accumulated depreciation

/** Maximum cost eligible for capital allowances on motor cars. */
const MOTOR_VEHICLE_CAP = 24_000;

/** Annual wear & tear rate (12.5% = 1/8). */
const ANNUAL_RATE = 0.125;

export interface VehicleAsset {
  description: string;
  reg: string;
  purchaseCost: number; // ex-VAT
  dateAcquired: string; // ISO date
  businessUsePct: number; // 0-100
}

export interface VehicleDepreciation {
  /** Original cost (ex-VAT). */
  cost: number;
  /** Cost capped at €24,000 for allowance purposes. */
  qualifyingCost: number;
  /** Full years of ownership as of the tax year end. */
  yearsOwned: number;
  /** Annual capital allowance (before business use apportionment). */
  annualAllowanceFull: number;
  /** Annual capital allowance after business use %. */
  annualAllowance: number;
  /** Cumulative allowances claimed to date. */
  cumulativeAllowances: number;
  /** Net book value (qualifying cost - cumulative allowances). */
  netBookValue: number;
  /** Whether the asset is fully depreciated (8 years). */
  fullyDepreciated: boolean;
  /** Business use percentage applied. */
  businessUsePct: number;
}

/**
 * Calculate vehicle depreciation and capital allowances for a given tax year.
 *
 * @param vehicle  Vehicle asset details from director onboarding.
 * @param taxYear  The tax year (calendar year) to calculate for.
 */
export function calculateVehicleDepreciation(vehicle: VehicleAsset, taxYear: number): VehicleDepreciation {
  const cost = vehicle.purchaseCost;
  const qualifyingCost = Math.min(cost, MOTOR_VEHICLE_CAP);
  const businessPct = Math.max(0, Math.min(100, vehicle.businessUsePct)) / 100;

  // Calculate years owned: count of full or partial years in which the asset
  // was owned. Year of acquisition counts as year 1.
  const acquiredYear = vehicle.dateAcquired ? new Date(vehicle.dateAcquired).getFullYear() : taxYear;

  const yearsOwned = Math.max(0, taxYear - acquiredYear + 1);

  // Allowances are claimed for max 8 years
  const claimableYears = Math.min(yearsOwned, 8);

  const annualAllowanceFull = Math.round(qualifyingCost * ANNUAL_RATE * 100) / 100;
  const annualAllowance = Math.round(annualAllowanceFull * businessPct * 100) / 100;

  const cumulativeAllowances =
    Math.round(Math.min(claimableYears * annualAllowanceFull * businessPct, qualifyingCost * businessPct) * 100) / 100;

  const netBookValue = Math.max(0, Math.round((qualifyingCost - claimableYears * annualAllowanceFull) * 100) / 100);

  return {
    cost,
    qualifyingCost,
    yearsOwned,
    annualAllowanceFull,
    annualAllowance,
    cumulativeAllowances,
    netBookValue,
    fullyDepreciated: claimableYears >= 8,
    businessUsePct: vehicle.businessUsePct,
  };
}
