'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';
import type { Profile } from '@/lib/supabase/types';

interface DirectoryProfile extends Pick<Profile, 'id' | 'nombre' | 'role' | 'telefono' | 'rut' | 'email'> {}

async function getSupabaseClientForDirectory(role: Profile['role']) {
  void role;
  return createServerClient();
}

type OrgMemberRole = 'org_admin' | 'lawyer' | 'staff';

async function fetchProfilesByOrgRoles(orgRoles: OrgMemberRole[]): Promise<DirectoryProfile[]> {
  const authProfile = await requireAuth();
  const supabase = await getSupabaseClientForDirectory(authProfile.role);
  const orgId = (authProfile as { active_organization_id?: string | null }).active_organization_id ?? null;

  if (!orgId) {
    console.warn('No active organization set for directory fetch.');
    return [];
  }

  const { data: members, error: membersError } = await (supabase as any)
    .from('org_members')
    .select('user_id, role')
    .eq('organization_id', orgId)
    .in('role', orgRoles);

  if (membersError) {
    console.error('Error fetching org members for directory:', membersError);
    return [];
  }

  const userIds = Array.from(
    new Set((members ?? []).map((member: { user_id?: string | null }) => member.user_id).filter(Boolean) as string[]),
  );

  if (userIds.length === 0) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, role, telefono, rut, email')
    .in('user_id', userIds)
    .eq('activo', true)
    .order('nombre');

  if (error) {
    console.error('Error fetching profiles for org directory:', error);
    return [];
  }

  return (data as DirectoryProfile[]) || [];
}

async function fetchProfilesByRole(targetRole: Profile['role']): Promise<DirectoryProfile[]> {
  const authProfile = await requireAuth();
  const supabase = await getSupabaseClientForDirectory(authProfile.role);

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, role, telefono, rut, email')
    .eq('role', targetRole)
    .eq('activo', true)
    .order('nombre');

  if (error) {
    console.error(`Error fetching profiles for role ${targetRole}:`, error);
    return [];
  }

  return (data as DirectoryProfile[]) || [];
}

export async function getAssignableLawyers() {
  return fetchProfilesByOrgRoles(['lawyer', 'org_admin']);
}

export async function getActiveClientsDirectory() {
  return fetchProfilesByRole('cliente');
}
