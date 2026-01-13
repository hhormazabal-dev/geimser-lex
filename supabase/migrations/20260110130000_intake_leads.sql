BEGIN;

-- ---------------------------------------------------------------------------
-- Intake leads (Deuda Cero and future external sources)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  rut TEXT,
  message TEXT,
  lead_type TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'website_deudacero',
  convertible_to_case BOOLEAN NOT NULL DEFAULT true,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_org_idx
  ON public.leads (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS leads_status_idx
  ON public.leads (status);

CREATE INDEX IF NOT EXISTS leads_email_idx
  ON public.leads (email);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
    CREATE TRIGGER update_leads_updated_at
      BEFORE UPDATE ON public.leads
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_select ON public.leads;
CREATE POLICY leads_select
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (public.has_org_access(organization_id));

DROP POLICY IF EXISTS leads_write ON public.leads;
CREATE POLICY leads_write
  ON public.leads
  FOR ALL
  TO authenticated
  USING (
    public.has_org_role(organization_id, 'org_admin'::public.org_member_role)
    OR public.has_org_role(organization_id, 'staff'::public.org_member_role)
    OR public.has_org_role(organization_id, 'lawyer'::public.org_member_role)
  )
  WITH CHECK (
    public.has_org_role(organization_id, 'org_admin'::public.org_member_role)
    OR public.has_org_role(organization_id, 'staff'::public.org_member_role)
    OR public.has_org_role(organization_id, 'lawyer'::public.org_member_role)
  );

INSERT INTO public.organizations (name, status, is_default)
SELECT 'Deuda Cero', 'active'::public.organization_status, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.organizations WHERE lower(name) = lower('Deuda Cero')
);

COMMIT;
