'use server';

import { createServerClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth/roles';
import { deriveCaseMilestones } from '@/lib/cases/milestones';

interface CaseForAgenda {
    case_id: string;
    caratulado: string;
    numero_causa: string | null;
    materia: string;
    prioridad: string;
    etapa_actual: string;
    nombre_cliente: string;
    updated_at: string;
    last_activity_at?: string | null;
    fecha_proxima: string | null;
    etapa_proxima?: string | null;
    is_future_hito?: boolean;
}

/**
 * Get ALL active cases for the lawyer dashboard agenda
 * Groups by etapa_actual, shows all cases regardless of scheduled date
 */
export async function getActiveCasesForAgenda(lawyerId?: string): Promise<{
    success: boolean;
    data?: CaseForAgenda[];
    error?: string;
}> {
    try {
        const profile = await getCurrentProfile();
        if (!profile) {
            return { success: false, error: 'No autenticado' };
        }

        const role = (profile.role ?? '').trim().toLowerCase();
        const isAdmin = role === 'admin_firma' || role === 'admin';
        const targetLawyerId = lawyerId ?? (isAdmin ? null : profile.id);

        const supabase = await createServerClient();

        // Get ALL active cases - no date filtering
        let query = supabase
            .from('cases')
            .select(`
        id,
        caratulado,
        numero_causa,
        contraparte,
        materia,
        prioridad,
        etapa_actual,
        nombre_cliente,
        updated_at,
        next_action_at,
        next_action_title,
        fecha_inicio,
        notificacion_demanda_fecha,
        notificacion_demanda_estado,
        sentencia_fecha,
        sentencia_estado,
        fecha_desistimiento,
        case_stages (
            id,
            etapa,
            fecha_programada,
            fecha_cumplida,
            estado,
            audiencia_tipo,
            orden
        )
      `)
            .is('deleted_at', null)
            .in('estado', ['activo', 'terminado_apelacion'])
            .order('prioridad', { ascending: true })
            .order('updated_at', { ascending: false });

        if (targetLawyerId) {
            query = query.eq('abogado_responsable', targetLawyerId);
        }

        const { data: cases, error: casesError } = await query;

        if (casesError) {
            console.error('Error fetching cases:', JSON.stringify(casesError, null, 2));
            return { success: false, error: casesError.message || 'Error de base de datos' };
        }

        if (!cases || cases.length === 0) {
            return { success: true, data: [] };
        }

        const caseIds = cases.map((c: any) => c.id).filter(Boolean);

        const latestAuditByCaseId = new Map<string, string>();
        if (caseIds.length > 0) {
            const { data: auditRows, error: auditError } = await supabase
                .from('audit_log')
                .select('entity_id, created_at')
                .eq('entity_type', 'case')
                .in('entity_id', caseIds)
                .order('created_at', { ascending: false })
                .limit(2000);

            if (auditError) {
                console.warn('Error fetching case audit logs:', auditError.message);
            } else {
                for (const row of (auditRows ?? []) as any[]) {
                    const id = row?.entity_id as string | null | undefined;
                    const createdAt = row?.created_at as string | null | undefined;
                    if (!id || !createdAt) continue;
                    if (!latestAuditByCaseId.has(id)) latestAuditByCaseId.set(id, createdAt);
                }
            }
        }

        const todayStr = new Date().toISOString().split('T')[0] || '';

        const result: CaseForAgenda[] = cases.map((c: any) => {
            const auditAt = latestAuditByCaseId.get(c.id) ?? null;
            const caseUpdatedAt = (c.updated_at as string | null | undefined) ?? null;
            const lastActivityAt =
                auditAt && caseUpdatedAt
                    ? new Date(auditAt).getTime() >= new Date(caseUpdatedAt).getTime()
                        ? auditAt
                        : caseUpdatedAt
                    : auditAt ?? caseUpdatedAt;

            const milestones = deriveCaseMilestones(c);

            const s = String(c.etapa_actual || '').toLowerCase();
            const isTerminated = s.includes('terminad') || s.includes('cierre') || s.includes('desistim') || s.includes('archiv') || s.includes('abandon');

            let targetMilestone = null;
            let isFuture = false;

            if (isTerminated) {
                // If the case is dead, prioritize finding its termination date (or highest past milestone) rather than any future stray dates
                targetMilestone = milestones.slice().reverse().find(m =>
                    m.key === 'fecha_desistimiento' ||
                    m.key === 'sentencia_fecha' ||
                    m.label.toLowerCase().includes('cierre') ||
                    m.label.toLowerCase().includes('término')
                ) || (milestones.length > 0 ? milestones[milestones.length - 1] : null);
            } else {
                // If the case is active, look for the upcoming future event
                const futureMilestones = milestones.filter(m => m.date >= todayStr);
                targetMilestone = futureMilestones.length > 0 ? futureMilestones[0] : null;
                isFuture = !!targetMilestone;
            }

            return {
                case_id: c.id,
                caratulado: c.caratulado,
                numero_causa: c.numero_causa ?? null,
                demandado: c.contraparte ?? null,
                materia: c.materia || 'Sin materia',
                prioridad: c.prioridad || 'media',
                etapa_actual: c.etapa_actual || 'Sin etapa',
                nombre_cliente: c.nombre_cliente || 'Sin cliente',
                updated_at: c.updated_at,
                last_activity_at: lastActivityAt,
                fecha_proxima: targetMilestone ? targetMilestone.date : (isTerminated ? null : c.next_action_at ?? null),
                etapa_proxima: targetMilestone ? (targetMilestone.detail ?? targetMilestone.label) : null,
                is_future_hito: isFuture
            };
        });

        return { success: true, data: result };
    } catch (error) {
        console.error('Error getting cases:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

// Backward compatibility alias
export async function getCasesWithStages(lawyerId?: string) {
    return getActiveCasesForAgenda(lawyerId);
}

export async function getUpcomingCaseStages(lawyerId?: string) {
    return getActiveCasesForAgenda(lawyerId);
}
