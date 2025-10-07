'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';

export interface DashboardStats {
  totalCases: number;
  activeCases: number;
  completedCases: number;
  totalClients: number;
  totalDocuments: number;
  totalNotes: number;
  pendingRequests: number;
  overdueStages: number;
}

export interface CasesByStatus {
  status: string;
  count: number;
  percentage: number;
}

export interface CasesByMateria {
  materia: string;
  count: number;
  percentage: number;
}

export interface CasesByPriority {
  priority: string;
  count: number;
  percentage: number;
}

export interface MonthlyStats {
  month: string;
  newCases: number;
  completedCases: number;
  revenue: number;
}

export interface AbogadoWorkload {
  abogado_id: string;
  nombre: string;
  activeCases: number;
  completedCases: number;
  totalValue: number;
  avgCaseValue: number;
}

/* --------------------------------- Helpers -------------------------------- */

const normalizeRole = (r: string | null) => (r ?? '').trim().toLowerCase();
const canSeeStats = (role: string) => ['admin_firma', 'abogado', 'analista'].includes(role);

const EMPTY_STATS: DashboardStats = {
  totalCases: 0,
  activeCases: 0,
  completedCases: 0,
  totalClients: 0,
  totalDocuments: 0,
  totalNotes: 0,
  pendingRequests: 0,
  overdueStages: 0,
};

/**
 * Obtiene estadísticas generales del dashboard
 */
export async function getDashboardStats(): Promise<{ success: boolean; stats?: DashboardStats; error?: string }> {
  try {
    const profile = await requireAuth();
    const role = normalizeRole(profile.role);

    if (!canSeeStats(role)) {
      console.warn('⚠️ Rol sin permisos (getDashboardStats):', profile.role);
      // Devolver datos vacíos para no romper el dashboard si entra un cliente
      return { success: true, stats: { ...EMPTY_STATS } };
    }

    const supabase = await createServerClient();

    // Construir consultas base según el rol
    let caseQuery = supabase.from('cases').select('*');

    const clientQueryPromise = (async () => {
      if (role === 'abogado') {
        const { data: rawAbogadoCases, error: casesError } = await supabase
          .from('cases')
          .select('id')
          .eq('abogado_responsable', profile.id);

        if (casesError) return { data: null, error: casesError };

        const abogadoCases = rawAbogadoCases as Array<{ id: string }> | null;
        const caseIds = abogadoCases?.map((c) => c.id) || [];
        if (caseIds.length === 0) return { data: [], error: null };

        const { data, error } = await supabase
          .from('case_clients')
          .select('client_profile_id')
          .in('case_id', caseIds);

        if (error) return { data: null, error };

        const clientRows = data as Array<{ client_profile_id: string }> | null;
        const clientIds = clientRows?.map((cc) => cc.client_profile_id) || [];
        if (clientIds.length === 0) return { data: [], error: null };

        return supabase.from('profiles').select('*').in('id', clientIds);
      }

      return supabase.from('profiles').select('*').eq('role', 'cliente');
    })();

    if (role === 'abogado') {
      // Los abogados solo ven estadísticas de sus casos
      caseQuery = caseQuery.eq('abogado_responsable', profile.id);
    }

    // Ejecutar consultas en paralelo
    const [casesResult, clientsResult, documentsResult, notesResult, requestsResult, stagesResult] = await Promise.all([
      caseQuery,
      clientQueryPromise,
      supabase.from('documents').select('*'),
      supabase.from('notes').select('*'),
      supabase.from('info_requests').select('*').eq('estado', 'pendiente'),
      supabase.from('case_stages').select('*').eq('estado', 'pendiente').lt('fecha_programada', new Date().toISOString()),
    ]);

    if (casesResult.error) throw casesResult.error;
    if (clientsResult.error) throw clientsResult.error;
    if (documentsResult.error) throw documentsResult.error;
    if (notesResult.error) throw notesResult.error;
    if (requestsResult.error) throw requestsResult.error;
    if (stagesResult.error) throw stagesResult.error;

    const cases = (casesResult.data as Array<Record<string, any>> | null) ?? [];
    const activeCases = cases.filter((c) => (c.estado as string | null) === 'activo').length;
    const completedCases = cases.filter((c) => (c.estado as string | null) === 'terminado').length;

    const stats: DashboardStats = {
      totalCases: cases.length,
      activeCases,
      completedCases,
      totalClients: clientsResult.data?.length || 0,
      totalDocuments: documentsResult.data?.length || 0,
      totalNotes: notesResult.data?.length || 0,
      pendingRequests: requestsResult.data?.length || 0,
      overdueStages: stagesResult.data?.length || 0,
    };

    return { success: true, stats };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Obtiene distribución de casos por estado
 */
export async function getCasesByStatus(): Promise<{ success: boolean; data?: CasesByStatus[]; error?: string }> {
  try {
    const profile = await requireAuth();
    const role = normalizeRole(profile.role);

    if (!canSeeStats(role)) {
      console.warn('⚠️ Rol sin permisos (getCasesByStatus):', profile.role);
      return { success: true, data: [] };
    }

    const supabase = await createServerClient();

    let query = supabase.from('cases').select('estado');

    if (role === 'abogado') {
      query = query.eq('abogado_responsable', profile.id);
    }

    const { data: casesData, error } = await query;
    if (error) throw error;

    const caseRows = (casesData as Array<Record<string, any>> | null) ?? [];

    const statusCounts = caseRows.reduce((acc, case_) => {
      const status = (case_.estado as string | null) || 'sin_estado';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = caseRows.length;
    const result: CasesByStatus[] = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));

    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting cases by status:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Obtiene distribución de casos por materia
 */
export async function getCasesByMateria(): Promise<{ success: boolean; data?: CasesByMateria[]; error?: string }> {
  try {
    const profile = await requireAuth();
    const role = normalizeRole(profile.role);

    if (!canSeeStats(role)) {
      console.warn('⚠️ Rol sin permisos (getCasesByMateria):', profile.role);
      return { success: true, data: [] };
    }

    const supabase = await createServerClient();

    let query = supabase.from('cases').select('materia');

    if (role === 'abogado') {
      query = query.eq('abogado_responsable', profile.id);
    }

    const { data: casesData, error } = await query;
    if (error) throw error;

    const caseRows = (casesData as Array<Record<string, any>> | null) ?? [];

    const materiaCounts = caseRows.reduce((acc, case_) => {
      const materia = (case_.materia as string | null) || 'Sin especificar';
      acc[materia] = (acc[materia] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = caseRows.length;
    const result: CasesByMateria[] = Object.entries(materiaCounts).map(([materia, count]) => ({
      materia,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));

    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting cases by materia:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Obtiene distribución de casos por prioridad
 */
export async function getCasesByPriority(): Promise<{ success: boolean; data?: CasesByPriority[]; error?: string }> {
  try {
    const profile = await requireAuth();
    const role = normalizeRole(profile.role);

    if (!canSeeStats(role)) {
      console.warn('⚠️ Rol sin permisos (getCasesByPriority):', profile.role);
      return { success: true, data: [] };
    }

    const supabase = await createServerClient();

    let query = supabase.from('cases').select('prioridad');

    if (role === 'abogado') {
      query = query.eq('abogado_responsable', profile.id);
    }

    const { data: casesData, error } = await query;
    if (error) throw error;

    const caseRows = (casesData as Array<Record<string, any>> | null) ?? [];

    const priorityCounts = caseRows.reduce((acc, case_) => {
      const priority = (case_.prioridad as string | null) || 'media';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = caseRows.length;
    const result: CasesByPriority[] = Object.entries(priorityCounts).map(([priority, count]) => ({
      priority,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));

    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting cases by priority:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Obtiene estadísticas mensuales
 */
export async function getMonthlyStats(): Promise<{ success: boolean; data?: MonthlyStats[]; error?: string }> {
  try {
    const profile = await requireAuth();
    const role = normalizeRole(profile.role);

    if (!canSeeStats(role)) {
      console.warn('⚠️ Rol sin permisos (getMonthlyStats):', profile.role);
      // Podemos devolver 12 meses “vacíos” para mantener el layout
      const months: MonthlyStats[] = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (11 - i));
        return {
          month: d.toLocaleDateString('es-CL', { year: 'numeric', month: 'short' }),
          newCases: 0,
          completedCases: 0,
          revenue: 0,
        };
      });
      return { success: true, data: months };
    }

    const supabase = await createServerClient();

    // Últimos 12 meses
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 11);
    startDate.setDate(1);

    let newCasesQuery = supabase
      .from('cases')
      .select('fecha_inicio, valor_estimado')
      .gte('fecha_inicio', startDate.toISOString());

    let completedCasesQuery = supabase
      .from('cases')
      .select('updated_at, valor_estimado')
      .eq('estado', 'terminado')
      .gte('updated_at', startDate.toISOString());

    if (role === 'abogado') {
      newCasesQuery = newCasesQuery.eq('abogado_responsable', profile.id);
      completedCasesQuery = completedCasesQuery.eq('abogado_responsable', profile.id);
    }

    const [newCasesResult, completedCasesResult] = await Promise.all([newCasesQuery, completedCasesQuery]);

    if (newCasesResult.error) throw newCasesResult.error;
    if (completedCasesResult.error) throw completedCasesResult.error;

    const newCases = (newCasesResult.data as Array<Record<string, any>> | null) ?? [];
    const completedCases = (completedCasesResult.data as Array<Record<string, any>> | null) ?? [];

    // Agrupar por mes
    const monthlyData: Record<string, MonthlyStats> = {};

    // Inicializar 12 meses
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
      const monthName = date.toLocaleDateString('es-CL', { year: 'numeric', month: 'short' });

      monthlyData[monthKey] = {
        month: monthName,
        newCases: 0,
        completedCases: 0,
        revenue: 0,
      };
    }

    // Procesar casos nuevos
    newCases.forEach((case_) => {
      const startDateValue = case_.fecha_inicio as string | null;
      if (startDateValue) {
        const monthKey = startDateValue.slice(0, 7);
        if (monthlyData[monthKey]) monthlyData[monthKey].newCases++;
      }
    });

    // Procesar casos completados
    completedCases.forEach((case_) => {
      const completedDate = case_.updated_at as string | null;
      const estimatedValue = case_.valor_estimado as number | null;

      if (completedDate) {
        const monthKey = completedDate.slice(0, 7);
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].completedCases++;
          monthlyData[monthKey].revenue += estimatedValue || 0;
        }
      }
    });

    const result = Object.values(monthlyData).reverse(); // Orden cronológico

    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting monthly stats:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Obtiene carga de trabajo por abogado (solo para admin)
 */
export async function getAbogadoWorkload(): Promise<{ success: boolean; data?: AbogadoWorkload[]; error?: string }> {
  try {
    const profile = await requireAuth();
    const role = normalizeRole(profile.role);

    if (role !== 'admin_firma') {
      console.warn('⚠️ Rol sin permisos (getAbogadoWorkload):', profile.role);
      return { success: true, data: [] };
    }

    const supabase = await createServerClient();

    // Obtener todos los abogados
    const { data: abogados, error: abogadosError } = await supabase
      .from('profiles')
      .select('id, nombre')
      .in('role', ['abogado', 'admin_firma']);

    if (abogadosError) throw abogadosError;

    const abogadosData = (abogados as Array<{ id: string; nombre: string | null }> | null) ?? [];

    // Obtener estadísticas de casos por abogado
    const workloadPromises = abogadosData.map(async (abogado) => {
      const [activeCasesResult, completedCasesResult] = await Promise.all([
        supabase.from('cases').select('valor_estimado').eq('abogado_responsable', abogado.id).eq('estado', 'activo'),
        supabase.from('cases').select('valor_estimado').eq('abogado_responsable', abogado.id).eq('estado', 'terminado'),
      ]);

      const activeCases = (activeCasesResult.data as Array<{ valor_estimado: number | null }> | null) ?? [];
      const completedCases = (completedCasesResult.data as Array<{ valor_estimado: number | null }> | null) ?? [];

      const totalValue = [...activeCases, ...completedCases].reduce(
        (sum, case_) => sum + ((case_.valor_estimado as number | null) ?? 0),
        0
      );

      const totalCases = activeCases.length + completedCases.length;
      const avgCaseValue = totalCases > 0 ? totalValue / totalCases : 0;

      return {
        abogado_id: abogado.id,
        nombre: abogado.nombre ?? 'Sin nombre',
        activeCases: activeCases.length,
        completedCases: completedCases.length,
        totalValue,
        avgCaseValue,
      };
    });

    const workloadData = await Promise.all(workloadPromises);

    return { success: true, data: workloadData };
  } catch (error) {
    console.error('Error getting abogado workload:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Obtiene casos próximos a vencer
 */
export async function getUpcomingDeadlines(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const profile = await requireAuth();
    const role = normalizeRole(profile.role);

    if (!canSeeStats(role)) {
      console.warn('⚠️ Rol sin permisos (getUpcomingDeadlines):', profile.role);
      return { success: true, data: [] };
    }

    const supabase = await createServerClient();

    // Etapas con fechas programadas en los próximos 30 días
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    const query = supabase
      .from('case_stages')
      .select(
        `
        *,
        case:cases(id, caratulado, abogado_responsable)
      `
      )
      .eq('estado', 'pendiente')
      .gte('fecha_programada', new Date().toISOString())
      .lte('fecha_programada', futureDate.toISOString())
      .order('fecha_programada', { ascending: true });

    const { data: stages, error } = await query;
    if (error) throw error;

    // Filtrar por acceso según rol
    const stageRows = (stages as Array<Record<string, any>> | null) ?? [];
    let filteredStages = stageRows;

    if (role === 'abogado') {
      filteredStages = filteredStages.filter(
        (stage) => (stage.case?.abogado_responsable as string | null) === profile.id
      );
    }

    return { success: true, data: filteredStages };
  } catch (error) {
    console.error('Error getting upcoming deadlines:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}
