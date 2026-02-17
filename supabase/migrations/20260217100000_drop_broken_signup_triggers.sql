-- Drop legacy triggers that fire on auth.users INSERT but reference
-- columns (icon, default_vat_rate, is_vat_recoverable, code, type)
-- that no longer exist in the current categories / accounts tables.
-- Category and account seeding is now handled in the frontend via
-- seedDefaultCategories() and seedDefaultAccount().

DROP TRIGGER IF EXISTS on_auth_user_created_categories ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_accounts ON auth.users;

DROP FUNCTION IF EXISTS public.create_default_categories();
DROP FUNCTION IF EXISTS public.create_default_accounts();
