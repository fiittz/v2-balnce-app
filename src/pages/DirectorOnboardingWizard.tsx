import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, User, Briefcase, Link2, Gift, Calculator, Globe, Check, Plus, X, Banknote, Car, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useDirectorOnboarding } from "@/hooks/useDirectorOnboarding";
import { supabase } from "@/integrations/supabase/client";
import { extractBaseLocation } from "@/lib/tripDetection";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";

import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OnboardingStep =
  | "personal_tax_profile"
  | "employment_salary"
  | "work_location_commute"
  | "benefits_in_kind"
  | "income_sources"
  | "business_links"
  | "reliefs_credits"
  | "preliminary_tax"
  | "foreign_income_cgt"
  | "declaration";

interface OnboardingState {
  // Step 1: Personal Tax Profile
  tax_year_start: string;
  assessment_basis: "single" | "joint" | "separate" | "";
  director_name: string;
  pps_number: string;
  date_of_birth: string;
  marital_status: "single" | "married" | "civil_partner" | "widowed" | "separated" | "";

  // Step 2: Employment & Salary
  employment_start_date: string;
  annual_salary: number;
  salary_frequency: "weekly" | "fortnightly" | "monthly" | "";
  receives_dividends: boolean;
  estimated_dividends: number;

  // Step 3: Work Location & Commute
  home_address: string;
  home_county: string;
  workshop_address: string;
  workshop_county: string;
  commute_method: "company_vehicle" | "personal_vehicle" | "public_transport" | "walk_cycle" | "";
  commute_distance_km: number;
  vehicle_owned_by_director: boolean; // true = director personally owns the vehicle → mileage eligible

  // Vehicle asset details (when owned by director)
  vehicle_description: string; // e.g. "2020 Ford Transit Custom"
  vehicle_reg: string; // registration number
  vehicle_purchase_cost: number; // original cost (ex-VAT)
  vehicle_date_acquired: string; // date purchased
  vehicle_business_use_pct: number; // % business use for apportionment

  // Step 4: Benefits in Kind
  has_bik: boolean;
  bik_types: string[];
  company_vehicle_value: number;
  company_vehicle_business_km: number;

  // Step 4: Expected Income Sources
  income_sources: string[];
  social_welfare_types: string[];

  // Step 5: Business Links
  is_director_owner: boolean;
  linked_businesses: string[];

  // Step 6: Reliefs & Credits
  reliefs: string[];
  has_dependent_children: boolean;
  dependent_children_count: number;
  home_carer_credit: boolean;
  flat_rate_expenses: boolean;
  remote_working_relief: boolean;
  charitable_donations: boolean;

  // Step 7: Preliminary Tax
  pays_preliminary_tax: "yes" | "no" | "unsure" | "";

  // Step 8: Foreign Income & CGT
  foreign_cgt_options: string[];
  foreign_bank_accounts: boolean;
  foreign_property: boolean;
  crypto_holdings: boolean;

  // Declaration
  declaration_confirmed: boolean;
}

const initialState: OnboardingState = {
  tax_year_start: "",
  assessment_basis: "",
  director_name: "",
  pps_number: "",
  date_of_birth: "",
  marital_status: "",
  employment_start_date: "",
  annual_salary: 0,
  salary_frequency: "",
  receives_dividends: false,
  estimated_dividends: 0,
  home_address: "",
  home_county: "",
  workshop_address: "",
  workshop_county: "",
  commute_method: "",
  commute_distance_km: 0,
  vehicle_owned_by_director: false,
  vehicle_description: "",
  vehicle_reg: "",
  vehicle_purchase_cost: 0,
  vehicle_date_acquired: "",
  vehicle_business_use_pct: 100,
  has_bik: false,
  bik_types: [],
  company_vehicle_value: 0,
  company_vehicle_business_km: 0,
  income_sources: [],
  social_welfare_types: [],
  is_director_owner: false,
  linked_businesses: [],
  reliefs: [],
  has_dependent_children: false,
  dependent_children_count: 0,
  home_carer_credit: false,
  flat_rate_expenses: false,
  remote_working_relief: false,
  charitable_donations: false,
  pays_preliminary_tax: "",
  foreign_cgt_options: [],
  foreign_bank_accounts: false,
  foreign_property: false,
  crypto_holdings: false,
  declaration_confirmed: false,
};

const STEPS: OnboardingStep[] = [
  "personal_tax_profile",
  "employment_salary",
  "work_location_commute",
  "benefits_in_kind",
  "income_sources",
  "business_links",
  "reliefs_credits",
  "preliminary_tax",
  "foreign_income_cgt",
  "declaration",
];

const STEP_LABELS: Record<OnboardingStep, string> = {
  personal_tax_profile: "Personal Tax Profile",
  employment_salary: "Employment & Salary",
  work_location_commute: "Work Location & Commute",
  benefits_in_kind: "Benefits in Kind",
  income_sources: "Income Sources",
  business_links: "Business Links",
  reliefs_credits: "Reliefs & Credits",
  preliminary_tax: "Preliminary Tax",
  foreign_income_cgt: "Foreign Income & CGT",
  declaration: "Declaration",
};

const STEP_ICONS: Record<OnboardingStep, React.ReactNode> = {
  personal_tax_profile: <User className="w-4 h-4" />,
  employment_salary: <Banknote className="w-4 h-4" />,
  work_location_commute: <MapPin className="w-4 h-4" />,
  benefits_in_kind: <Car className="w-4 h-4" />,
  income_sources: <Briefcase className="w-4 h-4" />,
  business_links: <Link2 className="w-4 h-4" />,
  reliefs_credits: <Gift className="w-4 h-4" />,
  preliminary_tax: <Calculator className="w-4 h-4" />,
  foreign_income_cgt: <Globe className="w-4 h-4" />,
  declaration: <Check className="w-4 h-4" />,
};

const INCOME_SOURCES = [
  { value: "self_employed_director", label: "Self-employed / director income" },
  { value: "paye_employment", label: "PAYE employment" },
  { value: "rental_income", label: "Rental income" },
  { value: "dividends", label: "Dividends" },
  { value: "pension_income", label: "Pension income" },
  { value: "social_welfare", label: "Social welfare" },
  { value: "other", label: "Other" },
];

const SOCIAL_WELFARE_CATEGORIES = [
  { value: "jobseeker_payments", label: "Jobseeker payments", emoji: "🧑‍💼" },
  { value: "illness_disability", label: "Illness or disability payments", emoji: "🏥" },
  { value: "pension_survivor", label: "State or survivor's pension", emoji: "👴" },
  { value: "child_family", label: "Child or family-related payments", emoji: "👨‍👩‍👧" },
  { value: "housing_supports", label: "Housing or cost-of-living supports", emoji: "🏠" },
  { value: "other_dsp", label: "Other DSP payment", emoji: "🧾" },
];

const RELIEFS = [
  { value: "pension_contributions", label: "Pension contributions" },
  { value: "medical_expenses", label: "Medical expenses" },
  { value: "health_insurance", label: "Health insurance" },
  { value: "tuition_fees", label: "Tuition fees" },
  { value: "rent_mortgage_interest", label: "Rent or mortgage interest" },
];

const FOREIGN_CGT_OPTIONS = [
  { value: "foreign_income", label: "Foreign income expected (outside business)" },
  { value: "cgt_events", label: "Personal CGT events expected (e.g. property, shares, crypto)" },
  { value: "none", label: "None apply" },
];

const BIK_TYPES = [
  { value: "company_vehicle", label: "Company vehicle" },
  { value: "health_insurance", label: "Health insurance" },
  { value: "accommodation", label: "Accommodation" },
  { value: "preferential_loan", label: "Preferential loan" },
  { value: "other", label: "Other" },
];

export default function DirectorOnboardingWizard() {
  const navigate = useNavigate();
  const { user, directorCount, directorsCompleted, incrementDirectorCompleted, refreshDirectorOnboardingStatus } = useAuth();
  const { getDirector, isLoading: directorDataLoading, invalidate: invalidateDirectorCache } = useDirectorOnboarding();
  const [state, setState] = useState<OnboardingState>(initialState);
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // Determine which director we're setting up (1-indexed)
  const currentDirectorNumber = directorsCompleted + 1;

  // Load existing director data from Supabase on mount (for re-editing)
  useEffect(() => {
    if (directorDataLoading) return;
    const existing = getDirector(currentDirectorNumber);
    if (!existing) return;

    setState({
      tax_year_start: existing.tax_year_start ?? "",
      assessment_basis: existing.assessment_basis ?? "",
      director_name: existing.director_name ?? "",
      pps_number: existing.pps_number ?? "",
      date_of_birth: existing.date_of_birth ?? "",
      marital_status: existing.marital_status ?? "",
      employment_start_date: existing.employment_start_date ?? "",
      annual_salary: existing.annual_salary ?? 0,
      salary_frequency: existing.salary_frequency ?? "",
      receives_dividends: existing.receives_dividends ?? false,
      estimated_dividends: existing.estimated_dividends ?? 0,
      home_address: existing.home_address ?? "",
      home_county: existing.home_county ?? "",
      workshop_address: existing.workshop_address ?? "",
      workshop_county: existing.workshop_county ?? "",
      commute_method: existing.commute_method ?? "",
      commute_distance_km: existing.commute_distance_km ?? 0,
      vehicle_owned_by_director: existing.vehicle_owned_by_director ?? false,
      vehicle_description: existing.vehicle_description ?? "",
      vehicle_reg: existing.vehicle_reg ?? "",
      vehicle_purchase_cost: existing.vehicle_purchase_cost ?? 0,
      vehicle_date_acquired: existing.vehicle_date_acquired ?? "",
      vehicle_business_use_pct: existing.vehicle_business_use_pct ?? 100,
      has_bik: existing.has_bik ?? false,
      bik_types: existing.bik_types ?? [],
      company_vehicle_value: existing.company_vehicle_value ?? 0,
      company_vehicle_business_km: existing.company_vehicle_business_km ?? 0,
      income_sources: existing.income_sources ?? [],
      social_welfare_types: existing.social_welfare_types ?? [],
      is_director_owner: existing.is_director_owner ?? false,
      linked_businesses: existing.linked_businesses ?? [],
      reliefs: existing.reliefs ?? [],
      has_dependent_children: existing.has_dependent_children ?? false,
      dependent_children_count: existing.dependent_children_count ?? 0,
      home_carer_credit: existing.home_carer_credit ?? false,
      flat_rate_expenses: existing.flat_rate_expenses ?? false,
      remote_working_relief: existing.remote_working_relief ?? false,
      charitable_donations: existing.charitable_donations ?? false,
      pays_preliminary_tax: existing.pays_preliminary_tax ?? "",
      foreign_cgt_options: existing.foreign_cgt_options ?? [],
      foreign_bank_accounts: existing.foreign_bank_accounts ?? false,
      foreign_property: existing.foreign_property ?? false,
      crypto_holdings: existing.crypto_holdings ?? false,
      declaration_confirmed: false, // always require re-confirmation
    });
  }, [directorDataLoading, currentDirectorNumber, getDirector]);
  
  const step = STEPS[stepIndex];
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const canProceed = useMemo(() => {
    switch (step) {
      case "personal_tax_profile":
        return state.assessment_basis;
      case "declaration":
        return state.declaration_confirmed;
      default:
        return true;
    }
  }, [step, state]);

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  const handleMultiSelect = (field: keyof OnboardingState, value: string) => {
    const currentValues = state[field] as string[];
    
    // Handle "none" selection for foreign_cgt_options
    if (field === "foreign_cgt_options") {
      if (value === "none") {
        setState({ ...state, [field]: ["none"] });
        return;
      }
      // If selecting something else, remove "none"
      const withoutNone = currentValues.filter(v => v !== "none");
      const newValues = withoutNone.includes(value)
        ? withoutNone.filter(v => v !== value)
        : [...withoutNone, value];
      setState({ ...state, [field]: newValues });
      return;
    }
    
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    setState({ ...state, [field]: newValues });
  };

  const handleFinish = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Store director onboarding settings in localStorage with director number
      const directorSettings = {
        user_id: user.id,
        director_number: currentDirectorNumber,
        director_name: state.director_name || null,
        pps_number: state.pps_number || null,
        date_of_birth: state.date_of_birth || null,
        marital_status: state.marital_status || null,
        tax_year_start: state.tax_year_start || null,
        assessment_basis: state.assessment_basis || null,
        home_address: state.home_address || null,
        home_county: state.home_county || null,
        workshop_address: state.workshop_address || null,
        workshop_county: state.workshop_county || null,
        commute_method: state.commute_method || null,
        commute_distance_km: state.commute_distance_km,
        vehicle_owned_by_director: state.vehicle_owned_by_director,
        vehicle_description: state.vehicle_description || null,
        vehicle_reg: state.vehicle_reg || null,
        vehicle_purchase_cost: state.vehicle_purchase_cost,
        vehicle_date_acquired: state.vehicle_date_acquired || null,
        vehicle_business_use_pct: state.vehicle_business_use_pct,
        employment_start_date: state.employment_start_date || null,
        annual_salary: state.annual_salary,
        salary_frequency: state.salary_frequency || null,
        receives_dividends: state.receives_dividends,
        estimated_dividends: state.estimated_dividends,
        has_bik: state.has_bik,
        bik_types: state.bik_types,
        company_vehicle_value: state.company_vehicle_value,
        company_vehicle_business_km: state.company_vehicle_business_km,
        income_sources: state.income_sources,
        social_welfare_types: state.social_welfare_types,
        is_director_owner: state.is_director_owner,
        linked_businesses: state.linked_businesses.filter(b => b.trim()),
        reliefs: state.reliefs,
        has_dependent_children: state.has_dependent_children,
        dependent_children_count: state.dependent_children_count,
        home_carer_credit: state.home_carer_credit,
        flat_rate_expenses: state.flat_rate_expenses,
        remote_working_relief: state.remote_working_relief,
        charitable_donations: state.charitable_donations,
        pays_preliminary_tax: state.pays_preliminary_tax || null,
        foreign_cgt_options: state.foreign_cgt_options,
        foreign_bank_accounts: state.foreign_bank_accounts,
        foreign_property: state.foreign_property,
        crypto_holdings: state.crypto_holdings,
        onboarding_completed: true,
        completed_at: new Date().toISOString(),
      };

      // Save to Supabase instead of localStorage
      const { error: upsertError } = await supabase
        .from("director_onboarding")
        .upsert({
          user_id: user.id,
          director_number: currentDirectorNumber,
          director_name: state.director_name || null,
          pps_number: state.pps_number || null,
          date_of_birth: state.date_of_birth || null,
          marital_status: state.marital_status || null,
          assessment_basis: state.assessment_basis || null,
          annual_salary: state.annual_salary || 0,
          receives_dividends: state.receives_dividends,
          estimated_dividends: state.estimated_dividends || 0,
          onboarding_completed: true,
          onboarding_data: directorSettings,
        }, {
          onConflict: 'user_id,director_number'
        });

      if (upsertError) {
        console.error("Error saving director onboarding to Supabase:", upsertError);
        toast.error(`Failed to save settings: ${upsertError.message}`);
        return;
      }

      // Invalidate React Query cache so other pages see the new data
      invalidateDirectorCache();

      // Increment completed count and refresh status
      incrementDirectorCompleted();

      // Refresh the auth context to ensure it picks up the changes
      refreshDirectorOnboardingStatus();

      // Check if there are more directors to onboard
      if (currentDirectorNumber < directorCount) {
        toast.success(`Director ${currentDirectorNumber} setup complete! Now set up Director ${currentDirectorNumber + 1}.`);
        // Reset state for next director
        setState(initialState);
        setStepIndex(0);
      } else {
        toast.success("All director onboarding complete! Welcome to your dashboard.");
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Error saving director onboarding:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to save settings: ${errMsg || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-xl">
                Director {currentDirectorNumber}{directorCount > 1 ? ` of ${directorCount}` : ''} – Personal Account
              </h1>
              <p className="text-sm text-muted-foreground">
                Step {stepIndex + 1} of {STEPS.length}: {STEP_LABELS[step]}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step indicators - scrollable on mobile */}
          <ScrollArea className="w-full">
            <div className="flex items-center gap-1 mt-4 pb-2 min-w-max">
              {STEPS.map((s, idx) => {
                const isActive = idx === stepIndex;
                const isComplete = idx < stepIndex;
                return (
                  <button
                    key={s}
                    onClick={() => idx < stepIndex && setStepIndex(idx)}
                    disabled={idx > stepIndex}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs whitespace-nowrap transition-colors",
                      isActive && "bg-primary text-primary-foreground",
                      isComplete && "text-primary hover:bg-primary/10",
                      !isActive && !isComplete && "text-muted-foreground"
                    )}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      STEP_ICONS[s]
                    )}
                    <span className="hidden md:inline">{STEP_LABELS[s]}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Step 1: Personal Tax Profile */}
        {step === "personal_tax_profile" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Personal Tax Profile</h2>
              <p className="text-muted-foreground">Set up your personal tax information for Form 11 automation.</p>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <Label htmlFor="director_name">Full legal name</Label>
                <Input
                  id="director_name"
                  value={state.director_name}
                  onChange={(e) => setState({ ...state, director_name: e.target.value })}
                  placeholder="Enter your full legal name"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="pps_number">PPS number</Label>
                <Input
                  id="pps_number"
                  value={state.pps_number}
                  onChange={(e) => setState({ ...state, pps_number: e.target.value })}
                  placeholder="1234567AB"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="date_of_birth">Date of birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={state.date_of_birth}
                  onChange={(e) => setState({ ...state, date_of_birth: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-base font-medium">Marital status</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                  {([
                    { value: "single", label: "Single" },
                    { value: "married", label: "Married" },
                    { value: "civil_partner", label: "Civil partner" },
                    { value: "widowed", label: "Widowed" },
                    { value: "separated", label: "Separated" },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setState({ ...state, marital_status: option.value })}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all flex items-center gap-2 text-sm",
                        state.marital_status === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                        state.marital_status === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {state.marital_status === option.value && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Tax year</Label>
                <div className="mt-1.5 p-3 bg-muted/50 rounded-lg border border-border">
                  <p className="font-medium">1st January – 31st December</p>
                  <p className="text-sm text-muted-foreground mt-1">Irish personal tax year is fixed to the calendar year.</p>
                </div>
              </div>

              <div>
                <Label className="text-base font-medium">Assessment basis *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                  {[
                    { value: "single", label: "Single" },
                    { value: "joint", label: "Joint" },
                    { value: "separate", label: "Separate" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setState({ ...state, assessment_basis: option.value as "single" | "joint" | "separate" })}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        state.assessment_basis === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        state.assessment_basis === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {state.assessment_basis === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Employment & Salary */}
        {step === "employment_salary" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Employment & Salary</h2>
              <p className="text-muted-foreground">Details about your directorship and remuneration from the company.</p>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <Label htmlFor="employment_start_date">Date appointed as director</Label>
                <Input
                  id="employment_start_date"
                  type="date"
                  value={state.employment_start_date}
                  onChange={(e) => setState({ ...state, employment_start_date: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="annual_salary">Gross annual salary from the company</Label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">EUR</span>
                  <Input
                    id="annual_salary"
                    type="number"
                    value={state.annual_salary || ""}
                    onChange={(e) => setState({ ...state, annual_salary: parseFloat(e.target.value) || 0 })}
                    className="pl-12"
                    min={0}
                  />
                </div>
              </div>

              <div>
                <Label className="text-base font-medium">How is salary paid?</Label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {([
                    { value: "weekly", label: "Weekly" },
                    { value: "fortnightly", label: "Fortnightly" },
                    { value: "monthly", label: "Monthly" },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setState({ ...state, salary_frequency: option.value })}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        state.salary_frequency === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        state.salary_frequency === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {state.salary_frequency === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base font-medium">Do you receive dividends from this company?</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { value: true, label: "Yes" },
                    { value: false, label: "No" },
                  ].map((option) => (
                    <button
                      key={String(option.value)}
                      onClick={() => setState({ ...state, receives_dividends: option.value })}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        state.receives_dividends === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        state.receives_dividends === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {state.receives_dividends === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {state.receives_dividends && (
                <div>
                  <Label htmlFor="estimated_dividends">Expected annual dividends</Label>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">EUR</span>
                    <Input
                      id="estimated_dividends"
                      type="number"
                      value={state.estimated_dividends || ""}
                      onChange={(e) => setState({ ...state, estimated_dividends: parseFloat(e.target.value) || 0 })}
                      className="pl-12"
                      min={0}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Work Location & Commute */}
        {step === "work_location_commute" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Work Location & Commute</h2>
              <p className="text-muted-foreground">Where you live and work affects mileage claims and BIK calculations.</p>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <Label htmlFor="home_address">Home address</Label>
                <AddressAutocomplete
                  id="home_address"
                  value={state.home_address}
                  onChange={(addr) => {
                    const county = extractBaseLocation(addr) || "";
                    setState({ ...state, home_address: addr, home_county: county });
                  }}
                  onTownSelect={(town) => {
                    setState((prev: typeof state) => ({ ...prev, home_county: town.county }));
                  }}
                  placeholder="e.g. 12 Main St, Swords, Co. Dublin"
                  className="mt-1.5"
                />
                {state.home_county && (
                  <p className="text-xs text-muted-foreground mt-1">
                    County detected: <span className="font-medium">{state.home_county}</span>
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="workshop_address">Workshop / place of work address</Label>
                <AddressAutocomplete
                  id="workshop_address"
                  value={state.workshop_address}
                  onChange={(addr) => {
                    const county = extractBaseLocation(addr) || "";
                    setState({ ...state, workshop_address: addr, workshop_county: county });
                  }}
                  onTownSelect={(town) => {
                    setState((prev: typeof state) => ({ ...prev, workshop_county: town.county }));
                  }}
                  placeholder="e.g. Unit 5, Industrial Estate, Finglas, Dublin 11"
                  className="mt-1.5"
                />
                {state.workshop_county && (
                  <p className="text-xs text-muted-foreground mt-1">
                    County detected: <span className="font-medium">{state.workshop_county}</span>
                  </p>
                )}
              </div>

              <div>
                <Label className="text-base font-medium">How do you usually get from home to your place of work?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  {([
                    { value: "company_vehicle", label: "Company vehicle", desc: "Triggers BIK calculation" },
                    { value: "personal_vehicle", label: "Personal vehicle", desc: "Eligible for mileage rates" },
                    { value: "public_transport", label: "Public transport", desc: "No mileage claim" },
                    { value: "walk_cycle", label: "Walk / cycle", desc: "No mileage claim" },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setState({ ...state, commute_method: option.value })}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        state.commute_method === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                        state.commute_method === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {state.commute_method === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <div>
                        <span className="font-medium block">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {state.commute_method === "personal_vehicle" && (
                <div>
                  <Label className="text-base font-medium">Is this vehicle owned by you personally?</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {[
                      { value: true, label: "Yes — I own it", desc: "Eligible for Revenue mileage rates" },
                      { value: false, label: "No", desc: "No mileage claim available" },
                    ].map((option) => (
                      <button
                        key={String(option.value)}
                        onClick={() => setState({ ...state, vehicle_owned_by_director: option.value })}
                        className={cn(
                          "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                          state.vehicle_owned_by_director === option.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                          state.vehicle_owned_by_director === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                        )}>
                          {state.vehicle_owned_by_director === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                        </div>
                        <div>
                          <span className="font-medium block">{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Mileage allowance at Revenue civil service rates only applies when the director personally owns the vehicle used for business travel.
                  </p>
                </div>
              )}

              {(state.commute_method === "company_vehicle" || state.commute_method === "personal_vehicle") && (
                <div>
                  <Label htmlFor="commute_distance_km">One-way commute distance (km)</Label>
                  <Input
                    id="commute_distance_km"
                    type="number"
                    value={state.commute_distance_km || ""}
                    onChange={(e) => setState({ ...state, commute_distance_km: parseFloat(e.target.value) || 0 })}
                    className="mt-1.5"
                    min={0}
                    placeholder="e.g. 25"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Home to workshop/primary place of work, one direction.
                  </p>
                </div>
              )}

              {/* Vehicle Asset Details */}
              {state.vehicle_owned_by_director && (
                <div className="border-t pt-5 space-y-4">
                  <div>
                    <h3 className="font-semibold text-base mb-1">Vehicle Asset Details</h3>
                    <p className="text-sm text-muted-foreground">
                      Your vehicle is a fixed asset on the company balance sheet. Capital allowances (12.5% p.a. over 8 years, capped at &euro;24,000) reduce taxable profit.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="vehicle_description">Vehicle description</Label>
                    <Input
                      id="vehicle_description"
                      value={state.vehicle_description}
                      onChange={(e) => setState({ ...state, vehicle_description: e.target.value })}
                      placeholder="e.g. 2020 Ford Transit Custom"
                      className="mt-1.5"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="vehicle_reg">Registration number</Label>
                      <Input
                        id="vehicle_reg"
                        value={state.vehicle_reg}
                        onChange={(e) => setState({ ...state, vehicle_reg: e.target.value })}
                        placeholder="e.g. 201-D-12345"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="vehicle_date_acquired">Date acquired</Label>
                      <Input
                        id="vehicle_date_acquired"
                        type="date"
                        value={state.vehicle_date_acquired}
                        onChange={(e) => setState({ ...state, vehicle_date_acquired: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="vehicle_purchase_cost">Purchase cost (ex-VAT)</Label>
                      <div className="relative mt-1.5">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
                        <Input
                          id="vehicle_purchase_cost"
                          type="number"
                          min={0}
                          value={state.vehicle_purchase_cost || ""}
                          onChange={(e) => setState({ ...state, vehicle_purchase_cost: parseFloat(e.target.value) || 0 })}
                          className="pl-8"
                          placeholder="0"
                        />
                      </div>
                      {state.vehicle_purchase_cost > 24000 && (
                        <p className="text-xs text-amber-600 mt-1">
                          Capital allowances capped at &euro;24,000 for motor cars.
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="vehicle_business_use_pct">Business use %</Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="vehicle_business_use_pct"
                          type="number"
                          min={0}
                          max={100}
                          value={state.vehicle_business_use_pct || ""}
                          onChange={(e) => setState({ ...state, vehicle_business_use_pct: parseInt(e.target.value) || 0 })}
                          className="pr-8"
                          placeholder="100"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Capital allowances are apportioned by business use percentage.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Benefits in Kind */}
        {step === "benefits_in_kind" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Benefits in Kind</h2>
              <p className="text-muted-foreground">Non-cash benefits received from the company are taxable (BIK).</p>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <Label className="text-base font-medium">Do you receive any benefits in kind?</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { value: true, label: "Yes" },
                    { value: false, label: "No" },
                  ].map((option) => (
                    <button
                      key={String(option.value)}
                      onClick={() => setState({ ...state, has_bik: option.value })}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        state.has_bik === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        state.has_bik === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {state.has_bik === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {state.has_bik && (
                <>
                  <div>
                    <Label className="text-base font-medium">Which types of BIK do you receive?</Label>
                    <div className="space-y-2 mt-2">
                      {BIK_TYPES.map((bik) => (
                        <button
                          key={bik.value}
                          onClick={() => {
                            const current = state.bik_types;
                            const newTypes = current.includes(bik.value)
                              ? current.filter(v => v !== bik.value)
                              : [...current, bik.value];
                            setState({ ...state, bik_types: newTypes });
                          }}
                          className={cn(
                            "w-full p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                            state.bik_types.includes(bik.value)
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <Checkbox checked={state.bik_types.includes(bik.value)} />
                          <span className="font-medium">{bik.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {state.bik_types.includes("company_vehicle") && (
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                      <div>
                        <Label htmlFor="company_vehicle_value">Original market value of company vehicle</Label>
                        <div className="relative mt-1.5">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">EUR</span>
                          <Input
                            id="company_vehicle_value"
                            type="number"
                            value={state.company_vehicle_value || ""}
                            onChange={(e) => setState({ ...state, company_vehicle_value: parseFloat(e.target.value) || 0 })}
                            className="pl-12"
                            min={0}
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="company_vehicle_business_km">Estimated annual business kilometres</Label>
                        <Input
                          id="company_vehicle_business_km"
                          type="number"
                          value={state.company_vehicle_business_km || ""}
                          onChange={(e) => setState({ ...state, company_vehicle_business_km: parseInt(e.target.value) || 0 })}
                          className="mt-1.5"
                          min={0}
                          placeholder="e.g. 24000"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Expected Income Sources */}
        {step === "income_sources" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Expected Income Sources</h2>
              <p className="text-muted-foreground">Select all income sources that apply to you.</p>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-sm">
              <div className="space-y-3">
                {INCOME_SOURCES.map((source) => (
                  <div key={source.value}>
                    <button
                      onClick={() => handleMultiSelect("income_sources", source.value)}
                      className={cn(
                        "w-full p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        state.income_sources.includes(source.value)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <Checkbox checked={state.income_sources.includes(source.value)} />
                      <span className="font-medium">{source.label}</span>
                    </button>
                    
                    {/* Social Welfare categories */}
                    {source.value === "social_welfare" && state.income_sources.includes("social_welfare") && (
                      <div className="mt-3 ml-8 space-y-2">
                        <Label className="text-sm text-muted-foreground block">Which categories apply?</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Includes payments from the Department of Social Protection.
                        </p>
                        <div className="space-y-2">
                          {SOCIAL_WELFARE_CATEGORIES.map((category) => (
                            <button
                              key={category.value}
                              onClick={() => {
                                const current = state.social_welfare_types;
                                const newTypes = current.includes(category.value)
                                  ? current.filter(v => v !== category.value)
                                  : [...current, category.value];
                                setState({ ...state, social_welfare_types: newTypes });
                              }}
                              className={cn(
                                "w-full p-3 rounded-lg border text-left transition-all flex items-center gap-2 text-sm",
                                state.social_welfare_types.includes(category.value)
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50"
                              )}
                            >
                              <Checkbox checked={state.social_welfare_types.includes(category.value)} />
                              <span>{category.emoji}</span>
                              <span>{category.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Business Links */}
        {step === "business_links" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Business Links</h2>
              <p className="text-muted-foreground">Are you a director or owner of any other business?</p>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: true, label: "Yes" },
                    { value: false, label: "No" },
                  ].map((option) => (
                    <button
                      key={String(option.value)}
                      onClick={() => setState({ ...state, is_director_owner: option.value })}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        state.is_director_owner === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        state.is_director_owner === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {state.is_director_owner === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {state.is_director_owner && (
                <div className="space-y-3">
                  <Label>Business name(s)</Label>
                  
                  {state.linked_businesses.map((business, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={business}
                        onChange={(e) => {
                          const updated = [...state.linked_businesses];
                          updated[index] = e.target.value;
                          setState({ ...state, linked_businesses: updated });
                        }}
                        placeholder="Enter business name"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const updated = state.linked_businesses.filter((_, i) => i !== index);
                          setState({ ...state, linked_businesses: updated });
                        }}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setState({ ...state, linked_businesses: [...state.linked_businesses, ""] })}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add business
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Reliefs & Credits */}
        {step === "reliefs_credits" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Reliefs & Credits</h2>
              <p className="text-muted-foreground">Select any reliefs or credits that apply to you.</p>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-5">
              <div className="space-y-3">
                {RELIEFS.map((relief) => (
                  <button
                    key={relief.value}
                    onClick={() => handleMultiSelect("reliefs", relief.value)}
                    className={cn(
                      "w-full p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                      state.reliefs.includes(relief.value)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Checkbox checked={state.reliefs.includes(relief.value)} />
                    <span className="font-medium">{relief.label}</span>
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t space-y-3">
                <Label className="text-base font-medium">Additional credits & reliefs</Label>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has_dependent_children"
                    checked={state.has_dependent_children}
                    onCheckedChange={(checked) => setState({ ...state, has_dependent_children: checked === true, dependent_children_count: checked ? state.dependent_children_count : 0 })}
                  />
                  <Label htmlFor="has_dependent_children">Dependent children</Label>
                </div>

                {state.has_dependent_children && (
                  <div className="ml-6">
                    <Label htmlFor="dependent_children_count">Number of dependent children</Label>
                    <Input
                      id="dependent_children_count"
                      type="number"
                      min={1}
                      value={state.dependent_children_count || ""}
                      onChange={(e) => setState({ ...state, dependent_children_count: parseInt(e.target.value) || 0 })}
                      className="mt-1.5 w-24"
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="home_carer_credit"
                    checked={state.home_carer_credit}
                    onCheckedChange={(checked) => setState({ ...state, home_carer_credit: checked === true })}
                  />
                  <Label htmlFor="home_carer_credit">Home carer tax credit</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="flat_rate_expenses"
                    checked={state.flat_rate_expenses}
                    onCheckedChange={(checked) => setState({ ...state, flat_rate_expenses: checked === true })}
                  />
                  <Label htmlFor="flat_rate_expenses">Flat-rate expenses for trade/profession</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remote_working_relief"
                    checked={state.remote_working_relief}
                    onCheckedChange={(checked) => setState({ ...state, remote_working_relief: checked === true })}
                  />
                  <Label htmlFor="remote_working_relief">Remote working relief (30% of electricity/heating)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="charitable_donations"
                    checked={state.charitable_donations}
                    onCheckedChange={(checked) => setState({ ...state, charitable_donations: checked === true })}
                  />
                  <Label htmlFor="charitable_donations">Qualifying charitable donations (min EUR 250)</Label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preliminary Tax */}
        {step === "preliminary_tax" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Preliminary Tax (Baseline)</h2>
              <p className="text-muted-foreground">Do you normally pay preliminary tax?</p>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                  { value: "unsure", label: "Unsure" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setState({ ...state, pays_preliminary_tax: option.value as "yes" | "no" | "unsure" })}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                      state.pays_preliminary_tax === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      state.pays_preliminary_tax === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                    )}>
                      {state.pays_preliminary_tax === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                    </div>
                    <span className="font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Foreign Income & CGT */}
        {step === "foreign_income_cgt" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Personal Foreign Income & CGT</h2>
              <p className="text-muted-foreground">
                Do you expect any personal income or gains <strong>outside of your business activities</strong>?
              </p>
            </div>

            <div className="bg-muted/50 border border-border rounded-xl p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">What belongs here?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Personal property sales (not business assets)</li>
                <li>Share or crypto disposals in your own name</li>
                <li>Foreign rental income or overseas pensions</li>
                <li>Any other personal income not linked to your business</li>
              </ul>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-5">
              <div className="space-y-3">
                {FOREIGN_CGT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleMultiSelect("foreign_cgt_options", option.value)}
                    className={cn(
                      "w-full p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                      state.foreign_cgt_options.includes(option.value)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Checkbox checked={state.foreign_cgt_options.includes(option.value)} />
                    <span className="font-medium">{option.label}</span>
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t space-y-3">
                <Label className="text-base font-medium">Additional disclosures</Label>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="foreign_bank_accounts"
                    checked={state.foreign_bank_accounts}
                    onCheckedChange={(checked) => setState({ ...state, foreign_bank_accounts: checked === true })}
                  />
                  <Label htmlFor="foreign_bank_accounts">I hold foreign bank accounts</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="foreign_property"
                    checked={state.foreign_property}
                    onCheckedChange={(checked) => setState({ ...state, foreign_property: checked === true })}
                  />
                  <Label htmlFor="foreign_property">I own property outside Ireland</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="crypto_holdings"
                    checked={state.crypto_holdings}
                    onCheckedChange={(checked) => setState({ ...state, crypto_holdings: checked === true })}
                  />
                  <Label htmlFor="crypto_holdings">I hold cryptocurrency</Label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Declaration */}
        {step === "declaration" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Onboarding Declaration – Personal</h2>
              <p className="text-muted-foreground">Review and confirm your information.</p>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-6">
              {/* Summary */}
              <div className="space-y-4">
                {state.director_name && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{state.director_name}</span>
                  </div>
                )}
                {state.pps_number && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">PPS number</span>
                    <span className="font-medium">{state.pps_number}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Assessment basis</span>
                  <span className="font-medium capitalize">{state.assessment_basis || "Not set"}</span>
                </div>
                {state.annual_salary > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Annual salary</span>
                    <span className="font-medium">EUR {state.annual_salary.toLocaleString()}</span>
                  </div>
                )}
                {state.receives_dividends && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Expected dividends</span>
                    <span className="font-medium">EUR {state.estimated_dividends.toLocaleString()}</span>
                  </div>
                )}
                {state.home_address && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Home address</span>
                    <span className="font-medium text-right max-w-[200px]">{state.home_address}</span>
                  </div>
                )}
                {state.workshop_address && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Workshop address</span>
                    <span className="font-medium text-right max-w-[200px]">{state.workshop_address}</span>
                  </div>
                )}
                {state.commute_method && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Commute method</span>
                    <span className="font-medium capitalize">{state.commute_method.replace(/_/g, " ")}</span>
                  </div>
                )}
                {state.commute_distance_km > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Commute distance</span>
                    <span className="font-medium">{state.commute_distance_km} km (one-way)</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Benefits in kind</span>
                  <span className="font-medium">{state.has_bik ? BIK_TYPES.filter(b => state.bik_types.includes(b.value)).map(b => b.label).join(", ") : "None"}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Income sources</span>
                  <span className="font-medium text-right max-w-[200px]">
                    {state.income_sources.length > 0
                      ? INCOME_SOURCES.filter(s => state.income_sources.includes(s.value)).map(s => s.label).join(", ")
                      : "None selected"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Director/Owner</span>
                  <span className="font-medium">{state.is_director_owner ? "Yes" : "No"}</span>
                </div>
                {state.is_director_owner && state.linked_businesses.filter(b => b.trim()).length > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Linked businesses</span>
                    <span className="font-medium">{state.linked_businesses.filter(b => b.trim()).join(", ")}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Preliminary tax</span>
                  <span className="font-medium capitalize">{state.pays_preliminary_tax || "Not set"}</span>
                </div>
              </div>

              {/* Declaration checkbox */}
              <button
                onClick={() => setState({ ...state, declaration_confirmed: !state.declaration_confirmed })}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all flex items-start gap-3",
                  state.declaration_confirmed
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <Checkbox checked={state.declaration_confirmed} className="mt-0.5" />
                <span className="text-sm">
                  I confirm this information is accurate and will be used to automate my personal tax calculations and Form 11 reporting.
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={stepIndex === 0}
          >
            Back
          </Button>

          {step === "declaration" ? (
            <Button
              onClick={handleFinish}
              disabled={!canProceed || saving}
            >
              {saving ? "Saving..." : "Complete Setup"}
            </Button>
          ) : (
            <Button
              onClick={goNext}
              disabled={!canProceed}
            >
              Continue
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
