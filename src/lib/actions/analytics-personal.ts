'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';
import { zonedTimeToUtc } from 'date-fns-tz';

/* ==================== Personal Performance Interfaces ==================== */

export interface PersonalStats {
    casosCerradosMes: number;
    casosCerradosMesAnterior: number;
    casosActivosActuales: number;
    rankingEnEquipo: number; // 1-based ranking
    totalAbogados: number;
    tiempoPromedioResolucion: number; // días
    valorTotalGestionado: number;
}

export interface WorkloadGauge {
    casosActivos: number;
    capacidadMaxima: number; // ej: 15
    porcentaje: number;
    status: 'low' | 'optimal' | 'high' | 'overload'; // <50%, 50-80%, 80-100%, >100%
}

export interface TimeDistribution {
    materia: string;
    horas: number;
    porcentaje: number;
    casosActivos: number;
}

export interface UpcomingDeadline {
    caseId: string;
    caratulado: string;
    etapa: string;
    fechaProgramada: string;
    horasRestantes: number;
    prioridad: string;
}

export interface SpecializationRadar {
    materia: string;
    casosCompletados: number;
    casosActivos: number;
    tasaExito: number; // porcentaje
    experiencia: number; // 0-100 basado en cantidad
}

/* ==================== Personal Stats ==================== */

export async function getPersonalStats(lawyerId?: string): Promise<{ success: boolean; data?: PersonalStats; error?: string }> {
    try {
        const profile = await requireAuth();
        const role = (profile.role ?? '').trim().toLowerCase();
        const isAdmin = role === 'admin_firma' || role === 'admin';

        const supabase = await createServerClient();
        const now = new Date();
        const mesActual = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

        // Build base query - if admin and no specific lawyerId, show ALL cases
        const targetLawyerId = lawyerId ?? (isAdmin ? null : profile.id);

        // Casos cerrados este mes
        let queryCerrados = supabase
            .from('cases')
            .select('id, fecha_inicio, updated_at')
            .is('deleted_at', null)
            .in('estado', ['terminado', 'terminado_desistido_demandante'])
            .gte('updated_at', mesActual);

        if (targetLawyerId) {
            queryCerrados = queryCerrados.eq('abogado_responsable', targetLawyerId);
        }
        const { data: casosEsteMes } = await queryCerrados;

        // Casos cerrados mes anterior
        let queryMesAnterior = supabase
            .from('cases')
            .select('id')
            .is('deleted_at', null)
            .in('estado', ['terminado', 'terminado_desistido_demandante'])
            .gte('updated_at', mesAnterior)
            .lt('updated_at', mesActual);

        if (targetLawyerId) {
            queryMesAnterior = queryMesAnterior.eq('abogado_responsable', targetLawyerId);
        }
        const { data: casosMesAnterior } = await queryMesAnterior;

        // Casos activos actuales
        let queryActivos = supabase
            .from('cases')
            .select('valor_estimado')
            .is('deleted_at', null)
            .in('estado', ['activo', 'terminado_apelacion']);

        if (targetLawyerId) {
            queryActivos = queryActivos.eq('abogado_responsable', targetLawyerId);
        }
        const { data: casosActivos } = await queryActivos;

        // Ranking en equipo
        const { data: todosAbogados } = await supabase
            .from('profiles')
            .select('id')
            .in('role', ['abogado', 'admin_firma']);

        const abogadosConCasos = await Promise.all(
            (todosAbogados ?? []).map(async (abogado: any) => {
                const { data } = await supabase
                    .from('cases')
                    .select('id')
                    .eq('abogado_responsable', abogado.id)
                    .is('deleted_at', null)
                    .in('estado', ['terminado', 'terminado_desistido_demandante'])
                    .gte('updated_at', mesActual);

                return { id: abogado.id, count: (data ?? []).length };
            })
        );

        abogadosConCasos.sort((a, b) => b.count - a.count);
        const ranking = abogadosConCasos.findIndex(a => a.id === profile.id) + 1;

        // Tiempo promedio de resolución
        const tiempos = (casosEsteMes ?? []).map((c: any) => {
            if (!c.fecha_inicio || !c.updated_at) return 0;
            const inicio = new Date(c.fecha_inicio).getTime();
            const fin = new Date(c.updated_at).getTime();
            return Math.max(0, Math.round((fin - inicio) / (1000 * 60 * 60 * 24)));
        }).filter(d => d > 0);

        const tiempoPromedioResolucion = tiempos.length > 0
            ? Math.round(tiempos.reduce((sum, t) => sum + t, 0) / tiempos.length)
            : 0;

        const valorTotalGestionado = (casosActivos ?? []).reduce((sum, c: any) => sum + (c.valor_estimado ?? 0), 0);

        return {
            success: true,
            data: {
                casosCerradosMes: (casosEsteMes ?? []).length,
                casosCerradosMesAnterior: (casosMesAnterior ?? []).length,
                casosActivosActuales: (casosActivos ?? []).length,
                rankingEnEquipo: ranking || 1,
                totalAbogados: (todosAbogados ?? []).length,
                tiempoPromedioResolucion,
                valorTotalGestionado,
            },
        };
    } catch (error) {
        console.error('Error getting personal stats:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

/* ==================== Workload Gauge ==================== */

export async function getWorkloadGauge(lawyerId?: string): Promise<{ success: boolean; data?: WorkloadGauge; error?: string }> {
    try {
        const profile = await requireAuth();
        const role = (profile.role ?? '').trim().toLowerCase();
        const isAdmin = role === 'admin_firma' || role === 'admin';
        const targetLawyerId = lawyerId ?? (isAdmin ? null : profile.id);

        const supabase = await createServerClient();

        let query = supabase
            .from('cases')
            .select('id')
            .is('deleted_at', null)
            .in('estado', ['activo', 'terminado_apelacion']);

        if (targetLawyerId) {
            query = query.eq('abogado_responsable', targetLawyerId);
        }

        const { data: casosActivos } = await query;

        const count = (casosActivos ?? []).length;
        // Si es admin viendo todos, capacidad es mayor
        const capacidadMaxima = isAdmin && !targetLawyerId ? 100 : 15;
        const porcentaje = Math.round((count / capacidadMaxima) * 100);

        let status: 'low' | 'optimal' | 'high' | 'overload';
        if (porcentaje < 50) status = 'low';
        else if (porcentaje <= 80) status = 'optimal';
        else if (porcentaje <= 100) status = 'high';
        else status = 'overload';

        return {
            success: true,
            data: {
                casosActivos: count,
                capacidadMaxima,
                porcentaje,
                status,
            },
        };
    } catch (error) {
        console.error('Error getting workload gauge:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

/* ==================== Time Distribution ==================== */

export async function getTimeDistribution(lawyerId?: string): Promise<{ success: boolean; data?: TimeDistribution[]; error?: string }> {
    try {
        const profile = await requireAuth();
        const role = (profile.role ?? '').trim().toLowerCase();
        const isAdmin = role === 'admin_firma' || role === 'admin';
        const targetLawyerId = lawyerId ?? (isAdmin ? null : profile.id);

        const supabase = await createServerClient();

        let query = supabase
            .from('cases')
            .select('materia')
            .is('deleted_at', null)
            .in('estado', ['activo', 'terminado_apelacion']);

        if (targetLawyerId) {
            query = query.eq('abogado_responsable', targetLawyerId);
        }

        const { data: casos } = await query;

        const materiaMap = (casos ?? []).reduce((map, c: any) => {
            const materia = c.materia || 'Sin especificar';
            map.set(materia, (map.get(materia) || 0) + 1);
            return map;
        }, new Map<string, number>());

        const total = (casos ?? []).length;
        const horasPorCaso = 10; // Asumiendo 10 horas promedio por caso activo

        const result: TimeDistribution[] = Array.from(materiaMap.entries()).map(([materia, count]) => ({
            materia,
            horas: count * horasPorCaso,
            porcentaje: total > 0 ? Math.round((count / total) * 100) : 0,
            casosActivos: count,
        })).sort((a, b) => b.horas - a.horas);

        return { success: true, data: result };
    } catch (error) {
        console.error('Error getting time distribution:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

/* ==================== Upcoming Deadlines (48hrs) ==================== */

export async function getUpcomingDeadlines48h(lawyerId?: string): Promise<{ success: boolean; data?: UpcomingDeadline[]; error?: string }> {
    try {
        const profile = await requireAuth();
        const role = (profile.role ?? '').trim().toLowerCase();
        const isAdmin = role === 'admin_firma' || role === 'admin';
        const targetLawyerId = lawyerId ?? (isAdmin ? null : profile.id);

        const supabase = await createServerClient();

        const CHILE_TZ = 'America/Santiago';
        const chileDateOnly = new Intl.DateTimeFormat('fr-CA', {
            timeZone: CHILE_TZ,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });

        const now = new Date();
        const maxHours = 48;

        // `fecha_programada` es DATE (YYYY-MM-DD). Consultamos por rango de fechas en hora Chile
        // para evitar desfases por UTC y luego filtramos por <= 48h.
        const today = chileDateOnly.format(now);
        const plus2 = new Date(now);
        plus2.setDate(plus2.getDate() + 2);
        const plus2Day = chileDateOnly.format(plus2);

        // Get upcoming stages
        const { data: stages } = await supabase
            .from('case_stages')
            .select('case_id, etapa, fecha_programada, estado')
            .gte('fecha_programada', today)
            .lte('fecha_programada', plus2Day)
            .eq('estado', 'pendiente');

        if (!stages || stages.length === 0) {
            return { success: true, data: [] };
        }

        const caseIds = [...new Set(stages.map((s: any) => s.case_id))];

        let queryCase = supabase
            .from('cases')
            .select('id, caratulado, prioridad, abogado_responsable')
            .in('id', caseIds)
            .is('deleted_at', null);

        if (targetLawyerId) {
            queryCase = queryCase.eq('abogado_responsable', targetLawyerId);
        }

        const { data: casos } = await queryCase;

        const result: UpcomingDeadline[] = stages
            .filter((stage: any) => casos?.some((c: any) => c.id === stage.case_id))
            .map((stage: any) => {
                const caso = casos?.find((c: any) => c.id === stage.case_id);
                const dateOnly = String(stage.fecha_programada ?? '').slice(0, 10);
                // Interpretar DATE como fin del día en Chile para no adelantar vencimientos por desfase UTC.
                const endOfDayUtc = zonedTimeToUtc(`${dateOnly}T23:59:59.999`, CHILE_TZ);
                const deltaHours = Math.round((endOfDayUtc.getTime() - now.getTime()) / (1000 * 60 * 60));
                const horasRestantes = Math.max(0, deltaHours);

                return {
                    caseId: stage.case_id,
                    caratulado: caso?.caratulado ?? 'Sin título',
                    etapa: stage.etapa,
                    fechaProgramada: stage.fecha_programada,
                    horasRestantes,
                    prioridad: caso?.prioridad ?? 'media',
                };
            })
            .filter((d) => d.horasRestantes <= maxHours)
            .sort((a, b) => a.horasRestantes - b.horasRestantes);

        return { success: true, data: result };
    } catch (error) {
        console.error('Error getting upcoming deadlines:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

/* ==================== Specialization Radar ==================== */

export async function getSpecializationRadar(lawyerId?: string): Promise<{ success: boolean; data?: SpecializationRadar[]; error?: string }> {
    try {
        const profile = await requireAuth();
        const role = (profile.role ?? '').trim().toLowerCase();
        const isAdmin = role === 'admin_firma' || role === 'admin';
        const targetLawyerId = lawyerId ?? (isAdmin ? null : profile.id);

        const supabase = await createServerClient();

        let query = supabase
            .from('cases')
            .select('materia, estado, resultado')
            .is('deleted_at', null);

        if (targetLawyerId) {
            query = query.eq('abogado_responsable', targetLawyerId);
        }

        const { data: todosCasos } = await query;

        const materiaMap = (todosCasos ?? []).reduce((map, c: any) => {
            const materia = c.materia || 'Sin especificar';

            if (!map.has(materia)) {
                map.set(materia, { completados: 0, activos: 0, exitosos: 0 });
            }

            const stats = map.get(materia)!;

            if (c.estado === 'terminado' || c.estado === 'terminado_desistido_demandante') {
                stats.completados++;
                const resultado = (c.resultado ?? '').toLowerCase();
                if (resultado.includes('favorable') || resultado.includes('ganado') || resultado.includes('acuerdo')) {
                    stats.exitosos++;
                }
            } else if (c.estado === 'activo' || c.estado === 'terminado_apelacion') {
                stats.activos++;
            }

            return map;
        }, new Map<string, { completados: number; activos: number; exitosos: number }>());

        const result: SpecializationRadar[] = Array.from(materiaMap.entries()).map(([materia, stats]) => {
            const total = stats.completados + stats.activos;
            const tasaExito = stats.completados > 0 ? Math.round((stats.exitosos / stats.completados) * 100) : 0;
            const experiencia = Math.min(100, total * 5); // 5 puntos por caso, máx 100

            return {
                materia,
                casosCompletados: stats.completados,
                casosActivos: stats.activos,
                tasaExito,
                experiencia,
            };
        }).sort((a, b) => b.experiencia - a.experiencia).slice(0, 6); // Top 6 materias

        return { success: true, data: result };
    } catch (error) {
        console.error('Error getting specialization radar:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}
