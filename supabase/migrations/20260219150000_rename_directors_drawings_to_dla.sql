-- Rename "Director's Drawings" to "Director's Loan Account" for all existing users
-- In a Ltd company there are no "Director's Drawings" — it's Director's Loan Account
UPDATE public.categories
SET name = 'Director''s Loan Account'
WHERE name = 'Director''s Drawings';
