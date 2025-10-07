// src/lib/auth/roles.ts
import 'server-only';

import { createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';
import type { User } from '@supabase/supabase-js';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];

type ProfileWithOverride = ProfileRow & { _role_override: Role | null };

export type Role = 'admin_firma' | 'abogado' | 'analista' | 'cliente';

const ROLE_NORMALIZATION_MAP: Record<string, Role> = {
  admin: 'admin_firma',
  admin_firma: 'admin_firma',
  adminfirma: 'admin_firma',
  'admin-firma': 'admin_firma',
  adminlex: 'admin_firma',
  firma_admin: 'admin_firma',
  abogado: 'abogado',
  analista: 'analista',
  cliente: 'cliente',
};

function normalizeRole(value: unknown): Role | null {
  if (value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    return value.length ? normalizeRole(value[0]) : null;
  }

  if (typeof value === 'boolean') {
    return value ? 'admin_firma' : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
  return ROLE_NORMALIZATION_MAP[key] ?? null;
}

function resolveRoleFromAuth(user: User): Role | null {
  const candidates: unknown[] = [];

  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;

  candidates.push(appMeta.role, (appMeta.roles as unknown[] | undefined)?.[0], appMeta.user_role);
  candidates.push(userMeta.role, (userMeta.roles as unknown[] | undefined)?.[0], userMeta.user_role);
  candidates.push(userMeta.perfil_rol, userMeta.profile_role, userMeta.tipo, userMeta.rol);

  if (appMeta.claims_admin === true || userMeta.is_admin === true) {
    candidates.push('admin_firma');
  }

  for (const candidate of candidates) {
    const normalized = normalizeRole(candidate);
    if (normalized) return normalized;
  }

  return null;
}

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
  const metadataRole = resolveRoleFromAuth(user);

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
          const override = metadataRole && metadataRole !== refreshed.role ? metadataRole : null;
          return {
            ...refreshed,
            _role_override: override,
          } satisfies ProfileWithOverride;
        }
        const fallbackOverride =
          metadataRole && metadataRole !== found.role ? metadataRole : null;
        return {
          ...found,
          _role_override: fallbackOverride,
        } satisfies ProfileWithOverride;
      }
    }

    if (metadataRole && metadataRole !== found.role) {
      const { data: updated, error: upRoleErr } = await supabase
        .from('profiles')
        .update({ role: metadataRole } satisfies Partial<ProfileRow>)
        .eq('id', authId)
        .select('*')
        .maybeSingle();

      if (upRoleErr) {
        console.warn('[AUTH] No se pudo sincronizar rol en profiles:', upRoleErr);
        return {
          ...found,
          _role_override: metadataRole ?? null,
        } satisfies ProfileWithOverride;
      }

      if (updated) {
        return {
          ...updated,
          _role_override: null,
        } satisfies ProfileWithOverride;
      }

      console.warn('[AUTH] Actualización de rol no devolvió datos, usando override local');
      return {
        ...found,
        _role_override: metadataRole ?? null,
      } satisfies ProfileWithOverride;
    }

    const finalOverride =
      metadataRole && metadataRole !== found.role ? metadataRole : null;
    return {
      ...found,
      _role_override: finalOverride,
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
    role: metadataRole ?? 'cliente',       // por defecto; luego lo cambias en DB si corresponde
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
    metadataRole,
  });

  if (!created) return null;

  const createOverride =
    metadataRole && metadataRole !== created.role ? metadataRole : null;

  return {
    ...created,
    _role_override: createOverride,
  } satisfies ProfileWithOverride;
}

/**
 * Devuelve el perfil actual (fila de `profiles`) con rol efectivo.
 * Si no hay sesión → null.
 */
export async function getCurrentProfile(): Promise<(ProfileRow & { role: Role }) | null> {
  const profile = await ensureProfile();
  if (!profile) return null;

  const override = profile._role_override;
  const role = override ?? (profile.role ?? 'cliente');

  const effectiveRole = (role as Role) ?? 'cliente';

  console.warn('[ROLE DEBUG] getCurrentProfile()', {
    auth_id: profile.id,
    table_user_id: profile.user_id,
    email: profile.email,
    role_db: profile.role,
    role_override: override,
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
  if (!allow.includes(role)) throw new Error('Sin permisos');
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
  return true;
}
