BEGIN;

-- Avoid RLS recursion when has_case_access() calls get_current_profile().
CREATE OR REPLACE FUNCTION public.get_current_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  profile_record public.profiles;
BEGIN
  SELECT * INTO profile_record
  FROM public.profiles
  WHERE user_id = auth.uid();

  RETURN profile_record;
END;
$$;

COMMIT;
