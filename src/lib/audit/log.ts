'use server';

import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth/roles';
import type { AuditLogInsert } from '@/lib/supabase/types';

interface LogAuditActionInput {
  action: string;
  entity_type: string;
  entity_id?: string;
  diff_json?: any;
}

/**
 * Registra una acción en el log de auditoría
 */
export async function logAuditAction(input: LogAuditActionInput) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      console.warn('Attempted to log audit action without authenticated user');
      return;
    }

    const supabase = await createServerClient();
    // Tu TS dice que headers() devuelve Promise<ReadonlyHeaders> -> usar await
    const headersList = await headers();

    const auditData: AuditLogInsert = {
      action: input.action,
      actor_id: profile.id,
      organization_id: (profile as any)?.active_organization_id ?? null,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null, // <- null, no undefined
      diff_json: input.diff_json as any, // si tu tipo es Json en supabase, castea
      ip_address:
        (headersList.get('x-forwarded-for') ??
          headersList.get('x-real-ip') ??
          'unknown') as unknown, // la columna es unknown en tus types
      user_agent: headersList.get('user-agent') ?? 'unknown',
      // created_at lo pone la DB si es default
    } as AuditLogInsert & { organization_id?: string | null };

    const { error } = await supabase.from('audit_log').insert(auditData);
    if (error) {
      console.error('Error logging audit action:', error);
    }
  } catch (error) {
    console.error('Error in logAuditAction:', error);
  }
}

/**
 * Obtiene el historial de auditoría para una entidad específica
 */
export async function getAuditHistory(entityType: string, entityId: string) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== 'admin_firma') {
      throw new Error('Sin permisos para ver auditoría');
    }

    const supabase = await createServerClient();

    const { data: auditLogs, error } = await supabase
      .from('audit_log')
      .select(
        `
        *,
        actor:profiles(nombre)
      `
      )
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching audit history:', error);
      throw new Error('Error al obtener historial de auditoría');
    }

    return { success: true, logs: auditLogs || [] };
  } catch (error) {
    console.error('Error in getAuditHistory:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      logs: [],
    };
  }
}

/**
 * Obtiene estadísticas de auditoría
 */
export async function getAuditStats(days: number = 30) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== 'admin_firma') {
      throw new Error('Sin permisos para ver estadísticas de auditoría');
    }

    const supabase = await createServerClient();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const { data: stats, error } = await supabase
      .from('audit_log')
      .select('action, entity_type, created_at')
      .gte('created_at', fromDate.toISOString());

    if (error) {
      console.error('Error fetching audit stats:', error);
      throw new Error('Error al obtener estadísticas de auditoría');
    }

    // Procesar estadísticas
    const actionCounts: Record<string, number> = {};
    const entityCounts: Record<string, number> = {};
    const dailyActivity: Record<string, number> = {};

    (stats ?? []).forEach((log: any) => {
      // Contar acciones
      if (log.action) {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      }

      // Contar entidades
      if (log.entity_type) {
        entityCounts[log.entity_type] = (entityCounts[log.entity_type] || 0) + 1;
      }

      // Actividad diaria: created_at puede ser null -> guard clause
      if (log.created_at) {
        const d = new Date(log.created_at);
        const dayKey = isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
        if (dayKey) {
          dailyActivity[dayKey] = (dailyActivity[dayKey] || 0) + 1;
        }
      }
    });

    return {
      success: true,
      stats: {
        totalActions: stats?.length || 0,
        actionCounts,
        entityCounts,
        dailyActivity,
      },
    };
  } catch (error) {
    console.error('Error in getAuditStats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      stats: null,
    };
  }
}

type CaseAuditHistoryOptions = {
  limit?: number;
};

/**
 * Obtiene historial de auditoría asociado a un caso:
 * - case (entity_id = caseId)
 * - case_stage / document / note / info_request (por IDs asociados al caseId)
 */
export async function getCaseAuditHistory(caseId: string, options: CaseAuditHistoryOptions = {}) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) throw new Error('No autenticado');

    const supabase = await createServerClient();

    // Validación de acceso vía RLS: si no puede leer el caso, no puede ver auditoría.
    const { data: caseRow, error: caseError } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .maybeSingle();
    if (caseError || !caseRow?.id) throw new Error('Sin permisos para ver auditoría de este caso');

    const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);

    const [stageIdsRes, docIdsRes, noteIdsRes, reqIdsRes] = await Promise.all([
      supabase.from('case_stages').select('id').eq('case_id', caseId),
      supabase.from('documents').select('id').eq('case_id', caseId),
      supabase.from('notes').select('id').eq('case_id', caseId),
      supabase.from('info_requests').select('id').eq('case_id', caseId),
    ]);

    const stageIds = (stageIdsRes.data ?? []).map((row: any) => row.id).filter(Boolean);
    const documentIds = (docIdsRes.data ?? []).map((row: any) => row.id).filter(Boolean);
    const noteIds = (noteIdsRes.data ?? []).map((row: any) => row.id).filter(Boolean);
    const requestIds = (reqIdsRes.data ?? []).map((row: any) => row.id).filter(Boolean);

    const selectWithActor = `
      *,
      actor:profiles(nombre, role)
    `;

    const fetchLogs = async (entityType: string, ids: string[] | 'case') => {
      let query = supabase.from('audit_log').select(selectWithActor).eq('entity_type', entityType);
      if (ids === 'case') {
        query = query.eq('entity_id', caseId);
      } else {
        if (ids.length === 0) return [] as any[];
        query = query.in('entity_id', ids);
      }
      const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
      if (error) {
        console.error('Error fetching audit logs:', { entityType, message: error.message });
        return [] as any[];
      }
      return data ?? [];
    };

    const [caseLogs, stageLogs, documentLogs, noteLogs, requestLogs] = await Promise.all([
      fetchLogs('case', 'case'),
      fetchLogs('case_stage', stageIds),
      fetchLogs('document', documentIds),
      fetchLogs('note', noteIds),
      fetchLogs('info_request', requestIds),
    ]);

    const merged = [...caseLogs, ...stageLogs, ...documentLogs, ...noteLogs, ...requestLogs]
      .filter((row) => row && row.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    return { success: true, logs: merged };
  } catch (error) {
    console.error('Error in getCaseAuditHistory:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      logs: [],
    };
  }
}
