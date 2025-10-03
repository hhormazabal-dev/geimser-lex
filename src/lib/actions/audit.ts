'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, requireAuth } from '@/lib/auth/roles';

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_values?: any;
  new_values?: any;
  changed_fields?: string[];
  user_id?: string;
  user_role?: string;
  user_email?: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  severity: string;
  category: string;
  description?: string;
  metadata?: any;
  created_at: string;
}

export interface SecurityAlert {
  alert_type: string;
  description: string;
  user_email?: string;
  ip_address?: string;
  severity: string;
  event_count: number;
  first_seen: string;
  last_seen: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  ip_address?: string;
  user_agent?: string;
  location_country?: string;
  location_city?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  is_active: boolean;
  last_activity: string;
  expires_at: string;
  created_at: string;
  ended_at?: string;
}

export interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string;
  user_agent?: string;
  success: boolean;
  failure_reason?: string;
  user_id?: string;
  session_id?: string;
  metadata?: any;
  created_at: string;
}

/**
 * Obtiene logs de auditoría con filtros
 */
export async function getAuditLogs(filters?: {
  table_name?: string;
  action?: string;
  user_id?: string;
  severity?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}): Promise<{ success: boolean; logs?: AuditLog[]; total?: number; error?: string }> {
  try {
    const profile = await requireAuth();
    
    // Solo admin puede ver todos los logs
    if (profile.role !== 'admin_firma') {
      throw new Error('Sin permisos para ver logs de auditoría');
    }

    const supabase = createClient();
    
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (filters?.table_name) {
      query = query.eq('table_name', filters.table_name);
    }

    if (filters?.action) {
      query = query.eq('action', filters.action);
    }

    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters?.severity) {
      query = query.eq('severity', filters.severity);
    }

    if (filters?.start_date) {
      query = query.gte('created_at', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('created_at', filters.end_date);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, (filters.offset + (filters.limit || 50)) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      success: true,
      logs: data || [],
      total: count || 0,
    };
  } catch (error) {
    console.error('Error getting audit logs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Obtiene alertas de seguridad
 */
export async function getSecurityAlerts(): Promise<{ success: boolean; alerts?: SecurityAlert[]; error?: string }> {
  try {
    const profile = await requireAuth();
    
    if (profile.role !== 'admin_firma') {
      throw new Error('Sin permisos para ver alertas de seguridad');
    }

    const supabase = createClient();

    const { data, error } = await supabase.rpc('detect_suspicious_activity');

    if (error) throw error;

    return {
      success: true,
      alerts: data || [],
    };
  } catch (error) {
    console.error('Error getting security alerts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Obtiene sesiones de usuario activas
 */
export async function getUserSessions(userId?: string): Promise<{ success: boolean; sessions?: UserSession[]; error?: string }> {
  try {
    const profile = await requireAuth();
    
    // Admin puede ver todas las sesiones, usuarios solo las suyas
    const targetUserId = profile.role === 'admin_firma' ? (userId || profile.id) : profile.id;

    const supabase = createClient();

    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .order('last_activity', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      sessions: data || [],
    };
  } catch (error) {
    console.error('Error getting user sessions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Termina una sesión de usuario
 */
export async function endUserSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const profile = await requireAuth();
    const supabase = createClient();

    // Verificar que el usuario puede terminar esta sesión
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    // Solo admin o el propio usuario pueden terminar la sesión
    if (profile.role !== 'admin_firma' && session.user_id !== profile.id) {
      throw new Error('Sin permisos para terminar esta sesión');
    }

    const { error } = await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error ending user session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Obtiene intentos de login recientes
 */
export async function getLoginAttempts(filters?: {
  email?: string;
  success?: boolean;
  start_date?: string;
  end_date?: string;
  limit?: number;
}): Promise<{ success: boolean; attempts?: LoginAttempt[]; error?: string }> {
  try {
    const profile = await requireAuth();
    
    if (profile.role !== 'admin_firma') {
      throw new Error('Sin permisos para ver intentos de login');
    }

    const supabase = createClient();
    
    let query = supabase
      .from('login_attempts')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.email) {
      query = query.ilike('email', `%${filters.email}%`);
    }

    if (filters?.success !== undefined) {
      query = query.eq('success', filters.success);
    }

    if (filters?.start_date) {
      query = query.gte('created_at', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('created_at', filters.end_date);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      success: true,
      attempts: data || [],
    };
  } catch (error) {
    console.error('Error getting login attempts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Registra un intento de login
 */
export async function logLoginAttempt(data: {
  email: string;
  ip_address: string;
  user_agent?: string;
  success: boolean;
  failure_reason?: string;
  user_id?: string;
  session_id?: string;
  metadata?: any;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('login_attempts')
      .insert({
        email: data.email,
        ip_address: data.ip_address,
        user_agent: data.user_agent,
        success: data.success,
        failure_reason: data.failure_reason,
        user_id: data.user_id,
        session_id: data.session_id,
        metadata: data.metadata,
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error logging login attempt:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Crea una nueva sesión de usuario
 */
export async function createUserSession(data: {
  user_id: string;
  session_token: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: string;
  metadata?: any;
}): Promise<{ success: boolean; session_id?: string; error?: string }> {
  try {
    const supabase = createClient();

    // Parsear user agent para extraer información del dispositivo
    const deviceInfo = parseUserAgent(data.user_agent || '');

    const { data: session, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: data.user_id,
        session_token: data.session_token,
        ip_address: data.ip_address,
        user_agent: data.user_agent,
        device_type: deviceInfo.device_type,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        expires_at: data.expires_at,
      })
      .select('id')
      .single();

    if (error) throw error;

    return {
      success: true,
      session_id: session.id,
    };
  } catch (error) {
    console.error('Error creating user session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Actualiza la actividad de una sesión
 */
export async function updateSessionActivity(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('user_sessions')
      .update({
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error updating session activity:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Obtiene estadísticas de auditoría
 */
export async function getAuditStats(period: 'day' | 'week' | 'month' = 'week'): Promise<{ 
  success: boolean; 
  stats?: {
    total_events: number;
    by_action: Record<string, number>;
    by_table: Record<string, number>;
    by_severity: Record<string, number>;
    by_user: Array<{ user_email: string; count: number }>;
    timeline: Array<{ date: string; count: number }>;
  }; 
  error?: string 
}> {
  try {
    const profile = await requireAuth();
    
    if (profile.role !== 'admin_firma') {
      throw new Error('Sin permisos para ver estadísticas de auditoría');
    }

    const supabase = createClient();
    
    const startDate = new Date();
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('action, table_name, severity, user_email, created_at')
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    const stats = {
      total_events: logs?.length || 0,
      by_action: {} as Record<string, number>,
      by_table: {} as Record<string, number>,
      by_severity: {} as Record<string, number>,
      by_user: [] as Array<{ user_email: string; count: number }>,
      timeline: [] as Array<{ date: string; count: number }>,
    };

    // Procesar estadísticas
    const userCounts: Record<string, number> = {};
    const dailyCounts: Record<string, number> = {};

    (logs || []).forEach(log => {
      // Por acción
      stats.by_action[log.action] = (stats.by_action[log.action] || 0) + 1;
      
      // Por tabla
      stats.by_table[log.table_name] = (stats.by_table[log.table_name] || 0) + 1;
      
      // Por severidad
      stats.by_severity[log.severity] = (stats.by_severity[log.severity] || 0) + 1;
      
      // Por usuario
      if (log.user_email) {
        userCounts[log.user_email] = (userCounts[log.user_email] || 0) + 1;
      }
      
      // Timeline diario
      const date = log.created_at.split('T')[0];
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    // Convertir a arrays ordenados
    stats.by_user = Object.entries(userCounts)
      .map(([user_email, count]) => ({ user_email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    stats.timeline = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      stats,
    };
  } catch (error) {
    console.error('Error getting audit stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Ejecuta limpieza de logs antiguos
 */
export async function cleanupOldLogs(): Promise<{ success: boolean; error?: string }> {
  try {
    const profile = await requireAuth();
    
    if (profile.role !== 'admin_firma') {
      throw new Error('Sin permisos para ejecutar limpieza');
    }

    const supabase = createClient();

    const { error } = await supabase.rpc('cleanup_old_audit_logs');

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error cleaning up old logs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Función auxiliar para parsear user agent
 */
function parseUserAgent(userAgent: string) {
  const result = {
    device_type: 'desktop',
    browser: 'unknown',
    os: 'unknown',
  };

  // Detectar dispositivo
  if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
    result.device_type = 'mobile';
  } else if (/Tablet|iPad/.test(userAgent)) {
    result.device_type = 'tablet';
  }

  // Detectar navegador
  if (/Chrome/.test(userAgent)) {
    result.browser = 'Chrome';
  } else if (/Firefox/.test(userAgent)) {
    result.browser = 'Firefox';
  } else if (/Safari/.test(userAgent)) {
    result.browser = 'Safari';
  } else if (/Edge/.test(userAgent)) {
    result.browser = 'Edge';
  }

  // Detectar OS
  if (/Windows/.test(userAgent)) {
    result.os = 'Windows';
  } else if (/Mac/.test(userAgent)) {
    result.os = 'macOS';
  } else if (/Linux/.test(userAgent)) {
    result.os = 'Linux';
  } else if (/Android/.test(userAgent)) {
    result.os = 'Android';
  } else if (/iOS/.test(userAgent)) {
    result.os = 'iOS';
  }

  return result;
}
