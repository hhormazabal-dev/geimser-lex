BEGIN;

-- ---------------------------------------------------------------------------
-- Fix: avoid RLS recursion when cases policies call has_case_access()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_case_access(case_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  current_profile public.profiles;
  v_case_org UUID;
  v_current_org UUID;
BEGIN
  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;

  SELECT * INTO current_profile FROM public.get_current_profile();
  IF current_profile.id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT c.organization_id INTO v_case_org
  FROM public.cases c
  WHERE c.id = case_uuid;

  -- Caso inexistente o sin org (no debería ocurrir)
  IF v_case_org IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Clientes: acceso solo por asignación al caso y, si existe, por org del cliente.
  IF current_profile.role = 'cliente' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.case_clients
      WHERE case_id = case_uuid
        AND client_profile_id = current_profile.id
    ) AND (
      current_profile.organization_id IS NULL
      OR current_profile.organization_id = v_case_org
    );
  END IF;

  -- Staff interno: requiere org activa y match.
  v_current_org := public.current_org_id();
  IF v_current_org IS NULL OR v_current_org <> v_case_org THEN
    RETURN FALSE;
  END IF;

  -- Admin de empresa: todo dentro del org activo.
  IF current_profile.role = 'admin_firma' THEN
    RETURN TRUE;
  END IF;

  -- Abogado: responsable o colaborador dentro del org.
  IF current_profile.role = 'abogado' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.cases
      WHERE id = case_uuid
        AND abogado_responsable = current_profile.id
    ) OR EXISTS (
      SELECT 1 FROM public.case_collaborators
      WHERE case_id = case_uuid
        AND abogado_id = current_profile.id
    );
  END IF;

  -- Analista: asignado al caso dentro del org.
  IF current_profile.role = 'analista' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.cases
      WHERE id = case_uuid
        AND analista_id = current_profile.id
    );
  END IF;

  RETURN FALSE;
END;
$$;

COMMIT;
