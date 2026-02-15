-- ============================================================
-- Add ON DELETE CASCADE FK constraints on user_id
-- for tables that are missing them.
-- ============================================================
-- These tables were created with user_id UUID NOT NULL but no
-- foreign key reference to auth.users.  Adding the FK ensures
-- that when a user account is deleted, their data is cleaned up.
--
-- The DO blocks check for existing constraints so this migration
-- is safe to run even if some FKs were added by later migrations.

-- 1. subcontractors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'subcontractors'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'subcontractors_user_id_fkey'
  ) THEN
    ALTER TABLE public.subcontractors
      ADD CONSTRAINT subcontractors_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. bank_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'bank_accounts'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'bank_accounts_user_id_fkey'
  ) THEN
    ALTER TABLE public.bank_accounts
      ADD CONSTRAINT bank_accounts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. vat_returns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'vat_returns'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'vat_returns_user_id_fkey'
  ) THEN
    ALTER TABLE public.vat_returns
      ADD CONSTRAINT vat_returns_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. rct_contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'rct_contracts'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'rct_contracts_user_id_fkey'
  ) THEN
    ALTER TABLE public.rct_contracts
      ADD CONSTRAINT rct_contracts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. rct_deductions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'rct_deductions'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'rct_deductions_user_id_fkey'
  ) THEN
    ALTER TABLE public.rct_deductions
      ADD CONSTRAINT rct_deductions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. audit_log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'audit_log'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'audit_log_user_id_fkey'
  ) THEN
    ALTER TABLE public.audit_log
      ADD CONSTRAINT audit_log_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 7. accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'accounts'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'accounts_user_id_fkey'
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 8. onboarding_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'onboarding_settings'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'onboarding_settings_user_id_fkey'
  ) THEN
    ALTER TABLE public.onboarding_settings
      ADD CONSTRAINT onboarding_settings_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 9. vat_finalisation_data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'vat_finalisation_data'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'vat_finalisation_data_user_id_fkey'
  ) THEN
    ALTER TABLE public.vat_finalisation_data
      ADD CONSTRAINT vat_finalisation_data_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 10. import_batches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'import_batches'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'import_batches_user_id_fkey'
  ) THEN
    ALTER TABLE public.import_batches
      ADD CONSTRAINT import_batches_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
