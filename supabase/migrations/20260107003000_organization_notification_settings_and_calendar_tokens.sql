BEGIN;

-- ---------------------------------------------------------------------------
-- Organization-level notification settings + calendar tokens (ICS)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organization_notification_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_change_emails_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  deadline_emails_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  calendar_links_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  deadline_reminder_days INTEGER[] NOT NULL DEFAULT '{7,3,1}',
  deadline_send_to_lawyer BOOLEAN NOT NULL DEFAULT TRUE,
  deadline_send_to_staff BOOLEAN NOT NULL DEFAULT FALSE,
  deadline_send_to_clients BOOLEAN NOT NULL DEFAULT TRUE,
  case_change_send_to_lawyer BOOLEAN NOT NULL DEFAULT TRUE,
  case_change_send_to_staff BOOLEAN NOT NULL DEFAULT FALSE,
  case_change_send_to_clients BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_org_notification_settings_updated_at ON public.organization_notification_settings;
    CREATE TRIGGER update_org_notification_settings_updated_at
      BEFORE UPDATE ON public.organization_notification_settings
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.organization_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_notification_settings_select" ON public.organization_notification_settings;
CREATE POLICY "org_notification_settings_select" ON public.organization_notification_settings
  FOR SELECT USING (public.is_super_admin() OR public.has_org_access(organization_id));

DROP POLICY IF EXISTS "org_notification_settings_insert" ON public.organization_notification_settings;
CREATE POLICY "org_notification_settings_insert" ON public.organization_notification_settings
  FOR INSERT WITH CHECK (public.is_super_admin() OR public.has_org_role(organization_id, 'org_admin'::public.org_member_role));

DROP POLICY IF EXISTS "org_notification_settings_update" ON public.organization_notification_settings;
CREATE POLICY "org_notification_settings_update" ON public.organization_notification_settings
  FOR UPDATE
  USING (public.is_super_admin() OR public.has_org_role(organization_id, 'org_admin'::public.org_member_role))
  WITH CHECK (public.is_super_admin() OR public.has_org_role(organization_id, 'org_admin'::public.org_member_role));

-- Calendar tokens used in emails (public .ics download via signed token)
CREATE TABLE IF NOT EXISTS public.calendar_event_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.case_stages(id) ON DELETE CASCADE,
  recipient_email TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calendar_event_tokens_token_idx ON public.calendar_event_tokens(token);
CREATE INDEX IF NOT EXISTS calendar_event_tokens_expires_idx ON public.calendar_event_tokens(expires_at);

ALTER TABLE public.calendar_event_tokens ENABLE ROW LEVEL SECURITY;

-- Limit to service role / super admin.
DROP POLICY IF EXISTS "calendar_event_tokens_access" ON public.calendar_event_tokens;
CREATE POLICY "calendar_event_tokens_access" ON public.calendar_event_tokens
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR public.is_super_admin()
  ) WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR public.is_super_admin()
  );

COMMIT;

