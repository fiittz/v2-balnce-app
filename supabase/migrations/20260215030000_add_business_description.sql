-- Add business_description column to onboarding_settings and profiles
ALTER TABLE onboarding_settings ADD COLUMN IF NOT EXISTS business_description TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_description TEXT;
