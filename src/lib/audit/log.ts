'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
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

    const supabase = createClient();
    const headersList = headers();
    
    const auditData: AuditLogInsert = {
      actor_id: profile.id,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      diff_json: input.diff_json,
      ip_address: headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown',
      user_agent: headersList.get('user-agent') || 'unknown',
    };

    const { error } = await supabase
      .from('audit_log')
      .insert(auditData);

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

    const supabase = createClient();

    const { data: auditLogs, error } = await supabase
      .from('audit_log')
      .select(`
        *,
        actor:profiles(nombre)
      `)
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

    const supabase = createClient();
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

    stats?.forEach(log => {
      // Contar acciones
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      
      // Contar entidades
      entityCounts[log.entity_type] = (entityCounts[log.entity_type] || 0) + 1;
      
      // Actividad diaria
      const date = new Date(log.created_at).toISOString().split('T')[0];
      dailyActivity[date] = (dailyActivity[date] || 0) + 1;
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
