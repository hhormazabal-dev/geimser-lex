BEGIN;

-- ---------------------------------------------------------------------------
-- Compliance / Monitoring (DeepComply-like MVP)
-- - Subjects (RUTs) per organization
-- - Links between subjects and cases
-- - Snapshots (e.g. PJUD/OJV causes-per-legal-person) per case+subject
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compliance_subject_kind') THEN
    CREATE TYPE public.compliance_subject_kind AS ENUM ('client', 'counterparty', 'other');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.compliance_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rut TEXT NOT NULL,
  rut_normalized TEXT NOT NULL,
  display_name TEXT NOT NULL,
  kind public.compliance_subject_kind NOT NULL DEFAULT 'other',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, rut_normalized)
);

CREATE INDEX IF NOT EXISTS compliance_subjects_org_idx ON public.compliance_subjects(organization_id);
CREATE INDEX IF NOT EXISTS compliance_subjects_org_kind_idx ON public.compliance_subjects(organization_id, kind);
CREATE INDEX IF NOT EXISTS compliance_subjects_rut_norm_idx ON public.compliance_subjects(rut_normalized);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compliance_subjects_touch ON public.compliance_subjects;
CREATE TRIGGER trg_compliance_subjects_touch
BEFORE UPDATE ON public.compliance_subjects
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.compliance_subject_case_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.compliance_subjects(id) ON DELETE CASCADE,
  role TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, subject_id)
);

CREATE INDEX IF NOT EXISTS compliance_subject_case_links_case_idx ON public.compliance_subject_case_links(case_id);
CREATE INDEX IF NOT EXISTS compliance_subject_case_links_subject_idx ON public.compliance_subject_case_links(subject_id);
CREATE INDEX IF NOT EXISTS compliance_subject_case_links_org_idx ON public.compliance_subject_case_links(organization_id);

CREATE OR REPLACE FUNCTION public.set_compliance_link_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_case_org UUID;
  v_subject_org UUID;
BEGIN
  SELECT c.organization_id INTO v_case_org
  FROM public.cases c
  WHERE c.id = NEW.case_id;

  IF v_case_org IS NULL THEN
    RAISE EXCEPTION 'case.organization_id no puede ser NULL para compliance link';
  END IF;

  SELECT s.organization_id INTO v_subject_org
  FROM public.compliance_subjects s
  WHERE s.id = NEW.subject_id;

  IF v_subject_org IS NULL THEN
    RAISE EXCEPTION 'subject.organization_id no puede ser NULL para compliance link';
  END IF;

  IF v_subject_org <> v_case_org THEN
    RAISE EXCEPTION 'subject.organization_id (%) no coincide con case.organization_id (%)', v_subject_org, v_case_org;
  END IF;

  NEW.organization_id = v_case_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compliance_link_org_id ON public.compliance_subject_case_links;
CREATE TRIGGER trg_compliance_link_org_id
BEFORE INSERT OR UPDATE OF case_id, subject_id ON public.compliance_subject_case_links
FOR EACH ROW
EXECUTE FUNCTION public.set_compliance_link_org_id();

CREATE TABLE IF NOT EXISTS public.compliance_subject_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.compliance_subjects(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'pjud_ojv',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT NULL
);

CREATE INDEX IF NOT EXISTS compliance_subject_snapshots_case_idx ON public.compliance_subject_snapshots(case_id);
CREATE INDEX IF NOT EXISTS compliance_subject_snapshots_subject_idx ON public.compliance_subject_snapshots(subject_id);
CREATE INDEX IF NOT EXISTS compliance_subject_snapshots_case_subject_fetched_idx
  ON public.compliance_subject_snapshots(case_id, subject_id, fetched_at DESC);

CREATE OR REPLACE FUNCTION public.set_compliance_snapshot_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_case_org UUID;
  v_subject_org UUID;
BEGIN
  SELECT c.organization_id INTO v_case_org
  FROM public.cases c
  WHERE c.id = NEW.case_id;

  IF v_case_org IS NULL THEN
    RAISE EXCEPTION 'case.organization_id no puede ser NULL para compliance snapshot';
  END IF;

  SELECT s.organization_id INTO v_subject_org
  FROM public.compliance_subjects s
  WHERE s.id = NEW.subject_id;

  IF v_subject_org IS NULL THEN
    RAISE EXCEPTION 'subject.organization_id no puede ser NULL para compliance snapshot';
  END IF;

  IF v_subject_org <> v_case_org THEN
    RAISE EXCEPTION 'subject.organization_id (%) no coincide con case.organization_id (%)', v_subject_org, v_case_org;
  END IF;

  NEW.organization_id = v_case_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compliance_snapshot_org_id ON public.compliance_subject_snapshots;
CREATE TRIGGER trg_compliance_snapshot_org_id
BEFORE INSERT OR UPDATE OF case_id, subject_id ON public.compliance_subject_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.set_compliance_snapshot_org_id();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.compliance_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_subject_case_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_subject_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_subjects_select ON public.compliance_subjects;
CREATE POLICY compliance_subjects_select ON public.compliance_subjects
  FOR SELECT USING (
    public.is_super_admin()
    OR public.has_org_access(organization_id)
    OR EXISTS (
      SELECT 1
      FROM public.compliance_subject_case_links l
      WHERE l.subject_id = compliance_subjects.id
        AND public.has_case_access(l.case_id)
    )
  );

DROP POLICY IF EXISTS compliance_subjects_write ON public.compliance_subjects;
CREATE POLICY compliance_subjects_write ON public.compliance_subjects
  FOR ALL USING (
    public.is_super_admin()
    OR (
      (public.get_current_profile()).role IN ('admin_firma', 'abogado', 'analista')
      AND public.has_org_access(organization_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      (public.get_current_profile()).role IN ('admin_firma', 'abogado', 'analista')
      AND public.has_org_access(organization_id)
    )
  );

DROP POLICY IF EXISTS compliance_links_select ON public.compliance_subject_case_links;
CREATE POLICY compliance_links_select ON public.compliance_subject_case_links
  FOR SELECT USING (
    public.is_super_admin()
    OR public.has_case_access(case_id)
  );

DROP POLICY IF EXISTS compliance_links_write ON public.compliance_subject_case_links;
CREATE POLICY compliance_links_write ON public.compliance_subject_case_links
  FOR ALL USING (
    public.is_super_admin()
    OR (
      (public.get_current_profile()).role IN ('admin_firma', 'abogado', 'analista')
      AND public.has_case_access(case_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      (public.get_current_profile()).role IN ('admin_firma', 'abogado', 'analista')
      AND public.has_case_access(case_id)
    )
  );

DROP POLICY IF EXISTS compliance_snapshots_select ON public.compliance_subject_snapshots;
CREATE POLICY compliance_snapshots_select ON public.compliance_subject_snapshots
  FOR SELECT USING (
    public.is_super_admin()
    OR public.has_case_access(case_id)
  );

DROP POLICY IF EXISTS compliance_snapshots_write ON public.compliance_subject_snapshots;
CREATE POLICY compliance_snapshots_write ON public.compliance_subject_snapshots
  FOR ALL USING (
    public.is_super_admin()
    OR (
      (public.get_current_profile()).role IN ('admin_firma', 'abogado', 'analista')
      AND public.has_case_access(case_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      (public.get_current_profile()).role IN ('admin_firma', 'abogado', 'analista')
      AND public.has_case_access(case_id)
    )
  );

COMMIT;
