-- =====================================================
-- BALNCE BOOKKEEPING ENGINE - COMPREHENSIVE SCHEMA
-- =====================================================

-- 1. SUBCONTRACTORS TABLE (for RCT)
CREATE TABLE public.subcontractors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  tax_reference TEXT, -- PPSN or Company Reg
  rct_rate INTEGER NOT NULL DEFAULT 20 CHECK (rct_rate IN (0, 20, 35)),
  email TEXT,
  phone TEXT,
  address TEXT,
  is_verified BOOLEAN DEFAULT false,
  verification_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own subcontractors"
ON public.subcontractors FOR ALL
USING (auth.uid() = user_id);

-- 2. BANK ACCOUNTS TABLE
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_name TEXT NOT NULL,
  account_number_masked TEXT, -- Last 4 digits only
  iban_masked TEXT,
  bank_name TEXT,
  currency TEXT DEFAULT 'EUR',
  current_balance NUMERIC DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own bank accounts"
ON public.bank_accounts FOR ALL
USING (auth.uid() = user_id);

-- 3. VAT RETURNS TABLE
CREATE TYPE public.vat_return_status AS ENUM ('draft', 'ready', 'submitted', 'paid');

CREATE TABLE public.vat_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  vat_on_sales NUMERIC NOT NULL DEFAULT 0,
  vat_on_purchases NUMERIC NOT NULL DEFAULT 0,
  net_vat NUMERIC NOT NULL DEFAULT 0,
  status public.vat_return_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMP WITH TIME ZONE,
  due_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_start, period_end)
);

ALTER TABLE public.vat_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own VAT returns"
ON public.vat_returns FOR ALL
USING (auth.uid() = user_id);

-- 4. RCT CONTRACTS TABLE
CREATE TYPE public.rct_contract_status AS ENUM ('active', 'completed', 'cancelled');

CREATE TABLE public.rct_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subcontractor_id UUID NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  contract_reference TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  estimated_value NUMERIC,
  status public.rct_contract_status NOT NULL DEFAULT 'active',
  notified_to_revenue BOOLEAN DEFAULT false,
  notification_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rct_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own RCT contracts"
ON public.rct_contracts FOR ALL
USING (auth.uid() = user_id);

-- 5. RCT DEDUCTIONS TABLE
CREATE TABLE public.rct_deductions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contract_id UUID REFERENCES public.rct_contracts(id) ON DELETE SET NULL,
  subcontractor_id UUID NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL,
  gross_amount NUMERIC NOT NULL,
  rct_rate INTEGER NOT NULL CHECK (rct_rate IN (0, 20, 35)),
  rct_deducted NUMERIC NOT NULL,
  net_payable NUMERIC NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  submitted_to_revenue BOOLEAN DEFAULT false,
  submission_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rct_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own RCT deductions"
ON public.rct_deductions FOR ALL
USING (auth.uid() = user_id);

-- 6. AUDIT LOG TABLE
CREATE TYPE public.audit_action AS ENUM (
  'auto_categorized', 
  'vat_applied', 
  'rct_applied', 
  'matched_receipt', 
  'matched_transaction',
  'duplicate_detected',
  'anomaly_flagged',
  'user_override'
);

CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL, -- 'transaction', 'expense', 'invoice'
  entity_id UUID NOT NULL,
  action public.audit_action NOT NULL,
  old_value JSONB,
  new_value JSONB,
  explanation TEXT,
  confidence_score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
ON public.audit_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs"
ON public.audit_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 7. ADD RCT FIELDS TO SUPPLIERS
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS is_subcontractor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rct_rate INTEGER DEFAULT 20 CHECK (rct_rate IS NULL OR rct_rate IN (0, 20, 35)),
ADD COLUMN IF NOT EXISTS tax_reference TEXT;

-- 8. ADD MATCHING AND AI FIELDS TO TRANSACTIONS
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS matched_expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ai_explanation TEXT,
ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS duplicate_of_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- 9. ADD MATCHING AND RCT FIELDS TO EXPENSES
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS matched_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ai_categorized BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC,
ADD COLUMN IF NOT EXISTS ai_explanation TEXT,
ADD COLUMN IF NOT EXISTS rct_applicable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rct_rate INTEGER CHECK (rct_rate IS NULL OR rct_rate IN (0, 20, 35)),
ADD COLUMN IF NOT EXISTS rct_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS subcontractor_id UUID REFERENCES public.subcontractors(id) ON DELETE SET NULL;

-- 10. ADD RCT AND MATCHING FIELDS TO INVOICES
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS matched_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rct_applicable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rct_rate INTEGER CHECK (rct_rate IS NULL OR rct_rate IN (0, 20, 35)),
ADD COLUMN IF NOT EXISTS rct_amount NUMERIC DEFAULT 0;

-- 11. CREATE INVOICE NUMBER SEQUENCE FUNCTION
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_year TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM invoices
  WHERE user_id = p_user_id
  AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now());
  
  RETURN 'INV-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

-- 12. VAT CALCULATION HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.calculate_vat(
  p_total NUMERIC,
  p_vat_rate public.vat_rate
)
RETURNS TABLE(net_amount NUMERIC, vat_amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  v_rate := CASE p_vat_rate
    WHEN 'standard_23' THEN 0.23
    WHEN 'reduced_13_5' THEN 0.135
    WHEN 'second_reduced_9' THEN 0.09
    WHEN 'livestock_4_8' THEN 0.048
    WHEN 'zero_rated' THEN 0
    WHEN 'exempt' THEN 0
    ELSE 0.23
  END;
  
  IF v_rate = 0 THEN
    net_amount := p_total;
    vat_amount := 0;
  ELSE
    vat_amount := ROUND(p_total * v_rate / (1 + v_rate), 2);
    net_amount := p_total - vat_amount;
  END IF;
  
  RETURN NEXT;
END;
$$;

-- 13. RCT CALCULATION HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.calculate_rct(
  p_gross_amount NUMERIC,
  p_rct_rate INTEGER
)
RETURNS TABLE(rct_deducted NUMERIC, net_payable NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  rct_deducted := ROUND(p_gross_amount * (p_rct_rate::NUMERIC / 100), 2);
  net_payable := p_gross_amount - rct_deducted;
  RETURN NEXT;
END;
$$;

-- 14. GET VAT PERIOD FUNCTION
CREATE OR REPLACE FUNCTION public.get_vat_period(p_date DATE)
RETURNS TABLE(period_start DATE, period_end DATE, due_date DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month INTEGER;
  v_year INTEGER;
BEGIN
  v_month := EXTRACT(MONTH FROM p_date);
  v_year := EXTRACT(YEAR FROM p_date);
  
  -- Bi-monthly periods: Jan-Feb, Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec
  IF v_month IN (1, 2) THEN
    period_start := make_date(v_year, 1, 1);
    period_end := make_date(v_year, 2, 28);
    due_date := make_date(v_year, 3, 23);
  ELSIF v_month IN (3, 4) THEN
    period_start := make_date(v_year, 3, 1);
    period_end := make_date(v_year, 4, 30);
    due_date := make_date(v_year, 5, 23);
  ELSIF v_month IN (5, 6) THEN
    period_start := make_date(v_year, 5, 1);
    period_end := make_date(v_year, 6, 30);
    due_date := make_date(v_year, 7, 23);
  ELSIF v_month IN (7, 8) THEN
    period_start := make_date(v_year, 7, 1);
    period_end := make_date(v_year, 8, 31);
    due_date := make_date(v_year, 9, 23);
  ELSIF v_month IN (9, 10) THEN
    period_start := make_date(v_year, 9, 1);
    period_end := make_date(v_year, 10, 31);
    due_date := make_date(v_year, 11, 23);
  ELSE
    period_start := make_date(v_year, 11, 1);
    period_end := make_date(v_year, 12, 31);
    due_date := make_date(v_year + 1, 1, 23);
  END IF;
  
  -- Adjust for leap year in Feb
  IF EXTRACT(MONTH FROM period_end) = 2 THEN
    period_end := (make_date(v_year, 3, 1) - INTERVAL '1 day')::DATE;
  END IF;
  
  RETURN NEXT;
END;
$$;

-- 15. TRIGGERS FOR UPDATED_AT
CREATE TRIGGER update_subcontractors_updated_at
BEFORE UPDATE ON public.subcontractors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_bank_accounts_updated_at
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_vat_returns_updated_at
BEFORE UPDATE ON public.vat_returns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_rct_contracts_updated_at
BEFORE UPDATE ON public.rct_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_rct_deductions_updated_at
BEFORE UPDATE ON public.rct_deductions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 16. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_needs_review ON public.transactions(user_id, needs_review) WHERE needs_review = true;
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_user_status ON public.invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_vat_returns_user_period ON public.vat_returns(user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_rct_deductions_user_period ON public.rct_deductions(user_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);