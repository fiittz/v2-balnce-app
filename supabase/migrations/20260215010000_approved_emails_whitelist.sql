-- Approved emails whitelist
-- Only emails in this table can sign up. All others are rejected.

CREATE TABLE public.approved_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  note TEXT,  -- e.g. "John's Carpentry Ltd" so you remember who it's for
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: only service_role can manage this table (not accessible from client)
ALTER TABLE public.approved_emails ENABLE ROW LEVEL SECURITY;
-- No policies = no client access. Only service_role (dashboard/edge functions) can read/write.

-- Trigger function: reject signups from unapproved emails
CREATE OR REPLACE FUNCTION public.enforce_email_whitelist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.approved_emails
    WHERE lower(email) = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'Signup not allowed. Please contact support for access.';
  END IF;
  RETURN NEW;
END;
$$;

-- Fire BEFORE insert on auth.users so unapproved signups are blocked
CREATE TRIGGER check_email_whitelist
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_email_whitelist();
