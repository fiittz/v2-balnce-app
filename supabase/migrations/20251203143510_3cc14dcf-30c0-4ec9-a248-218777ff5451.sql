-- Add notes column to transactions table for accounting comments
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS notes text;