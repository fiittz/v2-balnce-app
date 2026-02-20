/**
 * Smart Trip Detection
 *
 * Scans imported transactions for clusters that look like business trips
 * away from the user's base location. Groups by date + location, qualifies
 * trips (2+ transactions or 1 hotel booking), and merges consecutive days.
 */

import { IRISH_TOWNS } from "@/lib/irishTowns";

// ── Town → County mapping (derived from irishTowns.ts) ────────────────
// Single source of truth for all 200+ Irish towns.

const COUNTY_MAP: Record<string, string> = Object.fromEntries(IRISH_TOWNS.map((t) => [t.name, t.county]));

// ── Irish location dictionary ──────────────────────────────────────────
// Maps common bank-statement abbreviations → canonical location name.
// Auto-generated from IRISH_TOWNS, plus hand-curated abbreviations.

const IRISH_LOCATIONS: Record<string, string> = {
  // Auto-map every town name (lowercase → canonical)
  ...Object.fromEntries(IRISH_TOWNS.map((t) => [t.name.toLowerCase(), t.name])),

  // Common bank-statement abbreviations (not derivable from town names)
  dub: "Dublin",
  dubln: "Dublin",
  crk: "Cork",
  glwy: "Galway",
  lmk: "Limerick",
  waterfrd: "Waterford",
  wford: "Waterford",
  klkny: "Kilkenny",
  wxford: "Wexford",
  carrick: "Carrick-on-Shannon",
};

// ── Hotel / accommodation keywords ─────────────────────────────────────
const HOTEL_KEYWORDS = [
  "hotel",
  "b&b",
  "b & b",
  "guesthouse",
  "guest house",
  "hostel",
  "airbnb",
  "booking.com",
  "accommodation",
  "lodge",
  "inn",
];

// ── Trip expense type classification keywords ──────────────────────────
const ACCOMMODATION_KEYWORDS = [...HOTEL_KEYWORDS, "dooleys", "stay"];
const SUBSISTENCE_KEYWORDS = [
  "restaurant",
  "cafe",
  "coffee",
  "food",
  "lunch",
  "dinner",
  "breakfast",
  "pub",
  "bar",
  "takeaway",
  "mcdonalds",
  "subway",
  "supermacs",
  "centra",
  "spar",
  "deli",
  "uisce beatha",
  "costa",
  "insomnia",
  "starbucks",
  "greggs",
  "lidl",
  "aldi",
  "tesco",
  "dunnes",
  "supervalu",
  // Petrol station convenience stores (small purchases = meals)
  "circle k",
  "applegreen",
  "maxol",
  "texaco",
  "top",
  "emo",
  "go fuel",
  "inver",
];
const TRANSPORT_KEYWORDS = [
  "port of",
  "ferry",
  "taxi",
  "freenow",
  "bolt",
  "uber",
  "bus",
  "train",
  "toll",
  "eflow",
  "parking",
  "fuel",
];
// Never classify these as trip expenses
const EXCLUDED_KEYWORDS = [
  "bank charge",
  "bank fee",
  "government stamp",
  "stamp duty",
  "revenue",
  "rev comm",
  "interest charge",
  "account fee",
  "service charge",
  "direct debit",
  "standing order",
];

// ── Public types ────────────────────────────────────────────────────────

export type TripExpenseType = "accommodation" | "subsistence" | "transport" | "other";

export interface TripTransaction {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO date
  type: "income" | "expense";
  expenseType: TripExpenseType;
}

export interface DetectedTrip {
  id: string; // generated
  location: string;
  startDate: string;
  endDate: string;
  transactions: TripTransaction[];
  totalSpend: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s&.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Try to extract a location from a single address string. */
function tryExtractLocation(address: string | null | undefined): string | null {
  if (!address) return null;
  const norm = normalise(address);

  // Try each known location against the address
  for (const [key, canonical] of Object.entries(IRISH_LOCATIONS)) {
    // Word-boundary-ish check: the key must appear as a standalone token
    const re = new RegExp(`\\b${key}\\b`);
    if (re.test(norm)) return canonical;
  }

  // Check for Dublin Eircode patterns (D01-D24, D6W)
  const dublinEircodeRe = /\bd(?:0[1-9]|1[0-9]|2[0-4]|6w)\b/i;
  if (dublinEircodeRe.test(norm)) return "Dublin";

  return null;
}

/**
 * Extract the user's base city from their profile address string.
 * Falls back to a secondary address (e.g. director's home_address from onboarding).
 */
export function extractBaseLocation(
  address: string | null | undefined,
  fallbackAddress?: string | null,
): string | null {
  const primary = tryExtractLocation(address);
  if (primary) return primary;
  return tryExtractLocation(fallbackAddress);
}

/**
 * Extract a county name from a free-text address string.
 * Uses IRISH_LOCATIONS to find a town, then maps to county via COUNTY_MAP.
 * Also checks for "Co. <County>" or "County <County>" patterns.
 */
export function extractCountyFromAddress(address: string): string | null {
  if (!address) return null;
  const norm = normalise(address);

  // Direct "co. <county>" or "county <county>" pattern
  const countyPatterns = [/\bco\.?\s+(\w+)\b/, /\bcounty\s+(\w+)\b/];
  const allCounties = new Set(Object.values(COUNTY_MAP));
  for (const pattern of countyPatterns) {
    const match = norm.match(pattern);
    if (match) {
      const candidate = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      if (allCounties.has(candidate)) return candidate;
    }
  }

  // Try to find a town name and map to county
  const location = extractBaseLocation(address);
  if (location && COUNTY_MAP[location]) {
    return COUNTY_MAP[location];
  }

  return null;
}

/** Try to detect a location name from a transaction description. */
export function detectTransactionLocation(description: string): string | null {
  const norm = normalise(description);

  // Check longest keys first so "carrickmacross" matches before "carrick"
  const sortedKeys = Object.keys(IRISH_LOCATIONS).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    const re = new RegExp(`\\b${key}\\b`);
    if (re.test(norm)) return IRISH_LOCATIONS[key];
  }

  // Also try matching "port of <location>" pattern
  const portMatch = norm.match(/port of (\w+)/);
  if (portMatch) {
    const loc = portMatch[1];
    /* v8 ignore start -- unreachable: any single-word location key matched here would already be matched by the main loop above */
    if (IRISH_LOCATIONS[loc]) return IRISH_LOCATIONS[loc];
    /* v8 ignore stop */
  }

  return null;
}

/** Classify a transaction description into a trip expense type. */
export function classifyTripExpense(description: string): TripExpenseType {
  const norm = normalise(description);

  // Never classify bank charges, Revenue payments, etc. as trip expenses
  if (EXCLUDED_KEYWORDS.some((k) => norm.includes(k))) return "other";

  if (ACCOMMODATION_KEYWORDS.some((k) => norm.includes(k))) return "accommodation";
  if (TRANSPORT_KEYWORDS.some((k) => norm.includes(k))) return "transport";
  if (SUBSISTENCE_KEYWORDS.some((k) => norm.includes(k))) return "subsistence";
  return "other";
}

function isHotelBooking(description: string): boolean {
  const norm = normalise(description);
  return HOTEL_KEYWORDS.some((k) => norm.includes(k));
}

// ── Main detection function ─────────────────────────────────────────────

export interface DetectTripsInput {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: "income" | "expense";
}

/**
 * Scan a batch of transactions and return clusters that look like
 * business trips away from the user's base.
 *
 * Qualification rules:
 *  - 2+ expense transactions at the same non-base location on the same day
 *  - OR 1 hotel/accommodation booking at a non-base location
 *  - Consecutive-day clusters at the same location are merged into one trip
 */
export function detectTrips(transactions: DetectTripsInput[], baseLocation: string | null): DetectedTrip[] {
  // Only consider expenses
  const expenses = transactions.filter((t) => t.type === "expense");

  // Group by date+location
  const groups = new Map<string, { location: string; date: string; txns: DetectTripsInput[] }>();

  for (const txn of expenses) {
    const location = detectTransactionLocation(txn.description);
    if (!location) continue;

    // Skip if same as base location (exact match or same county)
    if (baseLocation) {
      if (location.toLowerCase() === baseLocation.toLowerCase()) continue;
      const baseCounty = COUNTY_MAP[baseLocation];
      const txnCounty = COUNTY_MAP[location];
      if (baseCounty && txnCounty && baseCounty === txnCounty) continue;
    }

    const key = `${txn.date}|${location}`;
    if (!groups.has(key)) {
      groups.set(key, { location, date: txn.date, txns: [] });
    }
    groups.get(key)!.txns.push(txn);
  }

  // Qualify each day-group
  const qualifiedDays: Array<{ location: string; date: string; txns: DetectTripsInput[] }> = [];

  for (const group of groups.values()) {
    const hasHotel = group.txns.some((t) => isHotelBooking(t.description));
    if (group.txns.length >= 2 || hasHotel) {
      qualifiedDays.push(group);
    }
  }

  if (qualifiedDays.length === 0) return [];

  // Sort by location then date
  qualifiedDays.sort((a, b) => {
    const locCmp = a.location.localeCompare(b.location);
    if (locCmp !== 0) return locCmp;
    return a.date.localeCompare(b.date);
  });

  // Merge consecutive days at the same location
  const trips: DetectedTrip[] = [];
  let current: {
    location: string;
    startDate: string;
    endDate: string;
    txns: DetectTripsInput[];
  } | null = null;

  for (const day of qualifiedDays) {
    if (current && current.location === day.location && dayDiff(current.endDate, day.date) <= 1) {
      // Extend current trip
      current.endDate = day.date;
      current.txns.push(...day.txns);
    } else {
      // Finalize previous trip
      if (current) {
        trips.push(buildTrip(current));
      }
      current = {
        location: day.location,
        startDate: day.date,
        endDate: day.date,
        txns: [...day.txns],
      };
    }
  }

  /* v8 ignore start -- current is always non-null here because qualifiedDays is non-empty (early return above) */
  if (current) {
    trips.push(buildTrip(current));
  }
  /* v8 ignore stop */

  return trips;
}

function dayDiff(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

let tripIdCounter = 0;

function buildTrip(raw: {
  location: string;
  startDate: string;
  endDate: string;
  txns: DetectTripsInput[];
}): DetectedTrip {
  tripIdCounter++;
  return {
    id: `trip-${tripIdCounter}-${Date.now()}`,
    location: raw.location,
    startDate: raw.startDate,
    endDate: raw.endDate,
    transactions: raw.txns.map((t) => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      date: t.date,
      type: t.type,
      expenseType: classifyTripExpense(t.description),
    })),
    totalSpend: raw.txns.reduce((sum, t) => sum + Math.abs(t.amount), 0),
  };
}
