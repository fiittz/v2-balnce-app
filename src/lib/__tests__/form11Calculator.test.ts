import { describe, it, expect } from "vitest";
import { calculateForm11, calculateVehicleBIK, TAX_CONSTANTS, type Form11Input } from "../form11Calculator";

// ── Helper: minimal valid input ──────────────────────────────
function baseInput(overrides: Partial<Form11Input> = {}): Form11Input {
  return {
    directorName: "Test User",
    ppsNumber: "1234567T",
    dateOfBirth: "1985-06-15",
    maritalStatus: "single",
    assessmentBasis: "single",
    salary: 0,
    dividends: 0,
    bik: 0,
    businessIncome: 0,
    businessExpenses: 0,
    capitalAllowances: 0,
    rentalIncome: 0,
    rentalExpenses: 0,
    foreignIncome: 0,
    otherIncome: 0,
    capitalGains: 0,
    capitalLosses: 0,
    pensionContributions: 0,
    medicalExpenses: 0,
    rentPaid: 0,
    charitableDonations: 0,
    remoteWorkingCosts: 0,
    spouseIncome: 0,
    claimHomeCarer: false,
    claimSingleParent: false,
    hasPAYEIncome: false,
    mileageAllowance: 0,
    preliminaryTaxPaid: 0,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// TAX_CONSTANTS
// ══════════════════════════════════════════════════════════════
describe("TAX_CONSTANTS", () => {
  it("has correct standard rate cutoff for single person", () => {
    expect(TAX_CONSTANTS.standardRateCutoff.single).toBe(44_000);
  });

  it("has correct married two-income cutoff", () => {
    expect(TAX_CONSTANTS.standardRateCutoff.married_two_incomes).toBe(88_000);
  });

  it("has 5 USC bands ending with 11% surcharge", () => {
    expect(TAX_CONSTANTS.usc).toHaveLength(5);
    expect(TAX_CONSTANTS.usc[4].rate).toBe(0.11);
  });

  it("has correct PRSI Class S rate and minimum", () => {
    expect(TAX_CONSTANTS.prsi.rate).toBe(0.042);
    expect(TAX_CONSTANTS.prsi.minimum).toBe(500);
  });

  it("has correct CGT rate and annual exemption", () => {
    expect(TAX_CONSTANTS.cgt.rate).toBe(0.33);
    expect(TAX_CONSTANTS.cgt.annualExemption).toBe(1_270);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateVehicleBIK
// ══════════════════════════════════════════════════════════════
describe("calculateVehicleBIK", () => {
  it("applies 22.67% for low mileage (< 24,000 km)", () => {
    const bik = calculateVehicleBIK(30_000, 10_000);
    expect(bik).toBe(6801); // 30000 * 0.2267
  });

  it("applies 18% for 24,001–32,000 km band", () => {
    const bik = calculateVehicleBIK(30_000, 28_000);
    expect(bik).toBe(5400); // 30000 * 0.18
  });

  it("applies 13.5% for 32,001–40,000 km band", () => {
    const bik = calculateVehicleBIK(40_000, 35_000);
    expect(bik).toBe(5400); // 40000 * 0.135
  });

  it("applies 9% for 40,001–48,000 km band", () => {
    const bik = calculateVehicleBIK(50_000, 45_000);
    expect(bik).toBe(4500); // 50000 * 0.09
  });

  it("applies 4.5% for 48,001+ km band", () => {
    const bik = calculateVehicleBIK(50_000, 60_000);
    expect(bik).toBe(2250); // 50000 * 0.045
  });

  it("returns 0 for zero OMV", () => {
    expect(calculateVehicleBIK(0, 10_000)).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateForm11 — Zero income
// ══════════════════════════════════════════════════════════════
describe("calculateForm11 — zero income", () => {
  it("returns zero liability for zero income", () => {
    const result = calculateForm11(baseInput());
    expect(result.totalGrossIncome).toBe(0);
    expect(result.totalLiability).toBe(0);
    expect(result.balanceDue).toBe(0);
  });

  it("marks USC exempt when income below threshold", () => {
    const result = calculateForm11(baseInput({ salary: 12_000 }));
    expect(result.uscExempt).toBe(true);
    expect(result.totalUSC).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateForm11 — Income aggregation
// ══════════════════════════════════════════════════════════════
describe("calculateForm11 — income aggregation", () => {
  it("correctly aggregates Schedule E (salary + dividends + BIK)", () => {
    const result = calculateForm11(baseInput({ salary: 50_000, dividends: 5_000, bik: 3_000 }));
    expect(result.scheduleE).toBe(58_000);
  });

  it("calculates Schedule D as income minus expenses minus capital allowances", () => {
    const result = calculateForm11(
      baseInput({
        businessIncome: 100_000,
        businessExpenses: 30_000,
        capitalAllowances: 10_000,
      }),
    );
    expect(result.scheduleD).toBe(60_000);
  });

  it("does not allow negative Schedule D", () => {
    const result = calculateForm11(
      baseInput({
        businessIncome: 10_000,
        businessExpenses: 50_000,
      }),
    );
    expect(result.scheduleD).toBe(0);
  });

  it("calculates rental profit correctly", () => {
    const result = calculateForm11(baseInput({ rentalIncome: 20_000, rentalExpenses: 8_000 }));
    expect(result.rentalProfit).toBe(12_000);
  });

  it("does not allow negative rental profit", () => {
    const result = calculateForm11(baseInput({ rentalIncome: 5_000, rentalExpenses: 10_000 }));
    expect(result.rentalProfit).toBe(0);
  });

  it("reduces Schedule E by mileage allowance", () => {
    const result = calculateForm11(baseInput({ salary: 50_000, mileageAllowance: 5_000 }));
    expect(result.scheduleE).toBe(45_000);
  });

  it("does not allow negative Schedule E from mileage", () => {
    const result = calculateForm11(baseInput({ salary: 3_000, mileageAllowance: 5_000 }));
    expect(result.scheduleE).toBe(0);
  });

  it("includes spouse income in total gross", () => {
    const result = calculateForm11(
      baseInput({
        salary: 40_000,
        spouseIncome: 30_000,
        maritalStatus: "married",
        assessmentBasis: "joint",
      }),
    );
    expect(result.totalGrossIncome).toBe(70_000);
    expect(result.spouseIncome).toBe(30_000);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateForm11 — Income tax bands
// ══════════════════════════════════════════════════════════════
describe("calculateForm11 — income tax bands", () => {
  it("taxes income at standard rate when within cutoff", () => {
    const result = calculateForm11(baseInput({ salary: 30_000 }));
    expect(result.incomeTaxBands).toHaveLength(1);
    expect(result.incomeTaxBands[0].rate).toBe(0.2);
    expect(result.incomeTaxBands[0].tax).toBe(6_000);
  });

  it("splits income between standard and higher rate", () => {
    const result = calculateForm11(baseInput({ salary: 60_000 }));
    expect(result.incomeTaxBands).toHaveLength(2);
    // Standard: 44,000 * 0.20 = 8,800
    expect(result.incomeTaxBands[0].amount).toBe(44_000);
    expect(result.incomeTaxBands[0].tax).toBe(8_800);
    // Higher: 16,000 * 0.40 = 6,400
    expect(result.incomeTaxBands[1].amount).toBe(16_000);
    expect(result.incomeTaxBands[1].tax).toBe(6_400);
  });

  it("increases cutoff for married joint assessment with spouse income", () => {
    const result = calculateForm11(
      baseInput({
        salary: 70_000,
        spouseIncome: 20_000,
        maritalStatus: "married",
        assessmentBasis: "joint",
      }),
    );
    // Cutoff: 44,000 + min(20,000, 33,000) = 64,000
    // Total income: 90,000. Standard: 64,000. Higher: 26,000.
    expect(result.incomeTaxBands[0].amount).toBe(64_000);
    expect(result.incomeTaxBands[1].amount).toBe(26_000);
  });

  it("caps spouse cutoff increase at €33,000", () => {
    const result = calculateForm11(
      baseInput({
        salary: 100_000,
        spouseIncome: 50_000,
        maritalStatus: "married",
        assessmentBasis: "joint",
      }),
    );
    // Cutoff: 44,000 + 44,000 = 88,000 (spouse income capped at second_earner_max)
    expect(result.incomeTaxBands[0].amount).toBe(88_000);
  });

  it("uses single cutoff for separated assessment", () => {
    const result = calculateForm11(
      baseInput({
        salary: 60_000,
        spouseIncome: 20_000,
        maritalStatus: "married",
        assessmentBasis: "separate",
      }),
    );
    // Separate = single cutoff of 44,000
    expect(result.incomeTaxBands[0].amount).toBe(44_000);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateForm11 — Credits
// ══════════════════════════════════════════════════════════════
describe("calculateForm11 — credits", () => {
  it("gives single person credit to single person", () => {
    const result = calculateForm11(baseInput({ salary: 50_000 }));
    const singleCredit = result.credits.find((c) => c.label.includes("Single Person"));
    expect(singleCredit).toBeDefined();
    expect(singleCredit!.amount).toBe(2_000);
  });

  it("gives married credit to married person", () => {
    const result = calculateForm11(baseInput({ salary: 50_000, maritalStatus: "married", assessmentBasis: "joint" }));
    const marriedCredit = result.credits.find((c) => c.label.includes("Married"));
    expect(marriedCredit).toBeDefined();
    expect(marriedCredit!.amount).toBe(4_000);
  });

  it("always includes earned income credit", () => {
    const result = calculateForm11(baseInput({ salary: 50_000 }));
    const earnedIncome = result.credits.find((c) => c.label.includes("Earned Income"));
    expect(earnedIncome).toBeDefined();
    expect(earnedIncome!.amount).toBe(2_000);
  });

  it("includes PAYE credit only when hasPAYEIncome is true", () => {
    const withPaye = calculateForm11(baseInput({ salary: 50_000, hasPAYEIncome: true }));
    const withoutPaye = calculateForm11(baseInput({ salary: 50_000, hasPAYEIncome: false }));
    expect(withPaye.credits.some((c) => c.label.includes("PAYE"))).toBe(true);
    expect(withoutPaye.credits.some((c) => c.label.includes("PAYE"))).toBe(false);
  });

  it("includes home carer credit when claimed", () => {
    const result = calculateForm11(baseInput({ salary: 50_000, claimHomeCarer: true }));
    const hcCredit = result.credits.find((c) => c.label.includes("Home Carer"));
    expect(hcCredit).toBeDefined();
    expect(hcCredit!.amount).toBe(1_800);
  });

  it("includes single parent credit when claimed", () => {
    const result = calculateForm11(baseInput({ salary: 50_000, claimSingleParent: true }));
    const spCredit = result.credits.find((c) => c.label.includes("Single Parent"));
    expect(spCredit).toBeDefined();
    expect(spCredit!.amount).toBe(1_750);
  });

  it("calculates medical expenses at 20%", () => {
    const result = calculateForm11(baseInput({ salary: 50_000, medicalExpenses: 2_000 }));
    const medCredit = result.credits.find((c) => c.label.includes("Medical"));
    expect(medCredit).toBeDefined();
    expect(medCredit!.amount).toBe(400); // 2000 * 0.20
  });

  it("caps rent credit at €1,000 for single", () => {
    const result = calculateForm11(baseInput({ salary: 50_000, rentPaid: 5_000 }));
    const rentCredit = result.credits.find((c) => c.label.includes("Rent"));
    expect(rentCredit).toBeDefined();
    expect(rentCredit!.amount).toBe(1_000);
  });

  it("caps rent credit at €2,000 for married", () => {
    const result = calculateForm11(baseInput({ salary: 50_000, rentPaid: 5_000, maritalStatus: "married" }));
    const rentCredit = result.credits.find((c) => c.label.includes("Rent"));
    expect(rentCredit!.amount).toBe(2_000);
  });

  it("calculates remote working relief at 30%", () => {
    const result = calculateForm11(baseInput({ salary: 50_000, remoteWorkingCosts: 1_000 }));
    const rwCredit = result.credits.find((c) => c.label.includes("Remote Working"));
    expect(rwCredit).toBeDefined();
    expect(rwCredit!.amount).toBe(300); // 1000 * 0.30
  });

  it("net income tax does not go below zero", () => {
    const result = calculateForm11(baseInput({ salary: 5_000 }));
    // Gross tax (5000 * 0.20 = 1000) minus credits (2000 + 2000 = 4000)
    expect(result.netIncomeTax).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateForm11 — USC
// ══════════════════════════════════════════════════════════════
describe("calculateForm11 — USC", () => {
  it("exempts USC when total income <= €13,000", () => {
    const result = calculateForm11(baseInput({ salary: 13_000 }));
    expect(result.uscExempt).toBe(true);
    expect(result.totalUSC).toBe(0);
  });

  it("charges USC when total income > €13,000", () => {
    const result = calculateForm11(baseInput({ salary: 13_001 }));
    expect(result.uscExempt).toBe(false);
    expect(result.totalUSC).toBeGreaterThan(0);
  });

  it("applies correct banded USC for €50,000 income", () => {
    const result = calculateForm11(baseInput({ salary: 50_000 }));
    // Band 1: 12,012 * 0.5% = 60.06
    // Band 2: 16,688 * 2% = 333.76 (28,700 - 12,012)
    // Band 3: 21,300 * 3% = 639.00 (50,000 - 28,700)
    // Total ≈ 1,032.82
    expect(result.uscBands).toHaveLength(3);
    expect(result.uscBands[0].tax).toBeCloseTo(60.06, 1);
    expect(result.uscBands[1].tax).toBeCloseTo(333.76, 1);
    expect(result.uscBands[2].tax).toBeCloseTo(639.0, 1);
  });

  it("applies 11% surcharge band for income > €100,000", () => {
    const result = calculateForm11(baseInput({ salary: 120_000 }));
    expect(result.uscBands).toHaveLength(5);
    expect(result.uscBands[4].rate).toBe(0.11);
    expect(result.uscBands[4].amount).toBe(20_000);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateForm11 — PRSI
// ══════════════════════════════════════════════════════════════
describe("calculateForm11 — PRSI", () => {
  it("charges no PRSI when income below €5,000 threshold", () => {
    const result = calculateForm11(baseInput({ salary: 4_999 }));
    expect(result.prsiPayable).toBe(0);
  });

  it("charges minimum €500 PRSI when calculated amount is lower", () => {
    const result = calculateForm11(baseInput({ salary: 10_000 }));
    // 10000 * 0.042 = 420 → minimum 500 applies
    expect(result.prsiPayable).toBe(500);
  });

  it("charges 4.2% PRSI when above minimum", () => {
    const result = calculateForm11(baseInput({ salary: 60_000 }));
    // 60000 * 0.042 = 2520
    expect(result.prsiCalculated).toBe(2520);
    expect(result.prsiPayable).toBe(2520);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateForm11 — CGT
// ══════════════════════════════════════════════════════════════
describe("calculateForm11 — CGT", () => {
  it("charges no CGT when gains <= losses", () => {
    const result = calculateForm11(baseInput({ capitalGains: 5_000, capitalLosses: 6_000 }));
    expect(result.cgtApplicable).toBe(false);
    expect(result.cgtPayable).toBe(0);
  });

  it("applies €1,270 annual exemption", () => {
    const result = calculateForm11(baseInput({ capitalGains: 2_000, capitalLosses: 0 }));
    // Taxable: 2000 - 1270 = 730. CGT: 730 * 0.33 = 240.90
    expect(result.cgtApplicable).toBe(true);
    expect(result.cgtPayable).toBeCloseTo(240.9, 1);
  });

  it("charges no CGT when net gains within exemption", () => {
    const result = calculateForm11(baseInput({ capitalGains: 1_270, capitalLosses: 0 }));
    expect(result.cgtApplicable).toBe(false);
    expect(result.cgtPayable).toBe(0);
  });

  it("charges 33% CGT on gains above exemption", () => {
    const result = calculateForm11(baseInput({ capitalGains: 11_270, capitalLosses: 0 }));
    // Taxable: 11270 - 1270 = 10000. CGT: 10000 * 0.33 = 3300
    expect(result.cgtPayable).toBe(3300);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateForm11 — Pension relief
// ══════════════════════════════════════════════════════════════
describe("calculateForm11 — pension relief", () => {
  it("applies age-based limit (20% for age 35)", () => {
    const result = calculateForm11(
      baseInput({
        dateOfBirth: "1990-01-01", // ~36 in 2026 → 30-39 band = 20%
        salary: 80_000,
        pensionContributions: 20_000,
      }),
    );
    // Max: 80000 * 0.20 = 16000
    expect(result.pensionRelief).toBe(16_000);
  });

  it("caps pension relief at earnings cap", () => {
    const result = calculateForm11(
      baseInput({
        dateOfBirth: "1960-01-01", // 60+ → 40%
        salary: 200_000,
        pensionContributions: 100_000,
      }),
    );
    // Relevant earnings capped at 115,000. Max: 115000 * 0.40 = 46000
    expect(result.pensionRelief).toBe(46_000);
  });

  it("generates warning when contributions exceed age-based limit", () => {
    const result = calculateForm11(
      baseInput({
        dateOfBirth: "1990-01-01",
        salary: 50_000,
        pensionContributions: 15_000,
      }),
    );
    // Max: 50000 * 0.20 = 10000, contributed 15000
    expect(result.pensionRelief).toBe(10_000);
    expect(result.warnings.some((w) => w.includes("Pension contributions capped"))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateForm11 — Summary and balance
// ══════════════════════════════════════════════════════════════
describe("calculateForm11 — summary", () => {
  it("calculates total liability as income tax + USC + PRSI + CGT", () => {
    const result = calculateForm11(baseInput({ salary: 60_000, capitalGains: 5_000 }));
    const expectedLiability = result.netIncomeTax + result.totalUSC + result.prsiPayable + result.cgtPayable;
    expect(result.totalLiability).toBeCloseTo(expectedLiability, 2);
  });

  it("calculates balance due as liability minus preliminary tax paid", () => {
    const result = calculateForm11(baseInput({ salary: 60_000, preliminaryTaxPaid: 5_000 }));
    expect(result.balanceDue).toBeCloseTo(result.totalLiability - 5_000, 2);
  });

  it("notes overpayment when preliminary tax exceeds liability", () => {
    const result = calculateForm11(baseInput({ salary: 10_000, preliminaryTaxPaid: 50_000 }));
    expect(result.balanceDue).toBeLessThan(0);
    expect(result.notes.some((n) => n.includes("Overpayment"))).toBe(true);
  });

  it("warns about charitable donations below €250", () => {
    const result = calculateForm11(baseInput({ salary: 50_000, charitableDonations: 100 }));
    expect(result.warnings.some((w) => w.includes("€250"))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateForm11 — Split-year
// ══════════════════════════════════════════════════════════════
describe("calculateForm11 — split-year", () => {
  it("applies proportional cutoff when change effective date is set", () => {
    const result = calculateForm11(
      baseInput({
        salary: 80_000,
        maritalStatus: "married",
        assessmentBasis: "joint",
        spouseIncome: 30_000,
        changeEffectiveDate: "2024-07-01",
        preChangeAssessmentBasis: "single",
      }),
    );
    expect(result.splitYearApplied).toBe(true);
    expect(result.splitYearNote).toContain("Assessment basis changed");
    // Pre: single cutoff (44,000), Post: joint cutoff (44000 + 30000 = 74000)
    // ~182 days single, ~184 days joint → weighted average ≈ 59,000ish
    expect(result.incomeTaxBands[0].amount).toBeGreaterThan(44_000);
    expect(result.incomeTaxBands[0].amount).toBeLessThan(74_000);
  });

  it("does not apply split-year when no change date", () => {
    const result = calculateForm11(baseInput({ salary: 50_000 }));
    expect(result.splitYearApplied).toBe(false);
    expect(result.splitYearNote).toBe("");
  });
});

// ══════════════════════════════════════════════════════════════
// Integration test — typical director scenario
// ══════════════════════════════════════════════════════════════
describe("calculateForm11 — integration: typical director", () => {
  it("calculates correctly for a single director with €75k salary", () => {
    const result = calculateForm11(
      baseInput({
        salary: 75_000,
        hasPAYEIncome: true,
        pensionContributions: 5_000,
        medicalExpenses: 1_000,
      }),
    );

    // Income
    expect(result.scheduleE).toBe(75_000);
    expect(result.totalGrossIncome).toBe(75_000);

    // Pension: age 40 (born 1985, now 2026) → 25% band. Max: 75000 * 0.25 = 18750
    expect(result.pensionRelief).toBe(5_000);
    expect(result.assessableIncome).toBe(70_000);

    // Tax bands: 44,000 @ 20% + 26,000 @ 40%
    expect(result.incomeTaxBands[0].tax).toBe(8_800);
    expect(result.incomeTaxBands[1].tax).toBe(10_400);
    expect(result.grossIncomeTax).toBe(19_200);

    // Credits: single (2000) + earned income (2000) + PAYE (2000) + medical (200) = 6200
    expect(result.totalCredits).toBe(6_200);
    expect(result.netIncomeTax).toBe(13_000);

    // USC on 75,000 gross (not assessable)
    expect(result.uscExempt).toBe(false);
    expect(result.totalUSC).toBeGreaterThan(0);

    // PRSI on assessable income (70,000)
    expect(result.prsiPayable).toBeGreaterThan(500);

    // Total liability should be positive
    expect(result.totalLiability).toBeGreaterThan(0);
    expect(result.balanceDue).toBe(result.totalLiability);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateForm11 — getAge fallback (lines 224-229)
// ══════════════════════════════════════════════════════════════
describe("calculateForm11 — empty dateOfBirth fallback", () => {
  it("defaults to age 35 when dateOfBirth is empty string", () => {
    const result = calculateForm11(
      baseInput({
        dateOfBirth: "",
        salary: 80_000,
        pensionContributions: 20_000,
      }),
    );
    // Age defaults to 35 → falls in 30-39 band = 20%
    // Max pension: 80000 * 0.20 = 16000
    expect(result.pensionRelief).toBe(16_000);
  });
});

// ══════════════════════════════════════════════════════════════
// calculateForm11 — getAge birthday not yet passed (line 229)
// ══════════════════════════════════════════════════════════════
describe("calculateForm11 — getAge birthday later in year", () => {
  it("subtracts 1 from age when birthday has not yet occurred this year", () => {
    // Use a DOB with month=December so the birthday is always in the future
    // In Feb 2026, someone born 1986-12-25 should be 39 (not 40 yet)
    // 39 falls in 30-39 band = 20%
    const result = calculateForm11(
      baseInput({
        dateOfBirth: "1986-12-25",
        salary: 80_000,
        pensionContributions: 20_000,
      }),
    );
    // Age = 39 → 30-39 band = 20%, Max: 80000 * 0.20 = 16000
    expect(result.pensionRelief).toBe(16_000);
  });
});
