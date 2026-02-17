-- Repair: re-add account_type column to categories (migration 20260215020000 recorded but column missing)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'both';

-- Tag existing business-only categories
UPDATE categories SET account_type = 'business'
WHERE name IN (
  'Materials & Supplies',
  'Subcontractor Payments',
  'Tools & Equipment',
  'Vehicle Expenses',
  'Fuel',
  'Office Expenses',
  'Telephone & Internet',
  'Rent & Rates',
  'Utilities',
  'Training & Certifications',
  'Advertising & Marketing',
  'Travel & Accommodation',
  'Subsistence',
  'Meals & Entertainment',
  'Repairs & Maintenance',
  'Protective Clothing & PPE',
  'Subscriptions & Software',
  'Director''s Drawings',
  'Miscellaneous Expenses',
  'Contract Work',
  'Labour Income',
  'Materials Charged',
  'Consultation Fees',
  'Other Income',
  -- Professional categories
  'Contractor Payments',
  'Professional Fees',
  'Training & CPD',
  'Consulting & Services',
  'Project Fees',
  'Retainer Income'
);

-- Tag shared categories
UPDATE categories SET account_type = 'both'
WHERE name IN (
  'Insurance',
  'Bank Charges',
  'Medical Expenses'
);

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_categories_account_type ON categories(account_type);
