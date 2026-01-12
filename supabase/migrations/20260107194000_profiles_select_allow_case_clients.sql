BEGIN;

-- ---------------------------------------------------------------------------
-- Fix: allow staff to read client + lawyer profiles linked to cases they can access.
-- Symptom: in Case detail, "Clientes principales" may show as "Sin registrar"
-- even when `case_clients` exists, because the joined `profiles` row is hidden
-- by RLS if the client profile has missing/mismatched organization_id.
--
-- This keeps tenant isolation: lawyers only see profiles for cases they are
-- responsible for OR where they are collaborators, within the active org.
-- ---------------------------------------------------------------------------

-- Helper to avoid RLS recursion between profiles <-> cases.
-- Note: we bypass row security here on purpose; access checks are implemented
-- explicitly using current org + org_members + case ownership/collaboration.
CREATE OR REPLACE FUNCTION public.can_access_case_for_profile_select(p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
  WITH ctx AS (
    SELECT
      auth.uid() AS user_id,
      (
        SELECT p.active_organization_id
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
        LIMIT 1
      ) AS org_id,
      (
        SELECT p.id
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
        LIMIT 1
      ) AS profile_id
  ),
  c AS (
    SELECT c.id, c.organization_id, c.abogado_responsable
    FROM public.cases c
    WHERE c.id = p_case_id
  ),
  roles AS (
    SELECT
      EXISTS (
        SELECT 1
        FROM public.org_members m
        WHERE m.organization_id = (SELECT org_id FROM ctx)
          AND m.user_id = (SELECT user_id FROM ctx)
          AND m.role = 'org_admin'::public.org_member_role
      ) AS is_org_admin,
      EXISTS (
        SELECT 1
        FROM public.org_members m
        WHERE m.organization_id = (SELECT org_id FROM ctx)
          AND m.user_id = (SELECT user_id FROM ctx)
          AND m.role = 'staff'::public.org_member_role
      ) AS is_staff,
      EXISTS (
        SELECT 1
        FROM public.org_members m
        WHERE m.organization_id = (SELECT org_id FROM ctx)
          AND m.user_id = (SELECT user_id FROM ctx)
          AND m.role = 'lawyer'::public.org_member_role
      ) AS is_lawyer
  )
  SELECT
    public.is_super_admin()
    OR (
      (SELECT org_id FROM ctx) IS NOT NULL
      AND (SELECT organization_id FROM c) = (SELECT org_id FROM ctx)
      AND (
        (SELECT is_org_admin FROM roles)
        OR (SELECT is_staff FROM roles)
        OR (
          (SELECT is_lawyer FROM roles)
          AND (
            (SELECT abogado_responsable FROM c) = (SELECT profile_id FROM ctx)
            OR EXISTS (
              SELECT 1
              FROM public.case_collaborators col
              WHERE col.case_id = (SELECT id FROM c)
                AND col.abogado_id = (SELECT profile_id FROM ctx)
            )
          )
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_case_for_profile_select(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_case_for_profile_select(UUID) TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_scoped" ON public.profiles;
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
        -- clientes del org activo (si están correctamente seteados)
        OR (profiles.role = 'cliente' AND profiles.organization_id = public.current_org_id())
        -- clientes vinculados a casos accesibles (fallback ante datos legacy)
        OR EXISTS (
          SELECT 1
          FROM public.case_clients cc
          WHERE cc.client_profile_id = profiles.id
            AND public.can_access_case_for_profile_select(cc.case_id)
        )
        -- abogados responsables vinculados a casos accesibles (fallback ante datos legacy)
        OR EXISTS (
          SELECT 1
          FROM public.cases c
          WHERE c.abogado_responsable = profiles.id
            AND public.can_access_case_for_profile_select(c.id)
        )
        -- abogados colaboradores vinculados a casos accesibles (fallback ante datos legacy)
        OR EXISTS (
          SELECT 1
          FROM public.case_collaborators col
          WHERE col.abogado_id = profiles.id
            AND public.can_access_case_for_profile_select(col.case_id)
        )
      )
    )
  );

COMMIT;
