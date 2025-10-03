import { createClient } from '@/lib/supabase/server';
import type { UserRole, Profile } from '@/lib/supabase/types';

/**
 * Obtiene el perfil del usuario actual
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return profile;
}

/**
 * Verifica si el usuario actual tiene un rol específico
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.role === role;
}

/**
 * Verifica si el usuario actual es admin
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole('admin_firma');
}

/**
 * Verifica si el usuario actual es abogado
 */
export async function isAbogado(): Promise<boolean> {
  return hasRole('abogado');
}

/**
 * Verifica si el usuario actual es cliente
 */
export async function isCliente(): Promise<boolean> {
  return hasRole('cliente');
}

/**
 * Verifica si el usuario actual puede acceder a un caso específico
 */
export async function canAccessCase(caseId: string): Promise<boolean> {
  const supabase = createClient();
  const profile = await getCurrentProfile();
  
  if (!profile) {
    return false;
  }

  // Admin puede acceder a todos los casos
  if (profile.role === 'admin_firma') {
    return true;
  }

  // Abogado puede acceder si es responsable o colaborador
  if (profile.role === 'abogado') {
    const { data: caseData } = await supabase
      .from('cases')
      .select('abogado_responsable')
      .eq('id', caseId)
      .single();

    if (caseData?.abogado_responsable === profile.id) {
      return true;
    }

    const { data: collaborator } = await supabase
      .from('case_collaborators')
      .select('id')
      .eq('case_id', caseId)
      .eq('abogado_id', profile.id)
      .single();

    return !!collaborator;
  }

  // Cliente puede acceder si está asignado al caso
  if (profile.role === 'cliente') {
    const { data: clientCase } = await supabase
      .from('case_clients')
      .select('id')
      .eq('case_id', caseId)
      .eq('client_profile_id', profile.id)
      .single();

    return !!clientCase;
  }

  return false;
}

/**
 * Obtiene todos los casos accesibles para el usuario actual
 */
export async function getAccessibleCases() {
  const supabase = createClient();
  const profile = await getCurrentProfile();
  
  if (!profile) {
    return [];
  }

  let query = supabase
    .from('cases')
    .select(`
      *,
      abogado_responsable:profiles!cases_abogado_responsable_fkey(nombre),
      case_stages(id, etapa, estado, fecha_programada, orden)
    `);

  // Filtrar según el rol
  if (profile.role === 'abogado') {
    query = query.or(`abogado_responsable.eq.${profile.id},case_collaborators.abogado_id.eq.${profile.id}`);
  } else if (profile.role === 'cliente') {
    query = query.in('id', 
      await supabase
        .from('case_clients')
        .select('case_id')
        .eq('client_profile_id', profile.id)
        .then(({ data }) => data?.map(cc => cc.case_id) || [])
    );
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching accessible cases:', error);
    return [];
  }

  return data || [];
}

/**
 * Middleware para verificar autenticación y roles
 */
export async function requireAuth(requiredRole?: UserRole) {
  const profile = await getCurrentProfile();
  
  if (!profile) {
    throw new Error('No autenticado');
  }

  if (requiredRole && profile.role !== requiredRole && profile.role !== 'admin_firma') {
    throw new Error('Sin permisos suficientes');
  }

  return profile;
}

/**
 * Verifica si el usuario puede realizar una acción específica
 */
export async function canPerformAction(action: string, resourceId?: string): Promise<boolean> {
  const profile = await getCurrentProfile();
  
  if (!profile) {
    return false;
  }

  // Admin puede hacer todo
  if (profile.role === 'admin_firma') {
    return true;
  }

  switch (action) {
    case 'create_case':
      return profile.role === 'abogado';
    
    case 'edit_case':
      return profile.role === 'abogado' && resourceId ? await canAccessCase(resourceId) : false;
    
    case 'view_case':
      return resourceId ? await canAccessCase(resourceId) : false;
    
    case 'create_note':
      return profile.role === 'abogado' && resourceId ? await canAccessCase(resourceId) : false;
    
    case 'upload_document':
      return resourceId ? await canAccessCase(resourceId) : false;
    
    case 'create_info_request':
      return profile.role === 'abogado' && resourceId ? await canAccessCase(resourceId) : false;
    
    case 'respond_info_request':
      return profile.role === 'cliente' && resourceId ? await canAccessCase(resourceId) : false;
    
    case 'view_audit_log':
      return profile.role === 'admin_firma';
    
    case 'manage_users':
      return profile.role === 'admin_firma';
    
    default:
      return false;
  }
}

/**
 * Obtiene estadísticas del usuario actual
 */
export async function getUserStats() {
  const supabase = createClient();
  const profile = await getCurrentProfile();
  
  if (!profile) {
    return null;
  }

  const stats: any = {
    totalCases: 0,
    activeCases: 0,
    pendingRequests: 0,
    completedStages: 0,
  };

  if (profile.role === 'admin_firma') {
    // Estadísticas globales para admin
    const { count: totalCases } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true });
    
    const { count: activeCases } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'activo');

    stats.totalCases = totalCases || 0;
    stats.activeCases = activeCases || 0;
  } else if (profile.role === 'abogado') {
    // Estadísticas para abogado
    const { count: totalCases } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .eq('abogado_responsable', profile.id);
    
    const { count: activeCases } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .eq('abogado_responsable', profile.id)
      .eq('estado', 'activo');

    const { count: pendingRequests } = await supabase
      .from('info_requests')
      .select('*, cases!inner(*)', { count: 'exact', head: true })
      .eq('cases.abogado_responsable', profile.id)
      .eq('estado', 'pendiente');

    stats.totalCases = totalCases || 0;
    stats.activeCases = activeCases || 0;
    stats.pendingRequests = pendingRequests || 0;
  } else if (profile.role === 'cliente') {
    // Estadísticas para cliente
    const caseIds = await supabase
      .from('case_clients')
      .select('case_id')
      .eq('client_profile_id', profile.id)
      .then(({ data }) => data?.map(cc => cc.case_id) || []);

    if (caseIds.length > 0) {
      const { count: totalCases } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .in('id', caseIds);

      const { count: pendingRequests } = await supabase
        .from('info_requests')
        .select('*', { count: 'exact', head: true })
        .in('case_id', caseIds)
        .eq('estado', 'pendiente');

      stats.totalCases = totalCases || 0;
      stats.pendingRequests = pendingRequests || 0;
    }
  }

  return stats;
}
