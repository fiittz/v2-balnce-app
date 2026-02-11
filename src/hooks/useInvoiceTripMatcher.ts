import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useInvoices } from "@/hooks/useInvoices";
import { useTransactions } from "@/hooks/useTransactions";
import { useDirectorOnboarding } from "@/hooks/useDirectorOnboarding";
import {
  extractCountyFromAddress,
  extractBaseLocation,
  detectTrips,
  classifyTripExpense,
  type DetectedTrip,
  type DetectTripsInput,
} from "@/lib/tripDetection";
import {
  calculateMileageAllowance,
  SUBSISTENCE_RATES,
} from "@/lib/revenueRates";

// ── Types ──────────────────────────────────────────────────────

export interface TripExpense {
  description: string;
  amount: number;
  type: "accommodation" | "subsistence" | "transport" | "other";
}

export interface InvoiceTrip {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  jobLocation: string; // county or town name
  invoiceDate: string;
  matchedTrip: DetectedTrip | null;
  overnightStayDetected: boolean;
  hotelTransactions: string[]; // descriptions of matched hotel txns
  vehicleType: "personal_vehicle" | "company_vehicle" | "none";
  suggestedSubsistence: {
    nights: number;
    days: number;
    allowance: number;
    method: "vouched" | "flat";
    accommodationActual: number; // actual hotel cost from CSV (vouched only)
    mealsAllowance: number; // meals portion of subsistence
  };
  suggestedMileage: { distanceKm: number; allowance: number };
  // Actual trip expenses from CSV
  tripExpenses: TripExpense[];
  totalExpensesFromCsv: number;
  // Revenue allowance vs actual
  totalRevenueAllowance: number;
  // Directors Loan Account: positive = company owes director
  directorsLoanBalance: number;
}

// ── Helpers ────────────────────────────────────────────────────

/** Approximate inter-county distances (km, one-way) from Dublin. */
const COUNTY_DISTANCE_FROM_DUBLIN: Record<string, number> = {
  Dublin: 0, Kildare: 50, Meath: 50, Wicklow: 55, Louth: 80,
  Westmeath: 100, Laois: 100, Offaly: 110, Carlow: 85, Kilkenny: 130,
  Wexford: 150, Waterford: 165, Cork: 260, Kerry: 305, Limerick: 200,
  Clare: 230, Tipperary: 175, Galway: 210, Mayo: 280, Roscommon: 190,
  Sligo: 215, Leitrim: 235, Donegal: 275, Cavan: 130, Monaghan: 130,
  Longford: 130,
};

function estimateDistanceKm(fromCounty: string, toCounty: string): number {
  if (fromCounty === toCounty) return 0;
  const fromD = COUNTY_DISTANCE_FROM_DUBLIN[fromCounty] ?? 0;
  const toD = COUNTY_DISTANCE_FROM_DUBLIN[toCounty] ?? 0;
  // Rough triangle estimate: use the difference or a minimum
  return Math.max(Math.abs(toD - fromD), 50);
}

function dayDiff(a: string, b: string): number {
  return Math.abs(
    Math.round(
      (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
    )
  );
}

// ── Hook ───────────────────────────────────────────────────────

interface UseInvoiceTripMatcherOptions {
  /** Workshop county for distance calculation */
  workshopCounty?: string;
}

export function useInvoiceTripMatcher(opts?: UseInvoiceTripMatcherOptions) {
  const { user, profile } = useAuth();
  const { data: directorRows } = useDirectorOnboarding();

  // Include both current year and previous year to catch all relevant invoices
  const now = new Date();
  const currentYear = now.getFullYear();
  const startDate = `${currentYear - 1}-01-01`;
  const endDate = `${currentYear}-12-31`;

  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  const { data: expenses, isLoading: expensesLoading } = useTransactions({
    type: "expense",
    startDate,
    endDate,
  });

  const isLoading = invoicesLoading || expensesLoading;

  // Read travel settings from business onboarding (localStorage)
  let placeOfWork: string | null = null;
  let workshopAddress: string | null = null;
  let subsistenceRadiusKm = 8;
  try {
    const extra = localStorage.getItem("business_onboarding_extra");
    if (extra) {
      const parsed = JSON.parse(extra);
      const biz = parsed?.businesses?.[0];
      placeOfWork = biz?.place_of_work || null;
      workshopAddress = biz?.workshop_address || null;
      subsistenceRadiusKm = biz?.subsistence_radius_km || 8;
    }
  } catch { /* ignore */ }

  const baseLocation = extractBaseLocation(profile?.address);
  // Home county — for overnight detection
  const homeCounty =
    (placeOfWork ? extractCountyFromAddress(placeOfWork) : null) ||
    opts?.workshopCounty ||
    (baseLocation ? extractCountyFromAddress(baseLocation) : null);
  // Workshop county — for subsistence (may be same county but different location)
  const workshopCounty = workshopAddress
    ? (extractCountyFromAddress(workshopAddress) || homeCounty)
    : homeCounty;

  // Get commute method and vehicle ownership from first director's onboarding_data
  const director1Data = (directorRows?.[0] as any)?.onboarding_data;
  const commuteMethod = director1Data?.commute_method || "";
  const vehicleOwnedByDirector = director1Data?.vehicle_owned_by_director === true;

  const invoiceTrips: InvoiceTrip[] = useMemo(() => {
    if (!invoices || !expenses || !user?.id) return [];

    // Mileage only if director personally owns the vehicle
    const vehicleType: "personal_vehicle" | "company_vehicle" | "none" =
      (commuteMethod === "personal_vehicle" && vehicleOwnedByDirector) ? "personal_vehicle" :
      commuteMethod === "company_vehicle" ? "company_vehicle" :
      "none";

    // Filter invoices for tax year
    const yearInvoices = invoices.filter((inv) => {
      const d = inv.invoice_date;
      return d >= startDate && d <= endDate;
    });

    const results: InvoiceTrip[] = [];

    for (const inv of yearInvoices) {
      // Extract location from customer address
      const customerAddress = (inv.customer as any)?.address || (inv as any)?.customer_address;
      if (!customerAddress) continue;

      const jobCounty = extractCountyFromAddress(customerAddress);
      if (!jobCounty) continue;

      // Determine trip type:
      // - Same county as workshop AND estimated distance < radius → skip entirely (local work)
      // - Same county as home but different from workshop → subsistence only (no overnight)
      // - Different county from home → full trip (overnight detection + subsistence + mileage)
      const estimatedDist = workshopCounty ? estimateDistanceKm(workshopCounty, jobCounty) : 999;
      const isLocalWork = workshopCounty && jobCounty === workshopCounty && estimatedDist < subsistenceRadiusKm;
      if (isLocalWork) continue;

      const isOutsideHomeCounty = homeCounty ? jobCounty !== homeCounty : true;

      // Parse job start/end dates from notes JSON
      let jobStartDate: string | null = null;
      let jobEndDate: string | null = null;
      try {
        const notesObj = inv.notes ? JSON.parse(inv.notes) : null;
        if (notesObj) {
          jobStartDate = notesObj.job_start_date || null;
          jobEndDate = notesObj.job_end_date || null;
        }
      } catch {
        // notes is plain text
      }

      // Find expense transactions within the job date range.
      // If invoice has explicit job_start_date/job_end_date → use those (inclusive).
      // Otherwise fallback to +/- 2 days of invoice date (covers travel day + work + return).
      const nearbyExpenses = (expenses ?? []).filter((exp) => {
        if (jobStartDate && jobEndDate) {
          return exp.transaction_date >= jobStartDate && exp.transaction_date <= jobEndDate;
        }
        return dayDiff(exp.transaction_date, inv.invoice_date) <= 2;
      });

      // Classify and collect all trip-related expenses from CSV
      const hotelTransactions: string[] = [];
      const tripExpenses: TripExpense[] = [];

      for (const exp of nearbyExpenses) {
        let expenseType = classifyTripExpense(exp.description);
        // During a job period, ALL non-excluded expenses are job-related.
        // Unclassified ("other") transactions default to subsistence
        // (e.g. Centra, Spar, pubs, fuel stations — food/meals on the job).
        if (expenseType === "other") {
          expenseType = "subsistence";
        }
        tripExpenses.push({
          description: exp.description,
          amount: Math.abs(Number(exp.amount)),
          type: expenseType,
        });
        if (expenseType === "accommodation") {
          hotelTransactions.push(exp.description);
        }
      }
      const overnightStayDetected = hotelTransactions.length > 0;
      const totalExpensesFromCsv = tripExpenses.reduce((sum, e) => sum + e.amount, 0);

      // Build trip input for detectTrips
      const tripInput: DetectTripsInput[] = nearbyExpenses.map((exp) => ({
        id: exp.id,
        description: exp.description,
        amount: Math.abs(Number(exp.amount)),
        date: exp.transaction_date,
        type: "expense" as const,
      }));

      const detectedTrips = detectTrips(tripInput, baseLocation);
      const matchedTrip = detectedTrips.find(
        (t) => extractCountyFromAddress(t.location) === jobCounty
      ) || detectedTrips[0] || null;

      // Calculate nights and days
      // Overnight stays only apply when working OUTSIDE home county
      // Subsistence (day rate) applies when working beyond subsistence radius from workshop
      //
      // Revenue rules:
      //   - Each overnight stay covers accommodation + meals for that night
      //   - Extra working days NOT covered by an overnight stay get the day rate (€46.17)
      //   - Example: 1 night + 2 working days → 1 × overnight + 1 × day rate
      let nights = 0;
      let days = 0;

      if (isOutsideHomeCounty) {
        // Outside home county — check for overnight stays
        if (jobStartDate && jobEndDate) {
          const totalDays = dayDiff(jobStartDate, jobEndDate) + 1; // inclusive of both days
          nights = dayDiff(jobStartDate, jobEndDate);
          // Extra working days beyond what overnight covers (arrival day is covered by overnight)
          days = Math.max(0, totalDays - nights);
        } else if (matchedTrip) {
          const totalDays = dayDiff(matchedTrip.startDate, matchedTrip.endDate) + 1;
          nights = dayDiff(matchedTrip.startDate, matchedTrip.endDate);
          days = Math.max(0, totalDays - nights);
        } else if (overnightStayDetected) {
          nights = hotelTransactions.length;
          days = 1; // departure day gets day rate
        } else {
          // Outside home county but no hotel detected — day trip
          nights = 0;
          days = 1;
        }
      } else {
        // Within home county but beyond subsistence radius — day subsistence only
        nights = 0;
        days = 1;
      }

      // If hotel receipts exist in CSV, use vouched method:
      //   actual accommodation (already in tripExpenses) + €39.08/day meals
      // If no receipts, use flat €191/night (covers accommodation + meals)
      const accommodationExpenses = tripExpenses
        .filter(e => e.type === "accommodation")
        .reduce((sum, e) => sum + e.amount, 0);

      let subsistenceAllowance: number;
      let subsistenceMethod: "vouched" | "flat" = "flat";

      if (accommodationExpenses > 0 && nights > 0) {
        // Vouched: actual accommodation + meals day rate per night
        subsistenceMethod = "vouched";
        subsistenceAllowance = accommodationExpenses + (nights * SUBSISTENCE_RATES.overnight.day_rate);
      } else if (nights > 0) {
        // Flat rate: €191/night (no receipts)
        subsistenceAllowance = nights * SUBSISTENCE_RATES.overnight.normal;
      } else {
        // Day trip: €39.08/day (10+ hours)
        subsistenceAllowance = days * SUBSISTENCE_RATES.day_trip.ten_hours;
      }

      subsistenceAllowance = Math.round(subsistenceAllowance * 100) / 100;

      // Estimate mileage — only for personal vehicle users
      let distanceKm = 0;
      let mileageAllowance = 0;

      if (vehicleType === "personal_vehicle" && workshopCounty) {
        distanceKm = estimateDistanceKm(workshopCounty, jobCounty) * 2; // return trip
        mileageAllowance = calculateMileageAllowance(distanceKm, "motor_car");
      }

      // Calculate meals portion for display
      const mealsAllowance = subsistenceMethod === "vouched"
        ? Math.round(nights * SUBSISTENCE_RATES.overnight.day_rate * 100) / 100
        : subsistenceMethod === "flat" && nights > 0
          ? 0 // included in flat rate
          : Math.round(days * SUBSISTENCE_RATES.day_trip.ten_hours * 100) / 100;

      const totalRevenueAllowance = subsistenceAllowance + mileageAllowance;
      // Positive = company owes director (director paid out of pocket more than CSV expenses)
      // Revenue allowance - actual CSV expenses = net owed to director
      const directorsLoanBalance = totalRevenueAllowance - totalExpensesFromCsv;

      results.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        customerName: (inv.customer as any)?.name || "Unknown",
        jobLocation: jobCounty,
        invoiceDate: inv.invoice_date,
        matchedTrip,
        overnightStayDetected,
        hotelTransactions,
        vehicleType,
        suggestedSubsistence: {
          nights,
          days,
          allowance: subsistenceAllowance,
          method: subsistenceMethod,
          accommodationActual: accommodationExpenses,
          mealsAllowance,
        },
        suggestedMileage: {
          distanceKm,
          allowance: mileageAllowance,
        },
        tripExpenses,
        totalExpensesFromCsv,
        totalRevenueAllowance,
        directorsLoanBalance,
      });
    }

    return results;
  }, [invoices, expenses, user?.id, baseLocation, homeCounty, workshopCounty, subsistenceRadiusKm, commuteMethod, vehicleOwnedByDirector, startDate, endDate]);

  return { invoiceTrips, isLoading };
}
