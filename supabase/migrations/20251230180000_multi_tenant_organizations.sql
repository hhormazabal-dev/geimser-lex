BEGIN;

-- ---------------------------------------------------------------------------
-- Multi-tenant foundations (Organizations)
-- - organizations
-- - org_members
-- - super_admins (email + optional user_id)
-- - profiles: active_organization_id + organization_id (for clients)
-- - helper functions: is_super_admin(), current_org_id(), has_org_role()
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status') THEN
    CREATE TYPE public.organization_status AS ENUM ('active', 'inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_member_role') THEN
    CREATE TYPE public.org_member_role AS ENUM ('org_admin', 'lawyer', 'staff');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status public.organization_status NOT NULL DEFAULT 'active',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo una organización default.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'organizations_one_default_idx'
  ) THEN
    CREATE UNIQUE INDEX organizations_one_default_idx
      ON public.organizations (is_default)
      WHERE is_default = true;
  END IF;
END $$;

-- Trigger updated_at (reusa update_updated_at_column si existe).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
    CREATE TRIGGER update_organizations_updated_at
      BEFORE UPDATE ON public.organizations
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_member_role NOT NULL DEFAULT 'lawyer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS org_members_user_id_idx ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS org_members_org_id_idx ON public.org_members(organization_id);

-- SUPER ADMIN global: se guarda por email (y opcionalmente por user_id para endurecer).
CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles: org activa (para contexto) + org del cliente (para asignación/listados).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_organization_id UUID REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS profiles_active_org_idx ON public.profiles(active_organization_id);
CREATE INDEX IF NOT EXISTS profiles_org_idx ON public.profiles(organization_id);

-- Inserta Default Org si no existe.
INSERT INTO public.organizations (name, status, is_default)
SELECT 'Default Org', 'active'::public.organization_status, true
WHERE NOT EXISTS (SELECT 1 FROM public.organizations WHERE is_default = true);

-- Seed SUPER ADMIN global por email (user_id se completa luego si se desea).
INSERT INTO public.super_admins (email)
SELECT 'hh2fc24@gmail.com'
WHERE NOT EXISTS (SELECT 1 FROM public.super_admins WHERE email = 'hh2fc24@gmail.com');

-- Helper: default org id.
CREATE OR REPLACE FUNCTION public.default_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.organizations WHERE is_default = true LIMIT 1;
$$;

-- SUPER ADMIN por user_id o por email claim.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.super_admins sa
    WHERE sa.user_id = auth.uid()
       OR sa.email = COALESCE(auth.jwt() ->> 'email', '')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT p.active_organization_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_org_access(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.org_members m
      WHERE m.organization_id = p_org_id
        AND m.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(p_org_id UUID, p_role public.org_member_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.org_members m
      WHERE m.organization_id = p_org_id
        AND m.user_id = auth.uid()
        AND m.role = p_role
    );
$$;

-- Backfill org activa y membership para usuarios internos existentes.
DO $$
DECLARE
  v_default_org UUID;
BEGIN
  v_default_org := public.default_organization_id();

  -- Usuarios internos deben tener org activa para defaults / contexto.
  UPDATE public.profiles
    SET active_organization_id = v_default_org
  WHERE active_organization_id IS NULL
    AND role IN ('admin_firma', 'abogado', 'analista');

  -- Clientes quedan asignados al default (MVP). Si ya está seteado, no tocar.
  UPDATE public.profiles
    SET organization_id = v_default_org
  WHERE organization_id IS NULL
    AND role = 'cliente';

  INSERT INTO public.org_members (organization_id, user_id, role)
  SELECT
    v_default_org,
    p.user_id,
    CASE
      WHEN p.role = 'admin_firma' THEN 'org_admin'::public.org_member_role
      WHEN p.role = 'abogado' THEN 'lawyer'::public.org_member_role
      WHEN p.role = 'analista' THEN 'staff'::public.org_member_role
      ELSE 'staff'::public.org_member_role
    END
  FROM public.profiles p
  WHERE p.role IN ('admin_firma', 'abogado', 'analista')
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;
END $$;

-- RLS (tablas nuevas)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- organizations: miembros pueden ver su org; super_admin ve todo; gestionar solo super_admin.
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
CREATE POLICY "organizations_select" ON public.organizations
  FOR SELECT USING (public.is_super_admin() OR public.has_org_access(id));

DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
CREATE POLICY "organizations_insert" ON public.organizations
  FOR INSERT WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
CREATE POLICY "organizations_update" ON public.organizations
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "organizations_delete" ON public.organizations;
CREATE POLICY "organizations_delete" ON public.organizations
  FOR DELETE USING (public.is_super_admin());

-- org_members: cada usuario ve su(s) memberships; org_admin gestiona dentro del org; super_admin todo.
DROP POLICY IF EXISTS "org_members_select" ON public.org_members;
CREATE POLICY "org_members_select" ON public.org_members
  FOR SELECT USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR public.has_org_role(organization_id, 'org_admin'::public.org_member_role)
  );

DROP POLICY IF EXISTS "org_members_insert" ON public.org_members;
CREATE POLICY "org_members_insert" ON public.org_members
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR public.has_org_role(organization_id, 'org_admin'::public.org_member_role)
  );

DROP POLICY IF EXISTS "org_members_update" ON public.org_members;
CREATE POLICY "org_members_update" ON public.org_members
  FOR UPDATE USING (
    public.is_super_admin()
    OR public.has_org_role(organization_id, 'org_admin'::public.org_member_role)
  ) WITH CHECK (
    public.is_super_admin()
    OR public.has_org_role(organization_id, 'org_admin'::public.org_member_role)
  );

DROP POLICY IF EXISTS "org_members_delete" ON public.org_members;
CREATE POLICY "org_members_delete" ON public.org_members
  FOR DELETE USING (
    public.is_super_admin()
    OR public.has_org_role(organization_id, 'org_admin'::public.org_member_role)
  );

-- super_admins: solo super_admin puede ver/gestionar (función is_super_admin() no depende de RLS).
DROP POLICY IF EXISTS "super_admins_select" ON public.super_admins;
CREATE POLICY "super_admins_select" ON public.super_admins
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS "super_admins_manage" ON public.super_admins;
CREATE POLICY "super_admins_manage" ON public.super_admins
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

COMMIT;

