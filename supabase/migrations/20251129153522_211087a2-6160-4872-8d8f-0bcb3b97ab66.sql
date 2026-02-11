-- Drop existing function and recreate with comprehensive industry categories
DROP FUNCTION IF EXISTS public.create_default_categories() CASCADE;

CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_business_type public.business_type;
BEGIN
  v_business_type := (NEW.raw_user_meta_data ->> 'business_type')::public.business_type;
  
  -- ===========================================
  -- CONSTRUCTION
  -- ===========================================
  IF v_business_type = 'construction' THEN
    -- Income Categories
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Labour Income', 'income', 'hard-hat', 'reduced_13_5'),
      (NEW.id, 'Supply & Fit Income', 'income', 'package', 'reduced_13_5'),
      (NEW.id, 'Materials + Labour Income', 'income', 'layers', 'reduced_13_5'),
      (NEW.id, 'Callout Fees', 'income', 'phone-call', 'reduced_13_5'),
      (NEW.id, 'Emergency Work', 'income', 'alert-circle', 'reduced_13_5'),
      (NEW.id, 'Subcontractor Income', 'income', 'users', 'zero_rated'),
      (NEW.id, 'Contract Income', 'income', 'file-text', 'reduced_13_5'),
      (NEW.id, 'Project Income', 'income', 'briefcase', 'reduced_13_5'),
      (NEW.id, 'Maintenance Income', 'income', 'wrench', 'reduced_13_5'),
      (NEW.id, 'Retention Released', 'income', 'unlock', 'reduced_13_5');
    -- Expense Categories
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Materials', 'expense', 'layers', 'standard_23', true),
      (NEW.id, 'Tools & Equipment', 'expense', 'wrench', 'standard_23', true),
      (NEW.id, 'Plant Hire', 'expense', 'truck', 'standard_23', true),
      (NEW.id, 'Fuel & Transport', 'expense', 'fuel', 'standard_23', false),
      (NEW.id, 'Vans & Vehicle Costs', 'expense', 'car', 'standard_23', false),
      (NEW.id, 'Subcontractors', 'expense', 'hard-hat', 'zero_rated', true),
      (NEW.id, 'Labour / Wages', 'expense', 'users', 'exempt', false),
      (NEW.id, 'Site Costs', 'expense', 'home', 'standard_23', true),
      (NEW.id, 'PPE & Safety Gear', 'expense', 'shield', 'standard_23', true),
      (NEW.id, 'Waste Disposal / Skip Hire', 'expense', 'trash-2', 'standard_23', true),
      (NEW.id, 'Repairs & Maintenance', 'expense', 'settings', 'reduced_13_5', true),
      (NEW.id, 'Insurance', 'expense', 'shield-check', 'exempt', false),
      (NEW.id, 'Training & Certification', 'expense', 'graduation-cap', 'standard_23', true),
      (NEW.id, 'Software & Subscriptions', 'expense', 'cloud', 'standard_23', true),
      (NEW.id, 'Phone & Internet', 'expense', 'wifi', 'standard_23', true),
      (NEW.id, 'Rent / Office', 'expense', 'building', 'exempt', false),
      (NEW.id, 'Advertising / Website', 'expense', 'megaphone', 'standard_23', true),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- CARPENTRY & JOINERY
  -- ===========================================
  ELSIF v_business_type = 'carpentry_joinery' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Labour Income', 'income', 'hammer', 'reduced_13_5'),
      (NEW.id, 'Supply & Fit Carpentry', 'income', 'package', 'reduced_13_5'),
      (NEW.id, 'Built-Ins & Custom Work', 'income', 'square', 'reduced_13_5'),
      (NEW.id, 'Kitchen Installations', 'income', 'utensils', 'reduced_13_5'),
      (NEW.id, 'Timber Supply', 'income', 'tree-pine', 'standard_23'),
      (NEW.id, 'Callout Fees', 'income', 'phone-call', 'reduced_13_5');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Timber & Sheet Materials', 'expense', 'tree-pine', 'standard_23', true),
      (NEW.id, 'Fixings & Consumables', 'expense', 'package', 'standard_23', true),
      (NEW.id, 'Power Tools', 'expense', 'zap', 'standard_23', true),
      (NEW.id, 'Hand Tools', 'expense', 'wrench', 'standard_23', true),
      (NEW.id, 'Sanding / Finishing Products', 'expense', 'sparkles', 'standard_23', true),
      (NEW.id, 'Van Costs', 'expense', 'car', 'standard_23', false),
      (NEW.id, 'Fuel', 'expense', 'fuel', 'standard_23', false),
      (NEW.id, 'Subcontractors', 'expense', 'users', 'zero_rated', true),
      (NEW.id, 'Waste Disposal', 'expense', 'trash-2', 'standard_23', true),
      (NEW.id, 'Software', 'expense', 'cloud', 'standard_23', true),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- ELECTRICAL
  -- ===========================================
  ELSIF v_business_type = 'electrical' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Electrical Labour', 'income', 'zap', 'reduced_13_5'),
      (NEW.id, 'Supply & Fit Electrical', 'income', 'package', 'reduced_13_5'),
      (NEW.id, 'Rewires', 'income', 'cable', 'reduced_13_5'),
      (NEW.id, 'Emergency Callouts', 'income', 'alert-circle', 'reduced_13_5'),
      (NEW.id, 'Certification Income', 'income', 'badge-check', 'standard_23'),
      (NEW.id, 'Subcontractor Labour', 'income', 'users', 'zero_rated');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Electrical Materials', 'expense', 'zap', 'standard_23', true),
      (NEW.id, 'Cables & Connectors', 'expense', 'cable', 'standard_23', true),
      (NEW.id, 'Tools & Testing Equipment', 'expense', 'wrench', 'standard_23', true),
      (NEW.id, 'Certification Software', 'expense', 'cloud', 'standard_23', true),
      (NEW.id, 'Vehicle Costs', 'expense', 'car', 'standard_23', false),
      (NEW.id, 'Fuel', 'expense', 'fuel', 'standard_23', false),
      (NEW.id, 'PPE', 'expense', 'shield', 'standard_23', true),
      (NEW.id, 'Subcontractors', 'expense', 'hard-hat', 'zero_rated', true),
      (NEW.id, 'Insurance', 'expense', 'shield-check', 'exempt', false),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- PLUMBING & HEATING
  -- ===========================================
  ELSIF v_business_type = 'plumbing_heating' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Labour', 'income', 'droplets', 'reduced_13_5'),
      (NEW.id, 'Boiler Installs', 'income', 'flame', 'reduced_13_5'),
      (NEW.id, 'Repairs / Callouts', 'income', 'phone-call', 'reduced_13_5'),
      (NEW.id, 'Supply & Fit', 'income', 'package', 'reduced_13_5'),
      (NEW.id, 'Gas Cert Income', 'income', 'badge-check', 'standard_23');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Plumbing Materials', 'expense', 'droplets', 'standard_23', true),
      (NEW.id, 'Boilers & Heating Units', 'expense', 'flame', 'standard_23', true),
      (NEW.id, 'Parts & Fittings', 'expense', 'package', 'standard_23', true),
      (NEW.id, 'Tools & Consumables', 'expense', 'wrench', 'standard_23', true),
      (NEW.id, 'Subcontractors', 'expense', 'hard-hat', 'zero_rated', true),
      (NEW.id, 'Vehicle / Fuel', 'expense', 'car', 'standard_23', false),
      (NEW.id, 'Waste Disposal', 'expense', 'trash-2', 'standard_23', true),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- PAINTING & DECORATING
  -- ===========================================
  ELSIF v_business_type = 'painting_decorating' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Labour', 'income', 'paintbrush', 'reduced_13_5'),
      (NEW.id, 'Supply & Fit', 'income', 'package', 'reduced_13_5'),
      (NEW.id, 'Interior/Exterior Jobs', 'income', 'home', 'reduced_13_5'),
      (NEW.id, 'Project Income', 'income', 'briefcase', 'reduced_13_5');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Paint & Primer', 'expense', 'paintbrush', 'standard_23', true),
      (NEW.id, 'Brushes & Rollers', 'expense', 'brush', 'standard_23', true),
      (NEW.id, 'Consumables', 'expense', 'package', 'standard_23', true),
      (NEW.id, 'Tools', 'expense', 'wrench', 'standard_23', true),
      (NEW.id, 'Fuel', 'expense', 'fuel', 'standard_23', false),
      (NEW.id, 'Subcontractors', 'expense', 'users', 'zero_rated', true),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- LANDSCAPING & GROUNDWORKS
  -- ===========================================
  ELSIF v_business_type = 'landscaping_groundworks' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Labour', 'income', 'tree-pine', 'reduced_13_5'),
      (NEW.id, 'Supply & Fit', 'income', 'package', 'reduced_13_5'),
      (NEW.id, 'Garden Projects', 'income', 'flower', 'reduced_13_5'),
      (NEW.id, 'Maintenance Income', 'income', 'scissors', 'reduced_13_5'),
      (NEW.id, 'Hard Landscaping Income', 'income', 'square', 'reduced_13_5');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Materials', 'expense', 'layers', 'standard_23', true),
      (NEW.id, 'Tools & Machinery', 'expense', 'wrench', 'standard_23', true),
      (NEW.id, 'Fuel', 'expense', 'fuel', 'standard_23', false),
      (NEW.id, 'Plant Hire', 'expense', 'truck', 'standard_23', true),
      (NEW.id, 'Disposal Fees', 'expense', 'trash-2', 'standard_23', true),
      (NEW.id, 'Subcontractors', 'expense', 'users', 'zero_rated', true),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- RETAIL & E-COMMERCE
  -- ===========================================
  ELSIF v_business_type = 'retail_ecommerce' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Product Sales', 'income', 'shopping-bag', 'standard_23'),
      (NEW.id, 'Shipping Income', 'income', 'truck', 'standard_23'),
      (NEW.id, 'Online Sales (EU)', 'income', 'globe', 'standard_23'),
      (NEW.id, 'Online Sales (Non-EU)', 'income', 'globe', 'zero_rated'),
      (NEW.id, 'Service Add-ons', 'income', 'plus-circle', 'standard_23');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Inventory / Stock', 'expense', 'package', 'standard_23', true),
      (NEW.id, 'Packaging', 'expense', 'box', 'standard_23', true),
      (NEW.id, 'Shipping Costs', 'expense', 'truck', 'standard_23', true),
      (NEW.id, 'Software / Platforms', 'expense', 'cloud', 'standard_23', true),
      (NEW.id, 'Advertising', 'expense', 'megaphone', 'standard_23', true),
      (NEW.id, 'Payment Fees', 'expense', 'credit-card', 'exempt', false),
      (NEW.id, 'Rent / Utilities', 'expense', 'building', 'exempt', false),
      (NEW.id, 'Staff Costs', 'expense', 'users', 'exempt', false),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- HOSPITALITY
  -- ===========================================
  ELSIF v_business_type = 'hospitality' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Food Sales', 'income', 'utensils', 'second_reduced_9'),
      (NEW.id, 'Beverage Sales', 'income', 'coffee', 'second_reduced_9'),
      (NEW.id, 'Alcohol Sales', 'income', 'wine', 'standard_23'),
      (NEW.id, 'Delivery Income', 'income', 'truck', 'second_reduced_9'),
      (NEW.id, 'Catering Income', 'income', 'chef-hat', 'second_reduced_9');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Food Ingredients', 'expense', 'carrot', 'zero_rated', true),
      (NEW.id, 'Drinks / Alcohol', 'expense', 'wine', 'standard_23', true),
      (NEW.id, 'Kitchen Supplies', 'expense', 'utensils', 'standard_23', true),
      (NEW.id, 'Consumables', 'expense', 'package', 'standard_23', true),
      (NEW.id, 'Delivery Fees', 'expense', 'truck', 'standard_23', true),
      (NEW.id, 'Staff Costs', 'expense', 'users', 'exempt', false),
      (NEW.id, 'Rent / Utilities', 'expense', 'building', 'exempt', false),
      (NEW.id, 'Cleaning Supplies', 'expense', 'sparkles', 'standard_23', true),
      (NEW.id, 'Software / POS', 'expense', 'monitor', 'standard_23', true),
      (NEW.id, 'Licensing Fees', 'expense', 'file-text', 'exempt', false),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- PROFESSIONAL SERVICES
  -- ===========================================
  ELSIF v_business_type = 'professional_services' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Service Fees', 'income', 'briefcase', 'standard_23'),
      (NEW.id, 'Training Income', 'income', 'graduation-cap', 'standard_23'),
      (NEW.id, 'Retainers', 'income', 'clock', 'standard_23'),
      (NEW.id, 'Digital Services', 'income', 'globe', 'standard_23'),
      (NEW.id, 'Project Fees', 'income', 'folder', 'standard_23');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Software', 'expense', 'cloud', 'standard_23', true),
      (NEW.id, 'Advertising', 'expense', 'megaphone', 'standard_23', true),
      (NEW.id, 'Travel', 'expense', 'plane', 'standard_23', true),
      (NEW.id, 'Training', 'expense', 'graduation-cap', 'standard_23', true),
      (NEW.id, 'Office Supplies', 'expense', 'folder', 'standard_23', true),
      (NEW.id, 'Subcontractors', 'expense', 'users', 'standard_23', true),
      (NEW.id, 'Accounting & Legal', 'expense', 'scale', 'standard_23', true),
      (NEW.id, 'Rent / Office', 'expense', 'building', 'exempt', false),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- TRANSPORT & LOGISTICS
  -- ===========================================
  ELSIF v_business_type = 'transport_logistics' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Delivery Income', 'income', 'truck', 'standard_23'),
      (NEW.id, 'Haulage Fees', 'income', 'container', 'standard_23'),
      (NEW.id, 'Freight Income', 'income', 'ship', 'standard_23'),
      (NEW.id, 'Fuel Surcharges', 'income', 'fuel', 'standard_23');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Fuel', 'expense', 'fuel', 'standard_23', false),
      (NEW.id, 'Vehicle Maintenance', 'expense', 'wrench', 'standard_23', true),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Repairs', 'expense', 'settings', 'standard_23', true),
      (NEW.id, 'Tyres', 'expense', 'circle', 'standard_23', true),
      (NEW.id, 'Toll & Parking', 'expense', 'ticket', 'zero_rated', false),
      (NEW.id, 'Warehousing', 'expense', 'warehouse', 'standard_23', true),
      (NEW.id, 'Subcontracted Drivers', 'expense', 'users', 'standard_23', true),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- REAL ESTATE & PROPERTY
  -- ===========================================
  ELSIF v_business_type = 'real_estate_property' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Rental Income', 'income', 'home', 'exempt'),
      (NEW.id, 'Management Fees', 'income', 'briefcase', 'standard_23'),
      (NEW.id, 'Commission', 'income', 'percent', 'standard_23'),
      (NEW.id, 'Short-Term Let Income', 'income', 'calendar', 'second_reduced_9');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Repairs & Maintenance', 'expense', 'wrench', 'reduced_13_5', true),
      (NEW.id, 'Cleaning', 'expense', 'sparkles', 'reduced_13_5', true),
      (NEW.id, 'Utilities', 'expense', 'zap', 'reduced_13_5', true),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Legal Fees', 'expense', 'scale', 'standard_23', true),
      (NEW.id, 'Advertising', 'expense', 'megaphone', 'standard_23', true),
      (NEW.id, 'Furniture / Fixtures', 'expense', 'sofa', 'standard_23', true),
      (NEW.id, 'Subcontractors', 'expense', 'users', 'reduced_13_5', true),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- HEALTH & WELLNESS
  -- ===========================================
  ELSIF v_business_type = 'health_wellness' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Subscription Income', 'income', 'repeat', 'exempt'),
      (NEW.id, 'Session Fees', 'income', 'heart', 'exempt'),
      (NEW.id, 'Classes', 'income', 'users', 'exempt'),
      (NEW.id, 'Online Coaching', 'income', 'video', 'exempt');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Equipment', 'expense', 'dumbbell', 'standard_23', true),
      (NEW.id, 'Software', 'expense', 'cloud', 'standard_23', true),
      (NEW.id, 'Rent / Studio', 'expense', 'building', 'exempt', false),
      (NEW.id, 'Advertising', 'expense', 'megaphone', 'standard_23', true),
      (NEW.id, 'Supplements for Resale', 'expense', 'pill', 'zero_rated', true),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- TECHNOLOGY & IT
  -- ===========================================
  ELSIF v_business_type = 'technology_it' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Software Services', 'income', 'code', 'standard_23'),
      (NEW.id, 'Development Fees', 'income', 'terminal', 'standard_23'),
      (NEW.id, 'Monthly Retainers', 'income', 'clock', 'standard_23'),
      (NEW.id, 'Digital Products', 'income', 'download', 'standard_23'),
      (NEW.id, 'Subscription Income', 'income', 'repeat', 'standard_23');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Software Tools', 'expense', 'cloud', 'standard_23', true),
      (NEW.id, 'Cloud Hosting', 'expense', 'server', 'standard_23', true),
      (NEW.id, 'Hardware', 'expense', 'monitor', 'standard_23', true),
      (NEW.id, 'Advertising', 'expense', 'megaphone', 'standard_23', true),
      (NEW.id, 'Contractors', 'expense', 'users', 'standard_23', true),
      (NEW.id, 'Training', 'expense', 'graduation-cap', 'standard_23', true),
      (NEW.id, 'Rent / Office', 'expense', 'building', 'exempt', false),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- MANUFACTURING
  -- ===========================================
  ELSIF v_business_type = 'manufacturing' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Product Sales', 'income', 'package', 'standard_23'),
      (NEW.id, 'Export Sales', 'income', 'globe', 'zero_rated'),
      (NEW.id, 'Contract Manufacturing', 'income', 'factory', 'standard_23');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Raw Materials', 'expense', 'layers', 'standard_23', true),
      (NEW.id, 'Machinery & Equipment', 'expense', 'settings', 'standard_23', true),
      (NEW.id, 'Factory Rent', 'expense', 'factory', 'exempt', false),
      (NEW.id, 'Utilities', 'expense', 'zap', 'reduced_13_5', true),
      (NEW.id, 'Staff Costs', 'expense', 'users', 'exempt', false),
      (NEW.id, 'Shipping & Freight', 'expense', 'truck', 'standard_23', true),
      (NEW.id, 'Maintenance', 'expense', 'wrench', 'standard_23', true),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- MAINTENANCE & FACILITIES
  -- ===========================================
  ELSIF v_business_type = 'maintenance_facilities' THEN
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate) VALUES
      (NEW.id, 'Service Contracts', 'income', 'file-text', 'reduced_13_5'),
      (NEW.id, 'Callout Fees', 'income', 'phone-call', 'reduced_13_5'),
      (NEW.id, 'Repair Income', 'income', 'wrench', 'reduced_13_5'),
      (NEW.id, 'Maintenance Retainers', 'income', 'clock', 'reduced_13_5');
    INSERT INTO public.categories (user_id, name, type, icon, default_vat_rate, is_vat_recoverable) VALUES
      (NEW.id, 'Parts & Materials', 'expense', 'package', 'standard_23', true),
      (NEW.id, 'Tools & Equipment', 'expense', 'wrench', 'standard_23', true),
      (NEW.id, 'Vehicle Costs', 'expense', 'car', 'standard_23', false),
      (NEW.id, 'Fuel', 'expense', 'fuel', 'standard_23', false),
      (NEW.id, 'Subcontractors', 'expense', 'users', 'reduced_13_5', true),
      (NEW.id, 'Cleaning Supplies', 'expense', 'sparkles', 'standard_23', true),
      (NEW.id, 'Insurance', 'expense', 'shield', 'exempt', false),
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false);

  -- ===========================================
  -- DEFAULT (Other business types)
  -- ===========================================
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
      (NEW.id, 'Bank Fees', 'expense', 'credit-card', 'exempt', false),
      (NEW.id, 'Rent', 'expense', 'home', 'exempt', false),
      (NEW.id, 'Marketing', 'expense', 'megaphone', 'standard_23', true);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created_categories ON auth.users;
CREATE TRIGGER on_auth_user_created_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_categories();