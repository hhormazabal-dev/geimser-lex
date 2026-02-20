'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';

/* ==================== Business Intelligence Interfaces ==================== */

export interface FinancialKPIs {
    facturadoMes: number;
    facturadoMesAnterior: number;
    pendienteCobro: number;
    tiempoPromedioResolucion: number; // días
    tiempoPromedioAnterior: number;
    casosCerradosMes: number;
    clientesActivos: number;
    nuevosClientesMes: number;
    retencionClientes: number; // porcentaje
}

export interface ConversionFunnelStage {
    stage: 'consultas' | 'casos_iniciados' | 'en_litigio' | 'terminados' | 'ganados';
    label: string;
    value: number;
    percentage: number; // % del stage anterior
}

export interface RevenueByMateria {
    materia: string;
    revenue: number;
    percentage: number;
    caseCount: number;
}

export interface LawyerPerformanceMonth {
    month: string; // "2026-01"
    casosResueltos: number;
    status: 'high' | 'medium' | 'low'; // >8, 5-8, <5
}

export interface LawyerPerformanceGrid {
    lawyerId: string;
    nombre: string;
    monthData: LawyerPerformanceMonth[];
    avgCasosPorMes: number;
}

/* ==================== Financial Summary ==================== */

/**
 * Obtiene KPIs financieros y de eficiencia para el dashboard ejecutivo
 */
export async function getFinancialKPIs(): Promise<{ success: boolean; data?: FinancialKPIs; error?: string }> {
    try {
        const profile = await requireAuth();
        const role = (profile.role ?? '').trim().toLowerCase();

        if (role !== 'admin_firma' && role !== 'admin') {
            return { success: false, error: 'Sin permisos' };
        }

        const supabase = await createServerClient();
        const now = new Date();
        const mesActual = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const mesDosAnterior = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();

        // Facturado este mes (casos terminados este mes)
        const { data: casosEsteMes } = await supabase
            .from('cases')
            .select('valor_estimado, created_at, updated_at')
            .is('deleted_at', null)
            .in('estado', ['terminado', 'terminado_desistido_demandante'])
            .gte('updated_at', mesActual);

        // Facturado mes anterior
        const { data: casosMesAnterior } = await supabase
            .from('cases')
            .select('valor_estimado')
            .is('deleted_at', null)
            .in('estado', ['terminado', 'terminado_desistido_demandante'])
            .gte('updated_at', mesAnterior)
            .lt('updated_at', mesActual);

        // Pendiente de cobro (casos activos)
        const { data: casosActivos } = await supabase
            .from('cases')
            .select('valor_estimado')
            .is('deleted_at', null)
            .in('estado', ['activo', 'terminado_apelacion']);

        // Tiempo promedio de resolución (últimos 30 casos terminados)
        const { data: casosTerminados } = await supabase
            .from('cases')
            .select('fecha_inicio, updated_at')
            .is('deleted_at', null)
            .in('estado', ['terminado', 'terminado_desistido_demandante'])
            .order('updated_at', { ascending: false })
            .limit(60);

        // Clientes activos y nuevos
        const { data: todosClientes } = await supabase
            .from('profiles')
            .select('id, created_at')
            .eq('role', 'cliente');

        const facturadoMes = (casosEsteMes ?? []).reduce((sum, c: any) => sum + (c.valor_estimado ?? 0), 0);
        const facturadoMesAnterior = (casosMesAnterior ?? []).reduce((sum, c: any) => sum + (c.valor_estimado ?? 0), 0);
        const pendienteCobro = (casosActivos ?? []).reduce((sum, c: any) => sum + (c.valor_estimado ?? 0), 0);

        // Calcular tiempos promedio
        const tiemposRecientes = (casosTerminados ?? []).slice(0, 30).map((c: any) => {
            if (!c.fecha_inicio || !c.updated_at) return 0;
            const inicio = new Date(c.fecha_inicio).getTime();
            const fin = new Date(c.updated_at).getTime();
            return Math.max(0, Math.round((fin - inicio) / (1000 * 60 * 60 * 24)));
        }).filter(d => d > 0);

        const tiemposAnteriores = (casosTerminados ?? []).slice(30, 60).map((c: any) => {
            if (!c.fecha_inicio || !c.updated_at) return 0;
            const inicio = new Date(c.fecha_inicio).getTime();
            const fin = new Date(c.updated_at).getTime();
            return Math.max(0, Math.round((fin - inicio) / (1000 * 60 * 60 * 24)));
        }).filter(d => d > 0);

        const tiempoPromedioResolucion = tiemposRecientes.length > 0
            ? Math.round(tiemposRecientes.reduce((sum, t) => sum + t, 0) / tiemposRecientes.length)
            : 0;

        const tiempoPromedioAnterior = tiemposAnteriores.length > 0
            ? Math.round(tiemposAnteriores.reduce((sum, t) => sum + t, 0) / tiemposAnteriores.length)
            : 0;

        const clientesActivos = (todosClientes ?? []).length;
        const nuevosClientesMes = (todosClientes ?? []).filter((c: any) => c.created_at >= mesActual).length;
        const retencionClientes = clientesActivos > 0 ? Math.round(((clientesActivos - nuevosClientesMes) / clientesActivos) * 100) : 0;

        return {
            success: true,
            data: {
                facturadoMes,
                facturadoMesAnterior,
                pendienteCobro,
                tiempoPromedioResolucion,
                tiempoPromedioAnterior,
                casosCerradosMes: (casosEsteMes ?? []).length,
                clientesActivos,
                nuevosClientesMes,
                retencionClientes,
            },
        };
    } catch (error) {
        console.error('Error getting financial KPIs:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

/* ==================== Conversion Funnel ==================== */

/**
 * Obtiene datos para el funnel de conversión de casos
 */
export async function getConversionFunnel(): Promise<{ success: boolean; data?: ConversionFunnelStage[]; error?: string }> {
    try {
        const profile = await requireAuth();
        const role = (profile.role ?? '').trim().toLowerCase();

        if (role !== 'admin_firma' && role !== 'admin') {
            return { success: false, error: 'Sin permisos' };
        }

        const supabase = await createServerClient();

        // Últimos 12 meses
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 12);

        // 1. Consultas = todos los casos creados en el periodo
        const { data: todos, error } = await supabase
            .from('cases')
            .select('id, estado, sentencia_estado, etapa_actual')
            .is('deleted_at', null)
            .gte('created_at', startDate.toISOString());

        if (error) console.error("Error in getConversionFunnel cases query:", error);

        const todosLista = todos ?? [];
        const countConsultas = todosLista.length;

        // 2. Casos iniciados = casos con estado != null (han avanzado de borrador)
        const casosIniciados = todosLista.filter((c: any) =>
            c.estado && c.estado !== 'borrador' && c.estado !== 'pendiente'
        );
        const countIniciados = casosIniciados.length;

        // 3. En litigio = casos activos
        const enLitigio = todosLista.filter((c: any) =>
            c.estado === 'activo' || c.estado === 'terminado_apelacion'
        );
        const countLitigio = enLitigio.length;

        // 4. Terminados = casos con estado terminado
        const terminados = todosLista.filter((c: any) =>
            c.estado === 'terminado' || c.estado === 'terminado_desistido_demandante'
        );
        const countTerminados = terminados.length;

        // 5. Ganados = casos con resultado favorable
        const ganados = terminados.filter((c: any) => {
            const sentencia = (c.sentencia_estado ?? '').toLowerCase();
            return sentencia === 'dictada' || sentencia.includes('favorable') || sentencia.includes('ganado') || sentencia.includes('acuerdo') || sentencia.includes('exitoso');
        });
        const countGanados = ganados.length;

        const funnel: ConversionFunnelStage[] = [
            {
                stage: 'consultas',
                label: 'Consultas',
                value: countConsultas,
                percentage: 100,
            },
            {
                stage: 'casos_iniciados',
                label: 'Casos Iniciados',
                value: countIniciados,
                percentage: countConsultas > 0 ? Math.round((countIniciados / countConsultas) * 100) : 0,
            },
            {
                stage: 'en_litigio',
                label: 'En Litigio',
                value: countLitigio,
                percentage: countIniciados > 0 ? Math.round((countLitigio / countIniciados) * 100) : 0,
            },
            {
                stage: 'terminados',
                label: 'Terminados',
                value: countTerminados,
                percentage: countConsultas > 0 ? Math.round((countTerminados / countConsultas) * 100) : 0,
            },
            {
                stage: 'ganados',
                label: 'Ganados',
                value: countGanados,
                percentage: countTerminados > 0 ? Math.round((countGanados / countTerminados) * 100) : 0,
            },
        ];

        return { success: true, data: funnel };
    } catch (error) {
        console.error('Error getting conversion funnel:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

/* ==================== Revenue by Materia ==================== */

/**
 * Obtiene distribución de ingresos por materia
 */
export async function getRevenueByMateria(): Promise<{ success: boolean; data?: RevenueByMateria[]; error?: string }> {
    try {
        const profile = await requireAuth();
        const role = (profile.role ?? '').trim().toLowerCase();

        if (role !== 'admin_firma' && role !== 'admin') {
            return { success: false, error: 'Sin permisos' };
        }

        const supabase = await createServerClient();

        // Últimos 12 meses de casos completados
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 12);

        const { data: cases } = await supabase
            .from('cases')
            .select('materia, valor_estimado')
            .is('deleted_at', null)
            .gte('created_at', startDate.toISOString());

        const materiaMap = (cases ?? []).reduce((map, c: any) => {
            const materia = c.materia || 'Sin especificar';
            const revenue = c.valor_estimado ?? 0;

            if (!map.has(materia)) {
                map.set(materia, { revenue: 0, count: 0 });
            }

            const current = map.get(materia)!;
            current.revenue += revenue;
            current.count += 1;

            return map;
        }, new Map<string, { revenue: number; count: number }>());

        const total = Array.from(materiaMap.values()).reduce((sum, m) => sum + m.revenue, 0);

        const result: RevenueByMateria[] = Array.from(materiaMap.entries()).map(([materia, data]) => ({
            materia,
            revenue: data.revenue,
            percentage: total > 0 ? Math.round((data.revenue / total) * 100) : 0,
            caseCount: data.count,
        })).sort((a, b) => b.revenue - a.revenue);

        return { success: true, data: result };
    } catch (error) {
        console.error('Error getting revenue by materia:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

/* ==================== Lawyer Performance Grid ==================== */

/**
 * Obtiene heatmap de desempeño de abogados por mes
 */
export async function getLawyerPerformanceGrid(): Promise<{ success: boolean; data?: LawyerPerformanceGrid[]; error?: string }> {
    try {
        const profile = await requireAuth();
        const role = (profile.role ?? '').trim().toLowerCase();

        if (role !== 'admin_firma' && role !== 'admin') {
            return { success: false, error: 'Sin permisos' };
        }

        const supabase = await createServerClient();

        // Obtener últimos 6 meses
        const months = 6;
        const monthKeys: string[] = [];
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            monthKeys.push(d.toISOString().slice(0, 7));
        }

        // Obtener abogados
        const { data: lawyers } = await supabase
            .from('profiles')
            .select('id, nombre')
            .in('role', ['abogado', 'admin_firma']);

        if (!lawyers || lawyers.length === 0) {
            return { success: true, data: [] };
        }

        // Para cada abogado, obtener casos resueltos por mes
        const gridData: LawyerPerformanceGrid[] = await Promise.all(
            lawyers.map(async (lawyer: any) => {
                const monthData: LawyerPerformanceMonth[] = [];

                for (const monthKey of monthKeys) {
                    const monthStart = `${monthKey}-01`;
                    const nextMonth = new Date(monthStart);
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    const monthEnd = nextMonth.toISOString().slice(0, 10);

                    const { data: casosResueltos } = await supabase
                        .from('cases')
                        .select('id')
                        .eq('abogado_responsable', lawyer.id)
                        .is('deleted_at', null)
                        .in('estado', ['terminado', 'terminado_desistido_demandante'])
                        .gte('updated_at', monthStart)
                        .lt('updated_at', monthEnd);

                    const count = (casosResueltos ?? []).length;

                    monthData.push({
                        month: monthKey,
                        casosResueltos: count,
                        status: count >= 8 ? 'high' : count >= 5 ? 'medium' : 'low',
                    });
                }

                const totalCasos = monthData.reduce((sum, m) => sum + m.casosResueltos, 0);
                const avgCasosPorMes = months > 0 ? Math.round((totalCasos / months) * 10) / 10 : 0;

                return {
                    lawyerId: lawyer.id,
                    nombre: lawyer.nombre ?? 'Sin nombre',
                    monthData,
                    avgCasosPorMes,
                };
            })
        );

        return { success: true, data: gridData };
    } catch (error) {
        console.error('Error getting lawyer performance grid:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}
