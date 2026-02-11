-- Create vat_finalisation_data table to store wizard responses
CREATE TABLE public.vat_finalisation_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vat_return_id UUID NOT NULL REFERENCES public.vat_returns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Section 1: Sales
  all_sales_added TEXT CHECK (all_sales_added IN ('yes', 'no', 'not_sure')),
  unpaid_invoices BOOLEAN DEFAULT false,
  unpaid_invoices_list JSONB DEFAULT '[]'::jsonb,
  special_sales TEXT[] DEFAULT '{}',
  special_sales_notes TEXT,
  
  -- Section 2: Purchases
  all_expenses_added TEXT CHECK (all_expenses_added IN ('yes', 'no', 'not_sure')),
  missing_receipts BOOLEAN DEFAULT false,
  missing_receipts_list JSONB DEFAULT '[]'::jsonb,
  
  -- Section 3: High-Risk VAT
  food_vat_claim TEXT CHECK (food_vat_claim IN ('no', 'allowed_staff_canteen', 'not_allowed_exclude')),
  motor_vat_claim TEXT CHECK (motor_vat_claim IN ('fuel_only', 'fuel_and_other', 'none')),
  remove_non_allowed_vat BOOLEAN,
  remove_non_allowed_reason TEXT,
  
  -- Section 4: EU Purchases
  eu_purchases BOOLEAN DEFAULT false,
  eu_purchase_ids UUID[] DEFAULT '{}',
  eu_reverse_charge_flags JSONB DEFAULT '{}'::jsonb,
  
  -- Section 5: Non-EU Purchases
  non_eu_purchases BOOLEAN DEFAULT false,
  non_eu_purchase_details JSONB DEFAULT '[]'::jsonb,
  
  -- Section 6: Adjustments
  credit_notes BOOLEAN DEFAULT false,
  credit_notes_details JSONB DEFAULT '[]'::jsonb,
  manual_adjustments BOOLEAN DEFAULT false,
  manual_adjustment_amount NUMERIC DEFAULT 0,
  manual_adjustment_reason TEXT,
  manual_adjustment_attachment TEXT,
  late_transactions BOOLEAN DEFAULT false,
  late_transactions_list JSONB DEFAULT '[]'::jsonb,
  
  -- Section 7: Compliance
  reviewed_flagged_transactions BOOLEAN DEFAULT false,
  confirm_accuracy BOOLEAN DEFAULT false,
  lock_period BOOLEAN DEFAULT false,
  vat_notes TEXT,
  declaration_true_and_complete BOOLEAN DEFAULT false,
  declaration_penalties_understood BOOLEAN DEFAULT false,
  declaration_period_lock_understood BOOLEAN DEFAULT false,
  
  -- Metadata
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vat_finalisation_data ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage their own VAT finalisation data"
  ON public.vat_finalisation_data
  FOR ALL
  USING (auth.uid() = user_id);

-- Add is_locked column to vat_returns
ALTER TABLE public.vat_returns ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- Trigger for updated_at
CREATE TRIGGER update_vat_finalisation_data_updated_at
  BEFORE UPDATE ON public.vat_finalisation_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();