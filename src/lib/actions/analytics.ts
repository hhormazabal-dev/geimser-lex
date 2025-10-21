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

export interface DashboardHighlights {
  recentCases: Array<{
    id: string;
    caratulado: string;
    estado: string | null;
    prioridad: string | null;
    fecha_inicio: string | null;
    abogado_responsable?: string | null;
    valor_estimado: number | null;
  }>;
  clients: Array<{
    id: string;
    nombre: string | null;
    email: string | null;
    telefono: string | null;
    created_at: string | null;
  }>;
  documents: Array<{
    id: string;
    nombre: string;
    case_id: string | null;
    created_at: string | null;
  }>;
  pending: Array<{
    id: string;
    tipo: 'solicitud' | 'etapa';
    titulo: string;
    descripcion?: string | null;
    fecha?: string | null;
    case_id?: string | null;
    estado?: string | null;
  }>;
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

export interface LawyerCaseSummary {
  id: string;
  caratulado: string;
  estado: string | null;
  etapa_actual: string | null;
  prioridad: string | null;
  valor_estimado: number | null;
  fecha_inicio: string | null;
  workflow_state: string | null;
  nombre_cliente: string | null;
  nextStage: {
    etapa: string;
    fecha_programada: string | null;
    estado: string;
    orden: number | null;
    isOverdue: boolean;
  } | null;
  pendingStages: number;
  completedStages: number;
  totalStages: number;
  overdueStages: number;
}

export interface LawyerDetailData {
  lawyer: {
    id: string;
    nombre: string;
    email: string | null;
    telefono: string | null;
    role: string | null;
  };
  stats: {
    activeCases: number;
    completedCases: number;
    totalCases: number;
    totalValue: number;
    avgCaseValue: number;
    overdueStages: number;
  };
  cases: LawyerCaseSummary[];
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
type DashboardStatsResponse = {
  success: boolean;
  stats?: DashboardStats;
  highlights?: DashboardHighlights;
  error?: string;
};

export async function getDashboardStats(): Promise<DashboardStatsResponse> {
  try {
    const profile = await requireAuth();
    const role = normalizeRole(profile.role);

    if (!canSeeStats(role)) {
      console.warn('⚠️ Rol sin permisos (getDashboardStats):', profile.role);
      // Devolver datos vacíos para no romper el dashboard si entra un cliente
      return {
        success: true,
        stats: { ...EMPTY_STATS },
        highlights: { recentCases: [], clients: [], documents: [], pending: [] },
      };
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

    const highlights: DashboardHighlights = {
      recentCases: cases
        .sort((a, b) => new Date(b.updated_at ?? b.created_at ?? '').getTime() - new Date(a.updated_at ?? a.created_at ?? '').getTime())
        .slice(0, 6)
        .map((caseItem) => ({
          id: caseItem.id as string,
          caratulado: (caseItem.caratulado as string) ?? 'Sin caratulado',
          estado: (caseItem.estado as string | null) ?? null,
          prioridad: (caseItem.prioridad as string | null) ?? null,
          fecha_inicio: (caseItem.fecha_inicio as string | null) ?? null,
          abogado_responsable: (caseItem.abogado_responsable as string | null) ?? null,
          valor_estimado: (caseItem.valor_estimado as number | null) ?? null,
        })),
      clients: ((clientsResult.data as Array<Record<string, any>> | null) ?? [])
        .slice(0, 6)
        .map((client) => ({
          id: client.id as string,
          nombre: (client.nombre as string | null) ?? null,
          email: (client.email as string | null) ?? null,
          telefono: (client.telefono as string | null) ?? null,
          created_at: (client.created_at as string | null) ?? null,
        })),
      documents: ((documentsResult.data as Array<Record<string, any>> | null) ?? [])
        .sort((a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime())
        .slice(0, 6)
        .map((doc) => ({
          id: doc.id as string,
          nombre: (doc.nombre as string) ?? 'Documento',
          case_id: (doc.case_id as string | null) ?? null,
          created_at: (doc.created_at as string | null) ?? null,
        })),
      pending: [
        ...(((requestsResult.data as Array<Record<string, any>> | null) ?? []).map((req) => ({
          id: req.id as string,
          tipo: 'solicitud' as const,
          titulo: (req.titulo as string) ?? 'Solicitud',
          descripcion: (req.descripcion as string | null) ?? null,
          fecha: (req.fecha_limite as string | null) ?? null,
          case_id: (req.case_id as string | null) ?? null,
          estado: (req.estado as string | null) ?? null,
        }))),
        ...(((stagesResult.data as Array<Record<string, any>> | null) ?? []).map((stage) => ({
          id: stage.id as string,
          tipo: 'etapa' as const,
          titulo: (stage.etapa as string) ?? 'Etapa',
          descripcion: null,
          fecha: (stage.fecha_programada as string | null) ?? null,
          case_id: (stage.case_id as string | null) ?? null,
          estado: (stage.estado as string | null) ?? null,
        }))),
      ].slice(0, 8),
    };

    return { success: true, stats, highlights };
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
 * Detalle de gestión de un abogado (solo admin)
 */
export async function getLawyerDetail(abogadoId: string): Promise<{ success: boolean; data?: LawyerDetailData; error?: string }> {
  try {
    const profile = await requireAuth();
    const role = normalizeRole(profile.role);

    if (role !== 'admin_firma') {
      return { success: false, error: 'Sin permisos para ver esta información' };
    }

    const supabase = await createServerClient();
    const { data: lawyer, error: lawyerError } = await supabase
      .from('profiles')
      .select('id, nombre, email, telefono, role')
      .eq('id', abogadoId)
      .single();

    if (lawyerError || !lawyer) {
      return { success: false, error: 'Abogado no encontrado' };
    }

    const { data: caseRows, error: casesError } = await supabase
      .from('cases')
      .select('id, caratulado, estado, etapa_actual, prioridad, valor_estimado, fecha_inicio, workflow_state, nombre_cliente, updated_at')
      .eq('abogado_responsable', abogadoId)
      .order('created_at', { ascending: false });

    if (casesError) throw casesError;

    const cases = (caseRows as any[]) ?? [];
    const caseIds = cases.map((c) => c.id);

    let stageMap = new Map<string, any[]>();
    if (caseIds.length > 0) {
      const { data: stageRows, error: stagesError } = await supabase
        .from('case_stages')
        .select('case_id, etapa, estado, fecha_programada, orden')
        .in('case_id', caseIds)
        .order('orden', { ascending: true });

      if (stagesError) throw stagesError;

      stageMap = (stageRows ?? []).reduce((map, stage) => {
        const list = map.get(stage.case_id) ?? [];
        list.push(stage);
        map.set(stage.case_id, list);
        return map;
      }, new Map<string, any[]>());
    }

    const today = new Date().toISOString().slice(0, 10);

    const caseSummaries: LawyerCaseSummary[] = cases.map((caseItem) => {
      const stages = stageMap.get(caseItem.id) ?? [];
      const completedStages = stages.filter((stage) => stage.estado === 'completado');
      const pendingStages = stages.filter((stage) => stage.estado !== 'completado');

      const nextStage = pendingStages.length > 0 ? pendingStages[0] : null;
      const overdueStages = pendingStages.filter((stage) => {
        if (!stage.fecha_programada) return false;
        return stage.fecha_programada < today;
      }).length;

      return {
        id: caseItem.id,
        caratulado: caseItem.caratulado,
        estado: caseItem.estado ?? null,
        etapa_actual: caseItem.etapa_actual ?? null,
        prioridad: caseItem.prioridad ?? null,
        valor_estimado: caseItem.valor_estimado ?? null,
        fecha_inicio: caseItem.fecha_inicio ?? null,
        workflow_state: caseItem.workflow_state ?? null,
        nombre_cliente: caseItem.nombre_cliente ?? null,
        nextStage: nextStage
          ? {
              etapa: nextStage.etapa,
              fecha_programada: nextStage.fecha_programada ?? null,
              estado: nextStage.estado ?? 'pendiente',
              orden: nextStage.orden ?? null,
              isOverdue:
                Boolean(nextStage.fecha_programada) && nextStage.fecha_programada < today,
            }
          : null,
        pendingStages: pendingStages.length,
        completedStages: completedStages.length,
        totalStages: stages.length,
        overdueStages,
      };
    });

    const activeCases = caseSummaries.filter((c) => c.estado === 'activo');
    const completedCases = caseSummaries.filter((c) => c.estado === 'terminado');
    const totalValue = caseSummaries.reduce(
      (sum, caseItem) => sum + ((caseItem.valor_estimado as number | null) ?? 0),
      0
    );
    const totalCases = caseSummaries.length;
    const avgCaseValue = totalCases > 0 ? totalValue / totalCases : 0;
    const totalOverdueStages = caseSummaries.reduce((sum, c) => sum + c.overdueStages, 0);

    return {
      success: true,
      data: {
        lawyer: {
          id: lawyer.id,
          nombre: lawyer.nombre ?? 'Sin nombre',
          email: lawyer.email ?? null,
          telefono: lawyer.telefono ?? null,
          role: lawyer.role ?? null,
        },
        stats: {
          activeCases: activeCases.length,
          completedCases: completedCases.length,
          totalCases,
          totalValue,
          avgCaseValue,
          overdueStages: totalOverdueStages,
        },
        cases: caseSummaries,
      },
    };
  } catch (error) {
    console.error('Error getting lawyer detail:', error);
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
