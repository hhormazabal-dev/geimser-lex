import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeEmail(value: unknown): string | null {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return null;
  if (!s.includes('@')) return null;
  return s;
}

function resolvePassword(value: unknown): string {
  const s = String(value ?? '').trim();
  if (s) return s;
  return randomBytes(12).toString('base64url');
}

type OrgRole = 'org_admin' | 'lawyer' | 'staff';
type GlobalRole = 'admin_firma' | 'abogado' | 'analista' | 'cliente';

function highestGlobalRole(roles: GlobalRole[]): GlobalRole {
  const priority: Record<GlobalRole, number> = {
    admin_firma: 300,
    abogado: 200,
    analista: 100,
    cliente: 0,
  };
  const unique = Array.from(new Set(roles));
  unique.sort((a, b) => (priority[b] ?? 0) - (priority[a] ?? 0));
  return unique[0] ?? 'cliente';
}

function defaultGlobalRolesForOrgRole(orgRole: OrgRole): GlobalRole[] {
  if (orgRole === 'org_admin') return ['admin_firma'];
  if (orgRole === 'staff') return ['analista'];
  return ['abogado'];
}

async function syncUserRbacRoles(service: any, userId: string, roles: GlobalRole[]) {
  const unique = Array.from(new Set(roles));
  const { data: existingRows } = await service.from('rbac_user_roles' as any).select('role_key').eq('user_id', userId);
  const existing = new Set<string>((existingRows ?? []).map((r: any) => String(r.role_key)));
  const desired = new Set<string>(unique);

  const toInsert = Array.from(desired).filter((r) => !existing.has(r));
  const toDelete = Array.from(existing).filter((r) => !desired.has(r));

  if (toInsert.length) {
    const payload = toInsert.map((role_key) => ({ user_id: userId, role_key }));
    await service.from('rbac_user_roles' as any).insert(payload);
  }
  if (toDelete.length) {
    await service.from('rbac_user_roles' as any).delete().eq('user_id', userId).in('role_key', toDelete);
  }
}

export async function POST(req: Request) {
  try {
    const supabase = (await createServerClient()) as any;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return jsonError('No autenticado', 401);

    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    const nombre = String(body?.nombre ?? '').trim();
    const orgRole = String(body?.orgRole ?? 'lawyer').trim() as OrgRole;
    if (!email) return jsonError('email requerido', 400);
    if (!nombre) return jsonError('nombre requerido', 400);
    if (!(['org_admin', 'lawyer', 'staff'] as const).includes(orgRole as any)) return jsonError('orgRole inválido', 400);

    const { data: meProfile, error: meErr } = await supabase
      .from('profiles')
      .select('active_organization_id')
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (meErr) return jsonError(meErr.message ?? 'Error leyendo perfil', 500);

    const orgId = (meProfile?.active_organization_id as string | null) ?? null;
    if (!orgId) return jsonError('Debes seleccionar una empresa activa primero', 400);

    const { data: isSuper, error: superErr } = await supabase.rpc('is_super_admin');
    if (superErr) return jsonError(superErr.message ?? 'Error validando permisos', 500);

    if (!isSuper) {
      const { data: membership, error: memErr } = await supabase
        .from('org_members')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', authData.user.id)
        .maybeSingle();
      if (memErr) return jsonError(memErr.message ?? 'Error validando membresía', 500);
      if (!membership || membership.role !== 'org_admin') return jsonError('Sin permisos', 403);
    }

    const password = resolvePassword(body?.password);
    const svc = createServiceClient() as any;

    let userId: string | null = null;
    let createdPassword: string | null = null;

    const created = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'abogado' }, // compatibilidad; se actualiza abajo
      user_metadata: { nombre },
    });

    if (created.error || !created.data?.user?.id) {
      const fallback = await svc.from('profiles').select('user_id').eq('email', email).maybeSingle();
      const existingUserId = fallback?.data?.user_id as string | undefined;
      if (!existingUserId) {
        return jsonError(created.error?.message ?? 'No se pudo crear el usuario', 500);
      }
      userId = existingUserId;
      createdPassword = null;
    } else {
      userId = created.data.user.id;
      createdPassword = password;
    }

    if (!userId) return jsonError('No se pudo resolver el userId', 500);

    const globalRoles = defaultGlobalRolesForOrgRole(orgRole);
    const primaryRole = highestGlobalRole(globalRoles);

    // Perfil (compatibilidad): mantener role como principal y empresa activa.
    await svc
      .from('profiles')
      .upsert(
        {
          id: userId,
          user_id: userId,
          email,
          nombre,
          role: primaryRole,
          activo: true,
          active_organization_id: orgId,
        },
        { onConflict: 'id' },
      );

    // Membership en empresa (org role)
    await svc.from('org_members').upsert(
      {
        organization_id: orgId,
        user_id: userId,
        role: orgRole,
      },
      { onConflict: 'organization_id,user_id' },
    );

    // RBAC global roles
    try {
      await syncUserRbacRoles(svc, userId, globalRoles);
    } catch {
      // RBAC aún no migrado: ignorar
    }

    // Actualiza metadata de Auth para compatibilidad (rol principal)
    try {
      await svc.auth.admin.updateUserById(userId, {
        app_metadata: { role: primaryRole },
        user_metadata: { nombre, role: primaryRole },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      ok: true,
      user: { user_id: userId, email, nombre, org_role: orgRole, role: primaryRole },
      password: createdPassword,
    });
  } catch (e: any) {
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}
