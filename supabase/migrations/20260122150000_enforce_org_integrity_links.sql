BEGIN;

-- ---------------------------------------------------------------------------
-- Enforce data integrity for org + role consistency.
-- Goal: prevenir asociaciones inconsistentes cuando crezca el volumen.
-- Nota: triggers no rompen datos existentes; solo validan INSERT/UPDATE.
-- ---------------------------------------------------------------------------

-- Ensure search_path to avoid surprises under SECURITY DEFINER.

-- 1) cases: abogado_responsable / analista_id / cliente_principal_id deben pertenecer a la org del caso
CREATE OR REPLACE FUNCTION public.trg_cases_enforce_participants_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
BEGIN
  v_org := NEW.organization_id;
  IF v_org IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.cliente_principal_id IS NOT NULL THEN
    PERFORM 1
    FROM public.profiles p
    WHERE p.id = NEW.cliente_principal_id
      AND p.role = 'cliente'
      AND p.organization_id = v_org;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'cliente_principal_id % inválido para org %', NEW.cliente_principal_id, v_org;
    END IF;
  END IF;

  IF NEW.abogado_responsable IS NOT NULL THEN
    PERFORM 1
    FROM public.profiles p
    JOIN public.org_members m
      ON m.organization_id = v_org
     AND m.user_id = p.user_id
    WHERE p.id = NEW.abogado_responsable
      AND p.role = 'abogado';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'abogado_responsable % inválido para org %', NEW.abogado_responsable, v_org;
    END IF;
  END IF;

  IF NEW.analista_id IS NOT NULL THEN
    PERFORM 1
    FROM public.profiles p
    JOIN public.org_members m
      ON m.organization_id = v_org
     AND m.user_id = p.user_id
    WHERE p.id = NEW.analista_id
      AND p.role = 'analista';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'analista_id % inválido para org %', NEW.analista_id, v_org;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cases_enforce_participants_org ON public.cases;
CREATE TRIGGER trg_cases_enforce_participants_org
  BEFORE INSERT OR UPDATE OF organization_id, abogado_responsable, analista_id, cliente_principal_id
  ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_cases_enforce_participants_org();

-- 2) case_clients: client_profile_id debe ser cliente y misma org del caso
CREATE OR REPLACE FUNCTION public.trg_case_clients_enforce_client_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_org UUID;
BEGIN
  SELECT c.organization_id INTO v_case_org
  FROM public.cases c
  WHERE c.id = NEW.case_id;

  IF v_case_org IS NULL THEN
    RAISE EXCEPTION 'No se pudo derivar organization_id desde case_id=%', NEW.case_id;
  END IF;

  PERFORM 1
  FROM public.profiles p
  WHERE p.id = NEW.client_profile_id
    AND p.role = 'cliente'
    AND p.organization_id = v_case_org;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client_profile_id % inválido para case_id=% (org=%)', NEW.client_profile_id, NEW.case_id, v_case_org;
  END IF;

  -- Asegura consistencia del org_id del link (si existe la columna; en este repo existe).
  NEW.organization_id := v_case_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_clients_enforce_client_org ON public.case_clients;
CREATE TRIGGER trg_case_clients_enforce_client_org
  BEFORE INSERT OR UPDATE OF case_id, client_profile_id
  ON public.case_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_case_clients_enforce_client_org();

-- 3) case_collaborators: abogado_id debe ser abogado y miembro del org del caso
CREATE OR REPLACE FUNCTION public.trg_case_collaborators_enforce_lawyer_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_org UUID;
BEGIN
  SELECT c.organization_id INTO v_case_org
  FROM public.cases c
  WHERE c.id = NEW.case_id;

  IF v_case_org IS NULL THEN
    RAISE EXCEPTION 'No se pudo derivar organization_id desde case_id=%', NEW.case_id;
  END IF;

  PERFORM 1
  FROM public.profiles p
  JOIN public.org_members m
    ON m.organization_id = v_case_org
   AND m.user_id = p.user_id
  WHERE p.id = NEW.abogado_id
    AND p.role = 'abogado';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'abogado_id % inválido para case_id=% (org=%)', NEW.abogado_id, NEW.case_id, v_case_org;
  END IF;

  NEW.organization_id := v_case_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_collaborators_enforce_lawyer_org ON public.case_collaborators;
CREATE TRIGGER trg_case_collaborators_enforce_lawyer_org
  BEFORE INSERT OR UPDATE OF case_id, abogado_id
  ON public.case_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_case_collaborators_enforce_lawyer_org();

COMMIT;

