-- Ensure specific accounts have global (super admin) access.
-- This enables seeing all organizations, lawyers and clients across tenants (via is_super_admin()).

INSERT INTO public.super_admins (email)
SELECT 'hh2fc24@gmail.com'
WHERE NOT EXISTS (SELECT 1 FROM public.super_admins WHERE email = 'hh2fc24@gmail.com');

INSERT INTO public.super_admins (email)
SELECT 'catalina@xel.cl'
WHERE NOT EXISTS (SELECT 1 FROM public.super_admins WHERE email = 'catalina@xel.cl');

