BEGIN;

-- ---------------------------------------------------------------------------
-- Org transfer audit + RPC
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.org_transfer_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  moved_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  to_organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  mode TEXT NOT NULL DEFAULT 'A',
  moved_cases_count INTEGER NOT NULL DEFAULT 0,
  moved_clients_count INTEGER NOT NULL DEFAULT 0,
  skipped_cases_count INTEGER NOT NULL DEFAULT 0,
  conflict_case_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  conflict_client_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS org_transfer_log_created_at_idx ON public.org_transfer_log(created_at DESC);
CREATE INDEX IF NOT EXISTS org_transfer_log_moved_user_idx ON public.org_transfer_log(moved_user_id);
CREATE INDEX IF NOT EXISTS org_transfer_log_to_org_idx ON public.org_transfer_log(to_organization_id);

ALTER TABLE public.org_transfer_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_transfer_log_select ON public.org_transfer_log;
CREATE POLICY org_transfer_log_select ON public.org_transfer_log
  FOR SELECT USING (
    public.is_super_admin()
    OR public.has_org_role(to_organization_id, 'org_admin'::public.org_member_role)
  );

DROP POLICY IF EXISTS org_transfer_log_insert ON public.org_transfer_log;
CREATE POLICY org_transfer_log_insert ON public.org_transfer_log
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR public.has_org_role(to_organization_id, 'org_admin'::public.org_member_role)
  );

-- RPC: mueve abogado (y sus datos) a una organización.
CREATE OR REPLACE FUNCTION public.transfer_lawyer_to_org(
  p_user_id UUID,
  p_new_org_id UUID,
  p_mode TEXT DEFAULT 'A'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller UUID;
  v_target_profile public.profiles;
  v_old_org UUID;
  v_mode TEXT;
  v_target_role public.org_member_role;

  v_candidate_cases UUID[];
  v_conflict_case_ids UUID[] := '{}'::uuid[];
  v_move_case_ids UUID[] := '{}'::uuid[];

  v_candidate_client_ids UUID[] := '{}'::uuid[];
  v_conflict_client_ids UUID[] := '{}'::uuid[];
  v_move_client_ids UUID[] := '{}'::uuid[];

  v_moved_cases_count INTEGER := 0;
  v_moved_clients_count INTEGER := 0;
  v_skipped_cases_count INTEGER := 0;
  v_details JSONB := '{}'::jsonb;
BEGIN
  v_caller := auth.uid();
  v_mode := COALESCE(NULLIF(TRIM(p_mode), ''), 'A');

  IF p_user_id IS NULL OR p_new_org_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id y p_new_org_id son requeridos';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_new_org_id AND o.status = 'active') THEN
    RAISE EXCEPTION 'Organización destino no existe o está inactiva';
  END IF;

  -- Permisos: super_admin o org_admin del org destino.
  IF NOT (public.is_super_admin() OR public.has_org_role(p_new_org_id, 'org_admin'::public.org_member_role)) THEN
    RAISE EXCEPTION 'Sin permisos para transferir a esta organización';
  END IF;

  SELECT * INTO v_target_profile
  FROM public.profiles p
  WHERE p.user_id = p_user_id OR p.id = p_user_id
  LIMIT 1;

  IF v_target_profile.id IS NULL THEN
    RAISE EXCEPTION 'No existe perfil para el usuario %', p_user_id;
  END IF;

  IF v_target_profile.role NOT IN ('abogado', 'admin_firma', 'analista') THEN
    RAISE EXCEPTION 'Solo se pueden transferir usuarios internos (admin_firma/abogado/analista)';
  END IF;

  v_target_role :=
    CASE v_target_profile.role
      WHEN 'admin_firma' THEN 'org_admin'::public.org_member_role
      WHEN 'analista' THEN 'staff'::public.org_member_role
      ELSE 'lawyer'::public.org_member_role
    END;

  -- Org origen: preferimos la activa del usuario, si no, su membership más reciente.
  SELECT p.active_organization_id INTO v_old_org
  FROM public.profiles p
  WHERE p.user_id = v_target_profile.user_id
  LIMIT 1;

  IF v_old_org IS NULL THEN
    SELECT m.organization_id INTO v_old_org
    FROM public.org_members m
    WHERE m.user_id = v_target_profile.user_id
    ORDER BY m.created_at DESC
    LIMIT 1;
  END IF;

  -- Contexto de transferencia para triggers de hardening.
  PERFORM set_config('app.org_transfer', '1', true);

  -- Upsert membership destino.
  INSERT INTO public.org_members (organization_id, user_id, role)
  VALUES (p_new_org_id, v_target_profile.user_id, v_target_role)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- "Move": remover membership de org anterior (si existe y es distinto).
  IF v_old_org IS NOT NULL AND v_old_org <> p_new_org_id THEN
    DELETE FROM public.org_members
    WHERE organization_id = v_old_org
      AND user_id = v_target_profile.user_id;
  END IF;

  -- Set active org del usuario transferido.
  UPDATE public.profiles
    SET active_organization_id = p_new_org_id
  WHERE user_id = v_target_profile.user_id;

  -- Casos candidatos: responsable.
  SELECT COALESCE(array_agg(c.id), '{}'::uuid[])
    INTO v_candidate_cases
  FROM public.cases c
  WHERE c.abogado_responsable = v_target_profile.id
    AND (v_old_org IS NULL OR c.organization_id = v_old_org);

  -- Conflictos (modo A): casos con colaboradores que no son miembros del org destino.
  IF upper(v_mode) = 'A' THEN
    SELECT COALESCE(array_agg(DISTINCT c.id), '{}'::uuid[])
      INTO v_conflict_case_ids
    FROM public.cases c
    JOIN public.case_collaborators cc ON cc.case_id = c.id
    WHERE c.id = ANY(v_candidate_cases)
      AND cc.abogado_id <> v_target_profile.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.org_members m
        WHERE m.organization_id = p_new_org_id
          AND m.user_id = cc.abogado_id
      );
  END IF;

  -- Casos a mover.
  SELECT COALESCE(array_agg(x.case_id), '{}'::uuid[])
    INTO v_move_case_ids
  FROM (
    SELECT unnest(v_candidate_cases) AS case_id
    EXCEPT
    SELECT unnest(v_conflict_case_ids) AS case_id
  ) x;

  v_skipped_cases_count := COALESCE(array_length(v_conflict_case_ids, 1), 0);

  -- Move cases -> org destino.
  UPDATE public.cases
    SET organization_id = p_new_org_id
  WHERE id = ANY(v_move_case_ids);

  GET DIAGNOSTICS v_moved_cases_count = ROW_COUNT;

  -- Sincroniza org_id en tablas dependientes por case_id (aunque tengan trigger, esto cubre cambios por traslado).
  UPDATE public.case_stages SET organization_id = p_new_org_id WHERE case_id = ANY(v_move_case_ids);
  UPDATE public.notes SET organization_id = p_new_org_id WHERE case_id = ANY(v_move_case_ids);
  UPDATE public.documents SET organization_id = p_new_org_id WHERE case_id = ANY(v_move_case_ids);
  UPDATE public.info_requests SET organization_id = p_new_org_id WHERE case_id = ANY(v_move_case_ids);
  UPDATE public.case_clients SET organization_id = p_new_org_id WHERE case_id = ANY(v_move_case_ids);
  UPDATE public.case_collaborators SET organization_id = p_new_org_id WHERE case_id = ANY(v_move_case_ids);
  UPDATE public.portal_tokens SET organization_id = p_new_org_id WHERE case_id = ANY(v_move_case_ids);
  UPDATE public.magic_links SET organization_id = p_new_org_id WHERE case_id = ANY(v_move_case_ids);
  UPDATE public.case_messages SET organization_id = p_new_org_id WHERE case_id = ANY(v_move_case_ids);
  UPDATE public.case_counterparties SET organization_id = p_new_org_id WHERE case_id = ANY(v_move_case_ids);
  UPDATE public.case_lawyer_checklist_items SET organization_id = p_new_org_id WHERE case_id = ANY(v_move_case_ids);
  UPDATE public.billing_account_cases SET organization_id = p_new_org_id WHERE case_id = ANY(v_move_case_ids);

  IF to_regclass('public.case_external_refs') IS NOT NULL THEN
    EXECUTE 'UPDATE public.case_external_refs SET organization_id = $1 WHERE case_id = ANY($2)'
      USING p_new_org_id, v_move_case_ids;
  END IF;
  IF to_regclass('public.case_events') IS NOT NULL THEN
    EXECUTE 'UPDATE public.case_events SET organization_id = $1 WHERE case_id = ANY($2)'
      USING p_new_org_id, v_move_case_ids;
  END IF;

  -- Billing: mueve billing_accounts solo si todos sus casos quedaron en el org destino.
  UPDATE public.billing_accounts a
    SET organization_id = p_new_org_id
  WHERE EXISTS (
      SELECT 1 FROM public.billing_account_cases bac
      WHERE bac.billing_account_id = a.id
        AND bac.case_id = ANY(v_move_case_ids)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.billing_account_cases bac
      JOIN public.cases c ON c.id = bac.case_id
      WHERE bac.billing_account_id = a.id
        AND c.organization_id <> p_new_org_id
    );

  -- Payments: org_id se deriva por trigger, pero actualizamos por consistencia.
  UPDATE public.billing_payments p
    SET organization_id = a.organization_id
  FROM public.billing_accounts a
  WHERE p.billing_account_id = a.id
    AND p.billing_account_id IN (
      SELECT DISTINCT bac.billing_account_id
      FROM public.billing_account_cases bac
      WHERE bac.case_id = ANY(v_move_case_ids)
    );

  -- Clientes candidatos: clientes vinculados a casos movidos (case_clients + cliente_principal_id).
  SELECT COALESCE(array_agg(DISTINCT client_id), '{}'::uuid[])
    INTO v_candidate_client_ids
  FROM (
    SELECT cc.client_profile_id AS client_id
    FROM public.case_clients cc
    WHERE cc.case_id = ANY(v_move_case_ids)
    UNION
    SELECT c.cliente_principal_id AS client_id
    FROM public.cases c
    WHERE c.id = ANY(v_move_case_ids)
      AND c.cliente_principal_id IS NOT NULL
  ) q;

  -- Conflicto cliente: tiene casos en otros orgs distintos al destino.
  IF upper(v_mode) = 'A' THEN
    SELECT COALESCE(array_agg(DISTINCT p.id), '{}'::uuid[])
      INTO v_conflict_client_ids
    FROM public.profiles p
    WHERE p.id = ANY(v_candidate_client_ids)
      AND EXISTS (
        SELECT 1
        FROM public.case_clients cc
        JOIN public.cases c ON c.id = cc.case_id
        WHERE cc.client_profile_id = p.id
          AND c.organization_id <> p_new_org_id
      );
  END IF;

  SELECT COALESCE(array_agg(x.client_id), '{}'::uuid[])
    INTO v_move_client_ids
  FROM (
    SELECT unnest(v_candidate_client_ids) AS client_id
    EXCEPT
    SELECT unnest(v_conflict_client_ids) AS client_id
  ) x;

  -- Mueve "org del cliente" (solo clientes) en modo A, evitando conflictos.
  UPDATE public.profiles
    SET organization_id = p_new_org_id
  WHERE id = ANY(v_move_client_ids)
    AND role = 'cliente';

  GET DIAGNOSTICS v_moved_clients_count = ROW_COUNT;

  v_details := jsonb_build_object(
    'mode', v_mode,
    'candidate_cases', COALESCE(array_length(v_candidate_cases, 1), 0),
    'moved_cases', v_moved_cases_count,
    'skipped_cases', v_skipped_cases_count,
    'candidate_clients', COALESCE(array_length(v_candidate_client_ids, 1), 0),
    'moved_clients', v_moved_clients_count,
    'conflict_cases', COALESCE(array_length(v_conflict_case_ids, 1), 0),
    'conflict_clients', COALESCE(array_length(v_conflict_client_ids, 1), 0)
  );

  INSERT INTO public.org_transfer_log (
    moved_by,
    moved_user_id,
    from_organization_id,
    to_organization_id,
    mode,
    moved_cases_count,
    moved_clients_count,
    skipped_cases_count,
    conflict_case_ids,
    conflict_client_ids,
    details
  ) VALUES (
    v_caller,
    v_target_profile.user_id,
    v_old_org,
    p_new_org_id,
    v_mode,
    v_moved_cases_count,
    v_moved_clients_count,
    v_skipped_cases_count,
    v_conflict_case_ids,
    v_conflict_client_ids,
    v_details
  );

  RETURN jsonb_build_object(
    'ok', true,
    'moved_cases_count', v_moved_cases_count,
    'moved_clients_count', v_moved_clients_count,
    'skipped_cases_count', v_skipped_cases_count,
    'conflict_case_ids', v_conflict_case_ids,
    'conflict_client_ids', v_conflict_client_ids,
    'from_organization_id', v_old_org,
    'to_organization_id', p_new_org_id,
    'mode', v_mode
  );
END;
$$;

COMMIT;
