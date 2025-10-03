'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, requireAuth } from '@/lib/auth/roles';

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

/**
 * Obtiene estadísticas generales del dashboard
 */
export async function getDashboardStats(): Promise<{ success: boolean; stats?: DashboardStats; error?: string }> {
  try {
    const profile = await requireAuth();
    
    // Solo admin y abogados pueden ver estadísticas
    if (profile.role === 'cliente') {
      throw new Error('Sin permisos para ver estadísticas');
    }

    const supabase = createClient();

    // Construir consultas base según el rol
    let caseQuery = supabase.from('cases').select('*');
    let clientQuery = supabase.from('profiles').select('*').eq('role', 'cliente');
    
    if (profile.role === 'abogado') {
      // Los abogados solo ven estadísticas de sus casos
      caseQuery = caseQuery.eq('abogado_responsable', profile.id);
      
      // Obtener clientes de los casos del abogado
      const { data: abogadoCases } = await supabase
        .from('cases')
        .select('id')
        .eq('abogado_responsable', profile.id);
      
      const caseIds = abogadoCases?.map(c => c.id) || [];
      if (caseIds.length > 0) {
        const { data: caseClients } = await supabase
          .from('case_clients')
          .select('client_profile_id')
          .in('case_id', caseIds);
        
        const clientIds = caseClients?.map(cc => cc.client_profile_id) || [];
        if (clientIds.length > 0) {
          clientQuery = clientQuery.in('id', clientIds);
        } else {
          clientQuery = clientQuery.eq('id', 'none'); // No clients
        }
      } else {
        clientQuery = clientQuery.eq('id', 'none'); // No clients
      }
    }

    // Ejecutar consultas en paralelo
    const [
      casesResult,
      clientsResult,
      documentsResult,
      notesResult,
      requestsResult,
      stagesResult
    ] = await Promise.all([
      caseQuery,
      clientQuery,
      supabase.from('case_documents').select('*'),
      supabase.from('case_notes').select('*'),
      supabase.from('info_requests').select('*').eq('estado', 'pendiente'),
      supabase.from('case_stages').select('*').eq('estado', 'pendiente').lt('fecha_programada', new Date().toISOString())
    ]);

    if (casesResult.error) throw casesResult.error;
    if (clientsResult.error) throw clientsResult.error;
    if (documentsResult.error) throw documentsResult.error;
    if (notesResult.error) throw notesResult.error;
    if (requestsResult.error) throw requestsResult.error;
    if (stagesResult.error) throw stagesResult.error;

    const cases = casesResult.data || [];
    const activeCases = cases.filter(c => c.estado === 'activo').length;
    const completedCases = cases.filter(c => c.estado === 'terminado').length;

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
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Obtiene distribución de casos por estado
 */
export async function getCasesByStatus(): Promise<{ success: boolean; data?: CasesByStatus[]; error?: string }> {
  try {
    const profile = await requireAuth();
    
    if (profile.role === 'cliente') {
      throw new Error('Sin permisos para ver estadísticas');
    }

    const supabase = createClient();
    
    let query = supabase
      .from('cases')
      .select('estado');
    
    if (profile.role === 'abogado') {
      query = query.eq('abogado_responsable', profile.id);
    }

    const { data: cases, error } = await query;
    
    if (error) throw error;

    const statusCounts = (cases || []).reduce((acc, case_) => {
      const status = case_.estado || 'sin_estado';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = cases?.length || 0;
    const result: CasesByStatus[] = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));

    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting cases by status:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Obtiene distribución de casos por materia
 */
export async function getCasesByMateria(): Promise<{ success: boolean; data?: CasesByMateria[]; error?: string }> {
  try {
    const profile = await requireAuth();
    
    if (profile.role === 'cliente') {
      throw new Error('Sin permisos para ver estadísticas');
    }

    const supabase = createClient();
    
    let query = supabase
      .from('cases')
      .select('materia');
    
    if (profile.role === 'abogado') {
      query = query.eq('abogado_responsable', profile.id);
    }

    const { data: cases, error } = await query;
    
    if (error) throw error;

    const materiaCounts = (cases || []).reduce((acc, case_) => {
      const materia = case_.materia || 'Sin especificar';
      acc[materia] = (acc[materia] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = cases?.length || 0;
    const result: CasesByMateria[] = Object.entries(materiaCounts).map(([materia, count]) => ({
      materia,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));

    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting cases by materia:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Obtiene distribución de casos por prioridad
 */
export async function getCasesByPriority(): Promise<{ success: boolean; data?: CasesByPriority[]; error?: string }> {
  try {
    const profile = await requireAuth();
    
    if (profile.role === 'cliente') {
      throw new Error('Sin permisos para ver estadísticas');
    }

    const supabase = createClient();
    
    let query = supabase
      .from('cases')
      .select('prioridad');
    
    if (profile.role === 'abogado') {
      query = query.eq('abogado_responsable', profile.id);
    }

    const { data: cases, error } = await query;
    
    if (error) throw error;

    const priorityCounts = (cases || []).reduce((acc, case_) => {
      const priority = case_.prioridad || 'media';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = cases?.length || 0;
    const result: CasesByPriority[] = Object.entries(priorityCounts).map(([priority, count]) => ({
      priority,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));

    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting cases by priority:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Obtiene estadísticas mensuales
 */
export async function getMonthlyStats(): Promise<{ success: boolean; data?: MonthlyStats[]; error?: string }> {
  try {
    const profile = await requireAuth();
    
    if (profile.role === 'cliente') {
      throw new Error('Sin permisos para ver estadísticas');
    }

    const supabase = createClient();
    
    // Obtener datos de los últimos 12 meses
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 11);
    startDate.setDate(1);
    
    let newCasesQuery = supabase
      .from('cases')
      .select('fecha_inicio, valor_estimado')
      .gte('fecha_inicio', startDate.toISOString());
    
    let completedCasesQuery = supabase
      .from('cases')
      .select('fecha_termino, valor_estimado')
      .eq('estado', 'terminado')
      .gte('fecha_termino', startDate.toISOString());
    
    if (profile.role === 'abogado') {
      newCasesQuery = newCasesQuery.eq('abogado_responsable', profile.id);
      completedCasesQuery = completedCasesQuery.eq('abogado_responsable', profile.id);
    }

    const [newCasesResult, completedCasesResult] = await Promise.all([
      newCasesQuery,
      completedCasesQuery
    ]);

    if (newCasesResult.error) throw newCasesResult.error;
    if (completedCasesResult.error) throw completedCasesResult.error;

    const newCases = newCasesResult.data || [];
    const completedCases = completedCasesResult.data || [];

    // Agrupar por mes
    const monthlyData: Record<string, MonthlyStats> = {};
    
    // Inicializar todos los meses
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
    newCases.forEach(case_ => {
      if (case_.fecha_inicio) {
        const monthKey = case_.fecha_inicio.slice(0, 7);
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].newCases++;
        }
      }
    });

    // Procesar casos completados
    completedCases.forEach(case_ => {
      if (case_.fecha_termino) {
        const monthKey = case_.fecha_termino.slice(0, 7);
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].completedCases++;
          monthlyData[monthKey].revenue += case_.valor_estimado || 0;
        }
      }
    });

    const result = Object.values(monthlyData).reverse(); // Orden cronológico

    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting monthly stats:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Obtiene carga de trabajo por abogado (solo para admin)
 */
export async function getAbogadoWorkload(): Promise<{ success: boolean; data?: AbogadoWorkload[]; error?: string }> {
  try {
    const profile = await requireAuth();
    
    // Solo admin puede ver carga de trabajo de todos los abogados
    if (profile.role !== 'admin_firma') {
      throw new Error('Sin permisos para ver carga de trabajo');
    }

    const supabase = createClient();

    // Obtener todos los abogados
    const { data: abogados, error: abogadosError } = await supabase
      .from('profiles')
      .select('id, nombre')
      .in('role', ['abogado', 'admin_firma']);

    if (abogadosError) throw abogadosError;

    // Obtener estadísticas de casos por abogado
    const workloadPromises = (abogados || []).map(async (abogado) => {
      const [activeCasesResult, completedCasesResult] = await Promise.all([
        supabase
          .from('cases')
          .select('valor_estimado')
          .eq('abogado_responsable', abogado.id)
          .eq('estado', 'activo'),
        supabase
          .from('cases')
          .select('valor_estimado')
          .eq('abogado_responsable', abogado.id)
          .eq('estado', 'terminado')
      ]);

      const activeCases = activeCasesResult.data || [];
      const completedCases = completedCasesResult.data || [];
      
      const totalValue = [...activeCases, ...completedCases]
        .reduce((sum, case_) => sum + (case_.valor_estimado || 0), 0);
      
      const totalCases = activeCases.length + completedCases.length;
      const avgCaseValue = totalCases > 0 ? totalValue / totalCases : 0;

      return {
        abogado_id: abogado.id,
        nombre: abogado.nombre,
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
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Obtiene casos próximos a vencer
 */
export async function getUpcomingDeadlines(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const profile = await requireAuth();
    
    if (profile.role === 'cliente') {
      throw new Error('Sin permisos para ver estadísticas');
    }

    const supabase = createClient();
    
    // Obtener etapas con fechas programadas en los próximos 30 días
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    
    let query = supabase
      .from('case_stages')
      .select(`
        *,
        case:cases(id, caratulado, abogado_responsable)
      `)
      .eq('estado', 'pendiente')
      .gte('fecha_programada', new Date().toISOString())
      .lte('fecha_programada', futureDate.toISOString())
      .order('fecha_programada', { ascending: true });

    const { data: stages, error } = await query;
    
    if (error) throw error;

    // Filtrar por acceso según rol
    let filteredStages = stages || [];
    if (profile.role === 'abogado') {
      filteredStages = filteredStages.filter(stage => 
        stage.case?.abogado_responsable === profile.id
      );
    }

    return { success: true, data: filteredStages };
  } catch (error) {
    console.error('Error getting upcoming deadlines:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}
