-- Add Internal Transfers account for all users who have accounts
INSERT INTO accounts (user_id, name, code, type, is_active)
SELECT DISTINCT user_id, 'Internal Transfers', '1200', 'Current Assets', true
FROM accounts
WHERE NOT EXISTS (
  SELECT 1 FROM accounts a2 
  WHERE a2.user_id = accounts.user_id 
  AND a2.name = 'Internal Transfers'
);