// src/lib/auth/roles.ts
import 'server-only';

import { createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];

type ProfileWithOverride = ProfileRow & { _role_override: Role | null };

export type Role = 'admin_firma' | 'abogado' | 'analista' | 'cliente';

/**
 * Busca o crea el perfil del usuario autenticado.
 * - Busca SIEMPRE por auth.uid (profiles.id === auth.uid).
 * - Si no existe, lo crea con datos mínimos (incluye `nombre` requerido).
 */
async function ensureProfile(): Promise<ProfileWithOverride | null> {
  const supabase = await createServerClient();

  // Usuario autenticado (Auth)
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    console.warn('[AUTH] No hay usuario autenticado:', authErr);
    return null;
  }

  const user = auth.user;
  const authId = user.id;
  // 1) Buscar por ID (único válido)
  const { data: found, error: selErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authId)
    .maybeSingle();

  if (selErr) {
    console.error('[AUTH] Error seleccionando profiles por id:', selErr);
    return null;
  }

  // 2) Si existe, sincroniza email si cambió (opcional) y devuelve
  if (found) {
    const emailNow = user.email ?? found.email ?? '';
    if (emailNow && emailNow !== found.email) {
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ email: emailNow } satisfies Partial<ProfileRow>)
        .eq('id', authId);
      if (upErr) {
        console.warn('[AUTH] No se pudo sincronizar email en profiles:', upErr);
      }
    }

    // Sincroniza nombre desde user_metadata si viene
    const metaNombre =
      (user.user_metadata as any)?.nombre ??
      (user.user_metadata as any)?.name ??
      null;

    if (metaNombre && metaNombre !== found.nombre) {
      const { error: upNameErr } = await supabase
        .from('profiles')
        .update({ nombre: String(metaNombre) } satisfies Partial<ProfileRow>)
        .eq('id', authId);
      if (upNameErr) {
        console.warn('[AUTH] No se pudo sincronizar nombre en profiles:', upNameErr);
      } else {
        // refresca la fila para devolverla actualizada
        const { data: refreshed } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authId)
          .maybeSingle();
        if (refreshed) {
          return {
            ...refreshed,
            _role_override: null,
          } satisfies ProfileWithOverride;
        }
        return {
          ...found,
          _role_override: null,
        } satisfies ProfileWithOverride;
      }
    }

    return {
      ...found,
      _role_override: null,
    } satisfies ProfileWithOverride;
  }

  // 3) No existe → crear fila mínima (nombre requerido por tu tipo)
  const displayName =
    (user.user_metadata as any)?.nombre ??
    (user.user_metadata as any)?.name ??
    (user.email ?? '').split('@')[0] ??
    'Usuario';

  const insertPayload: ProfileInsert = {
    id: authId,            // <= clave primaria = auth.uid
    user_id: authId,       // espejo
    email: user.email ?? '',
    nombre: String(displayName),   // <- REQUERIDO
    role: 'cliente',
    activo: true,
    // rut, telefono y otros son opcionales en tu esquema; no se envían
  };

  const { data: created, error: insErr } = await supabase
    .from('profiles')
    .insert(insertPayload)
    .select('*')
    .maybeSingle();

  if (insErr) {
    console.error('[AUTH] Error creando perfil por primera vez:', insErr);
    return null;
  }

  console.info('[AUTH] Perfil creado automáticamente:', {
    id: created?.id,
    email: created?.email,
    role: created?.role,
  });

  if (!created) return null;

  return {
    ...created,
    _role_override: null,
  } satisfies ProfileWithOverride;
}

/**
 * Devuelve el perfil actual (fila de `profiles`) con rol efectivo.
 * Si no hay sesión → null.
 */
export async function getCurrentProfile(): Promise<(ProfileRow & { role: Role }) | null> {
  const profile = await ensureProfile();
  if (!profile) return null;

  let effectiveRole = ((profile.role ?? 'cliente') as Role) ?? 'cliente';

  // RBAC (multi-rol): si existe, el rol efectivo es el de mayor prioridad.
  try {
    const supabase = (await createServerClient()) as any;
    const [{ data: isSuperAdmin }, { data: roleFromRbac, error: rbacErr }] = await Promise.all([
      supabase.rpc('is_super_admin'),
      supabase.rpc('effective_global_role'),
    ]);

    const rbacCandidate = String(roleFromRbac ?? '').trim() as Role;
    if (!rbacErr && (['admin_firma', 'abogado', 'analista', 'cliente'] as const).includes(rbacCandidate as any)) {
      effectiveRole = rbacCandidate;
    }

    // Contexto por empresa activa: el rol real para UI/permisos depende del membership en esa empresa.
    // - org_admin => admin_firma
    // - lawyer => abogado
    // - staff => analista
    // Super admin mantiene rol global.
    const activeOrgId = (profile as any)?.active_organization_id ?? null;
    if (!isSuperAdmin && effectiveRole !== 'cliente' && activeOrgId) {
      const { data: membership } = await supabase
        .from('org_members')
        .select('role')
        .eq('organization_id', activeOrgId)
        .eq('user_id', profile.user_id)
        .maybeSingle();

      const orgRole = String(membership?.role ?? '');
      if (orgRole === 'org_admin') effectiveRole = 'admin_firma';
      else if (orgRole === 'lawyer') effectiveRole = 'abogado';
      else if (orgRole === 'staff') effectiveRole = 'analista';
    }
  } catch {
    // ignore: RBAC aún no migrado o RPC no disponible
  }

  console.warn('[ROLE DEBUG] getCurrentProfile()', {
    auth_id: profile.id,
    table_user_id: profile.user_id,
    email: profile.email,
    role_db: profile.role,
    role_override: null,
    role_effective: effectiveRole,
  });

  return { ...profile, role: effectiveRole };
}

/**
 * Exige sesión y, opcionalmente, restringe por rol/roles.
 */
export async function requireAuth(roles?: Role | Role[]) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('No autenticado');

  const role: Role = profile.role;

  if (!roles) return { ...profile, role };

  const allow: Role[] = Array.isArray(roles) ? roles : [roles];
  if (!allow.includes(role)) {
    try {
      const supabase = (await createServerClient()) as any;
      const { data: isSuperAdmin, error } = await supabase.rpc('is_super_admin');
      if (error) {
        console.warn('[AUTH] No se pudo verificar is_super_admin():', error);
      } else if (isSuperAdmin) {
        return { ...profile, role };
      }
    } catch (error) {
      console.warn('[AUTH] Error verificando is_super_admin():', error);
    }
    throw new Error('Sin permisos');
  }
  return { ...profile, role };
}

/**
 * ¿Puede ver estadísticas?
 */
export function canSeeStatsRole(role: Role) {
  return role === 'admin_firma' || role === 'abogado' || role === 'analista';
}

/**
 * Tu helper (déjalo como lo tenías si luego filtras por RLS).
 */
export async function canAccessCase(_caseId: string): Promise<boolean> {
  const caseId = String(_caseId ?? '').trim();
  if (!caseId) return false;

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      // .is('deleted_at', null)
      .maybeSingle();
    if (error) return false;
    return Boolean(data?.id);
  } catch {
    return false;
  }
}
