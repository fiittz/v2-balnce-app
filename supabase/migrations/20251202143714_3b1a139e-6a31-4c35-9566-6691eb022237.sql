-- Add account_id column to transactions table for Chart of Accounts linking
ALTER TABLE public.transactions 
ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_transactions_account_id ON public.transactions(account_id);

-- Add comment for documentation
COMMENT ON COLUMN public.transactions.account_id IS 'Links transaction to Chart of Accounts entry';