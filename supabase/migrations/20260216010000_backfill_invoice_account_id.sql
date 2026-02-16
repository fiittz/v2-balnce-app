-- Backfill existing invoices with null account_id to each user's default account
UPDATE invoices
SET account_id = (
  SELECT id FROM accounts
  WHERE accounts.user_id = invoices.user_id
    AND accounts.is_default = true
  LIMIT 1
)
WHERE account_id IS NULL;
