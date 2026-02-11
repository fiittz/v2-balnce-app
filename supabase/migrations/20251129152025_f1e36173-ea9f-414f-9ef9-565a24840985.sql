-- First, drop the existing trigger that uses the old enum
DROP TRIGGER IF EXISTS on_auth_user_created_categories ON auth.users;

-- Drop the existing function
DROP FUNCTION IF EXISTS public.create_default_categories();

-- Update the business_type enum by creating a new one and migrating
-- First create a new enum with the new values
CREATE TYPE public.industry_type AS ENUM (
  'construction',
  'carpentry_joinery',
  'electrical',
  'plumbing_heating',
  'landscaping_groundworks',
  'painting_decorating',
  'manufacturing',
  'retail_ecommerce',
  'hospitality',
  'professional_services',
  'transport_logistics',
  'health_wellness',
  'technology_it',
  'real_estate_property',
  'maintenance_facilities'
);

-- Update profiles table to use the new enum
ALTER TABLE public.profiles 
  ALTER COLUMN business_type DROP DEFAULT,
  ALTER COLUMN business_type TYPE public.industry_type 
    USING CASE business_type::text
      WHEN 'contractor' THEN 'construction'::public.industry_type
      WHEN 'subcontractor' THEN 'construction'::public.industry_type
      WHEN 'sole_trader' THEN 'professional_services'::public.industry_type
      WHEN 'company' THEN 'professional_services'::public.industry_type
      ELSE 'professional_services'::public.industry_type
    END;

-- Drop the old enum
DROP TYPE public.business_type;

-- Rename the new enum to business_type
ALTER TYPE public.industry_type RENAME TO business_type;

-- Recreate the function with new industry-specific categories
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_business_type public.business_type;
BEGIN
  v_business_type := (NEW.raw_user_meta_data ->> 'business_type')::public.business_type;
  
  -- Construction trades (construction, carpentry, electrical, plumbing, landscaping, painting, maintenance)
  IF v_business_type IN ('construction', 'carpentry_joinery', 'electrical', 'plumbing_heating', 'landscaping_groundworks', 'painting_decorating', 'maintenance_facilities') THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Sales', 'income', 'receipt', 'reduced_13_5'),
      (NEW.id, 'Day Rate', 'income', 'clock', 'zero_rated'),
      (NEW.id, 'Interest Income', 'income', 'trending-up', 'zero_rated');
    
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Tools', 'expense', 'wrench', 'standard_23', true),
      (NEW.id, 'Equipment', 'expense', 'monitor', 'standard_23', true),
      (NEW.id, 'Cost of Goods Sold', 'expense', 'package', 'standard_23', true),
      (NEW.id, 'Materials', 'expense', 'layers', 'standard_23', true),
      (NEW.id, 'Motor Vehicle Expenses', 'expense', 'car', 'standard_23', false),
      (NEW.id, 'Fuel', 'expense', 'fuel', 'standard_23', false),
      (NEW.id, 'Tolls & Parking', 'expense', 'ticket', 'zero_rated', false),
      (NEW.id, 'Repairs and Maintenance', 'expense', 'hammer', 'standard_23', true),
      (NEW.id, 'Cleaning', 'expense', 'sparkles', 'reduced_13_5', true),
      (NEW.id, 'Consulting & Accounting', 'expense', 'calculator', 'standard_23', true),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Charges', 'expense', 'credit-card', 'exempt', false),
      (NEW.id, 'Wages & Salaries', 'expense', 'users', 'exempt', false),
      (NEW.id, 'Subcontractor Payments', 'expense', 'hard-hat', 'zero_rated', true),
      (NEW.id, 'PRSI & PAYE', 'expense', 'landmark', 'exempt', false),
      (NEW.id, 'General Expenses', 'expense', 'folder', 'standard_23', true),
      (NEW.id, 'Workwear & PPE', 'expense', 'shirt', 'standard_23', true),
      (NEW.id, 'Subsistence', 'expense', 'coffee', 'zero_rated', false),
      (NEW.id, 'Training', 'expense', 'graduation-cap', 'standard_23', true);

  -- Hospitality
  ELSIF v_business_type = 'hospitality' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Food Sales', 'income', 'utensils', 'reduced_13_5'),
      (NEW.id, 'Beverage Sales', 'income', 'wine', 'standard_23'),
      (NEW.id, 'Takeaway Sales', 'income', 'package', 'second_reduced_9'),
      (NEW.id, 'Other Income', 'income', 'coins', 'standard_23');
    
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Food Supplies', 'expense', 'shopping-cart', 'zero_rated', true),
      (NEW.id, 'Beverages Stock', 'expense', 'wine', 'standard_23', true),
      (NEW.id, 'Kitchen Equipment', 'expense', 'chef-hat', 'standard_23', true),
      (NEW.id, 'Cleaning Supplies', 'expense', 'sparkles', 'standard_23', true),
      (NEW.id, 'Utilities', 'expense', 'zap', 'reduced_13_5', true),
      (NEW.id, 'Rent', 'expense', 'home', 'exempt', false),
      (NEW.id, 'Wages & Salaries', 'expense', 'users', 'exempt', false),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Charges', 'expense', 'credit-card', 'exempt', false),
      (NEW.id, 'Marketing', 'expense', 'megaphone', 'standard_23', true),
      (NEW.id, 'Accounting', 'expense', 'calculator', 'standard_23', true);

  -- Retail & E-Commerce
  ELSIF v_business_type = 'retail_ecommerce' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Product Sales', 'income', 'shopping-bag', 'standard_23'),
      (NEW.id, 'Online Sales', 'income', 'globe', 'standard_23'),
      (NEW.id, 'Other Income', 'income', 'coins', 'standard_23');
    
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Stock Purchases', 'expense', 'package', 'standard_23', true),
      (NEW.id, 'Shipping & Delivery', 'expense', 'truck', 'standard_23', true),
      (NEW.id, 'Packaging', 'expense', 'box', 'standard_23', true),
      (NEW.id, 'Website & Hosting', 'expense', 'globe', 'standard_23', true),
      (NEW.id, 'Payment Processing', 'expense', 'credit-card', 'standard_23', true),
      (NEW.id, 'Rent', 'expense', 'home', 'exempt', false),
      (NEW.id, 'Utilities', 'expense', 'zap', 'reduced_13_5', true),
      (NEW.id, 'Wages & Salaries', 'expense', 'users', 'exempt', false),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Charges', 'expense', 'credit-card', 'exempt', false),
      (NEW.id, 'Marketing & Advertising', 'expense', 'megaphone', 'standard_23', true),
      (NEW.id, 'Accounting', 'expense', 'calculator', 'standard_23', true);

  -- Transport & Logistics
  ELSIF v_business_type = 'transport_logistics' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Delivery Services', 'income', 'truck', 'standard_23'),
      (NEW.id, 'Freight Income', 'income', 'package', 'standard_23'),
      (NEW.id, 'Other Income', 'income', 'coins', 'standard_23');
    
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Fuel', 'expense', 'fuel', 'standard_23', false),
      (NEW.id, 'Vehicle Maintenance', 'expense', 'wrench', 'standard_23', true),
      (NEW.id, 'Vehicle Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Road Tax & NCT', 'expense', 'file-text', 'exempt', false),
      (NEW.id, 'Tolls & Parking', 'expense', 'ticket', 'zero_rated', false),
      (NEW.id, 'Driver Wages', 'expense', 'users', 'exempt', false),
      (NEW.id, 'Vehicle Lease/HP', 'expense', 'car', 'standard_23', false),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Charges', 'expense', 'credit-card', 'exempt', false),
      (NEW.id, 'Accounting', 'expense', 'calculator', 'standard_23', true);

  -- Technology & IT
  ELSIF v_business_type = 'technology_it' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Software Sales', 'income', 'code', 'standard_23'),
      (NEW.id, 'Consulting', 'income', 'briefcase', 'standard_23'),
      (NEW.id, 'Support Services', 'income', 'headphones', 'standard_23'),
      (NEW.id, 'Other Income', 'income', 'coins', 'standard_23');
    
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Software & Licenses', 'expense', 'download', 'standard_23', true),
      (NEW.id, 'Cloud Services', 'expense', 'cloud', 'standard_23', true),
      (NEW.id, 'Hardware', 'expense', 'monitor', 'standard_23', true),
      (NEW.id, 'Internet & Telecom', 'expense', 'wifi', 'standard_23', true),
      (NEW.id, 'Office Rent', 'expense', 'home', 'exempt', false),
      (NEW.id, 'Wages & Salaries', 'expense', 'users', 'exempt', false),
      (NEW.id, 'Contractor Payments', 'expense', 'user-check', 'standard_23', true),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Charges', 'expense', 'credit-card', 'exempt', false),
      (NEW.id, 'Marketing', 'expense', 'megaphone', 'standard_23', true),
      (NEW.id, 'Accounting', 'expense', 'calculator', 'standard_23', true),
      (NEW.id, 'Training & Development', 'expense', 'graduation-cap', 'standard_23', true);

  -- Health & Wellness
  ELSIF v_business_type = 'health_wellness' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Services', 'income', 'heart', 'exempt'),
      (NEW.id, 'Product Sales', 'income', 'shopping-bag', 'standard_23'),
      (NEW.id, 'Memberships', 'income', 'users', 'exempt'),
      (NEW.id, 'Other Income', 'income', 'coins', 'standard_23');
    
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Medical Supplies', 'expense', 'first-aid', 'zero_rated', true),
      (NEW.id, 'Equipment', 'expense', 'monitor', 'standard_23', true),
      (NEW.id, 'Rent', 'expense', 'home', 'exempt', false),
      (NEW.id, 'Utilities', 'expense', 'zap', 'reduced_13_5', true),
      (NEW.id, 'Wages & Salaries', 'expense', 'users', 'exempt', false),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Charges', 'expense', 'credit-card', 'exempt', false),
      (NEW.id, 'Marketing', 'expense', 'megaphone', 'standard_23', true),
      (NEW.id, 'Accounting', 'expense', 'calculator', 'standard_23', true),
      (NEW.id, 'Training & CPD', 'expense', 'graduation-cap', 'exempt', true);

  -- Real Estate & Property
  ELSIF v_business_type = 'real_estate_property' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Rental Income', 'income', 'home', 'exempt'),
      (NEW.id, 'Commission', 'income', 'percent', 'standard_23'),
      (NEW.id, 'Management Fees', 'income', 'briefcase', 'standard_23'),
      (NEW.id, 'Other Income', 'income', 'coins', 'standard_23');
    
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Property Maintenance', 'expense', 'hammer', 'reduced_13_5', true),
      (NEW.id, 'Property Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Mortgage Interest', 'expense', 'landmark', 'exempt', false),
      (NEW.id, 'Utilities', 'expense', 'zap', 'reduced_13_5', true),
      (NEW.id, 'Advertising', 'expense', 'megaphone', 'standard_23', true),
      (NEW.id, 'Legal Fees', 'expense', 'scale', 'standard_23', true),
      (NEW.id, 'Wages & Salaries', 'expense', 'users', 'exempt', false),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Charges', 'expense', 'credit-card', 'exempt', false),
      (NEW.id, 'Accounting', 'expense', 'calculator', 'standard_23', true);

  -- Manufacturing
  ELSIF v_business_type = 'manufacturing' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Product Sales', 'income', 'package', 'standard_23'),
      (NEW.id, 'Export Sales', 'income', 'globe', 'zero_rated'),
      (NEW.id, 'Other Income', 'income', 'coins', 'standard_23');
    
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Raw Materials', 'expense', 'layers', 'standard_23', true),
      (NEW.id, 'Machinery & Equipment', 'expense', 'settings', 'standard_23', true),
      (NEW.id, 'Factory Rent', 'expense', 'home', 'exempt', false),
      (NEW.id, 'Utilities', 'expense', 'zap', 'reduced_13_5', true),
      (NEW.id, 'Wages & Salaries', 'expense', 'users', 'exempt', false),
      (NEW.id, 'Shipping & Freight', 'expense', 'truck', 'standard_23', true),
      (NEW.id, 'Maintenance', 'expense', 'wrench', 'standard_23', true),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Charges', 'expense', 'credit-card', 'exempt', false),
      (NEW.id, 'Accounting', 'expense', 'calculator', 'standard_23', true);

  -- Default: Professional Services and others
  ELSE
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Sales', 'income', 'receipt', 'standard_23'),
      (NEW.id, 'Services', 'income', 'briefcase', 'standard_23'),
      (NEW.id, 'Other Income', 'income', 'coins', 'standard_23');
    
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

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_categories();