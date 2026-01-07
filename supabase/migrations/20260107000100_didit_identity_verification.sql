BEGIN;

-- ---------------------------------------------------------------------------
-- Didit Identity Verification integration
-- - didit_profile_settings: per-profile preference (e.g. require biometrics)
-- - didit_verification_sessions: audit log + sync storage for Didit sessions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.didit_profile_settings (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  require_biometric BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS didit_profile_settings_org_idx
  ON public.didit_profile_settings (organization_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_didit_profile_settings_updated_at ON public.didit_profile_settings;
    CREATE TRIGGER update_didit_profile_settings_updated_at
      BEFORE UPDATE ON public.didit_profile_settings
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.didit_profile_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS didit_profile_settings_select ON public.didit_profile_settings;
CREATE POLICY didit_profile_settings_select
  ON public.didit_profile_settings
  FOR SELECT
  TO authenticated
  USING (
    public.has_org_access(organization_id)
    OR profile_id = auth.uid()
  );

DROP POLICY IF EXISTS didit_profile_settings_write ON public.didit_profile_settings;
CREATE POLICY didit_profile_settings_write
  ON public.didit_profile_settings
  FOR ALL
  TO authenticated
  USING (
    public.has_org_role(organization_id, 'org_admin'::public.org_member_role)
    OR public.has_org_role(organization_id, 'staff'::public.org_member_role)
  )
  WITH CHECK (
    public.has_org_role(organization_id, 'org_admin'::public.org_member_role)
    OR public.has_org_role(organization_id, 'staff'::public.org_member_role)
  );

CREATE TABLE IF NOT EXISTS public.didit_verification_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subject_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  initiated_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  didit_session_id UUID NOT NULL,
  workflow_id UUID NOT NULL,
  vendor_data TEXT,
  callback TEXT,
  session_url TEXT,
  status TEXT,
  raw JSONB,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (didit_session_id)
);

CREATE INDEX IF NOT EXISTS didit_verification_sessions_subject_idx
  ON public.didit_verification_sessions (subject_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS didit_verification_sessions_org_idx
  ON public.didit_verification_sessions (organization_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_didit_verification_sessions_updated_at ON public.didit_verification_sessions;
    CREATE TRIGGER update_didit_verification_sessions_updated_at
      BEFORE UPDATE ON public.didit_verification_sessions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.didit_verification_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS didit_verification_sessions_select ON public.didit_verification_sessions;
CREATE POLICY didit_verification_sessions_select
  ON public.didit_verification_sessions
  FOR SELECT
  TO authenticated
  USING (
    public.has_org_access(organization_id)
    OR subject_profile_id = auth.uid()
  );

DROP POLICY IF EXISTS didit_verification_sessions_write ON public.didit_verification_sessions;
CREATE POLICY didit_verification_sessions_write
  ON public.didit_verification_sessions
  FOR ALL
  TO authenticated
  USING (
    public.has_org_role(organization_id, 'org_admin'::public.org_member_role)
    OR public.has_org_role(organization_id, 'staff'::public.org_member_role)
  )
  WITH CHECK (
    public.has_org_role(organization_id, 'org_admin'::public.org_member_role)
    OR public.has_org_role(organization_id, 'staff'::public.org_member_role)
  );

COMMIT;

