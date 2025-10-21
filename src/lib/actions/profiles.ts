'use server';

import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';
import type { Profile } from '@/lib/supabase/types';

interface DirectoryProfile extends Pick<Profile, 'id' | 'nombre' | 'role' | 'telefono' | 'rut' | 'email'> {}

function canUseServiceClient(role: Profile['role']) {
  return role === 'admin_firma' || role === 'analista';
}

async function getSupabaseClientForDirectory(role: Profile['role']) {
  if (canUseServiceClient(role) && process.env.SUPABASE_SERVICE_KEY) {
    return createServiceClient();
  }
  return createServerClient();
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
  return fetchProfilesByRole('abogado');
}

export async function getActiveClientsDirectory() {
  return fetchProfilesByRole('cliente');
}
