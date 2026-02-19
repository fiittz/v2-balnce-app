INSERT INTO public.approved_emails (email)
VALUES ('markafmoore+balnce@gmail.com')
ON CONFLICT (email) DO NOTHING;
