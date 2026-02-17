INSERT INTO public.approved_emails (email, note)
VALUES ('kevin@workstuff.ai', 'Kevin - WorkStuff')
ON CONFLICT (email) DO NOTHING;
