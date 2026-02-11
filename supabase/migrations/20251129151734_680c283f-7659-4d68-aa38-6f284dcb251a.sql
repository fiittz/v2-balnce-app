-- Create business type enum
CREATE TYPE public.business_type AS ENUM ('sole_trader', 'contractor', 'subcontractor', 'company');

-- Add business_type column to profiles
ALTER TABLE public.profiles 
ADD COLUMN business_type public.business_type DEFAULT NULL;

-- Drop the old trigger and function to recreate with business type logic
DROP TRIGGER IF EXISTS on_auth_user_created_categories ON auth.users;
DROP FUNCTION IF EXISTS public.create_default_categories();

-- Create updated function that creates categories based on business type
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_type public.business_type;
BEGIN
  -- Get the business type from raw_user_meta_data
  v_business_type := (NEW.raw_user_meta_data ->> 'business_type')::public.business_type;
  
  -- Construction-specific categories for contractor/subcontractor
  IF v_business_type IN ('contractor', 'subcontractor') THEN
    -- Income categories for construction
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Sales', 'income', 'receipt', 'reduced_13_5'),
      (NEW.id, 'Day Rate', 'income', 'clock', 'zero_rated'),
      (NEW.id, 'Interest Income', 'income', 'trending-up', 'zero_rated');
    
    -- Expense categories for construction (based on the accounting file)
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      -- Tools & Equipment
      (NEW.id, 'Tools', 'expense', 'wrench', 'standard_23', true),
      (NEW.id, 'Equipment', 'expense', 'monitor', 'standard_23', true),
      
      -- Materials
      (NEW.id, 'Cost of Goods Sold', 'expense', 'package', 'standard_23', true),
      (NEW.id, 'Materials', 'expense', 'layers', 'standard_23', true),
      
      -- Vehicle
      (NEW.id, 'Motor Vehicle Expenses', 'expense', 'car', 'standard_23', false),
      (NEW.id, 'Fuel', 'expense', 'fuel', 'standard_23', false),
      (NEW.id, 'Tolls & Parking', 'expense', 'ticket', 'zero_rated', false),
      
      -- Maintenance
      (NEW.id, 'Repairs and Maintenance', 'expense', 'hammer', 'standard_23', true),
      (NEW.id, 'Cleaning', 'expense', 'sparkles', 'reduced_13_5', true),
      
      -- Professional
      (NEW.id, 'Consulting & Accounting', 'expense', 'calculator', 'standard_23', true),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Charges', 'expense', 'credit-card', 'exempt', false),
      
      -- Wages & Subcontractors
      (NEW.id, 'Wages & Salaries', 'expense', 'users', 'exempt', false),
      (NEW.id, 'Subcontractor Payments', 'expense', 'hard-hat', 'zero_rated', true),
      (NEW.id, 'PRSI & PAYE', 'expense', 'landmark', 'exempt', false),
      
      -- General
      (NEW.id, 'General Expenses', 'expense', 'folder', 'standard_23', true),
      (NEW.id, 'Workwear & PPE', 'expense', 'shirt', 'standard_23', true),
      (NEW.id, 'Subsistence', 'expense', 'coffee', 'zero_rated', false),
      (NEW.id, 'Training', 'expense', 'graduation-cap', 'standard_23', true);
  ELSE
    -- Default categories for other business types
    -- Income categories
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Sales', 'income', 'receipt', 'standard_23'),
      (NEW.id, 'Services', 'income', 'briefcase', 'standard_23'),
      (NEW.id, 'Other Income', 'income', 'coins', 'standard_23');
    
    -- Expense categories (general business)
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Office Supplies', 'expense', 'folder', 'standard_23', true),
      (NEW.id, 'Travel', 'expense', 'car', 'standard_23', true),
      (NEW.id, 'Utilities', 'expense', 'zap', 'reduced_13_5', true),
      (NEW.id, 'Professional Services', 'expense', 'user', 'standard_23', true),
      (NEW.id, 'Equipment', 'expense', 'monitor', 'standard_23', true),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Charges', 'expense', 'credit-card', 'exempt', false),
      (NEW.id, 'Entertainment', 'expense', 'coffee', 'standard_23', false),
      (NEW.id, 'Motor Expenses', 'expense', 'car', 'standard_23', false),
      (NEW.id, 'Rent', 'expense', 'home', 'exempt', false),
      (NEW.id, 'Wages', 'expense', 'users', 'exempt', false),
      (NEW.id, 'Marketing', 'expense', 'megaphone', 'standard_23', true);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger for default categories
CREATE TRIGGER on_auth_user_created_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_categories();