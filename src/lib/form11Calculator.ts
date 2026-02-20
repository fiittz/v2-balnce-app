// ──────────────────────────────────────────────────────────────
// Form 11 Calculation Engine — Irish Income Tax (Self-Assessed)
// Pure TypeScript, zero React / Supabase dependencies
// ──────────────────────────────────────────────────────────────

// ── Tax Constants by Year ────────────────────────────────────
// Source: Revenue.ie, Finance Acts 2023-2025

export interface TaxConstants {
  standardRateCutoff: {
    single: number;
    married_one_income: number;
    married_two_incomes: number;
    second_earner_max: number;
  };
  standardRate: number;
  higherRate: number;
  usc: readonly { from: number; to: number; rate: number }[];
  uscExemptionThreshold: number;
  prsi: { rate: number; minimum: number; threshold: number };
  credits: {
    single: number;
    married: number;
    earnedIncome: number;
    paye: number;
    homeCarer: number;
    singleParent: number;
  };
  pensionAgeLimits: readonly { maxAge: number; rate: number }[];
  pensionEarningsCap: number;
  medicalReliefRate: number;
  rentCredit: { single: number; couple: number };
  remoteWorkingRate: number;
  charitableMinimum: number;
  tuitionDisregard: { fullTime: number; partTime: number; maxPerCourse: number; reliefRate: number };
  cgt: { rate: number; annualExemption: number };
  vehicleBIKBands: readonly { maxKm: number; rate: number }[];
}

const SHARED_CONSTANTS = {
  standardRate: 0.2,
  higherRate: 0.4,
  uscExemptionThreshold: 13_000,
  pensionAgeLimits: [
    { maxAge: 29, rate: 0.15 },
    { maxAge: 39, rate: 0.2 },
    { maxAge: 49, rate: 0.25 },
    { maxAge: 54, rate: 0.3 },
    { maxAge: 59, rate: 0.35 },
    { maxAge: Infinity, rate: 0.4 },
  ] as const,
  pensionEarningsCap: 115_000,
  medicalReliefRate: 0.2,
  remoteWorkingRate: 0.3,
  charitableMinimum: 250,
  tuitionDisregard: { fullTime: 3_000, partTime: 1_500, maxPerCourse: 7_000, reliefRate: 0.2 },
  cgt: { rate: 0.33, annualExemption: 1_270 },
  vehicleBIKBands: [
    { maxKm: 24_000, rate: 0.2267 },
    { maxKm: 32_000, rate: 0.18 },
    { maxKm: 40_000, rate: 0.135 },
    { maxKm: 48_000, rate: 0.09 },
    { maxKm: Infinity, rate: 0.045 },
  ] as const,
};

const TAX_CONSTANTS_BY_YEAR: Record<number, TaxConstants> = {
  2024: {
    ...SHARED_CONSTANTS,
    standardRateCutoff: {
      single: 42_000,
      married_one_income: 51_000,
      married_two_incomes: 84_000,
      second_earner_max: 33_000,
    },
    usc: [
      { from: 0, to: 12_012, rate: 0.005 },
      { from: 12_012, to: 25_760, rate: 0.02 },
      { from: 25_760, to: 70_044, rate: 0.04 },
      { from: 70_044, to: 100_000, rate: 0.08 },
      { from: 100_000, to: Infinity, rate: 0.11 },
    ],
    prsi: { rate: 0.04025, minimum: 538, threshold: 5_000 }, // blended: 4% Jan-Sep, 4.1% Oct-Dec; min blended €537.50 → €538
    credits: {
      single: 1_875,
      married: 3_750,
      earnedIncome: 1_875,
      paye: 1_875,
      homeCarer: 1_800,
      singleParent: 1_750,
    },
    rentCredit: { single: 1_000, couple: 2_000 },
  },
  2025: {
    ...SHARED_CONSTANTS,
    standardRateCutoff: {
      single: 44_000,
      married_one_income: 53_000,
      married_two_incomes: 88_000,
      second_earner_max: 35_000,
    },
    usc: [
      { from: 0, to: 12_012, rate: 0.005 },
      { from: 12_012, to: 27_382, rate: 0.02 },
      { from: 27_382, to: 70_044, rate: 0.03 },
      { from: 70_044, to: 100_000, rate: 0.08 },
      { from: 100_000, to: Infinity, rate: 0.11 },
    ],
    prsi: { rate: 0.04125, minimum: 650, threshold: 5_000 },
    credits: {
      single: 2_000,
      married: 4_000,
      earnedIncome: 2_000,
      paye: 2_000,
      homeCarer: 1_950,
      singleParent: 1_900,
    },
    rentCredit: { single: 1_000, couple: 2_000 },
  },
  2026: {
    ...SHARED_CONSTANTS,
    standardRateCutoff: {
      single: 44_000,
      married_one_income: 53_000,
      married_two_incomes: 88_000,
      second_earner_max: 35_000, // €53k + €35k = €88k max
    },
    usc: [
      { from: 0, to: 12_012, rate: 0.005 },
      { from: 12_012, to: 28_700, rate: 0.02 },
      { from: 28_700, to: 70_044, rate: 0.03 },
      { from: 70_044, to: 100_000, rate: 0.08 },
      { from: 100_000, to: Infinity, rate: 0.11 },
    ],
    prsi: { rate: 0.042375, minimum: 650, threshold: 5_000 }, // blended: 4.2% Jan-Sep, 4.35% Oct-Dec
    credits: {
      single: 2_000,
      married: 4_000,
      earnedIncome: 2_000,
      paye: 2_000,
      homeCarer: 1_950,
      singleParent: 1_900,
    },
    rentCredit: { single: 1_000, couple: 2_000 },
  },
};

/** Get tax constants for a given tax year. Falls back to nearest known year. */
export function getTaxConstants(year: number): TaxConstants {
  if (TAX_CONSTANTS_BY_YEAR[year]) return TAX_CONSTANTS_BY_YEAR[year];
  // Fall back to closest year we have
  const years = Object.keys(TAX_CONSTANTS_BY_YEAR).map(Number).sort();
  const closest = years.reduce((prev, curr) => (Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev));
  return TAX_CONSTANTS_BY_YEAR[closest];
}

/** Default export for backwards compatibility — uses current tax year */
export const TAX_CONSTANTS = getTaxConstants(new Date().getMonth() >= 10 ? new Date().getFullYear() : new Date().getFullYear() - 1);

// ── Interfaces ───────────────────────────────────────────────

export interface Form11Input {
  // Identity
  directorName: string;
  ppsNumber: string;
  dateOfBirth: string; // ISO date
  maritalStatus: "single" | "married" | "civil_partner" | "widowed" | "separated";
  assessmentBasis: "single" | "joint" | "separate";

  // Schedule E — employment / director income
  salary: number;
  dividends: number;
  bik: number;

  // Schedule D — business / self-employment
  businessIncome: number;
  businessExpenses: number;
  capitalAllowances: number;

  // Other income
  rentalIncome: number;
  rentalExpenses: number;
  foreignIncome: number;
  otherIncome: number;

  // Capital gains
  capitalGains: number;
  capitalLosses: number;

  // Relief amounts
  pensionContributions: number;
  medicalExpenses: number;
  rentPaid: number;
  charitableDonations: number;
  remoteWorkingCosts: number;

  // Spouse (joint assessment)
  spouseIncome: number;

  // Credit flags
  claimHomeCarer: boolean;
  claimSingleParent: boolean;
  hasPAYEIncome: boolean;

  // Mileage allowance (personal vehicle commute)
  mileageAllowance: number;

  // Preliminary tax already paid
  preliminaryTaxPaid: number;

  // Split-year re-evaluation
  changeEffectiveDate?: string; // ISO date
  preChangeAssessmentBasis?: "single" | "joint" | "separate";
}

export interface TaxBandLine {
  label: string;
  amount: number;
  rate: number;
  tax: number;
}

export interface CreditLine {
  label: string;
  amount: number;
}

export interface Form11Result {
  // Income
  scheduleE: number;
  scheduleD: number;
  rentalProfit: number;
  foreignIncome: number;
  otherIncome: number;
  spouseIncome: number;
  totalGrossIncome: number;

  // Deductions
  pensionRelief: number;
  pensionAgeLimit: number;
  totalDeductions: number;
  assessableIncome: number;

  // Income tax
  incomeTaxBands: TaxBandLine[];
  grossIncomeTax: number;

  // Credits
  credits: CreditLine[];
  totalCredits: number;
  netIncomeTax: number;

  // USC
  uscBands: TaxBandLine[];
  totalUSC: number;
  uscExempt: boolean;

  // PRSI
  prsiAssessable: number;
  prsiCalculated: number;
  prsiPayable: number;

  // CGT
  cgtApplicable: boolean;
  cgtGains: number;
  cgtLosses: number;
  cgtExemption: number;
  cgtPayable: number;

  // Summary
  totalLiability: number;
  preliminaryTaxPaid: number;
  balanceDue: number;

  // Split-year
  splitYearApplied: boolean;
  splitYearNote: string;

  // Notes
  warnings: string[];
  notes: string[];
}

// ── Helpers ──────────────────────────────────────────────────

function calculateIncome(input: Form11Input) {
  // Mileage allowance reduces taxable Schedule E income
  const grossScheduleE = input.salary + input.dividends + input.bik;
  const scheduleE = Math.max(0, grossScheduleE - (input.mileageAllowance || 0));
  const scheduleD = Math.max(0, input.businessIncome - input.businessExpenses - input.capitalAllowances);
  const rentalProfit = Math.max(0, input.rentalIncome - input.rentalExpenses);

  const totalGrossIncome =
    scheduleE + scheduleD + rentalProfit + input.foreignIncome + input.otherIncome + input.spouseIncome;

  return { scheduleE, scheduleD, rentalProfit, totalGrossIncome };
}

function getAge(dob: string): number {
  if (!dob) return 35; // default mid-range
  const birthDate = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function calculateDeductions(input: Form11Input, constants: TaxConstants) {
  const age = getAge(input.dateOfBirth);

  // Pension relief — age-based limit on net relevant earnings
  const band = constants.pensionAgeLimits.find((b) => age <= b.maxAge)!;
  const relevantEarnings = Math.min(input.salary + input.businessIncome, constants.pensionEarningsCap);
  const maxPension = relevantEarnings * band.rate;
  const pensionRelief = Math.min(input.pensionContributions, maxPension);

  return { pensionRelief, pensionAgeLimit: band.rate };
}

function getCutoff(
  basis: Form11Input["assessmentBasis"],
  maritalStatus: Form11Input["maritalStatus"],
  spouseIncome: number,
  constants: TaxConstants,
): number {
  if (basis === "joint" && maritalStatus === "married") {
    const spouseExtra = Math.min(spouseIncome, constants.standardRateCutoff.second_earner_max);
    return constants.standardRateCutoff.single + spouseExtra;
  }
  return constants.standardRateCutoff.single;
}

function calculateIncomeTax(assessableIncome: number, input: Form11Input, constants: TaxConstants, overrideCutoff?: number): TaxBandLine[] {
  if (assessableIncome <= 0) return [];

  const cutoff = overrideCutoff ?? getCutoff(input.assessmentBasis, input.maritalStatus, input.spouseIncome, constants);

  const atStandard = Math.min(assessableIncome, cutoff);
  const atHigher = Math.max(0, assessableIncome - cutoff);

  const bands: TaxBandLine[] = [];

  if (atStandard > 0) {
    bands.push({
      label: "Standard rate (20%)",
      amount: atStandard,
      rate: constants.standardRate,
      tax: atStandard * constants.standardRate,
    });
  }

  if (atHigher > 0) {
    bands.push({
      label: "Higher rate (40%)",
      amount: atHigher,
      rate: constants.higherRate,
      tax: atHigher * constants.higherRate,
    });
  }

  return bands;
}

function calculateCredits(input: Form11Input, constants: TaxConstants): CreditLine[] {
  const lines: CreditLine[] = [];

  // Personal credit
  if (input.maritalStatus === "married" || input.maritalStatus === "civil_partner") {
    lines.push({ label: "Married / Civil Partner Credit", amount: constants.credits.married });
  } else {
    lines.push({ label: "Single Person Credit", amount: constants.credits.single });
  }

  // Earned income credit (self-assessed directors)
  lines.push({ label: "Earned Income Credit", amount: constants.credits.earnedIncome });

  // PAYE credit (only if also in PAYE employment)
  if (input.hasPAYEIncome) {
    lines.push({ label: "PAYE Credit", amount: constants.credits.paye });
  }

  // Home carer
  if (input.claimHomeCarer) {
    lines.push({ label: "Home Carer Credit", amount: constants.credits.homeCarer });
  }

  // Single parent
  if (input.claimSingleParent) {
    lines.push({ label: "Single Parent Credit", amount: constants.credits.singleParent });
  }

  // Medical expenses — 20% tax relief
  if (input.medicalExpenses > 0) {
    lines.push({
      label: "Medical Expenses (20%)",
      amount: Math.round(input.medicalExpenses * constants.medicalReliefRate * 100) / 100,
    });
  }

  // Rent credit
  if (input.rentPaid > 0) {
    const maxRent =
      input.maritalStatus === "married" || input.maritalStatus === "civil_partner"
        ? constants.rentCredit.couple
        : constants.rentCredit.single;
    lines.push({ label: "Rent Tax Credit", amount: Math.min(input.rentPaid, maxRent) });
  }

  // Remote working — 30% of costs at marginal rate (treated as credit here)
  if (input.remoteWorkingCosts > 0) {
    const relief = input.remoteWorkingCosts * constants.remoteWorkingRate;
    lines.push({ label: "Remote Working Relief (30%)", amount: Math.round(relief * 100) / 100 });
  }

  return lines;
}

function calculateUSC(totalIncome: number, constants: TaxConstants): { bands: TaxBandLine[]; exempt: boolean } {
  if (totalIncome <= constants.uscExemptionThreshold) {
    return { bands: [], exempt: true };
  }

  const bands: TaxBandLine[] = [];
  let remaining = totalIncome;

  for (const band of constants.usc) {
    const width = band.to === Infinity ? remaining : band.to - band.from;
    const taxable = Math.min(remaining, width);
    if (taxable <= 0) break;

    bands.push({
      label: `USC ${(band.rate * 100).toFixed(1)}%`,
      amount: taxable,
      rate: band.rate,
      tax: Math.round(taxable * band.rate * 100) / 100,
    });
    remaining -= taxable;
  }

  return { bands, exempt: false };
}

function calculatePRSI(assessableIncome: number, constants: TaxConstants) {
  if (assessableIncome < constants.prsi.threshold) {
    return { assessable: assessableIncome, calculated: 0, payable: 0 };
  }

  const calculated = assessableIncome * constants.prsi.rate;
  const payable = Math.max(calculated, constants.prsi.minimum);

  return {
    assessable: assessableIncome,
    calculated: Math.round(calculated * 100) / 100,
    payable: Math.round(payable * 100) / 100,
  };
}

function calculateCGT(input: Form11Input, constants: TaxConstants) {
  const netGains = input.capitalGains - input.capitalLosses;
  if (netGains <= 0) {
    return { applicable: false, gains: input.capitalGains, losses: input.capitalLosses, exemption: 0, payable: 0 };
  }

  const taxable = Math.max(0, netGains - constants.cgt.annualExemption);
  return {
    applicable: taxable > 0,
    gains: input.capitalGains,
    losses: input.capitalLosses,
    exemption: constants.cgt.annualExemption,
    payable: Math.round(taxable * constants.cgt.rate * 100) / 100,
  };
}

/** Calculate BIK for a company vehicle based on OMV and annual business km */
export function calculateVehicleBIK(omv: number, businessKm: number, taxYear?: number): number {
  const constants = taxYear ? getTaxConstants(taxYear) : TAX_CONSTANTS;
  const band = constants.vehicleBIKBands.find((b) => businessKm <= b.maxKm)!;
  return Math.round(omv * band.rate * 100) / 100;
}

// ── Main Calculator ──────────────────────────────────────────

export function calculateForm11(input: Form11Input, taxYear?: number): Form11Result {
  const constants = taxYear ? getTaxConstants(taxYear) : TAX_CONSTANTS;
  const warnings: string[] = [];
  const notes: string[] = [];

  // Split-year assessment
  let splitYearApplied = false;
  let splitYearNote = "";
  let proportionalCutoff: number | undefined;

  if (input.changeEffectiveDate && input.preChangeAssessmentBasis) {
    const changeDate = new Date(input.changeEffectiveDate);
    const yearStart = new Date(changeDate.getFullYear(), 0, 1);
    const yearEnd = new Date(changeDate.getFullYear(), 11, 31);
    const totalDays = Math.round((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysBefore = Math.round((changeDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysAfter = totalDays - daysBefore;

    const preCutoff = getCutoff(input.preChangeAssessmentBasis, input.maritalStatus, input.spouseIncome, constants);
    const postCutoff = getCutoff(input.assessmentBasis, input.maritalStatus, input.spouseIncome, constants);

    proportionalCutoff = Math.round(preCutoff * (daysBefore / totalDays) + postCutoff * (daysAfter / totalDays));

    splitYearApplied = true;
    splitYearNote =
      `Assessment basis changed on ${input.changeEffectiveDate}. ` +
      `Standard rate cutoff proportioned: ${daysBefore} days at old basis + ${daysAfter} days at new basis = €${proportionalCutoff.toLocaleString("en-IE")}.`;
    notes.push(splitYearNote);
  }

  // Mileage allowance note
  if (input.mileageAllowance > 0) {
    notes.push(
      `Mileage allowance claimed: €${input.mileageAllowance.toLocaleString("en-IE", { minimumFractionDigits: 2 })} (personal vehicle commute — Revenue civil service rates).`,
    );
  }

  // 1. Income
  const income = calculateIncome(input);

  // 2. Deductions
  const deductions = calculateDeductions(input, constants);
  const totalDeductions = deductions.pensionRelief;
  const assessableIncome = Math.max(0, income.totalGrossIncome - totalDeductions);

  if (input.pensionContributions > 0 && deductions.pensionRelief < input.pensionContributions) {
    warnings.push(
      `Pension contributions capped at ${(deductions.pensionAgeLimit * 100).toFixed(0)}% of net relevant earnings (age-based limit). ` +
        `Relief granted: €${deductions.pensionRelief.toLocaleString("en-IE", { minimumFractionDigits: 2 })}`,
    );
  }

  // 3. Income Tax (use proportional cutoff if split-year)
  const incomeTaxBands = calculateIncomeTax(assessableIncome, input, constants, proportionalCutoff);
  const grossIncomeTax = incomeTaxBands.reduce((sum, b) => sum + b.tax, 0);

  // 4. Credits
  const creditLines = calculateCredits(input, constants);
  const totalCredits = creditLines.reduce((sum, c) => sum + c.amount, 0);
  const netIncomeTax = Math.max(0, grossIncomeTax - totalCredits);

  // 5. USC
  const usc = calculateUSC(income.totalGrossIncome, constants);
  const totalUSC = usc.bands.reduce((sum, b) => sum + b.tax, 0);

  if (usc.exempt) {
    notes.push("USC exempt — total income is below €13,000.");
  }

  // 6. PRSI
  const prsi = calculatePRSI(assessableIncome, constants);

  if (prsi.payable > 0 && prsi.payable === constants.prsi.minimum) {
    notes.push(`Minimum PRSI Class S contribution of €${constants.prsi.minimum} applies.`);
  }

  // 7. CGT
  const cgt = calculateCGT(input, constants);

  // 8. Summary
  const totalLiability = Math.round((netIncomeTax + totalUSC + prsi.payable + cgt.payable) * 100) / 100;
  const balanceDue = Math.round((totalLiability - input.preliminaryTaxPaid) * 100) / 100;

  if (balanceDue < 0) {
    notes.push("Overpayment detected — you may be due a refund.");
  }

  if (input.charitableDonations > 0 && input.charitableDonations < constants.charitableMinimum) {
    warnings.push(`Charitable donations must be at least €${constants.charitableMinimum} to qualify for relief.`);
  }

  return {
    // Income
    scheduleE: income.scheduleE,
    scheduleD: income.scheduleD,
    rentalProfit: income.rentalProfit,
    foreignIncome: input.foreignIncome,
    otherIncome: input.otherIncome,
    spouseIncome: input.spouseIncome,
    totalGrossIncome: income.totalGrossIncome,

    // Deductions
    pensionRelief: deductions.pensionRelief,
    pensionAgeLimit: deductions.pensionAgeLimit,
    totalDeductions,
    assessableIncome,

    // Income tax
    incomeTaxBands,
    grossIncomeTax: Math.round(grossIncomeTax * 100) / 100,

    // Credits
    credits: creditLines,
    totalCredits,
    netIncomeTax: Math.round(netIncomeTax * 100) / 100,

    // USC
    uscBands: usc.bands,
    totalUSC: Math.round(totalUSC * 100) / 100,
    uscExempt: usc.exempt,

    // PRSI
    prsiAssessable: prsi.assessable,
    prsiCalculated: prsi.calculated,
    prsiPayable: prsi.payable,

    // CGT
    cgtApplicable: cgt.applicable,
    cgtGains: cgt.gains,
    cgtLosses: cgt.losses,
    cgtExemption: cgt.exemption,
    cgtPayable: cgt.payable,

    // Summary
    totalLiability,
    preliminaryTaxPaid: input.preliminaryTaxPaid,
    balanceDue,

    // Split-year
    splitYearApplied,
    splitYearNote,

    // Notes
    warnings,
    notes,
  };
}
