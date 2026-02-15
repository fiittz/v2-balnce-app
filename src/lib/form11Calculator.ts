// ──────────────────────────────────────────────────────────────
// Form 11 Calculation Engine — Irish Income Tax (Self-Assessed)
// Pure TypeScript, zero React / Supabase dependencies
// ──────────────────────────────────────────────────────────────

// ── Tax Constants (2026 tax year) ────────────────────────────

export const TAX_CONSTANTS = {
  // Income Tax Bands (2026 — unchanged from 2025)
  standardRateCutoff: {
    single: 44_000,
    married_one_income: 53_000,
    married_two_incomes: 88_000, // max increase of €44,000 for 2nd earner
    second_earner_max: 44_000,
  },
  standardRate: 0.20,
  higherRate: 0.40,

  // USC Bands (2026 — self-assessed, includes 11% surcharge band)
  usc: [
    { from: 0, to: 12_012, rate: 0.005 },
    { from: 12_012, to: 28_700, rate: 0.02 },
    { from: 28_700, to: 70_044, rate: 0.03 },
    { from: 70_044, to: 100_000, rate: 0.08 },
    { from: 100_000, to: Infinity, rate: 0.11 },
  ],
  uscExemptionThreshold: 13_000,

  // PRSI Class S (self-employed / directors) — 2026
  prsi: {
    rate: 0.042,     // 4.2% Jan–Sep 2026 (rises to 4.35% from Oct 2026)
    minimum: 500,
    threshold: 5_000,
  },

  // Tax Credits (2026 — unchanged from 2025)
  credits: {
    single: 2_000,
    married: 4_000,
    earnedIncome: 2_000,
    paye: 2_000,
    homeCarer: 1_800,
    singleParent: 1_750,
  },

  // Pension Relief — age-based % of net relevant earnings
  pensionAgeLimits: [
    { maxAge: 29, rate: 0.15 },
    { maxAge: 39, rate: 0.20 },
    { maxAge: 49, rate: 0.25 },
    { maxAge: 54, rate: 0.30 },
    { maxAge: 59, rate: 0.35 },
    { maxAge: Infinity, rate: 0.40 },
  ] as const,
  pensionEarningsCap: 115_000,

  // Other Reliefs
  medicalReliefRate: 0.20,
  rentCredit: { single: 1_000, couple: 2_000 },
  remoteWorkingRate: 0.30, // 30% of vouched costs
  charitableMinimum: 250,

  // CGT
  cgt: {
    rate: 0.33,
    annualExemption: 1_270,
  },

  // BIK Vehicle — mileage-based % of OMV
  vehicleBIKBands: [
    { maxKm: 24_000, rate: 0.2267 },
    { maxKm: 32_000, rate: 0.1800 },
    { maxKm: 40_000, rate: 0.1350 },
    { maxKm: 48_000, rate: 0.0900 },
    { maxKm: Infinity, rate: 0.0450 },
  ] as const,
} as const;

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
    scheduleE +
    scheduleD +
    rentalProfit +
    input.foreignIncome +
    input.otherIncome +
    input.spouseIncome;

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

function calculateDeductions(input: Form11Input) {
  const age = getAge(input.dateOfBirth);

  // Pension relief — age-based limit on net relevant earnings
  const band = TAX_CONSTANTS.pensionAgeLimits.find((b) => age <= b.maxAge)!;
  const relevantEarnings = Math.min(
    input.salary + input.businessIncome,
    TAX_CONSTANTS.pensionEarningsCap
  );
  const maxPension = relevantEarnings * band.rate;
  const pensionRelief = Math.min(input.pensionContributions, maxPension);

  return { pensionRelief, pensionAgeLimit: band.rate };
}

function getCutoff(basis: Form11Input["assessmentBasis"], maritalStatus: Form11Input["maritalStatus"], spouseIncome: number): number {
  if (basis === "joint" && maritalStatus === "married") {
    const spouseExtra = Math.min(spouseIncome, TAX_CONSTANTS.standardRateCutoff.second_earner_max);
    return TAX_CONSTANTS.standardRateCutoff.single + spouseExtra;
  }
  return TAX_CONSTANTS.standardRateCutoff.single;
}

function calculateIncomeTax(
  assessableIncome: number,
  input: Form11Input,
  overrideCutoff?: number
): TaxBandLine[] {
  if (assessableIncome <= 0) return [];

  const cutoff = overrideCutoff ?? getCutoff(input.assessmentBasis, input.maritalStatus, input.spouseIncome);

  const atStandard = Math.min(assessableIncome, cutoff);
  const atHigher = Math.max(0, assessableIncome - cutoff);

  const bands: TaxBandLine[] = [];

  if (atStandard > 0) {
    bands.push({
      label: "Standard rate (20%)",
      amount: atStandard,
      rate: TAX_CONSTANTS.standardRate,
      tax: atStandard * TAX_CONSTANTS.standardRate,
    });
  }

  if (atHigher > 0) {
    bands.push({
      label: "Higher rate (40%)",
      amount: atHigher,
      rate: TAX_CONSTANTS.higherRate,
      tax: atHigher * TAX_CONSTANTS.higherRate,
    });
  }

  return bands;
}

function calculateCredits(input: Form11Input): CreditLine[] {
  const lines: CreditLine[] = [];

  // Personal credit
  if (
    input.maritalStatus === "married" ||
    input.maritalStatus === "civil_partner"
  ) {
    lines.push({ label: "Married / Civil Partner Credit", amount: TAX_CONSTANTS.credits.married });
  } else {
    lines.push({ label: "Single Person Credit", amount: TAX_CONSTANTS.credits.single });
  }

  // Earned income credit (self-assessed directors)
  lines.push({ label: "Earned Income Credit", amount: TAX_CONSTANTS.credits.earnedIncome });

  // PAYE credit (only if also in PAYE employment)
  if (input.hasPAYEIncome) {
    lines.push({ label: "PAYE Credit", amount: TAX_CONSTANTS.credits.paye });
  }

  // Home carer
  if (input.claimHomeCarer) {
    lines.push({ label: "Home Carer Credit", amount: TAX_CONSTANTS.credits.homeCarer });
  }

  // Single parent
  if (input.claimSingleParent) {
    lines.push({ label: "Single Parent Credit", amount: TAX_CONSTANTS.credits.singleParent });
  }

  // Medical expenses — 20% tax relief
  if (input.medicalExpenses > 0) {
    lines.push({
      label: "Medical Expenses (20%)",
      amount: Math.round(input.medicalExpenses * TAX_CONSTANTS.medicalReliefRate * 100) / 100,
    });
  }

  // Rent credit
  if (input.rentPaid > 0) {
    const maxRent =
      input.maritalStatus === "married" || input.maritalStatus === "civil_partner"
        ? TAX_CONSTANTS.rentCredit.couple
        : TAX_CONSTANTS.rentCredit.single;
    lines.push({ label: "Rent Tax Credit", amount: Math.min(input.rentPaid, maxRent) });
  }

  // Remote working — 30% of costs at marginal rate (treated as credit here)
  if (input.remoteWorkingCosts > 0) {
    const relief = input.remoteWorkingCosts * TAX_CONSTANTS.remoteWorkingRate;
    lines.push({ label: "Remote Working Relief (30%)", amount: Math.round(relief * 100) / 100 });
  }

  return lines;
}

function calculateUSC(totalIncome: number): { bands: TaxBandLine[]; exempt: boolean } {
  if (totalIncome <= TAX_CONSTANTS.uscExemptionThreshold) {
    return { bands: [], exempt: true };
  }

  const bands: TaxBandLine[] = [];
  let remaining = totalIncome;

  for (const band of TAX_CONSTANTS.usc) {
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

function calculatePRSI(assessableIncome: number) {
  if (assessableIncome < TAX_CONSTANTS.prsi.threshold) {
    return { assessable: assessableIncome, calculated: 0, payable: 0 };
  }

  const calculated = assessableIncome * TAX_CONSTANTS.prsi.rate;
  const payable = Math.max(calculated, TAX_CONSTANTS.prsi.minimum);

  return {
    assessable: assessableIncome,
    calculated: Math.round(calculated * 100) / 100,
    payable: Math.round(payable * 100) / 100,
  };
}

function calculateCGT(input: Form11Input) {
  const netGains = input.capitalGains - input.capitalLosses;
  if (netGains <= 0) {
    return { applicable: false, gains: input.capitalGains, losses: input.capitalLosses, exemption: 0, payable: 0 };
  }

  const taxable = Math.max(0, netGains - TAX_CONSTANTS.cgt.annualExemption);
  return {
    applicable: taxable > 0,
    gains: input.capitalGains,
    losses: input.capitalLosses,
    exemption: TAX_CONSTANTS.cgt.annualExemption,
    payable: Math.round(taxable * TAX_CONSTANTS.cgt.rate * 100) / 100,
  };
}

/** Calculate BIK for a company vehicle based on OMV and annual business km */
export function calculateVehicleBIK(omv: number, businessKm: number): number {
  const band = TAX_CONSTANTS.vehicleBIKBands.find((b) => businessKm <= b.maxKm)!;
  return Math.round(omv * band.rate * 100) / 100;
}

// ── Main Calculator ──────────────────────────────────────────

export function calculateForm11(input: Form11Input): Form11Result {
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

    const preCutoff = getCutoff(input.preChangeAssessmentBasis, input.maritalStatus, input.spouseIncome);
    const postCutoff = getCutoff(input.assessmentBasis, input.maritalStatus, input.spouseIncome);

    proportionalCutoff = Math.round(
      (preCutoff * (daysBefore / totalDays)) + (postCutoff * (daysAfter / totalDays))
    );

    splitYearApplied = true;
    splitYearNote = `Assessment basis changed on ${input.changeEffectiveDate}. ` +
      `Standard rate cutoff proportioned: ${daysBefore} days at old basis + ${daysAfter} days at new basis = €${proportionalCutoff.toLocaleString("en-IE")}.`;
    notes.push(splitYearNote);
  }

  // Mileage allowance note
  if (input.mileageAllowance > 0) {
    notes.push(
      `Mileage allowance claimed: €${input.mileageAllowance.toLocaleString("en-IE", { minimumFractionDigits: 2 })} (personal vehicle commute — Revenue civil service rates).`
    );
  }

  // 1. Income
  const income = calculateIncome(input);

  // 2. Deductions
  const deductions = calculateDeductions(input);
  const totalDeductions = deductions.pensionRelief;
  const assessableIncome = Math.max(0, income.totalGrossIncome - totalDeductions);

  if (input.pensionContributions > 0 && deductions.pensionRelief < input.pensionContributions) {
    warnings.push(
      `Pension contributions capped at ${(deductions.pensionAgeLimit * 100).toFixed(0)}% of net relevant earnings (age-based limit). ` +
      `Relief granted: €${deductions.pensionRelief.toLocaleString("en-IE", { minimumFractionDigits: 2 })}`
    );
  }

  // 3. Income Tax (use proportional cutoff if split-year)
  const incomeTaxBands = calculateIncomeTax(assessableIncome, input, proportionalCutoff);
  const grossIncomeTax = incomeTaxBands.reduce((sum, b) => sum + b.tax, 0);

  // 4. Credits
  const creditLines = calculateCredits(input);
  const totalCredits = creditLines.reduce((sum, c) => sum + c.amount, 0);
  const netIncomeTax = Math.max(0, grossIncomeTax - totalCredits);

  // 5. USC
  const usc = calculateUSC(income.totalGrossIncome);
  const totalUSC = usc.bands.reduce((sum, b) => sum + b.tax, 0);

  if (usc.exempt) {
    notes.push("USC exempt — total income is below €13,000.");
  }

  // 6. PRSI
  const prsi = calculatePRSI(assessableIncome);

  if (prsi.payable > 0 && prsi.payable === TAX_CONSTANTS.prsi.minimum) {
    notes.push("Minimum PRSI Class S contribution of €500 applies.");
  }

  // 7. CGT
  const cgt = calculateCGT(input);

  // 8. Summary
  const totalLiability =
    Math.round((netIncomeTax + totalUSC + prsi.payable + cgt.payable) * 100) / 100;
  const balanceDue =
    Math.round((totalLiability - input.preliminaryTaxPaid) * 100) / 100;

  if (balanceDue < 0) {
    notes.push("Overpayment detected — you may be due a refund.");
  }

  if (input.charitableDonations > 0 && input.charitableDonations < TAX_CONSTANTS.charitableMinimum) {
    warnings.push(
      `Charitable donations must be at least €${TAX_CONSTANTS.charitableMinimum} to qualify for relief.`
    );
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
