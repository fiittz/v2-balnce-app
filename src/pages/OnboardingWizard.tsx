import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Briefcase, CreditCard, Receipt, Wallet, Landmark, Banknote, Users, Check, HardHat, UserPlus, FileSpreadsheet, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isDemoMode } from "@/lib/mockData";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";

type OnboardingStep =
  | "business_identity"
  | "industry_select"
  | "business_activity"
  | "income_payments"
  | "vat_setup"
  | "eu_international_trade"
  | "rct_subcontracting"
  | "expense_behaviour"
  | "capitalisation"
  | "payments_setup"
  | "employees_payroll"
  | "loans_finance"
  | "directors_loan"
  | "opening_balances"
  | "declaration";

// All per-business data
interface BusinessData {
  // Identity
  name: string;
  structure: "sole_trader" | "limited_company" | "";
  accounting_year_end: string;
  director_count: number | null;
  has_company_secretary: boolean;
  company_secretary_name: string;
  cro_number: string;
  tax_reference: string;
  registered_address: string;

  // Activity
  industry: string;
  primary_activity: string;
  primary_activity_other: string;
  secondary_activities: string[];
  business_description: string;

  // Income & Payments
  payment_methods: string[];

  // VAT Setup
  vat_registered: boolean;
  vat_number: string;
  vat_registration_date: string;
  vat_basis: "cash" | "invoice" | "";
  vat_status_change_expected: boolean;
  vat_change_date: string;

  // EU & International Trade
  eu_trade_enabled: boolean;
  sells_goods_to_eu: boolean;
  buys_goods_from_eu: boolean;
  sells_services_to_eu: boolean;
  buys_services_from_eu: boolean;
  sells_to_non_eu: boolean;
  buys_from_non_eu: boolean;
  sells_digital_services_b2c: boolean;
  has_section_56_authorisation: boolean;
  uses_postponed_accounting: boolean;

  // RCT & Subcontracting
  rct_status: "not_applicable" | "principal" | "subcontractor" | "both" | "";
  rct_rate: "0" | "20" | "35" | "";
  has_subcontractors: boolean;

  // Trip & travel settings
  place_of_work: string; // home county — overnight detection (e.g. "Dublin")
  workshop_address: string; // actual workshop/office address (e.g. "Hollystown Industrial Units")
  subsistence_radius_km: number; // km from workshop where subsistence kicks in

  // Expense Behaviour
  mixed_use_spending: boolean;
  has_home_office: boolean;
  business_use_percentage: number;

  // Capitalisation
  capitalisation_threshold: number;
  regular_capital_purchases: boolean;
  has_opening_assets: boolean;
  opening_asset_value: number;

  // Payments Setup
  payment_types: string[];
  custom_payment_types: string[];

  // Employees & Payroll
  has_employees: boolean;
  employee_count: number;
  paye_registered: boolean;
  paye_number: string;

  // Loans & Finance
  has_loans: boolean;
  loan_type: string;
  loan_start_date: string;

  // Director's Loan
  directors_loan_movements: boolean;

  // Opening Balances
  has_opening_balances: boolean;
  opening_bank_balance: number;
  opening_debtors: number;
  opening_creditors: number;
  opening_vat_liability: number;
}

interface OnboardingState {
  // Global settings
  business_count: number;
  businesses: BusinessData[];
  
  // Declaration
  declaration_confirmed: boolean;
}

const createEmptyBusiness = (): BusinessData => ({
  name: "",
  structure: "",
  accounting_year_end: "",
  director_count: null,
  has_company_secretary: false,
  company_secretary_name: "",
  cro_number: "",
  tax_reference: "",
  registered_address: "",
  industry: "",
  primary_activity: "",
  primary_activity_other: "",
  secondary_activities: [],
  business_description: "",
  payment_methods: [],
  vat_registered: false,
  vat_number: "",
  vat_registration_date: "",
  vat_basis: "",
  vat_status_change_expected: false,
  vat_change_date: "",
  eu_trade_enabled: false,
  sells_goods_to_eu: false,
  buys_goods_from_eu: false,
  sells_services_to_eu: false,
  buys_services_from_eu: false,
  sells_to_non_eu: false,
  buys_from_non_eu: false,
  sells_digital_services_b2c: false,
  has_section_56_authorisation: false,
  uses_postponed_accounting: false,
  rct_status: "",
  rct_rate: "",
  has_subcontractors: false,
  place_of_work: "",
  workshop_address: "",
  subsistence_radius_km: 8,
  mixed_use_spending: false,
  has_home_office: false,
  business_use_percentage: 0,
  capitalisation_threshold: 1000,
  regular_capital_purchases: false,
  has_opening_assets: false,
  opening_asset_value: 0,
  payment_types: [],
  custom_payment_types: [],
  has_employees: false,
  employee_count: 0,
  paye_registered: false,
  paye_number: "",
  has_loans: false,
  loan_type: "",
  loan_start_date: "",
  directors_loan_movements: false,
  has_opening_balances: false,
  opening_bank_balance: 0,
  opening_debtors: 0,
  opening_creditors: 0,
  opening_vat_liability: 0,
});

const initialState: OnboardingState = {
  business_count: 1,
  businesses: [createEmptyBusiness()],
  declaration_confirmed: false,
};

const CONSTRUCTION_ACTIVITIES = [
  "carpentry_joinery", "general_construction", "electrical_contracting",
  "plumbing_heating", "bricklaying_masonry", "plastering_drylining",
  "painting_decorating", "roofing", "groundworks_civil", "landscaping",
  "tiling_stonework", "steel_fabrication_welding", "quantity_surveying",
  "project_management", "site_supervision", "property_maintenance",
  "property_development",
];

const ALL_STEPS: OnboardingStep[] = [
  "business_identity",
  "industry_select",
  "business_activity",
  "income_payments",
  "vat_setup",
  "eu_international_trade",
  "rct_subcontracting",
  "expense_behaviour",
  "capitalisation",
  "payments_setup",
  "employees_payroll",
  "loans_finance",
  "directors_loan",
  "opening_balances",
  "declaration",
];

const STEP_LABELS: Record<OnboardingStep, string> = {
  business_identity: "Business Identity",
  industry_select: "Industry",
  business_activity: "Business Activity",
  income_payments: "Income & Payments",
  vat_setup: "VAT Setup",
  eu_international_trade: "EU & International",
  rct_subcontracting: "RCT & Subcontracting",
  expense_behaviour: "Expense Behaviour",
  capitalisation: "Capitalisation Policy",
  payments_setup: "Payments Setup",
  employees_payroll: "Employees & Payroll",
  loans_finance: "Loans & Finance",
  directors_loan: "Director's Loan",
  opening_balances: "Opening Balances",
  declaration: "Declaration",
};

const STEP_ICONS: Record<OnboardingStep, React.ReactNode> = {
  business_identity: <Building2 className="w-4 h-4" />,
  industry_select: <Briefcase className="w-4 h-4" />,
  business_activity: <Briefcase className="w-4 h-4" />,
  income_payments: <CreditCard className="w-4 h-4" />,
  vat_setup: <Receipt className="w-4 h-4" />,
  eu_international_trade: <Globe className="w-4 h-4" />,
  rct_subcontracting: <HardHat className="w-4 h-4" />,
  expense_behaviour: <Wallet className="w-4 h-4" />,
  capitalisation: <Landmark className="w-4 h-4" />,
  payments_setup: <Banknote className="w-4 h-4" />,
  employees_payroll: <UserPlus className="w-4 h-4" />,
  loans_finance: <Landmark className="w-4 h-4" />,
  directors_loan: <Users className="w-4 h-4" />,
  opening_balances: <FileSpreadsheet className="w-4 h-4" />,
  declaration: <Check className="w-4 h-4" />,
};

// Business Activity Categories
const BUSINESS_ACTIVITIES = {
  "Trades & Construction": [
    { value: "carpentry_joinery", label: "Carpentry & joinery" },
    { value: "general_construction", label: "General construction" },
    { value: "electrical_contracting", label: "Electrical contracting" },
    { value: "plumbing_heating", label: "Plumbing & heating" },
    { value: "bricklaying_masonry", label: "Bricklaying & masonry" },
    { value: "plastering_drylining", label: "Plastering / drylining" },
    { value: "painting_decorating", label: "Painting & decorating" },
    { value: "roofing", label: "Roofing" },
    { value: "groundworks_civil", label: "Groundworks / civil works" },
    { value: "landscaping", label: "Landscaping" },
    { value: "tiling_stonework", label: "Tiling & stonework" },
    { value: "steel_fabrication_welding", label: "Steel fabrication / welding" },
  ],
  "Construction Support & Property": [
    { value: "quantity_surveying", label: "Quantity surveying" },
    { value: "project_management", label: "Project management" },
    { value: "site_supervision", label: "Site supervision" },
    { value: "property_maintenance", label: "Property maintenance" },
    { value: "property_development", label: "Property development" },
    { value: "letting_property_management", label: "Letting / property management" },
  ],
  "Transport & Logistics": [
    { value: "haulage_hgv", label: "Haulage / HGV transport" },
    { value: "courier_services", label: "Courier services" },
    { value: "taxi_private_hire", label: "Taxi / private hire" },
    { value: "delivery_services", label: "Delivery services" },
    { value: "plant_hire", label: "Plant hire" },
  ],
  "Retail & Wholesale": [
    { value: "physical_retail", label: "Physical retail" },
    { value: "online_retail", label: "Online retail (e-commerce)" },
    { value: "market_stall", label: "Market / stall trading" },
    { value: "wholesale_distribution", label: "Wholesale / distribution" },
  ],
  "Professional Services": [
    { value: "accounting_bookkeeping", label: "Accounting / bookkeeping" },
    { value: "legal_services", label: "Legal services" },
    { value: "consultancy", label: "Consultancy / consulting" },
    { value: "hr_recruitment", label: "HR / recruitment" },
    { value: "financial_services", label: "Financial services" },
    { value: "insurance_broker", label: "Insurance / broker" },
    { value: "architecture", label: "Architecture" },
    { value: "engineering_consultancy", label: "Engineering consultancy" },
  ],
  "Digital & Creative": [
    { value: "software_development", label: "Software development" },
    { value: "it_services", label: "IT services / managed services" },
    { value: "web_design", label: "Web design" },
    { value: "graphic_design", label: "Graphic design" },
    { value: "digital_marketing", label: "Digital marketing" },
    { value: "photography_videography", label: "Photography / videography" },
    { value: "content_creation", label: "Content creation / media" },
  ],
  "Food & Hospitality": [
    { value: "cafe_restaurant", label: "Cafe / restaurant" },
    { value: "takeaway", label: "Takeaway" },
    { value: "catering", label: "Catering" },
    { value: "mobile_food", label: "Mobile food / food truck" },
  ],
  "Agriculture & Environmental": [
    { value: "farming", label: "Farming" },
    { value: "forestry", label: "Forestry" },
    { value: "agricultural_contracting", label: "Agricultural contracting" },
  ],
  "Domestic & Local Services": [
    { value: "cleaning", label: "Cleaning" },
    { value: "waste_removal", label: "Waste removal" },
    { value: "pest_control", label: "Pest control" },
    { value: "care_services", label: "Care services" },
    { value: "beauty_wellness", label: "Beauty / wellness / salon" },
    { value: "fitness_sports", label: "Fitness / sports / gym" },
  ],
  "Education & Training": [
    { value: "training_provider", label: "Training provider" },
    { value: "coaching_mentoring", label: "Coaching / mentoring" },
    { value: "tutoring", label: "Tutoring" },
  ],
  "Manufacturing & Production": [
    { value: "manufacturing", label: "Manufacturing" },
    { value: "bespoke_fabrication", label: "Bespoke fabrication" },
    { value: "food_production", label: "Food production" },
  ],
  "Mixed / Other": [
    { value: "mixed_activities", label: "Mixed activities" },
    { value: "other", label: "Other (brief description)" },
  ],
};

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "card_terminal", label: "Card terminal" },
  { value: "online_platforms", label: "Online platforms (Stripe, Shopify, etc.)" },
];

const PAYMENT_TYPES = [
  { value: "drawings", label: "Drawings" },
  { value: "payroll", label: "Payroll" },
  { value: "dividends", label: "Dividends" },
  { value: "contractor_payments", label: "Contractor payments" },
  
];

const LOAN_TYPES = [
  { value: "loan", label: "Loan" },
  { value: "hire_purchase", label: "Hire purchase" },
  { value: "lease", label: "Lease" },
];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { user, refreshOnboardingStatus } = useAuth();
  const [state, setState] = useState<OnboardingState>(initialState);
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selectedBusinessIndex, setSelectedBusinessIndex] = useState(0);

  // Compute visible steps based on whether any business has a construction activity
  const isConstructionTrade = state.businesses.some(b =>
    CONSTRUCTION_ACTIVITIES.includes(b.primary_activity) ||
    b.secondary_activities.some(a => CONSTRUCTION_ACTIVITIES.includes(a))
  );
  const isAnyVATRegistered = state.businesses.some(b => b.vat_registered);
  const STEPS = useMemo(() => {
    let steps = ALL_STEPS;
    if (!isConstructionTrade) steps = steps.filter(s => s !== "rct_subcontracting");
    if (!isAnyVATRegistered) steps = steps.filter(s => s !== "eu_international_trade");
    return steps;
  }, [isConstructionTrade, isAnyVATRegistered]);

  const step = STEPS[stepIndex];
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  
  // Current business data helper
  const currentBusiness = state.businesses[selectedBusinessIndex] || state.businesses[0];

  // Update a field on the current business
  const updateBusiness = <K extends keyof BusinessData>(field: K, value: BusinessData[K]) => {
    const newBusinesses = [...state.businesses];
    const updated = { ...newBusinesses[selectedBusinessIndex], [field]: value };

    // When industry changes, reset the sub-type so user must re-pick
    if (field === "industry") {
      updated.primary_activity = "";
      updated.secondary_activities = [];
    }

    // Mutual exclusivity: VAT and RCT disable each other
    if (field === "vat_registered" && value === true) {
      updated.rct_status = "not_applicable";
      updated.rct_rate = "";
    }
    if (field === "rct_status" && value !== "" && value !== "not_applicable") {
      updated.vat_registered = false;
      updated.vat_number = "";
      updated.vat_basis = "";
      updated.vat_registration_date = "";
    }

    newBusinesses[selectedBusinessIndex] = updated;
    setState({ ...state, businesses: newBusinesses });
  };

  const canProceed = useMemo(() => {
    switch (step) {
      case "business_identity":
        // All businesses must have name and structure filled
        // For limited companies, also require director count
        return state.businesses.every(b => {
          const hasBasicInfo = b.name.trim() && b.structure;
          if (b.structure === "limited_company") {
            return hasBasicInfo && b.director_count !== null && b.director_count >= 1;
          }
          return hasBasicInfo;
        });
      case "industry_select":
        return state.businesses.every(b => b.industry.trim() !== "");
      case "business_activity":
        // All businesses must have a primary activity (and description if "other")
        return state.businesses.every(b => b.primary_activity && (b.primary_activity !== "other" || b.primary_activity_other));
      case "vat_setup":
        // All businesses must have valid VAT setup
        return state.businesses.every(b => !b.vat_registered || (b.vat_number && b.vat_basis));
      case "capitalisation":
        // All businesses must have a valid threshold
        return state.businesses.every(b => b.capitalisation_threshold > 0);
      case "declaration":
        return state.declaration_confirmed;
      default:
        return true;
    }
  }, [step, state]);

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
      setSelectedBusinessIndex(0); // Reset to first business when changing steps
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
      setSelectedBusinessIndex(0);
    }
  };

  const handleMultiSelectBusiness = (field: "payment_methods" | "payment_types" | "secondary_activities", value: string) => {
    const currentValues = currentBusiness[field] as string[];
    
    // Handle "none" selection for payment_types
    if (field === "payment_types") {
      if (value === "none") {
        updateBusiness(field, ["none"]);
        return;
      }
      // If selecting something else, remove "none"
      const withoutNone = currentValues.filter(v => v !== "none");
      const newValues = withoutNone.includes(value)
        ? withoutNone.filter(v => v !== value)
        : [...withoutNone, value];
      updateBusiness(field, newValues);
      return;
    }
    
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    updateBusiness(field, newValues);
  };

  const handleSkip = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Demo mode: just navigate
      if (isDemoMode()) {
        toast.success("Onboarding skipped (demo mode)");
        navigate("/dashboard");
        return;
      }

      // Create minimal onboarding record to mark as complete
      const { data: existing } = await supabase
        .from("onboarding_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from("onboarding_settings")
          .update({ onboarding_completed: true })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("onboarding_settings")
          .insert({
            user_id: user.id,
            onboarding_completed: true,
          });
      }

      // Store mock director onboarding to skip that too
      try {
        localStorage.setItem('business_onboarding_extra', JSON.stringify({ director_count: 1 }));
      } catch (e) {
        console.warn("localStorage not available");
      }

      // Create a minimal director_onboarding record in Supabase so auth check passes
      await supabase
        .from("director_onboarding")
        .upsert({
          user_id: user.id,
          director_number: 1,
          onboarding_completed: true,
          onboarding_data: { onboarding_completed: true },
        }, { onConflict: 'user_id,director_number' });

      await refreshOnboardingStatus();
      toast.success("Onboarding skipped - you can configure settings later");
      navigate("/dashboard");
    } catch (error: unknown) {
      console.error("Error skipping onboarding:", error);
      toast.error("Failed to skip onboarding");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Use the first business for legacy fields
      const primaryBusiness = state.businesses[0];
      
      // Store additional fields in localStorage since they don't exist in DB yet
      const additionalSettings = {
        businesses: state.businesses,
        business_count: state.business_count,
      };
      
      try {
        localStorage.setItem('business_onboarding_extra', JSON.stringify(additionalSettings));
      } catch (storageError) {
        console.warn("Unable to persist business_onboarding_extra to localStorage", storageError);
      }

      // Demo mode: don't attempt to write to the backend.
      if (isDemoMode()) {
        toast.success("Saved (demo mode)");
        navigate("/dashboard");
        return;
      }

      // Persist only columns that exist in the backend schema (use first business for legacy).
      const vatNumber = primaryBusiness.vat_registered ? (primaryBusiness.vat_number || null) : null;

      const { data: existing, error: existingError } = await supabase
        .from("onboarding_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingError) throw existingError;

      const euTradeFields = {
        eu_trade_enabled: primaryBusiness.eu_trade_enabled,
        sells_goods_to_eu: primaryBusiness.sells_goods_to_eu,
        buys_goods_from_eu: primaryBusiness.buys_goods_from_eu,
        sells_services_to_eu: primaryBusiness.sells_services_to_eu,
        buys_services_from_eu: primaryBusiness.buys_services_from_eu,
        sells_to_non_eu: primaryBusiness.sells_to_non_eu,
        buys_from_non_eu: primaryBusiness.buys_from_non_eu,
        sells_digital_services_b2c: primaryBusiness.sells_digital_services_b2c,
        has_section_56_authorisation: primaryBusiness.has_section_56_authorisation,
        uses_postponed_accounting: primaryBusiness.uses_postponed_accounting,
      };

      if (existing?.id) {
        const { error } = await supabase
          .from("onboarding_settings")
          .update({
            business_name: primaryBusiness.name,
            business_type: (primaryBusiness.primary_activity === "other" ? primaryBusiness.primary_activity_other || "other" : primaryBusiness.primary_activity) || null,
            business_description: primaryBusiness.business_description || null,
            vat_registered: primaryBusiness.vat_registered,
            vat_number: vatNumber,
            onboarding_completed: true,
            ...euTradeFields,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("onboarding_settings")
          .insert({
            user_id: user.id,
            business_name: primaryBusiness.name,
            business_type: (primaryBusiness.primary_activity === "other" ? primaryBusiness.primary_activity_other || "other" : primaryBusiness.primary_activity) || null,
            business_description: primaryBusiness.business_description || null,
            vat_registered: primaryBusiness.vat_registered,
            vat_number: vatNumber,
            onboarding_completed: true,
            ...euTradeFields,
          });

        if (error) throw error;
      }

      // Update profile with the fields that exist.
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          business_name: primaryBusiness.name,
          business_type: (primaryBusiness.primary_activity === "other" ? primaryBusiness.primary_activity_other || "other" : primaryBusiness.primary_activity) || null,
          business_description: primaryBusiness.business_description || null,
        })
        .eq("id", user.id);

      if (profileError) {
        console.warn("Profile update warning:", profileError);
      }

      // Create business accounts based on businesses array
      const accountsToCreate = state.businesses.map((business, index) => ({
        user_id: user.id,
        name: business.name || `Business ${index + 1}`,
        account_type: "bank",
        is_default: index === 0,
      }));

      // Only insert if we have valid businesses
      if (accountsToCreate.length > 0) {
        const { error: accountsError } = await supabase
          .from("accounts")
          .insert(accountsToCreate);

        if (accountsError) {
          console.warn("Accounts creation warning:", accountsError);
        }
      }

      await refreshOnboardingStatus();
      toast.success("Onboarding complete!");
      navigate("/onboarding/director");
    } catch (error: unknown) {
      console.error("Error saving onboarding:", error);
      toast.error("Failed to save onboarding");
    } finally {
      setSaving(false);
    }
  };

  const getAllActivities = () => {
    const activities: { value: string; label: string }[] = [];
    Object.values(BUSINESS_ACTIVITIES).forEach(category => {
      activities.push(...category);
    });
    return activities;
  };

  // Business tabs component for steps that need per-business data
  const BusinessTabs = () => {
    if (state.businesses.length <= 1) return null;
    
    return (
      <div className="flex gap-2 mb-6 flex-wrap">
        {state.businesses.map((business, index) => (
          <button
            key={index}
            onClick={() => setSelectedBusinessIndex(index)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all border",
              selectedBusinessIndex === index
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
            )}
          >
            {business.name || `Business ${index + 1}`}
          </button>
        ))}
      </div>
    );
  };

  // Check if all businesses have completed a step
  const getBusinessCompletionStatus = (checkField: keyof BusinessData) => {
    return state.businesses.map((b, i) => {
      const value = b[checkField];
      if (typeof value === "boolean") return true; // Booleans are always "set"
      if (Array.isArray(value)) return true; // Arrays are optional
      return Boolean(value);
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto">
          {/* Step navigation tabs */}
          <ScrollArea className="w-full">
            <div className="flex items-center gap-1 py-1 min-w-max">
              {STEPS.map((s, idx) => {
                const isActive = idx === stepIndex;
                const isComplete = idx < stepIndex;
                return (
                  <button
                    key={s}
                    onClick={() => (import.meta.env.DEV || idx < stepIndex) && setStepIndex(idx)}
                    disabled={!import.meta.env.DEV && idx > stepIndex}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
                      isActive && "bg-primary text-primary-foreground border-primary",
                      isComplete && "bg-muted text-foreground border-border hover:bg-muted/80",
                      !isActive && !isComplete && "bg-transparent text-muted-foreground border-transparent hover:bg-muted/50"
                    )}
                  >
                    <span>{STEP_LABELS[s]}</span>
                  </button>
                );
              })}
              {import.meta.env.DEV && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  disabled={saving}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  Skip
                </Button>
              )}
            </div>
          </ScrollArea>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Step 1: Business Identity */}
        {step === "business_identity" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Business Identity</h2>
              <p className="text-muted-foreground">Basic information about your business structure and tax filing.</p>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <Label htmlFor="business_count">How many businesses do you have?</Label>
                <Input
                  id="business_count"
                  type="number"
                  min="1"
                  max="99"
                  value={state.business_count}
                  onChange={(e) => {
                    const newCount = Math.max(1, parseInt(e.target.value) || 1);
                    const newBusinesses = [...state.businesses];
                    // Add more empty businesses if needed
                    while (newBusinesses.length < newCount) {
                      newBusinesses.push(createEmptyBusiness());
                    }
                    // Remove extra businesses if count decreased
                    while (newBusinesses.length > newCount) {
                      newBusinesses.pop();
                    }
                    setState({ ...state, business_count: newCount, businesses: newBusinesses });
                  }}
                  className="mt-1.5 w-24"
                />
              </div>

              {/* Dynamic business forms based on count */}
              {state.businesses.map((business, index) => (
                <div key={index} className="border rounded-xl p-5 space-y-4 bg-muted/30">
                  <h3 className="font-semibold text-lg">
                    {state.business_count === 1 ? "Business Details" : `Business ${index + 1}`}
                  </h3>

                  <div>
                    <Label htmlFor={`business_name_${index}`}>Business name *</Label>
                    <Input
                      id={`business_name_${index}`}
                      value={business.name}
                      onChange={(e) => {
                        const newBusinesses = [...state.businesses];
                        newBusinesses[index] = { ...newBusinesses[index], name: e.target.value };
                        setState({ ...state, businesses: newBusinesses });
                      }}
                      placeholder="Enter business name"
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-base font-medium">Business structure *</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      {[
                        { value: "sole_trader", label: "Sole trader", description: "You are the business" },
                        { value: "limited_company", label: "Limited company", description: "Registered at CRO" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            const newBusinesses = [...state.businesses];
                            newBusinesses[index] = { ...newBusinesses[index], structure: option.value as "sole_trader" | "limited_company" };
                            setState({ ...state, businesses: newBusinesses });
                          }}
                          className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all",
                            business.structure === option.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5",
                              business.structure === option.value
                                ? "border-primary bg-primary"
                                : "border-muted-foreground"
                            )}>
                              {business.structure === option.value && (
                                <Check className="w-3 h-3 text-primary-foreground" />
                              )}
                            </div>
                            <div>
                              <span className="font-medium block">{option.label}</span>
                              <span className="text-sm text-muted-foreground">{option.description}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`accounting_year_end_${index}`}>Accounting year end</Label>
                    <Input
                      id={`accounting_year_end_${index}`}
                      type="date"
                      value={business.accounting_year_end}
                      onChange={(e) => {
                        const newBusinesses = [...state.businesses];
                        newBusinesses[index] = { ...newBusinesses[index], accounting_year_end: e.target.value };
                        setState({ ...state, businesses: newBusinesses });
                      }}
                      className="mt-1.5"
                    />
                  </div>

                  {/* Director count and company secretary - only show for limited companies */}
                  {business.structure === "limited_company" && (
                    <>
                      <div>
                        <Label htmlFor={`cro_number_${index}`}>CRO number</Label>
                        <Input
                          id={`cro_number_${index}`}
                          value={business.cro_number}
                          onChange={(e) => {
                            const newBusinesses = [...state.businesses];
                            newBusinesses[index] = { ...newBusinesses[index], cro_number: e.target.value };
                            setState({ ...state, businesses: newBusinesses });
                          }}
                          placeholder="Enter CRO registration number"
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label htmlFor={`director_count_${index}`}>How many directors does this company have? *</Label>
                        <Input
                          id={`director_count_${index}`}
                          type="number"
                          min="1"
                          max="99"
                          value={business.director_count || ""}
                          onChange={(e) => {
                            const newBusinesses = [...state.businesses];
                            newBusinesses[index] = { ...newBusinesses[index], director_count: parseInt(e.target.value) || null };
                            setState({ ...state, businesses: newBusinesses });
                          }}
                          placeholder="Enter number of directors"
                          className="mt-1.5 w-32"
                        />
                      </div>

                      <div>
                        <Label className="text-base font-medium">Does this company have a company secretary?</Label>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          {[
                            { value: true, label: "Yes" },
                            { value: false, label: "No" },
                          ].map((option) => (
                            <button
                              key={String(option.value)}
                              type="button"
                              onClick={() => {
                                const newBusinesses = [...state.businesses];
                                newBusinesses[index] = { ...newBusinesses[index], has_company_secretary: option.value };
                                setState({ ...state, businesses: newBusinesses });
                              }}
                              className={cn(
                                "p-4 rounded-xl border-2 text-left transition-all",
                                business.has_company_secretary === option.value
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                  business.has_company_secretary === option.value
                                    ? "border-primary bg-primary"
                                    : "border-muted-foreground"
                                )}>
                                  {business.has_company_secretary === option.value && (
                                    <Check className="w-3 h-3 text-primary-foreground" />
                                  )}
                                </div>
                                <span className="font-medium">{option.label}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {business.has_company_secretary && (
                        <div>
                          <Label htmlFor={`secretary_name_${index}`}>Company secretary name</Label>
                          <Input
                            id={`secretary_name_${index}`}
                            value={business.company_secretary_name}
                            onChange={(e) => {
                              const newBusinesses = [...state.businesses];
                              newBusinesses[index] = { ...newBusinesses[index], company_secretary_name: e.target.value };
                              setState({ ...state, businesses: newBusinesses });
                            }}
                            placeholder="Enter company secretary's full name"
                            className="mt-1.5"
                          />
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <Label htmlFor={`tax_reference_${index}`}>Revenue tax reference number</Label>
                    <Input
                      id={`tax_reference_${index}`}
                      value={business.tax_reference}
                      onChange={(e) => {
                        const newBusinesses = [...state.businesses];
                        newBusinesses[index] = { ...newBusinesses[index], tax_reference: e.target.value };
                        setState({ ...state, businesses: newBusinesses });
                      }}
                      placeholder="Enter tax reference number"
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`registered_address_${index}`}>Registered office address</Label>
                    <AddressAutocomplete
                      id={`registered_address_${index}`}
                      value={business.registered_address}
                      onChange={(val) => {
                        const newBusinesses = [...state.businesses];
                        newBusinesses[index] = { ...newBusinesses[index], registered_address: val };
                        setState({ ...state, businesses: newBusinesses });
                      }}
                      placeholder="Enter registered office address"
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`place_of_work_${index}`}>Home county *</Label>
                    <AddressAutocomplete
                      id={`place_of_work_${index}`}
                      value={business.place_of_work}
                      onChange={(val) => {
                        const newBusinesses = [...state.businesses];
                        newBusinesses[index] = { ...newBusinesses[index], place_of_work: val };
                        setState({ ...state, businesses: newBusinesses });
                      }}
                      onTownSelect={(town) => {
                        const newBusinesses = [...state.businesses];
                        newBusinesses[index] = { ...newBusinesses[index], place_of_work: town.county };
                        setState({ ...state, businesses: newBusinesses });
                      }}
                      placeholder="e.g. Dublin, Kildare, Cork"
                      className="mt-1.5"
                    />
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Work outside this county triggers overnight stay detection (hotel bookings, Booking.com, etc.).
                    </p>
                  </div>

                  <div>
                    <Label htmlFor={`workshop_address_${index}`}>Workshop / office address *</Label>
                    <AddressAutocomplete
                      id={`workshop_address_${index}`}
                      value={business.workshop_address}
                      onChange={(val) => {
                        const newBusinesses = [...state.businesses];
                        newBusinesses[index] = { ...newBusinesses[index], workshop_address: val };
                        setState({ ...state, businesses: newBusinesses });
                      }}
                      placeholder="e.g. Hollystown Industrial Units, Dublin 15"
                      className="mt-1.5"
                    />
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Subsistence (meals) applies when working beyond the radius below from this address.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor={`subsistence_radius_${index}`}>Subsistence radius (km)</Label>
                    <Input
                      id={`subsistence_radius_${index}`}
                      type="number"
                      min={1}
                      max={100}
                      value={business.subsistence_radius_km || ""}
                      onChange={(e) => {
                        const newBusinesses = [...state.businesses];
                        newBusinesses[index] = { ...newBusinesses[index], subsistence_radius_km: parseInt(e.target.value) || 8 };
                        setState({ ...state, businesses: newBusinesses });
                      }}
                      placeholder="8"
                      className="mt-1.5 w-24"
                    />
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Revenue civil service subsistence rates apply when working more than this distance from your workshop. Default: 8km.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Industry Select */}
        {step === "industry_select" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Pick Your Industry</h2>
              <p className="text-muted-foreground">Select the industry that best describes your business.</p>
            </div>

            <BusinessTabs />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.keys(BUSINESS_ACTIVITIES).map((industryKey) => (
                <button
                  key={industryKey}
                  type="button"
                  onClick={() => updateBusiness("industry", industryKey)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    currentBusiness.industry === industryKey
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0",
                      currentBusiness.industry === industryKey
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    )}>
                      {currentBusiness.industry === industryKey && (
                        <Check className="w-3 h-3 text-primary-foreground" />
                      )}
                    </div>
                    <span className="font-medium text-sm">{industryKey}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Business Activity */}
        {step === "business_activity" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Business Activity</h2>
              <p className="text-muted-foreground">
                {currentBusiness.industry
                  ? `Select your specific activity within ${currentBusiness.industry}.`
                  : "What does your business mainly do?"}
              </p>
            </div>

            <BusinessTabs />

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-6">
              {currentBusiness.industry === "Mixed / Other" ? (
                <div>
                  <Label className="text-base font-medium">Describe your business activity *</Label>
                  <Input
                    className="mt-2 h-14 text-base"
                    placeholder="e.g. Consulting, IT services, coaching..."
                    value={currentBusiness.primary_activity_other || ""}
                    onChange={(e) => {
                      const newBusinesses = [...state.businesses];
                      newBusinesses[selectedBusinessIndex] = {
                        ...newBusinesses[selectedBusinessIndex],
                        primary_activity: "other",
                        primary_activity_other: e.target.value,
                      };
                      setState({ ...state, businesses: newBusinesses });
                    }}
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-base font-medium">Primary business activity *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    {(BUSINESS_ACTIVITIES[currentBusiness.industry as keyof typeof BUSINESS_ACTIVITIES] || []).map((activity) => (
                      <button
                        key={activity.value}
                        type="button"
                        onClick={() => updateBusiness("primary_activity", activity.value)}
                        className={cn(
                          "rounded-xl border p-4 text-left transition-all",
                          currentBusiness.primary_activity === activity.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0",
                            currentBusiness.primary_activity === activity.value
                              ? "border-primary bg-primary"
                              : "border-muted-foreground"
                          )}>
                            {currentBusiness.primary_activity === activity.value && (
                              <Check className="w-3 h-3 text-primary-foreground" />
                            )}
                          </div>
                          <span className="font-medium text-sm">{activity.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-base font-medium">Describe what your business does (optional)</Label>
                <p className="text-sm text-muted-foreground mb-3">Max 40 words — helps us categorise your transactions accurately</p>
                <Textarea
                  className="min-h-[80px] text-base"
                  placeholder="e.g. We build custom kitchens and wardrobes for residential clients in Dublin"
                  value={currentBusiness.business_description}
                  onChange={(e) => {
                    const words = e.target.value.trim().split(/\s+/).filter(Boolean);
                    if (words.length <= 40) updateBusiness("business_description", e.target.value);
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {currentBusiness.business_description.trim().split(/\s+/).filter(Boolean).length}/40 words
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Income & Payment Methods */}
        {step === "income_payments" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Income & Payment Methods</h2>
              <p className="text-muted-foreground">How do customers typically pay you?</p>
            </div>

            <BusinessTabs />

            <div className="bg-card rounded-2xl p-6 shadow-sm">
              <div className="space-y-3">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.value}
                    onClick={() => handleMultiSelectBusiness("payment_methods", method.value)}
                    className={cn(
                      "w-full p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                      currentBusiness.payment_methods.includes(method.value)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Checkbox checked={currentBusiness.payment_methods.includes(method.value)} />
                    <span className="font-medium">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: VAT Setup */}
        {step === "vat_setup" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">VAT Setup</h2>
              <p className="text-muted-foreground">Configure your VAT registration and basis.</p>
            </div>

            <BusinessTabs />

            {currentBusiness.rct_status && currentBusiness.rct_status !== "" && currentBusiness.rct_status !== "not_applicable" && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm">
                VAT is disabled because RCT is active. To enable VAT, set RCT to "Not applicable" first.
              </div>
            )}

            <div className={cn("bg-card rounded-2xl p-6 shadow-sm space-y-5", currentBusiness.rct_status && currentBusiness.rct_status !== "" && currentBusiness.rct_status !== "not_applicable" && "opacity-50 pointer-events-none")}>
              <div>
                <Label className="text-base font-medium">Are you currently VAT registered?</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { value: true, label: "Yes" },
                    { value: false, label: "No" },
                  ].map((option) => (
                    <button
                      key={String(option.value)}
                      onClick={() => updateBusiness("vat_registered", option.value)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        currentBusiness.vat_registered === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        currentBusiness.vat_registered === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {currentBusiness.vat_registered === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {currentBusiness.vat_registered && (
                <>
                  <div>
                    <Label htmlFor="vat_number">VAT number *</Label>
                    <Input
                      id="vat_number"
                      value={currentBusiness.vat_number}
                      onChange={(e) => updateBusiness("vat_number", e.target.value)}
                      placeholder="IE1234567X"
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="vat_registration_date">VAT registration date</Label>
                    <Input
                      id="vat_registration_date"
                      type="date"
                      value={currentBusiness.vat_registration_date}
                      onChange={(e) => updateBusiness("vat_registration_date", e.target.value)}
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-base font-medium">VAT basis *</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {[
                        { value: "cash", label: "Cash" },
                        { value: "invoice", label: "Invoice" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => updateBusiness("vat_basis", option.value as "cash" | "invoice")}
                          className={cn(
                            "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                            currentBusiness.vat_basis === option.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                            currentBusiness.vat_basis === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                          )}>
                            {currentBusiness.vat_basis === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                          </div>
                          <span className="font-medium">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-base font-medium">Do you expect your VAT status to change?</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {[
                        { value: false, label: "No" },
                        { value: true, label: "Yes" },
                      ].map((option) => (
                        <button
                          key={String(option.value)}
                          onClick={() => updateBusiness("vat_status_change_expected", option.value)}
                          className={cn(
                            "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                            currentBusiness.vat_status_change_expected === option.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                            currentBusiness.vat_status_change_expected === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                          )}>
                            {currentBusiness.vat_status_change_expected === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                          </div>
                          <span className="font-medium">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {currentBusiness.vat_status_change_expected && (
                    <div>
                      <Label htmlFor="vat_change_date">Expected change date</Label>
                      <Input
                        id="vat_change_date"
                        type="date"
                        value={currentBusiness.vat_change_date}
                        onChange={(e) => updateBusiness("vat_change_date", e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* EU & International Trade (conditional on VAT registration) */}
        {step === "eu_international_trade" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">EU & International Trade</h2>
              <p className="text-muted-foreground">Set up cross-border VAT treatment for EU and non-EU trade.</p>
            </div>

            <BusinessTabs />

            {/* IE VAT number reminder */}
            {currentBusiness.vat_number && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-800 text-sm space-y-1">
                <p className="font-medium">Your EU VAT number: IE{currentBusiness.vat_number.replace(/^IE/i, "")}</p>
                <p>Give this number to EU suppliers so they can zero-rate their invoices to you. You then self-account for Irish VAT via reverse charge on your VAT3.</p>
              </div>
            )}

            {/* Master toggle */}
            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <Label className="text-base font-medium">Does your business trade with EU or non-EU countries?</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { value: true, label: "Yes" },
                    { value: false, label: "No" },
                  ].map((option) => (
                    <button
                      key={String(option.value)}
                      onClick={() => updateBusiness("eu_trade_enabled", option.value)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        currentBusiness.eu_trade_enabled === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        currentBusiness.eu_trade_enabled === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {currentBusiness.eu_trade_enabled === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {currentBusiness.eu_trade_enabled && (
                <>
                  <div className="space-y-3">
                    <Label className="text-base font-medium">What types of cross-border trade do you do?</Label>
                    <p className="text-sm text-muted-foreground">Select all that apply</p>

                    {[
                      { field: "sells_goods_to_eu" as const, label: "Sell goods to EU countries", desc: "Intra-Community Supplies (ICS) — zero-rated with VIES reporting" },
                      { field: "buys_goods_from_eu" as const, label: "Buy goods from EU countries", desc: "Intra-Community Acquisitions (ICA) — self-account for VAT" },
                      { field: "sells_services_to_eu" as const, label: "Sell services to EU businesses", desc: "Reverse charge — invoice without VAT" },
                      { field: "buys_services_from_eu" as const, label: "Buy services from EU businesses", desc: "Reverse charge — self-account for Irish VAT" },
                      { field: "sells_digital_services_b2c" as const, label: "Sell digital services to EU consumers (B2C)", desc: "One Stop Shop (OSS) may apply above €10,000" },
                      { field: "sells_to_non_eu" as const, label: "Export goods/services to non-EU countries", desc: "Zero-rated exports — retain proof of export" },
                      { field: "buys_from_non_eu" as const, label: "Import goods/services from non-EU countries", desc: "Import VAT applies — postponed accounting available" },
                    ].map((item) => (
                      <label
                        key={item.field}
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                          currentBusiness[item.field]
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <Checkbox
                          checked={currentBusiness[item.field]}
                          onCheckedChange={(checked) => updateBusiness(item.field, !!checked)}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="font-medium">{item.label}</span>
                          <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Conditional sub-questions */}
                  {(currentBusiness.buys_from_non_eu || currentBusiness.buys_goods_from_eu) && (
                    <div className="space-y-3 border-t pt-4">
                      <Label className="text-base font-medium">Additional import/acquisition options</Label>

                      {currentBusiness.buys_from_non_eu && (
                        <label className={cn(
                          "flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                          currentBusiness.uses_postponed_accounting ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        )}>
                          <Checkbox
                            checked={currentBusiness.uses_postponed_accounting}
                            onCheckedChange={(checked) => updateBusiness("uses_postponed_accounting", !!checked)}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="font-medium">Postponed Accounting (PA1)</span>
                            <p className="text-sm text-muted-foreground mt-0.5">Account for import VAT on your VAT3 instead of paying at the point of import — no cash-flow impact.</p>
                          </div>
                        </label>
                      )}

                      {(currentBusiness.sells_goods_to_eu || currentBusiness.sells_to_non_eu) && (
                        <label className={cn(
                          "flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                          currentBusiness.has_section_56_authorisation ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        )}>
                          <Checkbox
                            checked={currentBusiness.has_section_56_authorisation}
                            onCheckedChange={(checked) => updateBusiness("has_section_56_authorisation", !!checked)}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="font-medium">Section 56 Authorisation</span>
                            <p className="text-sm text-muted-foreground mt-0.5">Receive goods/services without VAT being charged — for businesses where 75%+ of sales are zero-rated (exports/ICS).</p>
                          </div>
                        </label>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* RCT & Subcontracting (conditional on construction trade) */}
        {step === "rct_subcontracting" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">RCT & Subcontracting</h2>
              <p className="text-muted-foreground">Relevant Contracts Tax applies to construction-related activities.</p>
            </div>

            <BusinessTabs />

            {currentBusiness.vat_registered && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm">
                RCT is disabled because VAT is active. To enable RCT, set VAT to "No" first.
              </div>
            )}

            <div className={cn("bg-card rounded-2xl p-6 shadow-sm space-y-5", currentBusiness.vat_registered && "opacity-50 pointer-events-none")}>
              <div>
                <Label className="text-base font-medium">What is your RCT role?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  {([
                    { value: "not_applicable", label: "Not applicable" },
                    { value: "principal", label: "Principal contractor" },
                    { value: "subcontractor", label: "Subcontractor" },
                    { value: "both", label: "Both" },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updateBusiness("rct_status", option.value)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        currentBusiness.rct_status === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        currentBusiness.rct_status === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {currentBusiness.rct_status === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {(currentBusiness.rct_status === "subcontractor" || currentBusiness.rct_status === "both") && (
                <div>
                  <Label className="text-base font-medium">Current RCT deduction rate</Label>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {([
                      { value: "0", label: "0%" },
                      { value: "20", label: "20%" },
                      { value: "35", label: "35%" },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        onClick={() => updateBusiness("rct_rate", option.value)}
                        className={cn(
                          "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                          currentBusiness.rct_rate === option.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                          currentBusiness.rct_rate === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                        )}>
                          {currentBusiness.rct_rate === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                        </div>
                        <span className="font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(currentBusiness.rct_status === "principal" || currentBusiness.rct_status === "both") && (
                <div>
                  <Label className="text-base font-medium">Do you engage subcontractors?</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {[
                      { value: true, label: "Yes" },
                      { value: false, label: "No" },
                    ].map((option) => (
                      <button
                        key={String(option.value)}
                        onClick={() => updateBusiness("has_subcontractors", option.value)}
                        className={cn(
                          "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                          currentBusiness.has_subcontractors === option.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                          currentBusiness.has_subcontractors === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                        )}>
                          {currentBusiness.has_subcontractors === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                        </div>
                        <span className="font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Expense Behaviour */}
        {step === "expense_behaviour" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Expense Behaviour</h2>
              <p className="text-muted-foreground">Expense categories and allowability are applied automatically based on business activity.</p>
            </div>

            <BusinessTabs />

            <div className="bg-card rounded-2xl p-6 shadow-sm">
              <div>
                <Label className="text-base font-medium">Will this bank account contain personal or mixed-use spending?</Label>
                <div className="grid grid-cols-1 gap-3 mt-3">
                  {[
                    { value: false, label: "No - business only" },
                    { value: true, label: "Yes - mixed use" },
                  ].map((option) => (
                    <button
                      key={String(option.value)}
                      onClick={() => updateBusiness("mixed_use_spending", option.value)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        currentBusiness.mixed_use_spending === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        currentBusiness.mixed_use_spending === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {currentBusiness.mixed_use_spending === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t">
                <Label className="text-base font-medium">Do you work from home?</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { value: true, label: "Yes" },
                    { value: false, label: "No" },
                  ].map((option) => (
                    <button
                      key={String(option.value)}
                      onClick={() => updateBusiness("has_home_office", option.value)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        currentBusiness.has_home_office === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        currentBusiness.has_home_office === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {currentBusiness.has_home_office === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t">
                <Label htmlFor="business_use_percentage">Estimated business use % of mixed items (phone, broadband, vehicle)</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="business_use_percentage"
                    type="number"
                    min={0}
                    max={100}
                    value={currentBusiness.business_use_percentage || ""}
                    onChange={(e) => updateBusiness("business_use_percentage", parseInt(e.target.value) || 0)}
                    className="pr-8"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5">Used for apportioning mixed-use expenses between business and personal.</p>
              </div>
            </div>
          </div>
        )}

        {/* Capitalisation Policy */}
        {step === "capitalisation" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Capitalisation Policy</h2>
              <p className="text-muted-foreground">How the platform treats larger purchases</p>
            </div>

            <BusinessTabs />

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-6">
              {/* Step 1: Asset Test */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Step 1 - Asset test (conceptual rule)</h3>
                <p className="text-muted-foreground">
                  A purchase is considered a <span className="font-medium text-foreground">fixed asset</span> if it is expected to be used in the business for <span className="font-medium text-foreground">more than one year</span>.
                </p>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Examples:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Tools and equipment</li>
                    <li>Vehicles</li>
                    <li>Machinery</li>
                    <li>Computers</li>
                  </ul>
                </div>
              </div>

              {/* Step 2: Practical Policy */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="font-semibold text-lg">Step 2 - Practical policy (your choice)</h3>
                <p className="text-muted-foreground">
                  To keep bookkeeping simple, businesses usually set a value threshold. Purchases above this amount are treated as fixed assets, even if similar smaller items are expensed.
                </p>
                <div>
                  <Label htmlFor="capitalisation_threshold">Capitalisation threshold (ex VAT) *</Label>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">EUR</span>
                    <Input
                      id="capitalisation_threshold"
                      type="number"
                      value={currentBusiness.capitalisation_threshold}
                      onChange={(e) => updateBusiness("capitalisation_threshold", parseInt(e.target.value) || 0)}
                      className="pl-12"
                      min={0}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1.5">Platform suggestion: EUR 1,000 (You can change this at any time.)</p>
                </div>
              </div>


              {/* Existing Assets */}
              <div className="space-y-3 pt-4 border-t">
                <Label className="text-base font-medium">Did the business have existing fixed assets before this accounting period?</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: true, label: "Yes" },
                    { value: false, label: "No" },
                  ].map((option) => (
                    <button
                      key={String(option.value)}
                      onClick={() => updateBusiness("has_opening_assets", option.value)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        currentBusiness.has_opening_assets === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        currentBusiness.has_opening_assets === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {currentBusiness.has_opening_assets === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>

                {currentBusiness.has_opening_assets && (
                  <div>
                    <Label htmlFor="opening_asset_value">Approximate total cost of existing assets</Label>
                    <div className="relative mt-1.5">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">EUR</span>
                      <Input
                        id="opening_asset_value"
                        type="number"
                        value={currentBusiness.opening_asset_value || ""}
                        onChange={(e) => updateBusiness("opening_asset_value", parseInt(e.target.value) || 0)}
                        className="pl-12"
                        min={0}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirmation */}
              <div className="pt-4 border-t">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="capitalisation_confirmed"
                    checked={currentBusiness.regular_capital_purchases}
                    onCheckedChange={(checked) => updateBusiness("regular_capital_purchases", checked === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="capitalisation_confirmed" className="text-sm font-normal leading-relaxed cursor-pointer">
                    I understand and confirm this policy
                  </Label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 7: Payments Setup */}
        {step === "payments_setup" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Payments Setup</h2>
              <p className="text-muted-foreground">Will this account be used to make any of the following payments?</p>
            </div>

            <BusinessTabs />

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-5">
              <div className="space-y-3">
                {PAYMENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => handleMultiSelectBusiness("payment_types", type.value)}
                    className={cn(
                      "w-full p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                      currentBusiness.payment_types.includes(type.value)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Checkbox checked={currentBusiness.payment_types.includes(type.value)} />
                    <span className="font-medium">{type.label}</span>
                  </button>
                ))}
              </div>

              {/* Custom Payment Types */}
              <div className="pt-4 border-t space-y-3">
                <Label>Other payment types</Label>
                <p className="text-sm text-muted-foreground">Add any additional payment types not listed above</p>
                
                <div className="space-y-2">
                  {(currentBusiness.custom_payment_types || []).map((customType, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={customType}
                        onChange={(e) => {
                          const updated = [...(currentBusiness.custom_payment_types || [])];
                          updated[index] = e.target.value;
                          updateBusiness("custom_payment_types", updated);
                        }}
                        placeholder="Enter payment type"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const updated = (currentBusiness.custom_payment_types || []).filter((_, i) => i !== index);
                          updateBusiness("custom_payment_types", updated);
                        }}
                        className="shrink-0 text-destructive hover:text-destructive"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      updateBusiness("custom_payment_types", [...(currentBusiness.custom_payment_types || []), ""]);
                    }}
                    className="w-full"
                  >
                    + Add payment type
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Employees & Payroll */}
        {step === "employees_payroll" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Employees & Payroll</h2>
              <p className="text-muted-foreground">Tell us about your workforce and payroll obligations.</p>
            </div>

            <BusinessTabs />

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <Label className="text-base font-medium">Does the business have employees (other than directors)?</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { value: true, label: "Yes" },
                    { value: false, label: "No" },
                  ].map((option) => (
                    <button
                      key={String(option.value)}
                      onClick={() => updateBusiness("has_employees", option.value)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        currentBusiness.has_employees === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        currentBusiness.has_employees === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {currentBusiness.has_employees === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {currentBusiness.has_employees && (
                <>
                  <div>
                    <Label htmlFor="employee_count">Number of employees</Label>
                    <Input
                      id="employee_count"
                      type="number"
                      min={1}
                      value={currentBusiness.employee_count || ""}
                      onChange={(e) => updateBusiness("employee_count", parseInt(e.target.value) || 0)}
                      className="mt-1.5 w-32"
                    />
                  </div>

                  <div>
                    <Label className="text-base font-medium">Registered for PAYE/PRSI as employer?</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {[
                        { value: true, label: "Yes" },
                        { value: false, label: "No" },
                      ].map((option) => (
                        <button
                          key={String(option.value)}
                          onClick={() => updateBusiness("paye_registered", option.value)}
                          className={cn(
                            "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                            currentBusiness.paye_registered === option.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                            currentBusiness.paye_registered === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                          )}>
                            {currentBusiness.paye_registered === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                          </div>
                          <span className="font-medium">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {currentBusiness.paye_registered && (
                    <div>
                      <Label htmlFor="paye_number">PAYE employer registration number</Label>
                      <Input
                        id="paye_number"
                        value={currentBusiness.paye_number}
                        onChange={(e) => updateBusiness("paye_number", e.target.value)}
                        placeholder="Enter PAYE number"
                        className="mt-1.5"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Loans & Finance */}
        {step === "loans_finance" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Loans & Finance</h2>
              <p className="text-muted-foreground">Does the business have any loans or finance agreements?</p>
            </div>

            <BusinessTabs />

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: true, label: "Yes" },
                    { value: false, label: "No" },
                  ].map((option) => (
                    <button
                      key={String(option.value)}
                      onClick={() => updateBusiness("has_loans", option.value)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        currentBusiness.has_loans === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        currentBusiness.has_loans === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {currentBusiness.has_loans === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {currentBusiness.has_loans && (
                <>
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={currentBusiness.loan_type}
                      onValueChange={(v) => updateBusiness("loan_type", v)}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select loan type" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOAN_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="loan_start_date">Start date</Label>
                    <Input
                      id="loan_start_date"
                      type="date"
                      value={currentBusiness.loan_start_date}
                      onChange={(e) => updateBusiness("loan_start_date", e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 9: Director's Loan Account */}
        {step === "directors_loan" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Director's Loan Account</h2>
              <p className="text-muted-foreground">If Company: Will money move between you and the business outside payroll or dividends?</p>
            </div>

            <BusinessTabs />

            <div className="bg-card rounded-2xl p-6 shadow-sm">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: true, label: "Yes" },
                  { value: false, label: "No" },
                ].map((option) => (
                  <button
                    key={String(option.value)}
                    onClick={() => updateBusiness("directors_loan_movements", option.value)}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                      currentBusiness.directors_loan_movements === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      currentBusiness.directors_loan_movements === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                    )}>
                      {currentBusiness.directors_loan_movements === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                    </div>
                    <span className="font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Opening Balances */}
        {step === "opening_balances" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Opening Balances</h2>
              <p className="text-muted-foreground">If this is your first year using Balnce, provide opening balances so accounts carry forward correctly.</p>
            </div>

            <BusinessTabs />

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <Label className="text-base font-medium">Is this the first year using Balnce?</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { value: true, label: "Yes" },
                    { value: false, label: "No" },
                  ].map((option) => (
                    <button
                      key={String(option.value)}
                      onClick={() => updateBusiness("has_opening_balances", option.value)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex items-center gap-3",
                        currentBusiness.has_opening_balances === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        currentBusiness.has_opening_balances === option.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {currentBusiness.has_opening_balances === option.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {currentBusiness.has_opening_balances && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="opening_bank_balance">Opening bank balance</Label>
                    <div className="relative mt-1.5">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">EUR</span>
                      <Input
                        id="opening_bank_balance"
                        type="number"
                        value={currentBusiness.opening_bank_balance || ""}
                        onChange={(e) => updateBusiness("opening_bank_balance", parseFloat(e.target.value) || 0)}
                        className="pl-12"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="opening_debtors">Outstanding trade debtors at start</Label>
                    <div className="relative mt-1.5">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">EUR</span>
                      <Input
                        id="opening_debtors"
                        type="number"
                        value={currentBusiness.opening_debtors || ""}
                        onChange={(e) => updateBusiness("opening_debtors", parseFloat(e.target.value) || 0)}
                        className="pl-12"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="opening_creditors">Outstanding trade creditors at start</Label>
                    <div className="relative mt-1.5">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">EUR</span>
                      <Input
                        id="opening_creditors"
                        type="number"
                        value={currentBusiness.opening_creditors || ""}
                        onChange={(e) => updateBusiness("opening_creditors", parseFloat(e.target.value) || 0)}
                        className="pl-12"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="opening_vat_liability">VAT owed / refundable at start</Label>
                    <div className="relative mt-1.5">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">EUR</span>
                      <Input
                        id="opening_vat_liability"
                        type="number"
                        value={currentBusiness.opening_vat_liability || ""}
                        onChange={(e) => updateBusiness("opening_vat_liability", parseFloat(e.target.value) || 0)}
                        className="pl-12"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5">Use a negative number if a refund was due.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Declaration */}
        {step === "declaration" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Onboarding Declaration - Business</h2>
              <p className="text-muted-foreground">Review and confirm your information.</p>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-sm space-y-6">
              {/* Summary for each business */}
              {state.businesses.map((business, index) => (
                <div key={index} className="space-y-4">
                  {state.businesses.length > 1 && (
                    <h3 className="font-semibold text-lg border-b pb-2">{business.name || `Business ${index + 1}`}</h3>
                  )}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Business name</span>
                    <span className="font-medium">{business.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Business structure</span>
                    <span className="font-medium">{business.structure === "sole_trader" ? "Sole trader" : "Limited company"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Primary activity</span>
                    <span className="font-medium">{getAllActivities().find(a => a.value === business.primary_activity)?.label || business.primary_activity}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">VAT registered</span>
                    <span className="font-medium">{business.vat_registered ? "Yes" : "No"}</span>
                  </div>
                  {business.vat_registered && (
                    <>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">VAT number</span>
                        <span className="font-medium">{business.vat_number}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">VAT basis</span>
                        <span className="font-medium capitalize">{business.vat_basis}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Capitalisation threshold</span>
                    <span className="font-medium">EUR {business.capitalisation_threshold.toLocaleString()}</span>
                  </div>
                  {business.rct_status && business.rct_status !== "not_applicable" && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">RCT status</span>
                      <span className="font-medium capitalize">{business.rct_status.replace("_", " ")}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Employees</span>
                    <span className="font-medium">{business.has_employees ? `Yes (${business.employee_count})` : "No"}</span>
                  </div>
                  {business.has_home_office && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Home office</span>
                      <span className="font-medium">Yes</span>
                    </div>
                  )}
                  {business.has_opening_balances && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Opening bank balance</span>
                      <span className="font-medium">EUR {business.opening_bank_balance.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              ))}

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
                  I confirm this information is accurate and will be used by the platform to automate bookkeeping, VAT, and balance sheet reporting for {state.businesses.length > 1 ? "these business accounts" : "this business account"}.
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
