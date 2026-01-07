BEGIN;

-- ---------------------------------------------------------------------------
-- Fix: allow staff to read client profiles linked to cases they can access.
-- Symptom: in Case detail, "Clientes principales" may show as "Sin registrar"
-- even when `case_clients` exists, because the joined `profiles` row is hidden
-- by RLS if the client profile has missing/mismatched organization_id.
--
-- This keeps tenant isolation: lawyers only see clients for cases they are
-- responsible for OR where they are collaborators, within the active org.
-- ---------------------------------------------------------------------------

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
          JOIN public.cases c ON c.id = cc.case_id
          WHERE cc.client_profile_id = profiles.id
            AND c.organization_id = public.current_org_id()
            AND (
              -- org_admin / staff ven los clientes de los casos del org
              public.has_org_role(public.current_org_id(), 'org_admin'::public.org_member_role)
              OR public.has_org_role(public.current_org_id(), 'staff'::public.org_member_role)
              OR (
                -- lawyers: solo los casos propios o donde colaboran
                public.has_org_role(public.current_org_id(), 'lawyer'::public.org_member_role)
                AND (
                  c.abogado_responsable = auth.uid()
                  OR EXISTS (
                    SELECT 1
                    FROM public.case_collaborators col
                    WHERE col.case_id = c.id
                      AND col.abogado_id = auth.uid()
                  )
                )
              )
            )
        )
      )
    )
  );

COMMIT;

