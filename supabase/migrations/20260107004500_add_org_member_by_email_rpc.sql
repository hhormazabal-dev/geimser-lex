BEGIN;

-- ---------------------------------------------------------------------------
-- RPC: add an existing user (by email) to an organization without transferring cases.
-- Use-case: a lawyer belongs to multiple organizations and switches via /select-org.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.add_org_member_by_email(
  p_org_id UUID,
  p_email TEXT,
  p_role public.org_member_role DEFAULT 'lawyer'::public.org_member_role
)
RETURNS public.org_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
  v_row public.org_members;
BEGIN
  v_email := lower(trim(coalesce(p_email, '')));
  IF v_email = '' THEN
    RAISE EXCEPTION 'email requerido';
  END IF;
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id requerido';
  END IF;

  IF NOT (public.is_super_admin() OR public.has_org_role(p_org_id, 'org_admin'::public.org_member_role)) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  SELECT p.user_id INTO v_user_id
  FROM public.profiles p
  WHERE lower(trim(p.email)) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado (profiles)';
  END IF;

  INSERT INTO public.org_members (organization_id, user_id, role)
  VALUES (p_org_id, v_user_id, p_role)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMIT;

