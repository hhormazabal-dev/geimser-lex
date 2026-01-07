BEGIN;

-- ---------------------------------------------------------------------------
-- Global RBAC (multi-role per user)
-- - rbac_roles: role catalog (with priority for legacy "primary role")
-- - rbac_permissions: permission catalog
-- - rbac_role_permissions: many-to-many mapping
-- - rbac_user_roles: many-to-many user<->roles (global, not per-organization)
-- Notes:
-- - This does NOT replace org_members (tenant membership) — it complements it.
-- - We keep profiles.role for backward compatibility, but RBAC is the source of truth.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rbac_roles (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rbac_permissions (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rbac_role_permissions (
  role_key TEXT NOT NULL REFERENCES public.rbac_roles(key) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.rbac_permissions(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_key, permission_key)
);

CREATE TABLE IF NOT EXISTS public.rbac_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL REFERENCES public.rbac_roles(key) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role_key)
);

CREATE INDEX IF NOT EXISTS rbac_user_roles_user_id_idx ON public.rbac_user_roles(user_id);
CREATE INDEX IF NOT EXISTS rbac_user_roles_role_key_idx ON public.rbac_user_roles(role_key);

-- Helper: does current user have a global role?
CREATE OR REPLACE FUNCTION public.has_global_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rbac_user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role_key = p_role
  );
$$;

-- Helper: does current user have a permission (via any global role)?
CREATE OR REPLACE FUNCTION public.has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rbac_user_roles ur
    JOIN public.rbac_role_permissions rp ON rp.role_key = ur.role_key
    WHERE ur.user_id = auth.uid()
      AND rp.permission_key = p_permission
  );
$$;

-- Legacy bridge: "effective" primary role (highest priority among assigned roles, fallback to profiles.role).
CREATE OR REPLACE FUNCTION public.effective_global_role(p_user_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH target AS (
    SELECT COALESCE(p_user_id, auth.uid()) AS uid
  ),
  best AS (
    SELECT r.key
    FROM target t
    JOIN public.rbac_user_roles ur ON ur.user_id = t.uid
    JOIN public.rbac_roles r ON r.key = ur.role_key
    ORDER BY r.priority DESC, r.key ASC
    LIMIT 1
  )
  SELECT
    COALESCE(
      (SELECT key FROM best),
      (SELECT p.role::text FROM public.profiles p WHERE p.user_id = COALESCE(p_user_id, auth.uid()) LIMIT 1),
      'cliente'
    );
$$;

-- Seed core roles (priority defines the legacy "primary")
INSERT INTO public.rbac_roles (key, name, description, priority)
VALUES
  ('admin_firma', 'Admin Firma', 'Administrador interno con acceso amplio', 300),
  ('abogado', 'Abogado', 'Abogado del estudio', 200),
  ('analista', 'Analista', 'Backoffice / soporte interno', 100),
  ('cliente', 'Cliente', 'Acceso portal cliente', 0)
ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      priority = EXCLUDED.priority;

-- Seed permissions (minimal set; extend as needed)
INSERT INTO public.rbac_permissions (key, name, description)
VALUES
  ('users.manage', 'Gestionar usuarios', 'Crear/editar/desactivar usuarios'),
  ('orgs.manage', 'Gestionar empresas', 'Administrar empresas y membresías'),
  ('cases.manage', 'Gestionar causas', 'Crear/editar causas y etapas'),
  ('billing.manage', 'Gestionar billing', 'Acceso a facturación y pagos'),
  ('audit.view', 'Ver auditoría', 'Acceso a logs/auditoría')
ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description;

-- Map role -> permissions (adjustable)
INSERT INTO public.rbac_role_permissions (role_key, permission_key)
SELECT x.role_key, x.permission_key
FROM (
  VALUES
    ('admin_firma', 'users.manage'),
    ('admin_firma', 'orgs.manage'),
    ('admin_firma', 'cases.manage'),
    ('admin_firma', 'billing.manage'),
    ('admin_firma', 'audit.view'),
    ('abogado', 'cases.manage'),
    ('analista', 'cases.manage'),
    ('analista', 'audit.view')
) AS x(role_key, permission_key)
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Backfill user roles from existing profiles.role (one role per user initially).
INSERT INTO public.rbac_user_roles (user_id, role_key)
SELECT p.user_id, p.role::text
FROM public.profiles p
WHERE p.user_id IS NOT NULL
ON CONFLICT (user_id, role_key) DO NOTHING;

-- RLS
ALTER TABLE public.rbac_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_user_roles ENABLE ROW LEVEL SECURITY;

-- View catalogs: super_admin, service_role, or users with users.manage (read-only for most).
DROP POLICY IF EXISTS "rbac_roles_select" ON public.rbac_roles;
CREATE POLICY "rbac_roles_select" ON public.rbac_roles
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR public.is_super_admin()
    OR public.has_permission('users.manage')
  );

DROP POLICY IF EXISTS "rbac_permissions_select" ON public.rbac_permissions;
CREATE POLICY "rbac_permissions_select" ON public.rbac_permissions
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR public.is_super_admin()
    OR public.has_permission('users.manage')
  );

DROP POLICY IF EXISTS "rbac_role_permissions_select" ON public.rbac_role_permissions;
CREATE POLICY "rbac_role_permissions_select" ON public.rbac_role_permissions
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR public.is_super_admin()
    OR public.has_permission('users.manage')
  );

-- Manage catalogs: super_admin or service_role only (keep this strict).
DROP POLICY IF EXISTS "rbac_roles_manage" ON public.rbac_roles;
CREATE POLICY "rbac_roles_manage" ON public.rbac_roles
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR public.is_super_admin()
  ) WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "rbac_permissions_manage" ON public.rbac_permissions;
CREATE POLICY "rbac_permissions_manage" ON public.rbac_permissions
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR public.is_super_admin()
  ) WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "rbac_role_permissions_manage" ON public.rbac_role_permissions;
CREATE POLICY "rbac_role_permissions_manage" ON public.rbac_role_permissions
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR public.is_super_admin()
  ) WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR public.is_super_admin()
  );

-- User roles:
-- - users can see their own
-- - super_admin/service_role can manage all
DROP POLICY IF EXISTS "rbac_user_roles_select" ON public.rbac_user_roles;
CREATE POLICY "rbac_user_roles_select" ON public.rbac_user_roles
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR public.is_super_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "rbac_user_roles_manage" ON public.rbac_user_roles;
CREATE POLICY "rbac_user_roles_manage" ON public.rbac_user_roles
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR public.is_super_admin()
  ) WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR public.is_super_admin()
  );

COMMIT;

