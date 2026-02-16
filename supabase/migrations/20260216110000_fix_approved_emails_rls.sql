-- The enforce_email_whitelist trigger function runs SECURITY DEFINER (as postgres)
-- but needs to read approved_emails which has RLS enabled with no policies.
-- While postgres should bypass RLS, add an explicit policy to ensure the
-- trigger can always read the table, and re-seed the emails as a safety net.

-- Allow the trigger function (running as postgres) to read approved_emails
CREATE POLICY "Allow postgres to read approved_emails"
  ON public.approved_emails
  FOR SELECT
  TO postgres
  USING (true);

-- Also allow supabase_auth_admin (the role that fires auth triggers) to read
CREATE POLICY "Allow auth admin to read approved_emails"
  ON public.approved_emails
  FOR SELECT
  TO supabase_auth_admin
  USING (true);

-- Re-seed all whitelisted emails in case previous migration didn't take effect
INSERT INTO public.approved_emails (email, note) VALUES
  ('jamie@oakmont.ie', 'Oakmont primary'),
  ('thomasvonteichman@nomadai.ie', 'Thomas - NomadAI'),
  ('fitzgerald7071jamie@gmail.com', 'Jamie personal Gmail')
ON CONFLICT (email) DO NOTHING;
