'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';

interface CaseStageForCalendar {
    id: string;
    case_id: string;
    caratulado: string;
    materia: string;
    prioridad: string;
    etapa: string;
    fecha_programada: string | null;
    tipo_actuacion: string | null;
    ubicacion: string | null;
    estado: string;
}

/**
 * Get all case stages with scheduled dates for calendar view
 */
export async function getCaseStagesForCalendar(lawyerId?: string): Promise<{
    success: boolean;
    data?: CaseStageForCalendar[];
    error?: string;
}> {
    try {
        const profile = await requireAuth();
        const targetLawyerId = lawyerId ?? profile.id;

        const supabase = await createServerClient();

        // Get all cases for this lawyer
        const { data: cases } = await supabase
            .from('cases')
            .select('id, caratulado, materia, prioridad')
            .eq('abogado_responsable', targetLawyerId)
            .is('deleted_at', null)
            .in('estado', ['activo', 'terminado_apelacion']);

        if (!cases || cases.length === 0) {
            return { success: true, data: [] };
        }

        const caseIds = cases.map((c) => c.id);

        // Get all stages for these cases with scheduled dates
        const { data: stages } = await supabase
            .from('case_stages')
            .select('id, case_id, etapa, fecha_programada, tipo_actuacion, ubicacion, estado')
            .in('case_id', caseIds)
            .not('fecha_programada', 'is', null)
            .order('fecha_programada', { ascending: true });

        if (!stages) {
            return { success: true, data: [] };
        }

        //  Combine stage data with case info
        const result: CaseStageForCalendar[] = stages.map((stage: any) => {
            const caseInfo = cases.find((c) => c.id === stage.case_id);
            return {
                id: stage.id,
                case_id: stage.case_id,
                caratulado: caseInfo?.caratulado ?? 'Sin título',
                materia: caseInfo?.materia ?? 'Sin especificar',
                prioridad: caseInfo?.prioridad ?? 'media',
                etapa: stage.etapa,
                fecha_programada: stage.fecha_programada,
                tipo_actuacion: stage.tipo_actuacion,
                ubicacion: stage.ubicacion,
                estado: stage.estado,
            };
        });

        return { success: true, data: result };
    } catch (error) {
        console.error('Error getting case stages for calendar:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}
