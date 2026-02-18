INSERT INTO public.approved_emails (email)
VALUES ('brendan@coso.ai')
ON CONFLICT (email) DO NOTHING;
