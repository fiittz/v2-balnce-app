-- Add account_id to invoices so users can link invoices to specific accounts
ALTER TABLE invoices ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
