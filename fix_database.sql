-- ============================================================
-- BALNCE APP: Database Fix Script
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. FIX CATEGORIES TABLE - Add missing columns
-- ============================================================
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS default_vat_rate TEXT DEFAULT 'standard_23';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_vat_recoverable BOOLEAN DEFAULT true;

-- ============================================================
-- 2. FIX TRANSACTIONS TABLE - Add missing AI columns
-- ============================================================
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS ai_categorized BOOLEAN DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS ai_confidence INTEGER DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS ai_explanation TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_business_expense BOOLEAN;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS bank_reference TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS bank_account_id UUID;

-- ============================================================
-- 3. FIX ACCOUNTS TABLE - Add Chart of Accounts columns
-- ============================================================
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ============================================================
-- 4. CREATE THE DEFAULT CATEGORIES TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_business_type TEXT;
  v_income categories.type%TYPE := 'income';
  v_expense categories.type%TYPE := 'expense';
BEGIN
  v_business_type := NEW.raw_user_meta_data ->> 'business_type';

  IF v_business_type = 'construction' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Labour Income', v_income, 'hard-hat', 'reduced_13_5'),
      (NEW.id, 'Supply & Fit Income', v_income, 'package', 'reduced_13_5'),
      (NEW.id, 'Materials + Labour Income', v_income, 'layers', 'reduced_13_5'),
      (NEW.id, 'Callout Fees', v_income, 'phone-call', 'reduced_13_5'),
      (NEW.id, 'Emergency Work', v_income, 'alert-circle', 'reduced_13_5'),
      (NEW.id, 'Subcontractor Income', v_income, 'users', 'zero_rated'),
      (NEW.id, 'Contract Income', v_income, 'file-text', 'reduced_13_5'),
      (NEW.id, 'Project Income', v_income, 'briefcase', 'reduced_13_5'),
      (NEW.id, 'Maintenance Income', v_income, 'wrench', 'reduced_13_5'),
      (NEW.id, 'Retention Released', v_income, 'unlock', 'reduced_13_5');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Materials', v_expense, 'layers', 'standard_23', true),
      (NEW.id, 'Tools & Equipment', v_expense, 'wrench', 'standard_23', true),
      (NEW.id, 'Plant Hire', v_expense, 'truck', 'standard_23', true),
      (NEW.id, 'Fuel & Transport', v_expense, 'fuel', 'standard_23', false),
      (NEW.id, 'Vans & Vehicle Costs', v_expense, 'car', 'standard_23', false),
      (NEW.id, 'Subcontractors', v_expense, 'hard-hat', 'zero_rated', true),
      (NEW.id, 'Labour / Wages', v_expense, 'users', 'exempt', false),
      (NEW.id, 'Site Costs', v_expense, 'home', 'standard_23', true),
      (NEW.id, 'PPE & Safety Gear', v_expense, 'shield', 'standard_23', true),
      (NEW.id, 'Waste Disposal / Skip Hire', v_expense, 'trash-2', 'standard_23', true),
      (NEW.id, 'Repairs & Maintenance', v_expense, 'settings', 'reduced_13_5', true),
      (NEW.id, 'Insurance', v_expense, 'shield-check', 'exempt', false),
      (NEW.id, 'Training & Certification', v_expense, 'graduation-cap', 'standard_23', true),
      (NEW.id, 'Software & Subscriptions', v_expense, 'cloud', 'standard_23', true),
      (NEW.id, 'Phone & Internet', v_expense, 'wifi', 'standard_23', true),
      (NEW.id, 'Rent / Office', v_expense, 'building', 'exempt', false),
      (NEW.id, 'Advertising / Website', v_expense, 'megaphone', 'standard_23', true),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSIF v_business_type = 'carpentry_joinery' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Labour Income', v_income, 'hammer', 'reduced_13_5'),
      (NEW.id, 'Supply & Fit Carpentry', v_income, 'package', 'reduced_13_5'),
      (NEW.id, 'Built-Ins & Custom Work', v_income, 'square', 'reduced_13_5'),
      (NEW.id, 'Kitchen Installations', v_income, 'utensils', 'reduced_13_5'),
      (NEW.id, 'Timber Supply', v_income, 'tree-pine', 'standard_23'),
      (NEW.id, 'Callout Fees', v_income, 'phone-call', 'reduced_13_5');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Timber & Sheet Materials', v_expense, 'tree-pine', 'standard_23', true),
      (NEW.id, 'Fixings & Consumables', v_expense, 'package', 'standard_23', true),
      (NEW.id, 'Power Tools', v_expense, 'zap', 'standard_23', true),
      (NEW.id, 'Hand Tools', v_expense, 'wrench', 'standard_23', true),
      (NEW.id, 'Sanding / Finishing Products', v_expense, 'sparkles', 'standard_23', true),
      (NEW.id, 'Van Costs', v_expense, 'car', 'standard_23', false),
      (NEW.id, 'Fuel', v_expense, 'fuel', 'standard_23', false),
      (NEW.id, 'Subcontractors', v_expense, 'users', 'zero_rated', true),
      (NEW.id, 'Waste Disposal', v_expense, 'trash-2', 'standard_23', true),
      (NEW.id, 'Software', v_expense, 'cloud', 'standard_23', true),
      (NEW.id, 'Insurance', v_expense, 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSIF v_business_type = 'electrical' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Electrical Labour', v_income, 'zap', 'reduced_13_5'),
      (NEW.id, 'Supply & Fit Electrical', v_income, 'package', 'reduced_13_5'),
      (NEW.id, 'Rewires', v_income, 'cable', 'reduced_13_5'),
      (NEW.id, 'Emergency Callouts', v_income, 'alert-circle', 'reduced_13_5'),
      (NEW.id, 'Certification Income', v_income, 'badge-check', 'standard_23'),
      (NEW.id, 'Subcontractor Labour', v_income, 'users', 'zero_rated');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Electrical Materials', v_expense, 'zap', 'standard_23', true),
      (NEW.id, 'Cables & Connectors', v_expense, 'cable', 'standard_23', true),
      (NEW.id, 'Tools & Testing Equipment', v_expense, 'wrench', 'standard_23', true),
      (NEW.id, 'Certification Software', v_expense, 'cloud', 'standard_23', true),
      (NEW.id, 'Vehicle Costs', v_expense, 'car', 'standard_23', false),
      (NEW.id, 'Fuel', v_expense, 'fuel', 'standard_23', false),
      (NEW.id, 'PPE', v_expense, 'shield', 'standard_23', true),
      (NEW.id, 'Subcontractors', v_expense, 'hard-hat', 'zero_rated', true),
      (NEW.id, 'Insurance', v_expense, 'shield-check', 'exempt', false),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSIF v_business_type = 'plumbing_heating' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Labour', v_income, 'droplets', 'reduced_13_5'),
      (NEW.id, 'Boiler Installs', v_income, 'flame', 'reduced_13_5'),
      (NEW.id, 'Repairs / Callouts', v_income, 'phone-call', 'reduced_13_5'),
      (NEW.id, 'Supply & Fit', v_income, 'package', 'reduced_13_5'),
      (NEW.id, 'Gas Cert Income', v_income, 'badge-check', 'standard_23');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Plumbing Materials', v_expense, 'droplets', 'standard_23', true),
      (NEW.id, 'Boilers & Heating Units', v_expense, 'flame', 'standard_23', true),
      (NEW.id, 'Parts & Fittings', v_expense, 'package', 'standard_23', true),
      (NEW.id, 'Tools & Consumables', v_expense, 'wrench', 'standard_23', true),
      (NEW.id, 'Subcontractors', v_expense, 'hard-hat', 'zero_rated', true),
      (NEW.id, 'Vehicle / Fuel', v_expense, 'car', 'standard_23', false),
      (NEW.id, 'Waste Disposal', v_expense, 'trash-2', 'standard_23', true),
      (NEW.id, 'Insurance', v_expense, 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSIF v_business_type = 'painting_decorating' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Labour', v_income, 'paintbrush', 'reduced_13_5'),
      (NEW.id, 'Supply & Fit', v_income, 'package', 'reduced_13_5'),
      (NEW.id, 'Interior/Exterior Jobs', v_income, 'home', 'reduced_13_5'),
      (NEW.id, 'Project Income', v_income, 'briefcase', 'reduced_13_5');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Paint & Primer', v_expense, 'paintbrush', 'standard_23', true),
      (NEW.id, 'Brushes & Rollers', v_expense, 'brush', 'standard_23', true),
      (NEW.id, 'Consumables', v_expense, 'package', 'standard_23', true),
      (NEW.id, 'Tools', v_expense, 'wrench', 'standard_23', true),
      (NEW.id, 'Fuel', v_expense, 'fuel', 'standard_23', false),
      (NEW.id, 'Subcontractors', v_expense, 'users', 'zero_rated', true),
      (NEW.id, 'Insurance', v_expense, 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSIF v_business_type = 'landscaping_groundworks' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Labour', v_income, 'tree-pine', 'reduced_13_5'),
      (NEW.id, 'Supply & Fit', v_income, 'package', 'reduced_13_5'),
      (NEW.id, 'Garden Projects', v_income, 'flower', 'reduced_13_5'),
      (NEW.id, 'Maintenance Income', v_income, 'scissors', 'reduced_13_5'),
      (NEW.id, 'Hard Landscaping Income', v_income, 'square', 'reduced_13_5');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Materials', v_expense, 'layers', 'standard_23', true),
      (NEW.id, 'Tools & Machinery', v_expense, 'wrench', 'standard_23', true),
      (NEW.id, 'Fuel', v_expense, 'fuel', 'standard_23', false),
      (NEW.id, 'Plant Hire', v_expense, 'truck', 'standard_23', true),
      (NEW.id, 'Disposal Fees', v_expense, 'trash-2', 'standard_23', true),
      (NEW.id, 'Subcontractors', v_expense, 'users', 'zero_rated', true),
      (NEW.id, 'Insurance', v_expense, 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSIF v_business_type = 'retail_ecommerce' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Product Sales', v_income, 'shopping-bag', 'standard_23'),
      (NEW.id, 'Shipping Income', v_income, 'truck', 'standard_23'),
      (NEW.id, 'Online Sales (EU)', v_income, 'globe', 'standard_23'),
      (NEW.id, 'Online Sales (Non-EU)', v_income, 'globe', 'zero_rated'),
      (NEW.id, 'Service Add-ons', v_income, 'plus-circle', 'standard_23');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Inventory / Stock', v_expense, 'package', 'standard_23', true),
      (NEW.id, 'Packaging', v_expense, 'box', 'standard_23', true),
      (NEW.id, 'Shipping Costs', v_expense, 'truck', 'standard_23', true),
      (NEW.id, 'Software / Platforms', v_expense, 'cloud', 'standard_23', true),
      (NEW.id, 'Advertising', v_expense, 'megaphone', 'standard_23', true),
      (NEW.id, 'Payment Fees', v_expense, 'credit-card', 'exempt', false),
      (NEW.id, 'Rent / Utilities', v_expense, 'building', 'exempt', false),
      (NEW.id, 'Staff Costs', v_expense, 'users', 'exempt', false),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSIF v_business_type = 'hospitality' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Food Sales', v_income, 'utensils', 'second_reduced_9'),
      (NEW.id, 'Beverage Sales', v_income, 'coffee', 'second_reduced_9'),
      (NEW.id, 'Alcohol Sales', v_income, 'wine', 'standard_23'),
      (NEW.id, 'Delivery Income', v_income, 'truck', 'second_reduced_9'),
      (NEW.id, 'Catering Income', v_income, 'chef-hat', 'second_reduced_9');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Food Ingredients', v_expense, 'carrot', 'zero_rated', true),
      (NEW.id, 'Drinks / Alcohol', v_expense, 'wine', 'standard_23', true),
      (NEW.id, 'Kitchen Supplies', v_expense, 'utensils', 'standard_23', true),
      (NEW.id, 'Consumables', v_expense, 'package', 'standard_23', true),
      (NEW.id, 'Delivery Fees', v_expense, 'truck', 'standard_23', true),
      (NEW.id, 'Staff Costs', v_expense, 'users', 'exempt', false),
      (NEW.id, 'Rent / Utilities', v_expense, 'building', 'exempt', false),
      (NEW.id, 'Cleaning Supplies', v_expense, 'sparkles', 'standard_23', true),
      (NEW.id, 'Software / POS', v_expense, 'monitor', 'standard_23', true),
      (NEW.id, 'Licensing Fees', v_expense, 'file-text', 'exempt', false),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSIF v_business_type = 'professional_services' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Service Fees', v_income, 'briefcase', 'standard_23'),
      (NEW.id, 'Training Income', v_income, 'graduation-cap', 'standard_23'),
      (NEW.id, 'Retainers', v_income, 'clock', 'standard_23'),
      (NEW.id, 'Digital Services', v_income, 'globe', 'standard_23'),
      (NEW.id, 'Project Fees', v_income, 'folder', 'standard_23');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Software', v_expense, 'cloud', 'standard_23', true),
      (NEW.id, 'Advertising', v_expense, 'megaphone', 'standard_23', true),
      (NEW.id, 'Travel', v_expense, 'plane', 'standard_23', true),
      (NEW.id, 'Training', v_expense, 'graduation-cap', 'standard_23', true),
      (NEW.id, 'Office Supplies', v_expense, 'folder', 'standard_23', true),
      (NEW.id, 'Subcontractors', v_expense, 'users', 'standard_23', true),
      (NEW.id, 'Accounting & Legal', v_expense, 'scale', 'standard_23', true),
      (NEW.id, 'Rent / Office', v_expense, 'building', 'exempt', false),
      (NEW.id, 'Insurance', v_expense, 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSIF v_business_type = 'transport_logistics' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Delivery Income', v_income, 'truck', 'standard_23'),
      (NEW.id, 'Haulage Fees', v_income, 'container', 'standard_23'),
      (NEW.id, 'Freight Income', v_income, 'ship', 'standard_23'),
      (NEW.id, 'Fuel Surcharges', v_income, 'fuel', 'standard_23');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Fuel', v_expense, 'fuel', 'standard_23', false),
      (NEW.id, 'Vehicle Maintenance', v_expense, 'wrench', 'standard_23', true),
      (NEW.id, 'Insurance', v_expense, 'shield', 'exempt', false),
      (NEW.id, 'Repairs', v_expense, 'settings', 'standard_23', true),
      (NEW.id, 'Tyres', v_expense, 'circle', 'standard_23', true),
      (NEW.id, 'Toll & Parking', v_expense, 'ticket', 'zero_rated', false),
      (NEW.id, 'Warehousing', v_expense, 'warehouse', 'standard_23', true),
      (NEW.id, 'Subcontracted Drivers', v_expense, 'users', 'standard_23', true),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSIF v_business_type = 'real_estate_property' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Rental Income', v_income, 'home', 'exempt'),
      (NEW.id, 'Management Fees', v_income, 'briefcase', 'standard_23'),
      (NEW.id, 'Commission', v_income, 'percent', 'standard_23'),
      (NEW.id, 'Short-Term Let Income', v_income, 'calendar', 'second_reduced_9');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Repairs & Maintenance', v_expense, 'wrench', 'reduced_13_5', true),
      (NEW.id, 'Cleaning', v_expense, 'sparkles', 'reduced_13_5', true),
      (NEW.id, 'Utilities', v_expense, 'zap', 'reduced_13_5', true),
      (NEW.id, 'Insurance', v_expense, 'shield', 'exempt', false),
      (NEW.id, 'Legal Fees', v_expense, 'scale', 'standard_23', true),
      (NEW.id, 'Advertising', v_expense, 'megaphone', 'standard_23', true),
      (NEW.id, 'Furniture / Fixtures', v_expense, 'sofa', 'standard_23', true),
      (NEW.id, 'Subcontractors', v_expense, 'users', 'reduced_13_5', true),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSIF v_business_type = 'health_wellness' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Subscription Income', v_income, 'repeat', 'exempt'),
      (NEW.id, 'Session Fees', v_income, 'heart', 'exempt'),
      (NEW.id, 'Classes', v_income, 'users', 'exempt'),
      (NEW.id, 'Online Coaching', v_income, 'video', 'exempt');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Equipment', v_expense, 'dumbbell', 'standard_23', true),
      (NEW.id, 'Software', v_expense, 'cloud', 'standard_23', true),
      (NEW.id, 'Rent / Studio', v_expense, 'building', 'exempt', false),
      (NEW.id, 'Advertising', v_expense, 'megaphone', 'standard_23', true),
      (NEW.id, 'Supplements for Resale', v_expense, 'pill', 'zero_rated', true),
      (NEW.id, 'Insurance', v_expense, 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSIF v_business_type = 'technology_it' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Software Services', v_income, 'code', 'standard_23'),
      (NEW.id, 'Development Fees', v_income, 'terminal', 'standard_23'),
      (NEW.id, 'Monthly Retainers', v_income, 'clock', 'standard_23'),
      (NEW.id, 'Digital Products', v_income, 'download', 'standard_23'),
      (NEW.id, 'Subscription Income', v_income, 'repeat', 'standard_23');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Software Tools', v_expense, 'cloud', 'standard_23', true),
      (NEW.id, 'Cloud Hosting', v_expense, 'server', 'standard_23', true),
      (NEW.id, 'Hardware', v_expense, 'monitor', 'standard_23', true),
      (NEW.id, 'Advertising', v_expense, 'megaphone', 'standard_23', true),
      (NEW.id, 'Contractors', v_expense, 'users', 'standard_23', true),
      (NEW.id, 'Training', v_expense, 'graduation-cap', 'standard_23', true),
      (NEW.id, 'Rent / Office', v_expense, 'building', 'exempt', false),
      (NEW.id, 'Insurance', v_expense, 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSIF v_business_type = 'manufacturing' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Product Sales', v_income, 'package', 'standard_23'),
      (NEW.id, 'Export Sales', v_income, 'globe', 'zero_rated'),
      (NEW.id, 'Contract Manufacturing', v_income, 'factory', 'standard_23');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Raw Materials', v_expense, 'layers', 'standard_23', true),
      (NEW.id, 'Machinery & Equipment', v_expense, 'settings', 'standard_23', true),
      (NEW.id, 'Factory Rent', v_expense, 'factory', 'exempt', false),
      (NEW.id, 'Utilities', v_expense, 'zap', 'reduced_13_5', true),
      (NEW.id, 'Staff Costs', v_expense, 'users', 'exempt', false),
      (NEW.id, 'Shipping & Freight', v_expense, 'truck', 'standard_23', true),
      (NEW.id, 'Maintenance', v_expense, 'wrench', 'standard_23', true),
      (NEW.id, 'Insurance', v_expense, 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSIF v_business_type = 'maintenance_facilities' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Service Contracts', v_income, 'file-text', 'reduced_13_5'),
      (NEW.id, 'Callout Fees', v_income, 'phone-call', 'reduced_13_5'),
      (NEW.id, 'Repair Income', v_income, 'wrench', 'reduced_13_5'),
      (NEW.id, 'Maintenance Retainers', v_income, 'clock', 'reduced_13_5');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Parts & Materials', v_expense, 'package', 'standard_23', true),
      (NEW.id, 'Tools & Equipment', v_expense, 'wrench', 'standard_23', true),
      (NEW.id, 'Vehicle Costs', v_expense, 'car', 'standard_23', false),
      (NEW.id, 'Fuel', v_expense, 'fuel', 'standard_23', false),
      (NEW.id, 'Subcontractors', v_expense, 'users', 'reduced_13_5', true),
      (NEW.id, 'Cleaning Supplies', v_expense, 'sparkles', 'standard_23', true),
      (NEW.id, 'Insurance', v_expense, 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);

  ELSE
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Sales', v_income, 'receipt', 'standard_23'),
      (NEW.id, 'Services', v_income, 'briefcase', 'standard_23'),
      (NEW.id, 'Other Income', v_income, 'coins', 'standard_23');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Office Supplies', v_expense, 'folder', 'standard_23', true),
      (NEW.id, 'Travel', v_expense, 'car', 'standard_23', true),
      (NEW.id, 'Utilities', v_expense, 'zap', 'reduced_13_5', true),
      (NEW.id, 'Professional Services', v_expense, 'user', 'standard_23', true),
      (NEW.id, 'Equipment', v_expense, 'monitor', 'standard_23', true),
      (NEW.id, 'Insurance', v_expense, 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false),
      (NEW.id, 'Rent', v_expense, 'home', 'exempt', false),
      (NEW.id, 'Marketing', v_expense, 'megaphone', 'standard_23', true);
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created_categories ON auth.users;
CREATE TRIGGER on_auth_user_created_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_categories();

-- ============================================================
-- 5. CREATE THE DEFAULT ACCOUNTS TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_default_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.accounts (user_id, name, code, type) VALUES
    (NEW.id, 'Sales Ireland 23%', 'INC001', 'Income'),
    (NEW.id, 'Sales Ireland 13.5%', 'INC002', 'Income'),
    (NEW.id, 'Sales Ireland 9%', 'INC003', 'Income'),
    (NEW.id, 'Zero Rated Sales', 'INC004', 'Income'),
    (NEW.id, 'Exempt Sales', 'INC005', 'Income'),
    (NEW.id, 'EU B2B Sales', 'INC006', 'Income'),
    (NEW.id, 'EU B2C Sales', 'INC007', 'Income'),
    (NEW.id, 'Export Sales', 'INC008', 'Income'),
    (NEW.id, 'Other Income', 'INC009', 'Income'),
    (NEW.id, 'Commission Received', 'INC010', 'Income'),
    (NEW.id, 'Rental Income', 'INC011', 'Income'),
    (NEW.id, 'Materials Purchased', 'COS001', 'Cost of Sales'),
    (NEW.id, 'Subcontractors', 'COS002', 'Cost of Sales'),
    (NEW.id, 'Direct Wages', 'COS003', 'Cost of Sales'),
    (NEW.id, 'Stock Purchases', 'COS004', 'Cost of Sales'),
    (NEW.id, 'Freight & Import Duties', 'COS005', 'Cost of Sales'),
    (NEW.id, 'Purchases EU (Reverse Charge)', 'COS006', 'Cost of Sales'),
    (NEW.id, 'Purchases Outside EU', 'COS007', 'Cost of Sales'),
    (NEW.id, 'Motor - Fuel', 'EXP001', 'Expense'),
    (NEW.id, 'Motor - Repairs', 'EXP002', 'Expense'),
    (NEW.id, 'Motor Tax & Insurance', 'EXP003', 'Expense'),
    (NEW.id, 'Travel & Subsistence', 'EXP004', 'Expense'),
    (NEW.id, 'Accommodation', 'EXP005', 'Expense'),
    (NEW.id, 'Public Transport', 'EXP006', 'Expense'),
    (NEW.id, 'Mileage Claims', 'EXP007', 'Expense'),
    (NEW.id, 'Wages & Salaries', 'EXP008', 'Expense'),
    (NEW.id, 'Employer PRSI', 'EXP009', 'Expense'),
    (NEW.id, 'Staff Training', 'EXP010', 'Expense'),
    (NEW.id, 'Staff Welfare', 'EXP011', 'Expense'),
    (NEW.id, 'PPE / Protective Gear', 'EXP012', 'Expense'),
    (NEW.id, 'Rent', 'EXP013', 'Expense'),
    (NEW.id, 'Rates', 'EXP014', 'Expense'),
    (NEW.id, 'Light & Heat', 'EXP015', 'Expense'),
    (NEW.id, 'Waste Collection', 'EXP016', 'Expense'),
    (NEW.id, 'Cleaning', 'EXP017', 'Expense'),
    (NEW.id, 'Office Supplies', 'EXP018', 'Expense'),
    (NEW.id, 'Printing & Stationery', 'EXP019', 'Expense'),
    (NEW.id, 'Computer Equipment', 'EXP020', 'Expense'),
    (NEW.id, 'Software & Subscriptions', 'EXP021', 'Expense'),
    (NEW.id, 'Telephone & Internet', 'EXP022', 'Expense'),
    (NEW.id, 'Bank Charges', 'EXP023', 'Expense'),
    (NEW.id, 'Bank Interest', 'EXP024', 'Expense'),
    (NEW.id, 'Merchant Fees', 'EXP025', 'Expense'),
    (NEW.id, 'Legal Fees', 'EXP026', 'Expense'),
    (NEW.id, 'Accountancy Fees', 'EXP027', 'Expense'),
    (NEW.id, 'Consultancy Fees', 'EXP028', 'Expense'),
    (NEW.id, 'Insurance', 'EXP029', 'Expense'),
    (NEW.id, 'Advertising', 'EXP030', 'Expense'),
    (NEW.id, 'Website Hosting', 'EXP031', 'Expense'),
    (NEW.id, 'Social Media Ads', 'EXP032', 'Expense'),
    (NEW.id, 'Promotional Materials', 'EXP033', 'Expense'),
    (NEW.id, 'Repairs & Maintenance', 'EXP034', 'Expense'),
    (NEW.id, 'Small Tools & Equipment', 'EXP035', 'Expense'),
    (NEW.id, 'Uniforms', 'EXP036', 'Expense'),
    (NEW.id, 'Postage & Couriers', 'EXP037', 'Expense'),
    (NEW.id, 'Charity Donations', 'EXP038', 'Expense'),
    (NEW.id, 'General Expenses', 'EXP039', 'Expense'),
    (NEW.id, 'VAT on Sales (Output VAT)', 'VAT001', 'VAT'),
    (NEW.id, 'VAT on Purchases (Input VAT)', 'VAT002', 'VAT'),
    (NEW.id, 'VAT Reverse Charge', 'VAT003', 'VAT'),
    (NEW.id, 'VAT EU Acquisitions', 'VAT004', 'VAT'),
    (NEW.id, 'VAT Payable', 'VAT005', 'VAT'),
    (NEW.id, 'VAT Receivable', 'VAT006', 'VAT'),
    (NEW.id, 'VAT Suspense', 'VAT007', 'VAT'),
    (NEW.id, 'Net Wages Payable', 'PAY001', 'Payroll'),
    (NEW.id, 'PAYE/PRSI/USC Payable', 'PAY002', 'Payroll'),
    (NEW.id, 'Employer PRSI Payable', 'PAY003', 'Payroll'),
    (NEW.id, 'Tools & Machinery', 'FA001', 'Fixed Assets'),
    (NEW.id, 'Motor Vehicles', 'FA002', 'Fixed Assets'),
    (NEW.id, 'Office Equipment', 'FA003', 'Fixed Assets'),
    (NEW.id, 'Fixtures & Fittings', 'FA004', 'Fixed Assets'),
    (NEW.id, 'Computer Hardware', 'FA005', 'Fixed Assets'),
    (NEW.id, 'Accumulated Depreciation - Tools', 'FA006', 'Fixed Assets'),
    (NEW.id, 'Accumulated Depreciation - Vehicles', 'FA007', 'Fixed Assets'),
    (NEW.id, 'Accumulated Depreciation - Equipment', 'FA008', 'Fixed Assets'),
    (NEW.id, 'Cash on Hand', 'CA001', 'Current Assets'),
    (NEW.id, 'Bank Account', 'CA002', 'Current Assets'),
    (NEW.id, 'Client Debtors', 'CA003', 'Current Assets'),
    (NEW.id, 'VAT Receivable', 'CA004', 'Current Assets'),
    (NEW.id, 'Inventory', 'CA005', 'Current Assets'),
    (NEW.id, 'Prepayments', 'CA006', 'Current Assets'),
    (NEW.id, 'Trade Creditors', 'CL001', 'Current Liabilities'),
    (NEW.id, 'VAT Payable', 'CL002', 'Current Liabilities'),
    (NEW.id, 'Payroll Taxes Payable', 'CL003', 'Current Liabilities'),
    (NEW.id, 'Accruals', 'CL004', 'Current Liabilities'),
    (NEW.id, 'Owner''s Capital', 'EQ001', 'Equity'),
    (NEW.id, 'Owner''s Drawings', 'EQ002', 'Equity'),
    (NEW.id, 'Retained Earnings', 'EQ003', 'Equity');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_accounts ON auth.users;
CREATE TRIGGER on_auth_user_created_accounts
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_accounts();

-- ============================================================
-- 6. SEED EXISTING USERS (carpentry categories + COA)
-- Uses DO block to handle enum type properly
-- ============================================================
DO $$
DECLARE
  v_user_id UUID;
  v_income public.categories.type%TYPE := 'income';
  v_expense public.categories.type%TYPE := 'expense';
BEGIN
  FOR v_user_id IN SELECT id FROM auth.users LOOP
    -- Only seed if user has no categories
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = v_user_id) THEN
      INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
        (v_user_id, 'Labour Income', v_income, 'hammer', 'reduced_13_5'),
        (v_user_id, 'Supply & Fit Carpentry', v_income, 'package', 'reduced_13_5'),
        (v_user_id, 'Built-Ins & Custom Work', v_income, 'square', 'reduced_13_5'),
        (v_user_id, 'Kitchen Installations', v_income, 'utensils', 'reduced_13_5'),
        (v_user_id, 'Timber Supply', v_income, 'tree-pine', 'standard_23'),
        (v_user_id, 'Callout Fees', v_income, 'phone-call', 'reduced_13_5');
      INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
        (v_user_id, 'Timber & Sheet Materials', v_expense, 'tree-pine', 'standard_23', true),
        (v_user_id, 'Fixings & Consumables', v_expense, 'package', 'standard_23', true),
        (v_user_id, 'Power Tools', v_expense, 'zap', 'standard_23', true),
        (v_user_id, 'Hand Tools', v_expense, 'wrench', 'standard_23', true),
        (v_user_id, 'Sanding / Finishing Products', v_expense, 'sparkles', 'standard_23', true),
        (v_user_id, 'Van Costs', v_expense, 'car', 'standard_23', false),
        (v_user_id, 'Fuel', v_expense, 'fuel', 'standard_23', false),
        (v_user_id, 'Subcontractors', v_expense, 'users', 'zero_rated', true),
        (v_user_id, 'Waste Disposal', v_expense, 'trash-2', 'standard_23', true),
        (v_user_id, 'Software', v_expense, 'cloud', 'standard_23', true),
        (v_user_id, 'Insurance', v_expense, 'shield', 'exempt', false),
        (v_user_id, 'Bank Fees', v_expense, 'credit-card', 'exempt', false);
    END IF;

    -- Only seed accounts if user has no COA accounts
    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = v_user_id AND code IS NOT NULL) THEN
      INSERT INTO public.accounts (user_id, name, code, type) VALUES
        (v_user_id, 'Sales Ireland 23%', 'INC001', 'Income'),
        (v_user_id, 'Sales Ireland 13.5%', 'INC002', 'Income'),
        (v_user_id, 'Sales Ireland 9%', 'INC003', 'Income'),
        (v_user_id, 'Zero Rated Sales', 'INC004', 'Income'),
        (v_user_id, 'Exempt Sales', 'INC005', 'Income'),
        (v_user_id, 'Other Income', 'INC009', 'Income'),
        (v_user_id, 'Materials Purchased', 'COS001', 'Cost of Sales'),
        (v_user_id, 'Subcontractors', 'COS002', 'Cost of Sales'),
        (v_user_id, 'Direct Wages', 'COS003', 'Cost of Sales'),
        (v_user_id, 'Stock Purchases', 'COS004', 'Cost of Sales'),
        (v_user_id, 'Motor - Fuel', 'EXP001', 'Expense'),
        (v_user_id, 'Motor - Repairs', 'EXP002', 'Expense'),
        (v_user_id, 'Motor Tax & Insurance', 'EXP003', 'Expense'),
        (v_user_id, 'Wages & Salaries', 'EXP008', 'Expense'),
        (v_user_id, 'PPE / Protective Gear', 'EXP012', 'Expense'),
        (v_user_id, 'Rent', 'EXP013', 'Expense'),
        (v_user_id, 'Light & Heat', 'EXP015', 'Expense'),
        (v_user_id, 'Software & Subscriptions', 'EXP021', 'Expense'),
        (v_user_id, 'Telephone & Internet', 'EXP022', 'Expense'),
        (v_user_id, 'Bank Charges', 'EXP023', 'Expense'),
        (v_user_id, 'Accountancy Fees', 'EXP027', 'Expense'),
        (v_user_id, 'Insurance', 'EXP029', 'Expense'),
        (v_user_id, 'Advertising', 'EXP030', 'Expense'),
        (v_user_id, 'Repairs & Maintenance', 'EXP034', 'Expense'),
        (v_user_id, 'Small Tools & Equipment', 'EXP035', 'Expense'),
        (v_user_id, 'General Expenses', 'EXP039', 'Expense'),
        (v_user_id, 'VAT on Sales (Output VAT)', 'VAT001', 'VAT'),
        (v_user_id, 'VAT on Purchases (Input VAT)', 'VAT002', 'VAT'),
        (v_user_id, 'VAT Reverse Charge', 'VAT003', 'VAT'),
        (v_user_id, 'Tools & Machinery', 'FA001', 'Fixed Assets'),
        (v_user_id, 'Motor Vehicles', 'FA002', 'Fixed Assets'),
        (v_user_id, 'Bank Account', 'CA002', 'Current Assets'),
        (v_user_id, 'Client Debtors', 'CA003', 'Current Assets'),
        (v_user_id, 'Trade Creditors', 'CL001', 'Current Liabilities'),
        (v_user_id, 'VAT Payable', 'CL002', 'Current Liabilities'),
        (v_user_id, 'Owner''s Capital', 'EQ001', 'Equity'),
        (v_user_id, 'Owner''s Drawings', 'EQ002', 'Equity'),
        (v_user_id, 'Retained Earnings', 'EQ003', 'Equity');
    END IF;
  END LOOP;
END;
$$;
