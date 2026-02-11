-- Create onboarding_settings table to store all business setup information
CREATE TABLE public.onboarding_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  
  -- Step 1: Business Basics
  business_name text,
  business_type text, -- sole_trader, partnership, limited_company, contractor
  industry text,
  year_end date,
  
  -- Step 2: VAT Information
  vat_registered boolean DEFAULT false,
  vat_number text,
  vat_basis text, -- invoice, cash
  vat_frequency text, -- bi_monthly, quarterly, annual, other
  vat_rates_used text[] DEFAULT '{}', -- array of rates used
  
  -- Step 3: Transaction Sources
  transaction_sources text[] DEFAULT '{}',
  
  -- Step 4: Sales & Income
  income_streams text[] DEFAULT '{}',
  invoicing boolean DEFAULT false,
  payment_terms text,
  sells text, -- products, services, both
  
  -- Step 5: Expenses & Cost Structure
  has_employees boolean DEFAULT false,
  payroll_frequency text,
  employee_count integer,
  uses_subcontractors boolean DEFAULT false,
  expense_types text[] DEFAULT '{}',
  
  -- Step 6: Receipt Preferences
  receipt_upload_method text, -- photo, pdf, bulk, email_forwarding
  ocr_required boolean DEFAULT true,
  
  -- Step 7: Category Rules (stored as JSONB for flexibility)
  category_rules jsonb DEFAULT '[]'::jsonb,
  
  -- Step 8: Accountant
  invite_accountant boolean DEFAULT false,
  accountant_email text,
  accountant_permissions text, -- view, upload, full
  
  -- Onboarding Status
  onboarding_completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own onboarding settings"
ON public.onboarding_settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_onboarding_settings_updated_at
BEFORE UPDATE ON public.onboarding_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();