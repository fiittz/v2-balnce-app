-- Create accounts table for Chart of Accounts
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  type TEXT NOT NULL CHECK (type IN ('Income', 'Cost of Sales', 'Expense', 'VAT', 'Payroll', 'Fixed Assets', 'Current Assets', 'Current Liabilities', 'Equity')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage their own accounts"
ON public.accounts
FOR ALL
USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_accounts_user_type ON public.accounts(user_id, type);
CREATE INDEX idx_accounts_code ON public.accounts(user_id, code);

-- Function to seed default accounts for new users
CREATE OR REPLACE FUNCTION public.create_default_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Income Accounts
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
    (NEW.id, 'Rental Income', 'INC011', 'Income');

  -- Cost of Sales
  INSERT INTO public.accounts (user_id, name, code, type) VALUES
    (NEW.id, 'Materials Purchased', 'COS001', 'Cost of Sales'),
    (NEW.id, 'Subcontractors', 'COS002', 'Cost of Sales'),
    (NEW.id, 'Direct Wages', 'COS003', 'Cost of Sales'),
    (NEW.id, 'Stock Purchases', 'COS004', 'Cost of Sales'),
    (NEW.id, 'Freight & Import Duties', 'COS005', 'Cost of Sales'),
    (NEW.id, 'Purchases EU (Reverse Charge)', 'COS006', 'Cost of Sales'),
    (NEW.id, 'Purchases Outside EU', 'COS007', 'Cost of Sales');

  -- Expenses
  INSERT INTO public.accounts (user_id, name, code, type) VALUES
    (NEW.id, 'Motor – Fuel', 'EXP001', 'Expense'),
    (NEW.id, 'Motor – Repairs', 'EXP002', 'Expense'),
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
    (NEW.id, 'General Expenses', 'EXP039', 'Expense');

  -- VAT Accounts
  INSERT INTO public.accounts (user_id, name, code, type) VALUES
    (NEW.id, 'VAT on Sales (Output VAT)', 'VAT001', 'VAT'),
    (NEW.id, 'VAT on Purchases (Input VAT)', 'VAT002', 'VAT'),
    (NEW.id, 'VAT Reverse Charge', 'VAT003', 'VAT'),
    (NEW.id, 'VAT EU Acquisitions', 'VAT004', 'VAT'),
    (NEW.id, 'VAT Payable', 'VAT005', 'VAT'),
    (NEW.id, 'VAT Receivable', 'VAT006', 'VAT'),
    (NEW.id, 'VAT Suspense', 'VAT007', 'VAT');

  -- Payroll Accounts
  INSERT INTO public.accounts (user_id, name, code, type) VALUES
    (NEW.id, 'Net Wages Payable', 'PAY001', 'Payroll'),
    (NEW.id, 'PAYE/PRSI/USC Payable', 'PAY002', 'Payroll'),
    (NEW.id, 'Employer PRSI Payable', 'PAY003', 'Payroll');

  -- Fixed Assets
  INSERT INTO public.accounts (user_id, name, code, type) VALUES
    (NEW.id, 'Tools & Machinery', 'FA001', 'Fixed Assets'),
    (NEW.id, 'Motor Vehicles', 'FA002', 'Fixed Assets'),
    (NEW.id, 'Office Equipment', 'FA003', 'Fixed Assets'),
    (NEW.id, 'Fixtures & Fittings', 'FA004', 'Fixed Assets'),
    (NEW.id, 'Computer Hardware', 'FA005', 'Fixed Assets'),
    (NEW.id, 'Accumulated Depreciation – Tools', 'FA006', 'Fixed Assets'),
    (NEW.id, 'Accumulated Depreciation – Vehicles', 'FA007', 'Fixed Assets'),
    (NEW.id, 'Accumulated Depreciation – Equipment', 'FA008', 'Fixed Assets');

  -- Current Assets
  INSERT INTO public.accounts (user_id, name, code, type) VALUES
    (NEW.id, 'Cash on Hand', 'CA001', 'Current Assets'),
    (NEW.id, 'Bank Account', 'CA002', 'Current Assets'),
    (NEW.id, 'Client Debtors', 'CA003', 'Current Assets'),
    (NEW.id, 'VAT Receivable', 'CA004', 'Current Assets'),
    (NEW.id, 'Inventory', 'CA005', 'Current Assets'),
    (NEW.id, 'Prepayments', 'CA006', 'Current Assets');

  -- Current Liabilities
  INSERT INTO public.accounts (user_id, name, code, type) VALUES
    (NEW.id, 'Trade Creditors', 'CL001', 'Current Liabilities'),
    (NEW.id, 'VAT Payable', 'CL002', 'Current Liabilities'),
    (NEW.id, 'Payroll Taxes Payable', 'CL003', 'Current Liabilities'),
    (NEW.id, 'Accruals', 'CL004', 'Current Liabilities');

  -- Equity
  INSERT INTO public.accounts (user_id, name, code, type) VALUES
    (NEW.id, 'Owner''s Capital', 'EQ001', 'Equity'),
    (NEW.id, 'Owner''s Drawings', 'EQ002', 'Equity'),
    (NEW.id, 'Retained Earnings', 'EQ003', 'Equity');

  RETURN NEW;
END;
$$;

-- Trigger to seed accounts on new user creation
CREATE TRIGGER on_auth_user_created_accounts
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_accounts();