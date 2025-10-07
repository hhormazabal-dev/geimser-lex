'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';
import type { Json } from '@/lib/supabase/types';

/* =======================
   Tipos
======================= */
export interface AuditLog {
  id: string;
  table_name: string | null;
  record_id: string | null;
  action: string | null;
  old_values?: Json | null;
  new_values?: Json | null;
  changed_fields?: string[] | null;
  actor_id?: string | null;
  user_id?: string | null;
  user_role?: string | null;
  user_email?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  session_id?: string | null;
  severity: string | null;
  category: string | null;
  description?: string | null;
  metadata?: Json | null;
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
  ip_address?: string | null;
  user_agent?: string | null;
  location_country?: string | null;
  location_city?: string | null;
  device_type?: string | null;
  browser?: string | null;
  os?: string | null;
  is_active: boolean;
  last_activity: string;
  expires_at: string;
  created_at: string;
  ended_at?: string | null;
}

export interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string;
  user_agent?: string | null;
  success: boolean;
  failure_reason?: string | null;
  user_id?: string | null;
  session_id?: string | null;
  metadata?: Json | null;
  created_at: string;
}

/* =======================
   Normalizador
======================= */
type RawAuditRow = {
  id: string;
  table_name?: string | null;
  record_id?: string | null;
  action?: string | null;
  old_values?: Json | null;
  new_values?: Json | null;
  changed_fields?: string[] | null;
  actor_id?: string | null;
  user_id?: string | null;
  user_role?: string | null;
  user_email?: string | null;
  ip_address?: unknown;           // <-- puede venir como unknown en tipos generados
  user_agent?: string | null;
  session_id?: string | null;
  severity?: string | null;
  category?: string | null;
  description?: string | null;
  metadata?: Json | null;
  created_at?: string | null;
};

function normalizeAuditRow(row: RawAuditRow): AuditLog {
  return {
    id: row.id,
    table_name: row.table_name ?? null,
    record_id: row.record_id ?? null,
    action: row.action ?? null,
    old_values: row.old_values ?? null,
    new_values: row.new_values ?? null,
    changed_fields: row.changed_fields ?? null,
    actor_id: row.actor_id ?? row.user_id ?? null,
    user_id: row.user_id ?? null,
    user_role: row.user_role ?? null,
    user_email: row.user_email ?? null,
    ip_address: row.ip_address == null ? null : String(row.ip_address), // <-- conversión segura
    user_agent: row.user_agent ?? null,
    session_id: row.session_id ?? null,
    severity: row.severity ?? null,
    category: row.category ?? null,
    description: row.description ?? null,
    metadata: row.metadata ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

/* =======================
   AUDIT LOGS
======================= */
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
    if (profile.role !== 'admin_firma') throw new Error('Sin permisos para ver logs de auditoría');

    const supabase = await createServerClient();

    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters?.table_name) query = query.eq('table_name', filters.table_name);
    if (filters?.action) query = query.eq('action', filters.action);
    if (filters?.user_id) query = query.eq('actor_id', filters.user_id);
    if (filters?.severity) query = query.eq('severity', filters.severity);
    if (filters?.start_date) query = query.gte('created_at', filters.start_date);
    if (filters?.end_date) query = query.lte('created_at', filters.end_date);
    if (typeof filters?.limit === 'number') query = query.limit(filters.limit);
    if (typeof filters?.offset === 'number') {
      const from = filters.offset;
      const to = from + (filters.limit ?? 50) - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const normalized: AuditLog[] = (data as unknown as RawAuditRow[]).map(normalizeAuditRow);
    return { success: true, logs: normalized, total: count ?? 0 };
  } catch (error) {
    console.error('getAuditLogs', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/* =======================
   SECURITY ALERTS (RPC)
======================= */
export async function getSecurityAlerts(): Promise<{ success: boolean; alerts?: SecurityAlert[]; error?: string }> {
  try {
    const profile = await requireAuth();
    if (profile.role !== 'admin_firma') throw new Error('Sin permisos para ver alertas de seguridad');

    const supabase = await createServerClient();
    const { data, error } = await (supabase as any).rpc('detect_suspicious_activity');
    if (error) throw error;

    const alerts: SecurityAlert[] = Array.isArray(data)
      ? (data as SecurityAlert[])
      : data
      ? [data as SecurityAlert]
      : [];

    return { success: true, alerts };
  } catch (error) {
    console.error('getSecurityAlerts', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/* =======================
   USER SESSIONS
======================= */
export async function getUserSessions(userId?: string): Promise<{ success: boolean; sessions?: UserSession[]; error?: string }> {
  try {
    const profile = await requireAuth();
    const targetUserId = profile.role === 'admin_firma' ? (userId || profile.id) : profile.id;

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .order('last_activity', { ascending: false });

    if (error) throw error;
    return { success: true, sessions: (data as UserSession[]) ?? [] };
  } catch (error) {
    console.error('getUserSessions', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

export async function endUserSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const profile = await requireAuth();
    const supabase = await createServerClient();

    const { data: session, error: sErr } = await supabase
      .from('user_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (sErr) throw sErr;
    if (!session) throw new Error('Sesión no encontrada');
    if (profile.role !== 'admin_firma' && session.user_id !== profile.id) throw new Error('Sin permisos');

    const { error } = await supabase
      .from('user_sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('endUserSession', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/* =======================
   LOGIN ATTEMPTS
======================= */
export async function getLoginAttempts(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ success: boolean; attempts?: LoginAttempt[]; total?: number; error?: string }> {
  try {
    const profile = await requireAuth();
    if (profile.role !== 'admin_firma') throw new Error('Sin permisos para ver intentos de login');

    const supabase = await createServerClient();

    let q = supabase
      .from('login_attempts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (typeof params?.limit === 'number') q = q.limit(params.limit);
    if (typeof params?.offset === 'number') {
      const from = params.offset;
      const to = from + (params?.limit ?? 50) - 1;
      q = q.range(from, to);
    }

    const { data, error, count } = await q;
    if (error) throw error;

    return {
      success: true,
      attempts: (data as LoginAttempt[]) ?? [],
      total: count ?? 0,
    };
  } catch (err) {
    console.error('getLoginAttempts', err);
    return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

/* =======================
   AUDIT STATS
======================= */
type StatsPeriod = 'day' | 'week' | 'month';

export async function getAuditStats(
  period: StatsPeriod = 'week'
): Promise<{
  success: boolean;
  stats?: {
    total_events: number;
    by_action: Record<string, number>;
    by_user: Array<{ user_email: string | null; count: number }>;
    timeline: Array<{ date: string; count: number }>;
  };
  error?: string;
}> {
  try {
    const profile = await requireAuth();
    if (profile.role !== 'admin_firma') throw new Error('Sin permisos para ver estadísticas');

    const supabase = await createServerClient();

    // Rango de fechas
    const now = new Date();
    const from = new Date(now);
    if (period === 'day') from.setDate(now.getDate() - 1);
    else if (period === 'week') from.setDate(now.getDate() - 7);
    else from.setDate(now.getDate() - 30);

    const { data, error } = await supabase
      .from('audit_log')
      .select('action, actor_id, created_at')
      .gte('created_at', from.toISOString())
      .lte('created_at', now.toISOString());

    if (error) throw error;

    const rows = (data ?? []) as Array<{
      action: string | null;
      actor_id: string | null;
      created_at: string | null;
    }>;

    const by_action: Record<string, number> = {};
    const by_actor: Record<string, number> = {};
    const timelineMap: Record<string, number> = {};

    for (const r of rows) {
      const actionKey = (r.action ?? 'UNKNOWN').toUpperCase();
      by_action[actionKey] = (by_action[actionKey] || 0) + 1;

      const actorKey = typeof r.actor_id === 'string' && r.actor_id.length > 0 ? r.actor_id : 'unknown';
      by_actor[actorKey] = (by_actor[actorKey] || 0) + 1;

      const d = r.created_at ? new Date(r.created_at) : null;
      const dayKey = d ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      timelineMap[dayKey] = (timelineMap[dayKey] || 0) + 1;
    }

    const actorIds: string[] = Object.keys(by_actor).filter((id) => id !== 'unknown');

    let emailMap: Record<string, string | null> = {};

    if (actorIds.length > 0) {
      const { data: profilesData, error: pErr } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', actorIds);

      if (!pErr && Array.isArray(profilesData)) {
        emailMap = (profilesData as Array<{ id: string | null; email: string | null }>).reduce((acc, p) => {
          if (p && typeof p.id === 'string') acc[p.id] = p.email ?? null;
          return acc;
        }, {} as Record<string, string | null>);
      }
    }

    const by_user = Object.entries(by_actor)
      .map(([actorId, count]) => {
        const email = actorId === 'unknown' ? null : (emailMap[actorId] ?? null);
        return { user_email: email, count };
      })
      .sort((a, b) => b.count - a.count);

    const timeline = Object.entries(timelineMap)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, count]) => ({ date, count }));

    return {
      success: true,
      stats: {
        total_events: rows.length,
        by_action,
        by_user,
        timeline,
      },
    };
  } catch (err) {
    console.error('getAuditStats', err);
    return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

/* =======================
   CLEANUP OLD LOGS
======================= */
export async function cleanupOldLogs(days: number = 90): Promise<{ success: boolean; removed?: number; error?: string }> {
  try {
    const profile = await requireAuth();
    if (profile.role !== 'admin_firma') throw new Error('Sin permisos');

    const supabase = await createServerClient();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { error, count } = await supabase
      .from('audit_log')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString());

    if (error) throw error;
    return { success: true, removed: count ?? 0 };
  } catch (err) {
    console.error('cleanupOldLogs', err);
    return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' };
  }
}
