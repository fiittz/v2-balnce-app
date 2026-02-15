-- Add account_type to categories to distinguish business vs personal categories
ALTER TABLE categories ADD COLUMN account_type text NOT NULL DEFAULT 'both';

-- Add account_id to expenses so each expense links to an account
ALTER TABLE expenses ADD COLUMN account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

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
  'Other Income'
);

-- Tag shared categories (apply to both business and personal)
UPDATE categories SET account_type = 'both'
WHERE name IN (
  'Insurance',
  'Professional Fees',
  'Bank Charges',
  'Medical Expenses'
);

-- Create index for filtering categories by account_type
CREATE INDEX idx_categories_account_type ON categories(account_type);

-- Create index for filtering expenses by account_id
CREATE INDEX idx_expenses_account_id ON expenses(account_id);
