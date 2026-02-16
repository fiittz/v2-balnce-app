INSERT INTO public.approved_emails (email, note)
VALUES ('fitzgerald7071jamie@gmail.com', NULL)
ON CONFLICT (email) DO NOTHING;
