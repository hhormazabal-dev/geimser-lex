'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import type { Database, ProfileInsert, ProfileUpdate } from '@/lib/supabase/types';
import { requireAuth } from '@/lib/auth/roles';
import {
  createManagedUserSchema,
  updateManagedUserSchema,
  type CreateManagedUserInput,
  type UpdateManagedUserInput,
  type ManagedUserRole,
} from '@/lib/validators/admin-users';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';

const ADMIN_USERS_PATH = '/dashboard/admin/users';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ProfileRowExtended = ProfileRow & {
  active_organization_id?: string | null;
  organization_id?: string | null;
};
type ServiceClient = ReturnType<typeof createServiceClient>;
type AuthUserLite = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

export type ManagedOrganization = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  isDefault: boolean;
};

export type ManagedUser = {
  profileId: string;
  userId: string;
  email: string;
  nombre: string;
  role: ManagedUserRole;
  globalRoles: ManagedUserRole[];
  rut: string | null;
  telefono: string | null;
  activo: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  activeOrganizationId: string | null;
  organizationId: string | null;
};

export type ManagedUsersResult = {
  success: boolean;
  users?: ManagedUser[];
  error?: string;
};

export type ManagedOrganizationsResult = {
  success: boolean;
  organizations?: ManagedOrganization[];
  error?: string;
};

function mapRowToManagedUser(row: ProfileRowExtended, authUser?: AuthUserLite | null): ManagedUser | null {
  const email = row.email ?? authUser?.email ?? null;
  if (!email) return null;

  const role = (row.role ?? 'cliente') as ManagedUserRole;

  return {
    profileId: row.id,
    userId: row.user_id,
    email,
    nombre: row.nombre,
    role,
    globalRoles: [role],
    rut: row.rut ?? null,
    telefono: row.telefono ?? null,
    activo: row.activo ?? true,
    createdAt: authUser?.created_at ?? row.created_at ?? null,
    lastSignInAt: authUser?.last_sign_in_at ?? null,
    activeOrganizationId: row.active_organization_id ?? null,
    organizationId: row.organization_id ?? null,
  };
}

function getHighestRole(roles: ManagedUserRole[]): ManagedUserRole {
  const priority: Record<ManagedUserRole, number> = {
    admin_firma: 300,
    abogado: 200,
    analista: 100,
    cliente: 0,
  };
  const unique = Array.from(new Set((roles ?? []).filter(Boolean))) as ManagedUserRole[];
  const sorted = unique.sort((a, b) => (priority[b] ?? 0) - (priority[a] ?? 0));
  return sorted[0] ?? 'cliente';
}

function parseGlobalRolesFromFormData(formData: FormData, primaryRole: ManagedUserRole): ManagedUserRole[] {
  const raw = formData.getAll('global_roles').map((v) => String(v).trim()) as string[];
  const roleSet = new Set<ManagedUserRole>();
  roleSet.add(primaryRole);
  for (const r of raw) {
    if ((['admin_firma', 'abogado', 'analista', 'cliente'] as const).includes(r as any)) {
      roleSet.add(r as ManagedUserRole);
    }
  }
  return Array.from(roleSet);
}

async function syncUserRbacRoles(service: ServiceClient, userId: string, roles: ManagedUserRole[]) {
  const uniqueRoles = Array.from(new Set((roles ?? []).filter(Boolean)));

  const { data: existingRows, error: selErr } = await service
    .from('rbac_user_roles' as any)
    .select('role_key')
    .eq('user_id', userId);
  if (selErr) throw selErr;

  const existing = new Set<string>((existingRows ?? []).map((r: any) => String(r.role_key)));
  const desired = new Set<string>(uniqueRoles);

  const toInsert = Array.from(desired).filter((r) => !existing.has(r));
  const toDelete = Array.from(existing).filter((r) => !desired.has(r));

  if (toInsert.length) {
    const payload = toInsert.map((role_key) => ({ user_id: userId, role_key }));
    const { error: insErr } = await service.from('rbac_user_roles' as any).insert(payload);
    if (insErr) throw insErr;
  }

  if (toDelete.length) {
    const { error: delErr } = await service
      .from('rbac_user_roles' as any)
      .delete()
      .eq('user_id', userId)
      .in('role_key', toDelete);
    if (delErr) throw delErr;
  }
}

async function ensureAdminAccess() {
  const profile = await requireAuth();
  if (profile.role !== 'admin_firma') {
    const supabase = (await createServerClient()) as any;
    const { data: isSuperAdmin } = await supabase.rpc('is_super_admin');
    if (!isSuperAdmin) throw new Error('Sin permisos administrativos');
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Falta configurar SUPABASE_SERVICE_ROLE_KEY');
  }
}

function parseCheckbox(value: FormDataEntryValue | null) {
  if (typeof value === 'string') return ['on', 'true', '1'].includes(value.toLowerCase());
  return Boolean(value);
}

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeCreateInput(formData: FormData) {
  const tentative: Partial<CreateManagedUserInput> = {
    email: getStringValue(formData, 'email'),
    password: getStringValue(formData, 'password'),
    nombre: getStringValue(formData, 'nombre'),
    role: getStringValue(formData, 'role') as ManagedUserRole,
    rut: getStringValue(formData, 'rut') || undefined,
    telefono: getStringValue(formData, 'telefono') || undefined,
    activo: parseCheckbox(formData.get('activo')),
  };
  const result = createManagedUserSchema.safeParse(tentative);
  if (!result.success) return { error: result.error.errors[0]?.message ?? 'Datos inválidos' };
  return { data: result.data };
}

function sanitizeUpdateInput(formData: FormData) {
  const tentative: Partial<UpdateManagedUserInput> = {
    email: getStringValue(formData, 'email'),
    password: getStringValue(formData, 'password') || undefined,
    nombre: getStringValue(formData, 'nombre'),
    role: getStringValue(formData, 'role') as ManagedUserRole,
    rut: getStringValue(formData, 'rut') || undefined,
    telefono: getStringValue(formData, 'telefono') || undefined,
    activo: parseCheckbox(formData.get('activo')),
  };
  const result = updateManagedUserSchema.safeParse(tentative);
  if (!result.success) return { error: result.error.errors[0]?.message ?? 'Datos inválidos' };
  return { data: result.data };
}

function sortUsers(users: ManagedUser[]) {
  return [...users].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

async function buildAuthUserMap(client: ServiceClient) {
  const map = new Map<string, AuthUserLite>();
  const perPage = 200;
  let page = 1;

  let hasMore = true;

  while (hasMore) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    for (const user of users) {
      map.set(user.id, {
        id: user.id,
        email: user.email ?? null,
        created_at: user.created_at ?? null,
        last_sign_in_at: user.last_sign_in_at ?? null,
      });
    }

    if (users.length < perPage) {
      hasMore = false;
    } else {
      page += 1;
    }
  }

  return map;
}

export async function fetchManagedUsers(): Promise<ManagedUsersResult> {
  try {
    await ensureAdminAccess();
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        user_id,
        email,
        nombre,
        role,
        rut,
        telefono,
        activo,
        created_at,
        active_organization_id,
        organization_id
      `)
      .order('nombre', { ascending: true })
      .returns<ProfileRowExtended[]>();

    if (error) {
      console.error('[fetchManagedUsers] error', error);
      return { success: false, error: 'No se pudieron obtener los usuarios' };
    }

    let authUserMap: Map<string, AuthUserLite>;
    try {
      authUserMap = await buildAuthUserMap(supabase);
    } catch (authError) {
      console.error('[fetchManagedUsers] auth admin list error', authError);
      return {
        success: false,
        error: authError instanceof Error ? authError.message : 'No se pudieron obtener usuarios de autenticación',
      };
    }

    const users = (data ?? [])
      .map((row) => mapRowToManagedUser(row, authUserMap.get(row.user_id)))
      .filter((u): u is ManagedUser => Boolean(u));

    // Attach RBAC global roles (multi-role). Fallback to profiles.role if RBAC table not present yet.
    try {
      const userIds = Array.from(new Set(users.map((u) => u.userId).filter(Boolean)));
      if (userIds.length) {
        const { data: rolesRows } = await supabase
          .from('rbac_user_roles' as any)
          .select('user_id, role_key')
          .in('user_id', userIds);

        const rolesByUser = new Map<string, ManagedUserRole[]>();
        for (const rr of rolesRows ?? []) {
          const uid = String((rr as any).user_id ?? '');
          const roleKey = String((rr as any).role_key ?? '') as ManagedUserRole;
          if (!uid || !roleKey) continue;
          const current = rolesByUser.get(uid) ?? [];
          current.push(roleKey);
          rolesByUser.set(uid, current);
        }

        for (const u of users) {
          const roles = rolesByUser.get(u.userId);
          if (roles && roles.length) {
            u.globalRoles = Array.from(new Set(roles));
          } else {
            u.globalRoles = [u.role];
          }
        }
      }
    } catch {
      // ignore (RBAC not migrated yet)
    }

    return { success: true, users: sortUsers(users) };
  } catch (error) {
    console.error('[fetchManagedUsers] unexpected', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error inesperado' };
  }
}

export async function fetchManagedOrganizations(): Promise<ManagedOrganizationsResult> {
  try {
    await ensureAdminAccess();
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from('organizations' as any)
      .select('id, name, status, is_default')
      .order('name', { ascending: true });

    if (error) {
      console.error('[fetchManagedOrganizations] error', error);
      return { success: false, error: 'No se pudieron obtener las empresas' };
    }

    const organizations: ManagedOrganization[] = (data ?? []).map((row: any) => ({
      id: String(row.id),
      name: String(row.name ?? 'Empresa'),
      status: (row.status === 'inactive' ? 'inactive' : 'active') as ManagedOrganization['status'],
      isDefault: Boolean(row.is_default),
    }));

    return { success: true, organizations };
  } catch (error) {
    console.error('[fetchManagedOrganizations] unexpected', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error inesperado' };
  }
}

export async function createManagedUser(formData: FormData): Promise<ManagedUsersResult> {
  try {
    await ensureAdminAccess();
    const parsed = sanitizeCreateInput(formData);
    const createData = parsed.data as CreateManagedUserInput | undefined;
    if (!createData) return { success: false, error: parsed.error ?? 'Datos inválidos' };

    const { email, password, role, nombre, rut, telefono, activo } = createData;
    const rutValue = typeof rut === 'string' ? rut : null;
    const telefonoValue = typeof telefono === 'string' ? telefono : null;
    const activoValue = typeof activo === 'boolean' ? activo : true;
    const rawOrganizationId = getStringValue(formData, 'organization_id') || undefined;
    const organizationId = rawOrganizationId && rawOrganizationId.length > 0 ? rawOrganizationId : undefined;

    if (organizationId && !isUuid(organizationId)) {
      return { success: false, error: 'Empresa inválida' };
    }

    const serverSupabase = (await createServerClient()) as any;
    const { data: authData } = await serverSupabase.auth.getUser();
    const callerId = authData?.user?.id ?? null;
    if (!callerId) return { success: false, error: 'No autenticado' };

    if (organizationId) {
      const { data: org, error: orgErr } = await serverSupabase
        .from('organizations')
        .select('id, status')
        .eq('id', organizationId)
        .maybeSingle();
      if (orgErr) return { success: false, error: orgErr.message ?? 'No se pudo validar la empresa' };
      if (!org?.id || org.status !== 'active') {
        return { success: false, error: 'La empresa seleccionada no existe o está inactiva' };
      }

      const { data: isSuper, error: superErr } = await serverSupabase.rpc('is_super_admin');
      if (superErr) return { success: false, error: 'No se pudieron validar permisos' };

      if (!isSuper) {
        const { data: callerMembership, error: memErr } = await serverSupabase
          .from('org_members')
          .select('role')
          .eq('organization_id', organizationId)
          .eq('user_id', callerId)
          .maybeSingle();
        if (memErr) return { success: false, error: 'No se pudieron validar permisos' };
        if (!callerMembership || callerMembership.role !== 'org_admin') {
          return { success: false, error: 'Sin permisos para asignar a esta empresa' };
        }
      }
    }

    const supabase = await createServiceClient();

    const created = await supabase.auth.admin.createUser({
      email: email as string,
      password: password as string,
      email_confirm: true,
      app_metadata: { role: role as ManagedUserRole },
      user_metadata: { nombre, role },
    });

    if (created.error) return { success: false, error: created.error.message };

    const userId = created.data.user?.id;
    if (!userId) return { success: false, error: 'Supabase no devolvió el ID del nuevo usuario' };

    // 🔧 FIX: añadimos el email en el payload
    const profilePayload: ProfileInsert = {
      id: userId,
      user_id: userId,
      email: email as string,
      nombre: nombre as string,
      role: role as ManagedUserRole,
      rut: rutValue,
      telefono: telefonoValue,
      activo: activoValue,
    };

    const { error: profileError } = await supabase.from('profiles').upsert(profilePayload, {
      onConflict: 'id',
    });

    if (profileError) {
      console.error('[createManagedUser] profile error', profileError);
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
      return { success: false, error: 'No se pudo guardar el perfil del usuario' };
    }

    if (organizationId) {
      try {
        if (role === 'cliente') {
          const { error: orgAssignErr } = await supabase
            .from('profiles')
            .update({ organization_id: organizationId } as any)
            .eq('user_id', userId);
          if (orgAssignErr) throw orgAssignErr;
        } else {
          const { error: transferErr } = await serverSupabase.rpc('transfer_lawyer_to_org', {
            p_user_id: userId,
            p_new_org_id: organizationId,
            p_mode: 'B',
          });
          if (transferErr) throw transferErr;
        }
      } catch (orgAssignError) {
        console.error('[createManagedUser] org assignment error', orgAssignError);
        await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
        try {
          await supabase.from('profiles').delete().eq('user_id', userId);
        } catch {
          // ignore rollback failure
        }
        return {
          success: false,
          error:
            orgAssignError instanceof Error
              ? orgAssignError.message
              : 'No se pudo asignar la empresa al usuario',
          users: (await fetchManagedUsers()).users ?? [],
        };
      }
    }

    // RBAC roles: by default assign primary role only (editable later).
    try {
      await syncUserRbacRoles(supabase, userId, [role]);
    } catch (rbacErr) {
      console.warn('[createManagedUser] RBAC sync skipped/failed:', rbacErr);
    }

    revalidatePath(ADMIN_USERS_PATH);
    return fetchManagedUsers();
  } catch (error) {
    console.error('[createManagedUser] unexpected', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error inesperado al crear el usuario' };
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function updateManagedUserOrganization(
  userId: string,
  organizationId: string | null,
  mode: 'A' | 'B' = 'A',
): Promise<ManagedUsersResult & { transfer?: unknown }> {
  try {
    await ensureAdminAccess();

    const trimmedOrgId = organizationId?.trim() || null;
    if (trimmedOrgId && !isUuid(trimmedOrgId)) {
      return { success: false, error: 'Empresa inválida' };
    }

    const service = await createServiceClient();
    const { data: targetProfile, error: targetErr } = await service
      .from('profiles')
      .select('id, user_id, role')
      .eq('user_id', userId)
      .maybeSingle();

    if (targetErr) {
      console.error('[updateManagedUserOrganization] target profile error', targetErr);
      return { success: false, error: 'No se pudo leer el usuario' };
    }
    if (!targetProfile?.user_id) return { success: false, error: 'Usuario no encontrado' };

    const targetRole = String((targetProfile as any).role ?? 'cliente') as ManagedUserRole;

    if (trimmedOrgId) {
      const { data: org, error: orgErr } = await service
        .from('organizations' as any)
        .select('id, status')
        .eq('id', trimmedOrgId)
        .maybeSingle();
      if (orgErr) {
        console.error('[updateManagedUserOrganization] org lookup error', orgErr);
        return { success: false, error: 'No se pudo validar la empresa' };
      }
      const orgRow = org as any;
      if (!orgRow?.id || orgRow.status !== 'active') {
        return { success: false, error: 'La empresa destino no existe o está inactiva' };
      }
    }

    if (targetRole === 'cliente') {
      const serverSupabase = (await createServerClient()) as any;
      const { data: authData } = await serverSupabase.auth.getUser();
      const callerId = authData?.user?.id ?? null;
      if (!callerId) return { success: false, error: 'No autenticado' };

      const { data: isSuper, error: superErr } = await serverSupabase.rpc('is_super_admin');
      if (superErr) return { success: false, error: 'No se pudieron validar permisos' };

      if (!trimmedOrgId && !isSuper) {
        return { success: false, error: 'Solo el super admin puede dejar un cliente sin empresa' };
      }

      if (!isSuper && trimmedOrgId) {
        const { data: callerMembership, error: memErr } = await serverSupabase
          .from('org_members')
          .select('role')
          .eq('organization_id', trimmedOrgId)
          .eq('user_id', callerId)
          .maybeSingle();
        if (memErr) return { success: false, error: 'No se pudieron validar permisos' };
        if (!callerMembership || callerMembership.role !== 'org_admin') {
          return { success: false, error: 'Sin permisos para asignar a esta empresa' };
        }
      }

      const { error: updateErr } = await service
        .from('profiles')
        .update({ organization_id: trimmedOrgId } as any)
        .eq('user_id', userId);

      if (updateErr) {
        console.error('[updateManagedUserOrganization] client update error', updateErr);
        return { success: false, error: 'No se pudo reasignar la empresa del cliente' };
      }

      revalidatePath(ADMIN_USERS_PATH);
      return fetchManagedUsers();
    }

    if (!trimmedOrgId) {
      return { success: false, error: 'Los usuarios internos deben pertenecer a una empresa' };
    }

    const serverSupabase = (await createServerClient()) as any;
    const { data: transfer, error: rpcErr } = await serverSupabase.rpc('transfer_lawyer_to_org', {
      p_user_id: userId,
      p_new_org_id: trimmedOrgId,
      p_mode: mode,
    });

    if (rpcErr) {
      console.error('[updateManagedUserOrganization] transfer rpc error', rpcErr);
      return { success: false, error: rpcErr.message ?? 'No se pudo transferir el usuario' };
    }

    revalidatePath(ADMIN_USERS_PATH);
    const refreshed = await fetchManagedUsers();
    return { ...refreshed, transfer };
  } catch (error) {
    console.error('[updateManagedUserOrganization] unexpected', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error inesperado' };
  }
}

export async function updateManagedUser(userId: string, formData: FormData): Promise<ManagedUsersResult> {
  try {
    await ensureAdminAccess();
    const parsed = sanitizeUpdateInput(formData);
    const updateData = parsed.data as UpdateManagedUserInput | undefined;
    if (!updateData) return { success: false, error: parsed.error ?? 'Datos inválidos' };

    const { email, password, role, nombre, rut, telefono, activo } = updateData;
    const globalRoles = parseGlobalRolesFromFormData(formData, role);
    const primaryRole = getHighestRole(globalRoles);
    const rutValue = typeof rut === 'string' ? rut : null;
    const telefonoValue = typeof telefono === 'string' ? telefono : null;
    const activoValue = typeof activo === 'boolean' ? activo : true;

    const supabase = await createServiceClient();

    const userUpdatePayload: Record<string, unknown> = {
      email,
      email_confirm: true,
      app_metadata: { role: primaryRole as ManagedUserRole },
      user_metadata: { nombre, role: primaryRole as ManagedUserRole },
    };
    if (password) userUpdatePayload.password = password;

    const { error: authError } = await supabase.auth.admin.updateUserById(userId, userUpdatePayload);
    if (authError) return { success: false, error: authError.message };

    const profileUpdatePayload: ProfileUpdate = {
      nombre: nombre as string,
      email: email as string,
      role: primaryRole as ManagedUserRole,
      rut: rutValue,
      telefono: telefonoValue,
      activo: activoValue,
    };

    const { error: profileError } = await supabase.from('profiles')
      .update(profileUpdatePayload)
      .eq('user_id', userId);

    if (profileError) {
      console.error('[updateManagedUser] profile error', profileError);
      return { success: false, error: 'No se pudo actualizar el perfil del usuario' };
    }

    // RBAC: update multi-role assignment
    try {
      await syncUserRbacRoles(supabase, userId, globalRoles);
    } catch (rbacErr) {
      console.warn('[updateManagedUser] RBAC sync skipped/failed:', rbacErr);
    }

    revalidatePath(ADMIN_USERS_PATH);
    return fetchManagedUsers();
  } catch (error) {
    console.error('[updateManagedUser] unexpected', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error inesperado al actualizar el usuario' };
  }
}

export async function deactivateManagedUser(userId: string): Promise<ManagedUsersResult> {
  try {
    await ensureAdminAccess();
    const supabase = await createServiceClient();

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ activo: false })
      .eq('user_id', userId);

    if (profileError) {
      console.error('[deactivateManagedUser] profile error', profileError);
      return { success: false, error: 'No se pudo desactivar la cuenta' };
    }

    revalidatePath(ADMIN_USERS_PATH);
    return fetchManagedUsers();
  } catch (error) {
    console.error('[deactivateManagedUser] unexpected', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error inesperado al desactivar el usuario' };
  }
}

export async function deleteManagedUser(userId: string): Promise<ManagedUsersResult> {
  try {
    await ensureAdminAccess();
    const supabase = await createServiceClient();

    const attemptDelete = async () => supabase.auth.admin.deleteUser(userId);

    const deletion = await attemptDelete();

    if (!deletion.error) {
      revalidatePath(ADMIN_USERS_PATH);
      return fetchManagedUsers();
    }

    console.error('[deleteManagedUser] auth delete error', deletion.error);

    const message = deletion.error.message || '';
    const shouldAttemptCascade =
      /foreign key/i.test(message) ||
      /constraint/i.test(message) ||
      /database error deleting user/i.test(message);

    if (shouldAttemptCascade) {
      const { error: profileDeleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (!profileDeleteError) {
        const retry = await attemptDelete();
        if (!retry.error) {
          revalidatePath(ADMIN_USERS_PATH);
          return fetchManagedUsers();
        }
        console.error('[deleteManagedUser] retry auth delete error', retry.error);
      } else {
        console.error('[deleteManagedUser] profile delete error', profileDeleteError);
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ activo: false })
        .eq('user_id', userId);

      if (profileError) {
        console.error('[deleteManagedUser] deactivate fallback error', profileError);
        return { success: false, error: profileDeleteError?.message ?? message };
      }

      revalidatePath(ADMIN_USERS_PATH);
      const refreshed = await fetchManagedUsers();
      return {
        success: false,
        users: refreshed.users ?? [],
        error: 'El usuario tiene registros asociados y no se puede eliminar. Se desactivó la cuenta.',
      };
    }

    return { success: false, error: deletion.error.message };
  } catch (error) {
    console.error('[deleteManagedUser] unexpected', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error inesperado al eliminar el usuario' };
  }
}
