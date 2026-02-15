-- Add EU & International trade settings to onboarding_settings
ALTER TABLE public.onboarding_settings
  ADD COLUMN IF NOT EXISTS eu_trade_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sells_goods_to_eu BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS buys_goods_from_eu BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sells_services_to_eu BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS buys_services_from_eu BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sells_to_non_eu BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS buys_from_non_eu BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sells_digital_services_b2c BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_section_56_authorisation BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS uses_postponed_accounting BOOLEAN DEFAULT false;
