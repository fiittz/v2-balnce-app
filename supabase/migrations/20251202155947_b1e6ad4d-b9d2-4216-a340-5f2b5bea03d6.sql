ALTER TABLE public.transactions 
ADD COLUMN is_business_expense BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN public.transactions.is_business_expense IS 'NULL = needs review, TRUE = confirmed business expense, FALSE = personal/non-deductible';