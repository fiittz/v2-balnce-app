-- Fix RLS policies on onboarding_settings: make them PERMISSIVE instead of RESTRICTIVE
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can insert own onboarding" ON public.onboarding_settings;
DROP POLICY IF EXISTS "Users can update own onboarding" ON public.onboarding_settings;
DROP POLICY IF EXISTS "Users can view own onboarding" ON public.onboarding_settings;

-- Recreate as PERMISSIVE policies (the default, and what we need)
CREATE POLICY "Users can insert own onboarding" 
ON public.onboarding_settings 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding" 
ON public.onboarding_settings 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own onboarding" 
ON public.onboarding_settings 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);