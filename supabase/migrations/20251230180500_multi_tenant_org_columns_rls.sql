BEGIN;

-- ---------------------------------------------------------------------------
-- Multi-tenant columns + org-aware RLS
-- - Adds organization_id to business tables
-- - Backfills using default org
-- - Sync triggers for case-linked tables
-- - Tightens RLS to ensure true tenant isolation
-- ---------------------------------------------------------------------------

-- Effective org id (fallback for contexts where current_org_id() is null).
CREATE OR REPLACE FUNCTION public.effective_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(public.current_org_id(), public.default_organization_id());
$$;

-- ---------------------------------------------------------------------------
-- Columns: add organization_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.case_stages
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.info_requests
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.case_clients
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.case_collaborators
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.portal_tokens
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.magic_links
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.case_messages
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.case_counterparties
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.case_lawyer_checklist_items
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.billing_accounts
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.billing_account_cases
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.legal_templates
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.quick_links
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Tablas creadas sin RLS anteriormente
ALTER TABLE IF EXISTS public.case_external_refs
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE IF EXISTS public.case_events
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_default_org UUID;
BEGIN
  v_default_org := public.default_organization_id();

  -- Base: casos
  UPDATE public.cases
    SET organization_id = v_default_org
  WHERE organization_id IS NULL;

  -- Derivadas desde case_id
  UPDATE public.case_stages cs
    SET organization_id = c.organization_id
  FROM public.cases c
  WHERE cs.case_id = c.id
    AND cs.organization_id IS NULL;

  UPDATE public.notes n
    SET organization_id = c.organization_id
  FROM public.cases c
  WHERE n.case_id = c.id
    AND n.organization_id IS NULL;

  UPDATE public.documents d
    SET organization_id = c.organization_id
  FROM public.cases c
  WHERE d.case_id = c.id
    AND d.organization_id IS NULL;

  UPDATE public.info_requests ir
    SET organization_id = c.organization_id
  FROM public.cases c
  WHERE ir.case_id = c.id
    AND ir.organization_id IS NULL;

  UPDATE public.case_clients cc
    SET organization_id = c.organization_id
  FROM public.cases c
  WHERE cc.case_id = c.id
    AND cc.organization_id IS NULL;

  UPDATE public.case_collaborators coll
    SET organization_id = c.organization_id
  FROM public.cases c
  WHERE coll.case_id = c.id
    AND coll.organization_id IS NULL;

  UPDATE public.portal_tokens pt
    SET organization_id = c.organization_id
  FROM public.cases c
  WHERE pt.case_id = c.id
    AND pt.organization_id IS NULL;

  UPDATE public.magic_links ml
    SET organization_id = c.organization_id
  FROM public.cases c
  WHERE ml.case_id = c.id
    AND ml.organization_id IS NULL;

  UPDATE public.case_messages m
    SET organization_id = c.organization_id
  FROM public.cases c
  WHERE m.case_id = c.id
    AND m.organization_id IS NULL;

  UPDATE public.case_counterparties cp
    SET organization_id = c.organization_id
  FROM public.cases c
  WHERE cp.case_id = c.id
    AND cp.organization_id IS NULL;

  UPDATE public.case_lawyer_checklist_items cli
    SET organization_id = c.organization_id
  FROM public.cases c
  WHERE cli.case_id = c.id
    AND cli.organization_id IS NULL;

  -- Nuevas tablas sin RLS
  IF to_regclass('public.case_external_refs') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.case_external_refs r
        SET organization_id = c.organization_id
      FROM public.cases c
      WHERE r.case_id = c.id
        AND r.organization_id IS NULL
    $sql$;
  END IF;

  IF to_regclass('public.case_events') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.case_events e
        SET organization_id = c.organization_id
      FROM public.cases c
      WHERE e.case_id = c.id
        AND e.organization_id IS NULL
    $sql$;
  END IF;

  -- billing_accounts: asignar default por ahora (se mantiene por org_id en links/triggers).
  UPDATE public.billing_accounts
    SET organization_id = v_default_org
  WHERE organization_id IS NULL;

  -- billing_account_cases: org desde caso
  UPDATE public.billing_account_cases bac
    SET organization_id = c.organization_id
  FROM public.cases c
  WHERE bac.case_id = c.id
    AND bac.organization_id IS NULL;

  -- billing_payments: org desde billing_account
  UPDATE public.billing_payments p
    SET organization_id = a.organization_id
  FROM public.billing_accounts a
  WHERE p.billing_account_id = a.id
    AND p.organization_id IS NULL;

  -- templates/links: default
  UPDATE public.legal_templates
    SET organization_id = v_default_org
  WHERE organization_id IS NULL;

  UPDATE public.quick_links
    SET organization_id = v_default_org
  WHERE organization_id IS NULL;

  -- audit_log: default (MVP). La app lo setea a futuro.
  UPDATE public.audit_log
    SET organization_id = v_default_org
  WHERE organization_id IS NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Defaults + NOT NULL + indexes
-- ---------------------------------------------------------------------------

ALTER TABLE public.cases
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.case_stages
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.notes
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.documents
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.info_requests
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.case_clients
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.case_collaborators
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.portal_tokens
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.magic_links
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.case_messages
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.case_counterparties
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.case_lawyer_checklist_items
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.billing_accounts
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.billing_account_cases
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.billing_payments
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.legal_templates
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.quick_links
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.audit_log
  ALTER COLUMN organization_id SET DEFAULT public.effective_org_id(),
  ALTER COLUMN organization_id SET NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.case_external_refs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.case_external_refs ALTER COLUMN organization_id SET DEFAULT public.effective_org_id()';
    EXECUTE 'ALTER TABLE public.case_external_refs ALTER COLUMN organization_id SET NOT NULL';
  END IF;
  IF to_regclass('public.case_events') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.case_events ALTER COLUMN organization_id SET DEFAULT public.effective_org_id()';
    EXECUTE 'ALTER TABLE public.case_events ALTER COLUMN organization_id SET NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cases_org_id_idx ON public.cases(organization_id);
CREATE INDEX IF NOT EXISTS case_stages_org_id_idx ON public.case_stages(organization_id);
CREATE INDEX IF NOT EXISTS notes_org_id_idx ON public.notes(organization_id);
CREATE INDEX IF NOT EXISTS documents_org_id_idx ON public.documents(organization_id);
CREATE INDEX IF NOT EXISTS info_requests_org_id_idx ON public.info_requests(organization_id);
CREATE INDEX IF NOT EXISTS case_clients_org_id_idx ON public.case_clients(organization_id);
CREATE INDEX IF NOT EXISTS case_collaborators_org_id_idx ON public.case_collaborators(organization_id);
CREATE INDEX IF NOT EXISTS portal_tokens_org_id_idx ON public.portal_tokens(organization_id);
CREATE INDEX IF NOT EXISTS magic_links_org_id_idx ON public.magic_links(organization_id);
CREATE INDEX IF NOT EXISTS case_messages_org_id_idx ON public.case_messages(organization_id);
CREATE INDEX IF NOT EXISTS case_counterparties_org_id_idx ON public.case_counterparties(organization_id);
CREATE INDEX IF NOT EXISTS case_lawyer_checklist_org_id_idx ON public.case_lawyer_checklist_items(organization_id);
CREATE INDEX IF NOT EXISTS billing_accounts_org_id_idx ON public.billing_accounts(organization_id);
CREATE INDEX IF NOT EXISTS billing_account_cases_org_id_idx ON public.billing_account_cases(organization_id);
CREATE INDEX IF NOT EXISTS billing_payments_org_id_idx ON public.billing_payments(organization_id);
CREATE INDEX IF NOT EXISTS legal_templates_org_id_idx ON public.legal_templates(organization_id);
CREATE INDEX IF NOT EXISTS quick_links_org_id_idx ON public.quick_links(organization_id);
CREATE INDEX IF NOT EXISTS audit_log_org_id_idx ON public.audit_log(organization_id);

-- ---------------------------------------------------------------------------
-- Triggers: sync org from case / billing account
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_sync_org_id_from_case()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.case_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.organization_id INTO NEW.organization_id
  FROM public.cases c
  WHERE c.id = NEW.case_id;

  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo derivar organization_id desde case_id=%', NEW.case_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Aplica a tablas con case_id.
DROP TRIGGER IF EXISTS trg_case_stages_org_sync ON public.case_stages;
CREATE TRIGGER trg_case_stages_org_sync
  BEFORE INSERT OR UPDATE OF case_id ON public.case_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_org_id_from_case();

DROP TRIGGER IF EXISTS trg_notes_org_sync ON public.notes;
CREATE TRIGGER trg_notes_org_sync
  BEFORE INSERT OR UPDATE OF case_id ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_org_id_from_case();

DROP TRIGGER IF EXISTS trg_documents_org_sync ON public.documents;
CREATE TRIGGER trg_documents_org_sync
  BEFORE INSERT OR UPDATE OF case_id ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_org_id_from_case();

DROP TRIGGER IF EXISTS trg_info_requests_org_sync ON public.info_requests;
CREATE TRIGGER trg_info_requests_org_sync
  BEFORE INSERT OR UPDATE OF case_id ON public.info_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_org_id_from_case();

DROP TRIGGER IF EXISTS trg_case_clients_org_sync ON public.case_clients;
CREATE TRIGGER trg_case_clients_org_sync
  BEFORE INSERT OR UPDATE OF case_id ON public.case_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_org_id_from_case();

DROP TRIGGER IF EXISTS trg_case_collaborators_org_sync ON public.case_collaborators;
CREATE TRIGGER trg_case_collaborators_org_sync
  BEFORE INSERT OR UPDATE OF case_id ON public.case_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_org_id_from_case();

DROP TRIGGER IF EXISTS trg_portal_tokens_org_sync ON public.portal_tokens;
CREATE TRIGGER trg_portal_tokens_org_sync
  BEFORE INSERT OR UPDATE OF case_id ON public.portal_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_org_id_from_case();

DROP TRIGGER IF EXISTS trg_magic_links_org_sync ON public.magic_links;
CREATE TRIGGER trg_magic_links_org_sync
  BEFORE INSERT OR UPDATE OF case_id ON public.magic_links
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_org_id_from_case();

DROP TRIGGER IF EXISTS trg_case_messages_org_sync ON public.case_messages;
CREATE TRIGGER trg_case_messages_org_sync
  BEFORE INSERT OR UPDATE OF case_id ON public.case_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_org_id_from_case();

DROP TRIGGER IF EXISTS trg_case_counterparties_org_sync ON public.case_counterparties;
CREATE TRIGGER trg_case_counterparties_org_sync
  BEFORE INSERT OR UPDATE OF case_id ON public.case_counterparties
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_org_id_from_case();

DROP TRIGGER IF EXISTS trg_case_lawyer_checklist_org_sync ON public.case_lawyer_checklist_items;
CREATE TRIGGER trg_case_lawyer_checklist_org_sync
  BEFORE INSERT OR UPDATE OF case_id ON public.case_lawyer_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_org_id_from_case();

DROP TRIGGER IF EXISTS trg_billing_account_cases_org_sync ON public.billing_account_cases;
CREATE TRIGGER trg_billing_account_cases_org_sync
  BEFORE INSERT OR UPDATE OF case_id ON public.billing_account_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_org_id_from_case();

DO $$
BEGIN
  IF to_regclass('public.case_external_refs') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_case_external_refs_org_sync ON public.case_external_refs';
    EXECUTE 'CREATE TRIGGER trg_case_external_refs_org_sync
      BEFORE INSERT OR UPDATE OF case_id ON public.case_external_refs
      FOR EACH ROW EXECUTE FUNCTION public.trg_sync_org_id_from_case()';
  END IF;
  IF to_regclass('public.case_events') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_case_events_org_sync ON public.case_events';
    EXECUTE 'CREATE TRIGGER trg_case_events_org_sync
      BEFORE INSERT OR UPDATE OF case_id ON public.case_events
      FOR EACH ROW EXECUTE FUNCTION public.trg_sync_org_id_from_case()';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_sync_org_id_from_billing_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.billing_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.organization_id INTO NEW.organization_id
  FROM public.billing_accounts a
  WHERE a.id = NEW.billing_account_id;

  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo derivar organization_id desde billing_account_id=%', NEW.billing_account_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_payments_org_sync ON public.billing_payments;
CREATE TRIGGER trg_billing_payments_org_sync
  BEFORE INSERT OR UPDATE OF billing_account_id ON public.billing_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_org_id_from_billing_account();

-- Enforce: billing_account_cases solo puede vincular casos de la misma org del billing_account.
CREATE OR REPLACE FUNCTION public.trg_billing_account_cases_enforce_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_org UUID;
  v_account_org UUID;
BEGIN
  SELECT c.organization_id INTO v_case_org
  FROM public.cases c
  WHERE c.id = NEW.case_id;

  SELECT a.organization_id INTO v_account_org
  FROM public.billing_accounts a
  WHERE a.id = NEW.billing_account_id;

  IF v_case_org IS NULL OR v_account_org IS NULL THEN
    RAISE EXCEPTION 'No se pudo validar org (case_org=%, account_org=%)', v_case_org, v_account_org;
  END IF;

  IF v_case_org <> v_account_org THEN
    RAISE EXCEPTION 'No se puede vincular billing_account de org % con case de org %', v_account_org, v_case_org;
  END IF;

  NEW.organization_id := v_case_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_account_cases_enforce_org ON public.billing_account_cases;
CREATE TRIGGER trg_billing_account_cases_enforce_org
  BEFORE INSERT OR UPDATE OF billing_account_id, case_id ON public.billing_account_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_billing_account_cases_enforce_org();

-- ---------------------------------------------------------------------------
-- Org-aware access: has_case_access()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_case_access(case_uuid UUID)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

-- ---------------------------------------------------------------------------
-- Tighten profiles RLS (evitar fuga cross-org)
-- ---------------------------------------------------------------------------

-- Reemplaza políticas existentes demasiado permisivas.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Ver perfil propio / super_admin / miembros del org activo (incluye abogados del org) / clientes del org activo.
CREATE POLICY "profiles_select_scoped" ON public.profiles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR (
      public.current_org_id() IS NOT NULL
      AND (
        -- miembros internos del org activo (cualquier rol org)
        EXISTS (
          SELECT 1
          FROM public.org_members m
          WHERE m.organization_id = public.current_org_id()
            AND m.user_id = profiles.user_id
        )
        -- clientes del org activo
        OR (profiles.role = 'cliente' AND profiles.organization_id = public.current_org_id())
      )
    )
  );

-- Updates: el usuario puede actualizar su fila, pero no puede setear active_organization_id fuera de sus orgs.
CREATE POLICY "profiles_update_self_scoped" ON public.profiles
  FOR UPDATE
  USING (user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (
    (user_id = auth.uid() OR public.is_super_admin())
    AND (
      active_organization_id IS NULL
      OR public.has_org_access(active_organization_id)
    )
  );

-- Insert solo super_admin (service_role bypassa RLS igualmente).
DROP POLICY IF EXISTS "profiles_insert_super_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_client_self" ON public.profiles;

-- Cliente: puede crear su propio perfil mínimo (evita romper onboarding / ensureProfile()).
CREATE POLICY "profiles_insert_client_self" ON public.profiles
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND id = auth.uid()
    AND role = 'cliente'
    AND (organization_id IS NULL OR organization_id = public.default_organization_id())
  );

CREATE POLICY "profiles_insert_super_admin" ON public.profiles
  FOR INSERT
  WITH CHECK (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Cases RLS: sustituir por políticas org-aware
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can view all cases" ON public.cases;
DROP POLICY IF EXISTS "Abogados y analistas pueden ver casos asignados" ON public.cases;
DROP POLICY IF EXISTS "Clientes can view their cases" ON public.cases;
DROP POLICY IF EXISTS "Admins and abogados can insert cases" ON public.cases;
DROP POLICY IF EXISTS "Admins can update all cases" ON public.cases;
DROP POLICY IF EXISTS "Abogados can update their assigned cases" ON public.cases;

CREATE POLICY "cases_select_scoped" ON public.cases
  FOR SELECT USING (public.has_case_access(id));

CREATE POLICY "cases_insert_scoped" ON public.cases
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (
      (public.get_current_profile()).role IN ('admin_firma', 'abogado', 'analista')
      AND organization_id = public.current_org_id()
      AND public.has_org_access(organization_id)
      AND (
        cliente_principal_id IS NULL OR EXISTS (
          SELECT 1
          FROM public.profiles cp
          WHERE cp.id = cliente_principal_id
            AND cp.role = 'cliente'
            AND cp.organization_id = cases.organization_id
        )
      )
    )
  );

CREATE POLICY "cases_update_scoped" ON public.cases
  FOR UPDATE USING (
    public.is_super_admin()
    OR (
      (public.get_current_profile()).role IN ('admin_firma', 'abogado', 'analista')
      AND public.has_case_access(id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      (public.get_current_profile()).role IN ('admin_firma', 'abogado', 'analista')
      AND organization_id = public.current_org_id()
      AND public.has_case_access(id)
    )
  );

-- ---------------------------------------------------------------------------
-- Case-linked tables: enforce org scoping for admin-role shortcuts
-- ---------------------------------------------------------------------------

-- case_clients: recrear policies (varias migraciones agregaron policies acumuladas).
DROP POLICY IF EXISTS "Admins can view all case-client mappings" ON public.case_clients;
DROP POLICY IF EXISTS "Abogados can view mappings for their cases" ON public.case_clients;
DROP POLICY IF EXISTS "Clientes can view their own mappings" ON public.case_clients;
DROP POLICY IF EXISTS "Admins and abogados can insert case-client mappings" ON public.case_clients;
DROP POLICY IF EXISTS "Admins and abogados can update case-client mappings" ON public.case_clients;
DROP POLICY IF EXISTS "Analistas can insert case-client mappings" ON public.case_clients;
DROP POLICY IF EXISTS "Analistas can update case-client mappings" ON public.case_clients;

DROP POLICY IF EXISTS "case_clients_select_staff" ON public.case_clients;
CREATE POLICY "case_clients_select_staff" ON public.case_clients
  FOR SELECT USING (
    (public.get_current_profile()).role IN ('admin_firma', 'abogado', 'analista')
    AND public.has_case_access(case_id)
  );

DROP POLICY IF EXISTS "case_clients_select_client" ON public.case_clients;
CREATE POLICY "case_clients_select_client" ON public.case_clients
  FOR SELECT USING (
    (public.get_current_profile()).role = 'cliente'
    AND client_profile_id = (SELECT id FROM public.get_current_profile())
  );

DROP POLICY IF EXISTS "case_clients_insert_staff" ON public.case_clients;
CREATE POLICY "case_clients_insert_staff" ON public.case_clients
  FOR INSERT WITH CHECK (
    (public.get_current_profile()).role IN ('admin_firma', 'abogado', 'analista')
    AND public.has_case_access(case_id)
  );

DROP POLICY IF EXISTS "case_clients_update_staff" ON public.case_clients;
CREATE POLICY "case_clients_update_staff" ON public.case_clients
  FOR UPDATE USING (
    (public.get_current_profile()).role IN ('admin_firma', 'abogado', 'analista')
    AND public.has_case_access(case_id)
  ) WITH CHECK (
    (public.get_current_profile()).role IN ('admin_firma', 'abogado', 'analista')
    AND public.has_case_access(case_id)
  );

DROP POLICY IF EXISTS "case_clients_delete_staff" ON public.case_clients;
CREATE POLICY "case_clients_delete_staff" ON public.case_clients
  FOR DELETE USING (
    (public.get_current_profile()).role IN ('admin_firma', 'abogado', 'analista')
    AND public.has_case_access(case_id)
  );

-- portal_tokens: agregar has_case_access a selects (antes era is_admin/is_abogado sin caso).
DROP POLICY IF EXISTS "Only admins and abogados can view portal tokens" ON public.portal_tokens;
DROP POLICY IF EXISTS "Only admins and abogados can insert portal tokens" ON public.portal_tokens;
DROP POLICY IF EXISTS "Only admins and abogados can update portal tokens" ON public.portal_tokens;

CREATE POLICY "portal_tokens_select_scoped" ON public.portal_tokens
  FOR SELECT USING (
    public.is_super_admin()
    OR ((public.get_current_profile()).role IN ('admin_firma','abogado','analista') AND public.has_case_access(case_id))
  );

CREATE POLICY "portal_tokens_insert_scoped" ON public.portal_tokens
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR ((public.get_current_profile()).role IN ('admin_firma','abogado','analista') AND public.has_case_access(case_id))
  );

CREATE POLICY "portal_tokens_update_scoped" ON public.portal_tokens
  FOR UPDATE USING (
    public.is_super_admin()
    OR ((public.get_current_profile()).role IN ('admin_firma','abogado','analista') AND public.has_case_access(case_id))
  ) WITH CHECK (
    public.is_super_admin()
    OR ((public.get_current_profile()).role IN ('admin_firma','abogado','analista') AND public.has_case_access(case_id))
  );

-- magic_links: no tenía policies; habilitamos mínimo para staff (por caso) y cliente (por email/token via service).
ALTER TABLE public.magic_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "magic_links_select_staff" ON public.magic_links;
CREATE POLICY "magic_links_select_staff" ON public.magic_links
  FOR SELECT USING (
    public.is_super_admin()
    OR ((public.get_current_profile()).role IN ('admin_firma','abogado','analista') AND public.has_case_access(case_id))
  );

DROP POLICY IF EXISTS "magic_links_insert_staff" ON public.magic_links;
CREATE POLICY "magic_links_insert_staff" ON public.magic_links
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR ((public.get_current_profile()).role IN ('admin_firma','abogado','analista') AND public.has_case_access(case_id))
  );

DROP POLICY IF EXISTS "magic_links_update_staff" ON public.magic_links;
CREATE POLICY "magic_links_update_staff" ON public.magic_links
  FOR UPDATE USING (
    public.is_super_admin()
    OR ((public.get_current_profile()).role IN ('admin_firma','abogado','analista') AND public.has_case_access(case_id))
  ) WITH CHECK (
    public.is_super_admin()
    OR ((public.get_current_profile()).role IN ('admin_firma','abogado','analista') AND public.has_case_access(case_id))
  );

-- ---------------------------------------------------------------------------
-- Org-aware RLS for per-org resources (legal_templates / quick_links / billing / audit_log)
-- ---------------------------------------------------------------------------

-- legal_templates
DROP POLICY IF EXISTS "Templates visibles por abogados y admin" ON public.legal_templates;
DROP POLICY IF EXISTS "Solo admin crea plantillas compartidas" ON public.legal_templates;
DROP POLICY IF EXISTS "Autor o admin actualiza" ON public.legal_templates;
DROP POLICY IF EXISTS "Autor o admin elimina" ON public.legal_templates;

CREATE POLICY "legal_templates_select_scoped" ON public.legal_templates
  FOR SELECT USING (
    public.is_super_admin()
    OR (organization_id = public.current_org_id() AND (public.get_current_profile()).role IN ('admin_firma','abogado','analista'))
  );

CREATE POLICY "legal_templates_insert_scoped" ON public.legal_templates
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (
      organization_id = public.current_org_id()
      AND (public.get_current_profile()).role IN ('admin_firma','abogado','analista')
      AND (
        (public.get_current_profile()).role = 'admin_firma'
        OR is_shared = false
      )
    )
  );

CREATE POLICY "legal_templates_update_scoped" ON public.legal_templates
  FOR UPDATE USING (
    public.is_super_admin()
    OR (
      organization_id = public.current_org_id()
      AND ((public.get_current_profile()).role = 'admin_firma' OR created_by = auth.uid())
    )
  ) WITH CHECK (
    public.is_super_admin()
    OR (organization_id = public.current_org_id())
  );

CREATE POLICY "legal_templates_delete_scoped" ON public.legal_templates
  FOR DELETE USING (
    public.is_super_admin()
    OR (
      organization_id = public.current_org_id()
      AND ((public.get_current_profile()).role = 'admin_firma' OR created_by = auth.uid())
    )
  );

-- quick_links
DROP POLICY IF EXISTS "Abogados y admin ven enlaces" ON public.quick_links;
DROP POLICY IF EXISTS "Abogados y admin crean enlaces" ON public.quick_links;
DROP POLICY IF EXISTS "Autor o admin gestiona" ON public.quick_links;
DROP POLICY IF EXISTS "Autor o admin elimina" ON public.quick_links;

CREATE POLICY "quick_links_select_scoped" ON public.quick_links
  FOR SELECT USING (
    public.is_super_admin()
    OR (organization_id = public.current_org_id() AND (public.get_current_profile()).role IN ('admin_firma','abogado','analista'))
  );

CREATE POLICY "quick_links_insert_scoped" ON public.quick_links
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (
      organization_id = public.current_org_id()
      AND (public.get_current_profile()).role IN ('admin_firma','abogado','analista')
    )
  );

CREATE POLICY "quick_links_update_scoped" ON public.quick_links
  FOR UPDATE USING (
    public.is_super_admin()
    OR (
      organization_id = public.current_org_id()
      AND (created_by = auth.uid() OR (public.get_current_profile()).role = 'admin_firma')
    )
  ) WITH CHECK (
    public.is_super_admin()
    OR (organization_id = public.current_org_id())
  );

CREATE POLICY "quick_links_delete_scoped" ON public.quick_links
  FOR DELETE USING (
    public.is_super_admin()
    OR (
      organization_id = public.current_org_id()
      AND (created_by = auth.uid() OR (public.get_current_profile()).role = 'admin_firma')
    )
  );

-- billing_* : reemplazar policies para que "admin" no vea cross-org.
DROP POLICY IF EXISTS "Billing accounts: select for linked cases" ON public.billing_accounts;
DROP POLICY IF EXISTS "Billing accounts: staff can insert" ON public.billing_accounts;
DROP POLICY IF EXISTS "Billing accounts: staff can update linked" ON public.billing_accounts;
DROP POLICY IF EXISTS "Billing accounts: staff can delete linked" ON public.billing_accounts;

CREATE POLICY "billing_accounts_select_scoped" ON public.billing_accounts
  FOR SELECT USING (
    public.is_super_admin()
    OR (organization_id = public.current_org_id() AND (public.get_current_profile()).role IN ('admin_firma','abogado','analista'))
    OR EXISTS (
      SELECT 1
      FROM public.billing_account_cases bac
      WHERE bac.billing_account_id = billing_accounts.id
        AND public.has_case_access(bac.case_id)
    )
  );

CREATE POLICY "billing_accounts_insert_scoped" ON public.billing_accounts
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (
      organization_id = public.current_org_id()
      AND (public.get_current_profile()).role IN ('admin_firma','abogado','analista')
    )
  );

CREATE POLICY "billing_accounts_update_scoped" ON public.billing_accounts
  FOR UPDATE USING (
    public.is_super_admin()
    OR (organization_id = public.current_org_id() AND (public.get_current_profile()).role IN ('admin_firma','abogado','analista'))
  ) WITH CHECK (
    public.is_super_admin()
    OR (organization_id = public.current_org_id())
  );

CREATE POLICY "billing_accounts_delete_scoped" ON public.billing_accounts
  FOR DELETE USING (
    public.is_super_admin()
    OR (organization_id = public.current_org_id() AND (public.get_current_profile()).role IN ('admin_firma','abogado','analista'))
  );

DROP POLICY IF EXISTS "Billing links: select for case access" ON public.billing_account_cases;
DROP POLICY IF EXISTS "Billing links: staff insert for case access" ON public.billing_account_cases;
DROP POLICY IF EXISTS "Billing links: staff update for case access" ON public.billing_account_cases;
DROP POLICY IF EXISTS "Billing links: staff delete for case access" ON public.billing_account_cases;

CREATE POLICY "billing_account_cases_select_scoped" ON public.billing_account_cases
  FOR SELECT USING (public.is_super_admin() OR public.has_case_access(case_id));

CREATE POLICY "billing_account_cases_insert_scoped" ON public.billing_account_cases
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR ((public.get_current_profile()).role IN ('admin_firma','abogado','analista') AND public.has_case_access(case_id))
  );

CREATE POLICY "billing_account_cases_update_scoped" ON public.billing_account_cases
  FOR UPDATE USING (
    public.is_super_admin()
    OR ((public.get_current_profile()).role IN ('admin_firma','abogado','analista') AND public.has_case_access(case_id))
  ) WITH CHECK (
    public.is_super_admin()
    OR ((public.get_current_profile()).role IN ('admin_firma','abogado','analista') AND public.has_case_access(case_id))
  );

CREATE POLICY "billing_account_cases_delete_scoped" ON public.billing_account_cases
  FOR DELETE USING (
    public.is_super_admin()
    OR ((public.get_current_profile()).role IN ('admin_firma','abogado','analista') AND public.has_case_access(case_id))
  );

DROP POLICY IF EXISTS "Billing payments: select for linked cases" ON public.billing_payments;
DROP POLICY IF EXISTS "Billing payments: staff insert for linked cases" ON public.billing_payments;
DROP POLICY IF EXISTS "Billing payments: staff update for linked cases" ON public.billing_payments;
DROP POLICY IF EXISTS "Billing payments: staff delete for linked cases" ON public.billing_payments;

CREATE POLICY "billing_payments_select_scoped" ON public.billing_payments
  FOR SELECT USING (
    public.is_super_admin()
    OR (organization_id = public.current_org_id() AND (public.get_current_profile()).role IN ('admin_firma','abogado','analista'))
    OR EXISTS (
      SELECT 1
      FROM public.billing_account_cases bac
      WHERE bac.billing_account_id = billing_payments.billing_account_id
        AND public.has_case_access(bac.case_id)
    )
  );

CREATE POLICY "billing_payments_insert_scoped" ON public.billing_payments
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (
      (public.get_current_profile()).role IN ('admin_firma','abogado','analista')
      AND EXISTS (
        SELECT 1
        FROM public.billing_account_cases bac
        WHERE bac.billing_account_id = billing_payments.billing_account_id
          AND public.has_case_access(bac.case_id)
      )
    )
  );

CREATE POLICY "billing_payments_update_scoped" ON public.billing_payments
  FOR UPDATE USING (
    public.is_super_admin()
    OR (
      (public.get_current_profile()).role IN ('admin_firma','abogado','analista')
      AND organization_id = public.current_org_id()
    )
  ) WITH CHECK (
    public.is_super_admin()
    OR (organization_id = public.current_org_id())
  );

CREATE POLICY "billing_payments_delete_scoped" ON public.billing_payments
  FOR DELETE USING (
    public.is_super_admin()
    OR (
      (public.get_current_profile()).role IN ('admin_firma','abogado','analista')
      AND organization_id = public.current_org_id()
    )
  );

-- audit_log: admin_firma ve solo su org; super_admin ve todo.
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "All authenticated users can insert audit logs" ON public.audit_log;

CREATE POLICY "audit_log_select_scoped" ON public.audit_log
  FOR SELECT USING (
    public.is_super_admin()
    OR (
      (public.get_current_profile()).role = 'admin_firma'
      AND organization_id = public.current_org_id()
    )
  );

CREATE POLICY "audit_log_insert_scoped" ON public.audit_log
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.is_super_admin()
      OR organization_id = public.current_org_id()
      OR organization_id = public.default_organization_id()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS faltante: case_external_refs / case_events / daily_statements_cache
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.case_external_refs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.case_external_refs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS case_external_refs_select_scoped ON public.case_external_refs';
    EXECUTE 'CREATE POLICY case_external_refs_select_scoped ON public.case_external_refs
      FOR SELECT USING (public.is_super_admin() OR public.has_case_access(case_id))';
    EXECUTE 'DROP POLICY IF EXISTS case_external_refs_write_scoped ON public.case_external_refs';
    EXECUTE 'CREATE POLICY case_external_refs_write_scoped ON public.case_external_refs
      FOR ALL USING ((public.get_current_profile()).role IN (''admin_firma'',''abogado'',''analista'') AND public.has_case_access(case_id))
      WITH CHECK ((public.get_current_profile()).role IN (''admin_firma'',''abogado'',''analista'') AND public.has_case_access(case_id))';
  END IF;

  IF to_regclass('public.case_events') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS case_events_select_scoped ON public.case_events';
    EXECUTE 'CREATE POLICY case_events_select_scoped ON public.case_events
      FOR SELECT USING (public.is_super_admin() OR public.has_case_access(case_id))';
    EXECUTE 'DROP POLICY IF EXISTS case_events_write_scoped ON public.case_events';
    EXECUTE 'CREATE POLICY case_events_write_scoped ON public.case_events
      FOR ALL USING ((public.get_current_profile()).role IN (''admin_firma'',''abogado'',''analista'') AND public.has_case_access(case_id))
      WITH CHECK ((public.get_current_profile()).role IN (''admin_firma'',''abogado'',''analista'') AND public.has_case_access(case_id))';
  END IF;
END $$;

-- daily_statements_cache: solo service_role y super_admin.
ALTER TABLE IF EXISTS public.daily_statements_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_statements_cache_access ON public.daily_statements_cache;
CREATE POLICY daily_statements_cache_access ON public.daily_statements_cache
  FOR ALL USING (
    public.is_super_admin()
    OR auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    public.is_super_admin()
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- notification_logs: endurecer a super_admin o service_role.
DROP POLICY IF EXISTS "notification_logs_admin_access" ON public.notification_logs;
CREATE POLICY "notification_logs_admin_access" ON public.notification_logs
  FOR ALL USING (
    public.is_super_admin()
    OR auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    public.is_super_admin()
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- ---------------------------------------------------------------------------
-- Hardening triggers (evita escalación por UPDATE de columnas sensibles)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_profiles_restrict_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- service_role / super_admin: permitido
  IF current_setting('app.org_transfer', true) = '1'
     OR auth.jwt() ->> 'role' = 'service_role'
     OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- Evita que un usuario cambie identidad/rol.
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'No se puede modificar profiles.id';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'No se puede modificar profiles.user_id';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'No se puede modificar profiles.role';
  END IF;

  -- Clientes no pueden mover su org.
  IF OLD.role = 'cliente' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'No se puede modificar organization_id del cliente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_restrict_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_profiles_restrict_sensitive_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_profiles_restrict_sensitive_fields();

CREATE OR REPLACE FUNCTION public.trg_cases_restrict_org_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    IF current_setting('app.org_transfer', true) = '1'
       OR auth.jwt() ->> 'role' = 'service_role'
       OR public.is_super_admin() THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'No se puede cambiar organization_id del caso fuera de transferencias controladas';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cases_restrict_org_change ON public.cases;
CREATE TRIGGER trg_cases_restrict_org_change
  BEFORE UPDATE OF organization_id ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_cases_restrict_org_change();

COMMIT;
