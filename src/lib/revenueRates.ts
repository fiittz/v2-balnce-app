// ──────────────────────────────────────────────────────────────
// Revenue Civil Service Mileage & Subsistence Rates (2025)
// Effective 29 January 2025 — source: revenue.ie
// Pure TypeScript, zero React dependencies
// ──────────────────────────────────────────────────────────────

// ── Mileage Rates ─────────────────────────────────────────────
// Revenue civil service mileage rates (effective 29 Jan 2025)
// Using 1501cc+ band (most common for tradespeople)

export interface MileageBand {
  readonly upTo: number;
  readonly rate: number; // EUR per km
}

export const MILEAGE_RATES = {
  motor_car: [
    { upTo: 1_500, rate: 0.5182 }, // Band 1: up to 1,500 km (1501cc+)
    { upTo: 5_500, rate: 0.9063 }, // Band 2: 1,501–5,500 km (1501cc+)
    { upTo: 25_000, rate: 0.3922 }, // Band 3: 5,501–25,000 km (1501cc+)
    { upTo: Infinity, rate: 0.2587 }, // Band 4: 25,001+ km (1501cc+)
  ] as readonly MileageBand[],
  motorcycle: [
    { upTo: 6_437, rate: 0.2372 }, // 251–600cc band
    { upTo: Infinity, rate: 0.1529 },
  ] as readonly MileageBand[],
  bicycle: { rate: 0.08 },
} as const;

// ── Subsistence Rates ─────────────────────────────────────────
// Revenue domestic subsistence rates (effective 29 Jan 2025)

export const SUBSISTENCE_RATES = {
  overnight: {
    normal: 205.53, // accommodation + meals (overnight, 24+ hours)
    reduced: 184.98, // reduced overnight rate
    vouched_accommodation: 0, // claim actual accommodation + day rate
    day_rate: 46.17, // meals only when accommodation vouched separately
  },
  day_trip: {
    ten_hours: 46.17, // 10+ hours away, no overnight
    five_hours: 19.25, // 5–10 hours away
  },
} as const;

// ── Calculation Functions ─────────────────────────────────────

/**
 * Calculate mileage allowance for a given distance using Revenue banded rates.
 * Applies the correct rate per band cumulatively.
 */
export function calculateMileageAllowance(
  distanceKm: number,
  vehicleType: "motor_car" | "motorcycle" | "bicycle",
): number {
  if (distanceKm <= 0) return 0;

  if (vehicleType === "bicycle") {
    return Math.round(distanceKm * MILEAGE_RATES.bicycle.rate * 100) / 100;
  }

  const bands = MILEAGE_RATES[vehicleType];
  let remaining = distanceKm;
  let total = 0;
  let prevCeiling = 0;

  for (const band of bands) {
    const bandWidth = band.upTo === Infinity ? remaining : band.upTo - prevCeiling;
    const kmInBand = Math.min(remaining, bandWidth);
    if (kmInBand <= 0) break;

    total += kmInBand * band.rate;
    remaining -= kmInBand;
    prevCeiling = band.upTo;
  }

  return Math.round(total * 100) / 100;
}

/**
 * Calculate subsistence allowance for a business trip.
 * Revenue allows (from 29 Jan 2025):
 *  - Overnight: €205.53/night (or vouched accommodation + €46.17 day rate)
 *  - Day trip 10+ hours: €46.17/day
 *  - Day trip 5–10 hours: €19.25/day
 */
export function calculateSubsistenceAllowance(
  nightsAway: number,
  daysAway: number,
): { accommodation: number; meals: number; total: number } {
  // Overnight rate covers accommodation + meals
  const overnightTotal = nightsAway * SUBSISTENCE_RATES.overnight.normal;

  // Day trips (no overnight stay)
  const dayTripMeals = daysAway * SUBSISTENCE_RATES.day_trip.ten_hours;

  return {
    accommodation: Math.round(nightsAway * SUBSISTENCE_RATES.overnight.normal * 100) / 100,
    meals: Math.round(dayTripMeals * 100) / 100,
    total: Math.round((overnightTotal + dayTripMeals) * 100) / 100,
  };
}

/**
 * Calculate annual commute mileage allowance for personal vehicle.
 * Revenue allows civil service rates for business mileage.
 * Commute distance × 2 (return) × working days × banded rate.
 */
export function calculateAnnualCommuteMileage(oneWayKm: number, workingDaysPerYear: number = 230): number {
  const totalAnnualKm = oneWayKm * 2 * workingDaysPerYear;
  return calculateMileageAllowance(totalAnnualKm, "motor_car");
}
