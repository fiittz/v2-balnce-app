import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useReliefScan } from "@/hooks/useReliefScan";
import { useDirectorOnboarding } from "@/hooks/useDirectorOnboarding";
import {
  calculateForm11,
  calculateVehicleBIK,
  type Form11Input,
  type Form11Result,
} from "@/lib/form11Calculator";
import { calculateAnnualCommuteMileage } from "@/lib/revenueRates";

/**
 * Assembles a Form11Input from three data sources:
 *  1. Director onboarding (localStorage)
 *  2. Form 11 questionnaire (localStorage)
 *  3. Supabase transactions (income / expenses for the tax year)
 *
 * When personal accounts exist, business income/expenses come from
 * "limited_company" accounts and reliefs scan "directors_personal_tax".
 * Otherwise falls back to scanning all transactions.
 *
 * Returns the calculated Form11Result.
 */
export function useForm11Data(directorNumber: number) {
  const { user } = useAuth();

  // Check if personal accounts exist
  const { data: personalAccounts } = useAccounts("directors_personal_tax");
  const hasPersonalAccounts = (personalAccounts?.length ?? 0) > 0;

  // Determine tax year (Irish tax year = calendar year)
  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const startDate = `${taxYear}-01-01`;
  const endDate = `${taxYear}-12-31`;

  // When personal accounts exist, filter business transactions to business accounts
  const businessAccountType = hasPersonalAccounts ? "limited_company" : undefined;

  // Fetch transactions for the tax year
  const {
    data: incomeTransactions,
    isLoading: incomeLoading,
  } = useTransactions({ type: "income", startDate, endDate, accountType: businessAccountType });

  const {
    data: expenseTransactions,
    isLoading: expenseLoading,
  } = useTransactions({ type: "expense", startDate, endDate, accountType: businessAccountType });

  // When personal accounts exist, scan only personal account expenses for reliefs
  const reliefAccountType = hasPersonalAccounts ? "directors_personal_tax" : undefined;
  const { reliefs, isLoading: reliefsLoading } = useReliefScan({ accountType: reliefAccountType });

  // Fetch director onboarding data from Supabase
  const { getDirector, isLoading: directorLoading } = useDirectorOnboarding();

  const isLoading = incomeLoading || expenseLoading || reliefsLoading || directorLoading;

  const { input, result } = useMemo(() => {
    if (!user?.id) return { input: null, result: null };

    // ── 1. Director Onboarding Data (from Supabase) ──────
    const onboarding = getDirector(directorNumber);

    if (!onboarding) return { input: null, result: null };

    // ── 2. Questionnaire Data ────────────────────────────
    const questionnaireRaw = localStorage.getItem(
      `form11_questionnaire_${user.id}_${directorNumber}`
    );
    const questionnaire = questionnaireRaw ? JSON.parse(questionnaireRaw) : null;

    // ── 3. Transaction Totals ────────────────────────────
    const businessIncome = (incomeTransactions ?? []).reduce(
      (sum, t) => sum + Math.abs(Number(t.amount) || 0),
      0
    );
    const businessExpenses = (expenseTransactions ?? []).reduce(
      (sum, t) => sum + Math.abs(Number(t.amount) || 0),
      0
    );

    // ── Map marital status ───────────────────────────────
    const rawMarital = questionnaire?.changes?.assessmentStatus
      ? undefined // changed — don't trust original
      : onboarding.marital_status;

    const maritalStatus = normalizeMaritalStatus(rawMarital);

    // ── Assessment basis ─────────────────────────────────
    const assessmentBasis = normalizeAssessmentBasis(onboarding.assessment_basis);

    // ── Change effective date for split-year ────────────
    const changeEffectiveDate = questionnaire?.changeEffectiveDate
      ? (typeof questionnaire.changeEffectiveDate === "string"
          ? questionnaire.changeEffectiveDate.slice(0, 10)
          : new Date(questionnaire.changeEffectiveDate).toISOString().slice(0, 10))
      : undefined;

    // Pre-change assessment basis (if assessment status changed mid-year)
    const preChangeAssessmentBasis = questionnaire?.changes?.assessmentStatus && changeEffectiveDate
      ? normalizeAssessmentBasis(onboarding.assessment_basis)
      : undefined;

    // ── Salary with pre/post split support ──────────────
    const hasEmploymentSplit = questionnaire?.changes?.employmentStatus && changeEffectiveDate
      && (questionnaire?.preSalaryAmount || questionnaire?.postSalaryAmount);

    // ── Salary / Dividends (questionnaire overrides) ─────
    const salary = hasEmploymentSplit
      ? (questionnaire.preSalaryAmount ?? 0) + (questionnaire.postSalaryAmount ?? 0)
      : questionnaire?.salaryCorrect
        ? (onboarding.annual_salary ?? 0)
        : (questionnaire?.salaryAmount ?? onboarding.annual_salary ?? 0);

    const dividends = questionnaire?.dividendsReceived
      ? (questionnaire?.dividendsAmount ?? onboarding.estimated_dividends ?? 0)
      : 0;

    // ── BIK ──────────────────────────────────────────────
    let bik = questionnaire?.bikEstimatedValue ?? 0;
    if (
      bik === 0 &&
      onboarding.has_bik &&
      onboarding.bik_types?.includes("company_vehicle") &&
      onboarding.company_vehicle_value
    ) {
      bik = calculateVehicleBIK(
        onboarding.company_vehicle_value,
        onboarding.company_vehicle_business_km ?? 24_000
      );
    }

    // ── Mileage Allowance (personal vehicle commute) ─────
    let mileageAllowance = 0;
    if (
      onboarding.commute_method === "personal_vehicle" &&
      onboarding.commute_distance_km > 0
    ) {
      mileageAllowance = calculateAnnualCommuteMileage(
        onboarding.commute_distance_km
      );
    }

    // ── Reliefs (questionnaire overrides auto-detected) ──
    const pensionContributions =
      questionnaire?.pensionContributionsAmount || reliefs?.pension.total || 0;
    const medicalExpenses =
      questionnaire?.medicalExpensesAmount || reliefs?.medical.total || 0;
    const rentPaid =
      questionnaire?.rentReliefAmount || reliefs?.rent.total || 0;
    const charitableDonations =
      questionnaire?.charitableDonationsAmount || reliefs?.charitable.total || 0;
    const remoteWorkingCosts = questionnaire?.remoteWorkingDays
      ? questionnaire.remoteWorkingDays * 3.20 // Revenue flat rate per day
      : 0;

    // ── Spouse ───────────────────────────────────────────
    const spouseIncome =
      assessmentBasis === "joint" && questionnaire?.spouseHasIncome
        ? (questionnaire?.spouseIncomeAmount ?? 0)
        : 0;

    // ── Preliminary tax ──────────────────────────────────
    const preliminaryTaxPaid =
      questionnaire?.preliminaryTaxPaid === "yes"
        ? parseFloat(questionnaire.preliminaryTaxAmount?.replace(/[^0-9.]/g, "") || "0")
        : 0;

    // ── Rental income (edge cases) ───────────────────────
    const rentalIncome = questionnaire?.rentalIncomeAmount ?? 0;
    const rentalExpenses = questionnaire?.rentalExpensesAmount ?? 0;

    // ── Build input ──────────────────────────────────────
    const form11Input: Form11Input = {
      directorName: onboarding.director_name ?? `Director ${directorNumber}`,
      ppsNumber: onboarding.pps_number ?? "",
      dateOfBirth: onboarding.date_of_birth ?? "",
      maritalStatus,
      assessmentBasis,

      salary,
      dividends,
      bik,

      businessIncome,
      businessExpenses,
      capitalAllowances: 0,

      rentalIncome,
      rentalExpenses,
      foreignIncome: 0,
      otherIncome: 0,

      capitalGains: 0,
      capitalLosses: 0,

      pensionContributions,
      medicalExpenses,
      rentPaid,
      charitableDonations,
      remoteWorkingCosts,

      mileageAllowance,

      spouseIncome,

      claimHomeCarer: onboarding.home_carer_credit ?? false,
      claimSingleParent: false,
      hasPAYEIncome: (onboarding.income_sources ?? []).includes("paye_employment"),

      preliminaryTaxPaid,

      changeEffectiveDate,
      preChangeAssessmentBasis,
    };

    const form11Result = calculateForm11(form11Input);

    return { input: form11Input, result: form11Result };
  }, [user?.id, directorNumber, incomeTransactions, expenseTransactions, reliefs, getDirector]);

  return { input, result, isLoading, taxYear };
}

// ── Normalizers ──────────────────────────────────────────────

function normalizeMaritalStatus(
  raw: string | null | undefined
): Form11Input["maritalStatus"] {
  const valid = ["single", "married", "civil_partner", "widowed", "separated"];
  return valid.includes(raw ?? "") ? (raw as Form11Input["maritalStatus"]) : "single";
}

function normalizeAssessmentBasis(
  raw: string | null | undefined
): Form11Input["assessmentBasis"] {
  const valid = ["single", "joint", "separate"];
  return valid.includes(raw ?? "") ? (raw as Form11Input["assessmentBasis"]) : "single";
}
