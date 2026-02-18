-- Fix receipts.transaction_id FK to use ON DELETE SET NULL
-- The original CREATE TABLE had ON DELETE SET NULL but the live
-- constraint is blocking deletes, so re-create it explicitly.

ALTER TABLE public.receipts
  DROP CONSTRAINT IF EXISTS receipts_transaction_id_fkey;

ALTER TABLE public.receipts
  ADD CONSTRAINT receipts_transaction_id_fkey
  FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
  ON DELETE SET NULL;
