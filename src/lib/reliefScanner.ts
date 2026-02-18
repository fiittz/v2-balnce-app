/**
 * Relief Scanner — scans personal account transactions for Form 11 qualifying reliefs.
 *
 * Applies Section 469 TCA 1997 rules: medical relief at 20% covers non-routine
 * medical expenses but EXCLUDES cosmetic procedures and routine dental.
 *
 * Pure function, no React dependencies.
 */

export interface ReliefMatch {
  date: string;
  description: string;
  amount: number;
}

export interface ReliefScanResult {
  medical: { total: number; transactions: ReliefMatch[] };
  healthInsurance: { total: number; transactions: ReliefMatch[] };
  pension: { total: number; transactions: ReliefMatch[] };
  charitable: { total: number; transactions: ReliefMatch[] };
  rent: { total: number; transactions: ReliefMatch[] };
  tuition: { total: number; transactions: ReliefMatch[] };
}

interface TransactionRow {
  description: string;
  amount: number;
  transaction_date: string;
  type: string;
}

// ── Qualifying patterns ────────────────────────────────────────

const HEALTH_INSURANCE_PATTERNS = ["vhi", "laya healthcare", "laya health", "irish life health", "glo health"];

const MEDICAL_PATTERNS = [
  "physio",
  "physiotherapy",
  "dental surgery",
  "orthodont",
  "oral surgery",
  "hospital",
  "consultant",
  "surgeon",
  "dermatolog",
  "fertility",
  "ivf",
  "mater private",
  "blackrock clinic",
  "beacon hospital",
  "bon secours",
  "st vincent",
  "galway clinic",
  "gp visit",
  "doctor",
];

const PENSION_PATTERNS = ["irish life pension", "zurich pension", "aviva pension", "new ireland", "standard life"];

const CHARITABLE_PATTERNS = [
  "trocaire",
  "concern worldwide",
  "goal",
  "svp",
  "st vincent de paul",
  "unicef ireland",
  "irish cancer society",
  "pieta house",
  "barnardos",
];

const RENT_PATTERNS = ["rent payment", "monthly rent", "residential tenancies", "rtb registration"];

const TUITION_PATTERNS = [
  "ucd",
  "tcd",
  "trinity college",
  "dcu",
  "nuig",
  "university of galway",
  "ucc",
  "maynooth university",
  "tu dublin",
  "technological university",
  "griffith college",
  "ncad",
  "rcsi",
  "dit",
  "athlone it",
  "waterford it",
  "letterkenny it",
  "sligo it",
  "carlow it",
  "dundalk it",
  "limerick it",
  "tuition",
];

// ── Exclusion patterns (routine / cosmetic — NOT qualifying) ───

const MEDICAL_EXCLUSIONS = [
  "teeth whitening",
  "teeth cleaning",
  "dental checkup",
  "dental check-up",
  "dental check up",
  "routine dental",
  "botox",
  "cosmetic",
  "filler",
  "laser hair",
  "liposuction",
  "rhinoplasty",
  "breast augment",
  "tanning",
];

// ── Helpers ────────────────────────────────────────────────────

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesAny(text: string, patterns: string[]): boolean {
  return patterns.some((p) => text.includes(p));
}

// ── Main scanner ───────────────────────────────────────────────

export function scanForReliefs(transactions: TransactionRow[]): ReliefScanResult {
  const result: ReliefScanResult = {
    medical: { total: 0, transactions: [] },
    healthInsurance: { total: 0, transactions: [] },
    pension: { total: 0, transactions: [] },
    charitable: { total: 0, transactions: [] },
    rent: { total: 0, transactions: [] },
    tuition: { total: 0, transactions: [] },
  };

  for (const tx of transactions) {
    // Only scan expenses (outgoing payments)
    if (tx.type !== "expense") continue;

    const desc = normalise(tx.description);
    const amount = Math.abs(Number(tx.amount) || 0);
    if (amount === 0) continue;

    const match: ReliefMatch = {
      date: tx.transaction_date,
      description: tx.description,
      amount,
    };

    // Health insurance (checked first — more specific than generic medical)
    if (matchesAny(desc, HEALTH_INSURANCE_PATTERNS)) {
      result.healthInsurance.total += amount;
      result.healthInsurance.transactions.push(match);
      continue;
    }

    // Medical (non-routine) — must NOT match exclusion patterns
    if (matchesAny(desc, MEDICAL_PATTERNS) && !matchesAny(desc, MEDICAL_EXCLUSIONS)) {
      result.medical.total += amount;
      result.medical.transactions.push(match);
      continue;
    }

    // Pension
    if (matchesAny(desc, PENSION_PATTERNS)) {
      result.pension.total += amount;
      result.pension.transactions.push(match);
      continue;
    }

    // Charitable
    if (matchesAny(desc, CHARITABLE_PATTERNS)) {
      result.charitable.total += amount;
      result.charitable.transactions.push(match);
      continue;
    }

    // Rent (personal — for rent tax credit)
    if (matchesAny(desc, RENT_PATTERNS)) {
      result.rent.total += amount;
      result.rent.transactions.push(match);
      continue;
    }

    // Tuition fees
    if (matchesAny(desc, TUITION_PATTERNS)) {
      result.tuition.total += amount;
      result.tuition.transactions.push(match);
      continue;
    }
  }

  return result;
}
