'use server';

import { createServerClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth/roles';

interface CaseForAgenda {
    case_id: string;
    caratulado: string;
    materia: string;
    prioridad: string;
    etapa_actual: string;
    nombre_cliente: string;
    updated_at: string;
    fecha_proxima: string | null;
}

/**
 * Get ALL active cases for the lawyer dashboard agenda
 * Groups by etapa_actual, shows all cases regardless of scheduled date
 */
export async function getActiveCasesForAgenda(): Promise<{
    success: boolean;
    data?: CaseForAgenda[];
    error?: string;
}> {
    try {
        const profile = await getCurrentProfile();
        if (!profile) {
            return { success: false, error: 'No autenticado' };
        }

        const supabase = await createServerClient();

        // Get ALL active cases - no date filtering
        const { data: cases, error: casesError } = await supabase
            .from('cases')
            .select(`
        id,
        caratulado,
        materia,
        prioridad,
        etapa_actual,
        nombre_cliente,
        updated_at,
        next_action_at
      `)
            .is('deleted_at', null)
            .eq('estado', 'activo')
            .order('prioridad', { ascending: true })
            .order('updated_at', { ascending: false });

        if (casesError) {
            console.error('Error fetching cases:', JSON.stringify(casesError, null, 2));
            return { success: false, error: casesError.message || 'Error de base de datos' };
        }

        if (!cases || cases.length === 0) {
            return { success: true, data: [] };
        }

        const result: CaseForAgenda[] = cases.map((c: any) => ({
            case_id: c.id,
            caratulado: c.caratulado,
            materia: c.materia || 'Sin materia',
            prioridad: c.prioridad || 'media',
            etapa_actual: c.etapa_actual || 'Sin etapa',
            nombre_cliente: c.nombre_cliente || 'Sin cliente',
            updated_at: c.updated_at,
            fecha_proxima: c.next_action_at,
        }));

        return { success: true, data: result };
    } catch (error) {
        console.error('Error getting cases:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

// Backward compatibility alias
export async function getCasesWithStages() {
    return getActiveCasesForAgenda();
}

export async function getUpcomingCaseStages() {
    return getActiveCasesForAgenda();
}
