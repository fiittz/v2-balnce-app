CREATE INDEX IF NOT EXISTS idx_rct_deductions_subcontractor_id ON public.rct_deductions(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_rct_contracts_user_id ON public.rct_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_subcontractors_user_id ON public.subcontractors(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON public.bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);
