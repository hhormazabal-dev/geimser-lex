'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, requireAuth, canAccessCase } from '@/lib/auth/roles';
import { logAuditAction } from '@/lib/audit/log';
import {
  createStageSchema,
  updateStageSchema,
  completeStageSchema,
  stageFiltersSchema,
  type CreateStageInput,
  type UpdateStageInput,
  type CompleteStageInput,
  type StageFiltersInput,
} from '@/lib/validators/stages';
import type { CaseStage, CaseStageInsert } from '@/lib/supabase/types';

/**
 * Crea una nueva etapa procesal
 */
export async function createStage(input: CreateStageInput) {
  try {
    const profile = await requireAuth();
    const validatedInput = createStageSchema.parse(input);
    
    // Verificar acceso al caso
    const hasAccess = await canAccessCase(validatedInput.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para acceder a este caso');
    }

    // Solo abogados y admin pueden crear etapas
    if (profile.role === 'cliente') {
      throw new Error('Sin permisos para crear etapas');
    }

    const supabase = createClient();

    const stageData: CaseStageInsert = {
      ...validatedInput,
      responsable_id: validatedInput.responsable_id || profile.id,
    };

    const { data: newStage, error } = await supabase
      .from('case_stages')
      .insert(stageData)
      .select(`
        *,
        responsable:profiles(nombre),
        case:cases(caratulado)
      `)
      .single();

    if (error) {
      console.error('Error creating stage:', error);
      throw new Error('Error al crear la etapa');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'CREATE',
      entity_type: 'case_stage',
      entity_id: newStage.id,
      diff_json: { created: stageData },
    });

    revalidatePath(`/cases/${validatedInput.case_id}`);

    return { success: true, stage: newStage };
  } catch (error) {
    console.error('Error in createStage:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Actualiza una etapa procesal
 */
export async function updateStage(stageId: string, input: UpdateStageInput) {
  try {
    const profile = await requireAuth();
    const validatedInput = updateStageSchema.parse(input);
    const supabase = createClient();

    // Obtener la etapa existente
    const { data: existingStage, error: fetchError } = await supabase
      .from('case_stages')
      .select('*')
      .eq('id', stageId)
      .single();

    if (fetchError || !existingStage) {
      throw new Error('Etapa no encontrada');
    }

    // Verificar acceso al caso
    const hasAccess = await canAccessCase(existingStage.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para acceder a este caso');
    }

    // Verificar permisos
    if (profile.role === 'cliente') {
      throw new Error('Sin permisos para editar etapas');
    }

    if (profile.role === 'abogado' && existingStage.responsable_id !== profile.id) {
      throw new Error('Solo puedes editar etapas de las que eres responsable');
    }

    const { data: updatedStage, error } = await supabase
      .from('case_stages')
      .update(validatedInput)
      .eq('id', stageId)
      .select(`
        *,
        responsable:profiles(nombre),
        case:cases(caratulado)
      `)
      .single();

    if (error) {
      console.error('Error updating stage:', error);
      throw new Error('Error al actualizar la etapa');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'UPDATE',
      entity_type: 'case_stage',
      entity_id: stageId,
      diff_json: { 
        from: existingStage, 
        to: updatedStage 
      },
    });

    revalidatePath(`/cases/${existingStage.case_id}`);

    return { success: true, stage: updatedStage };
  } catch (error) {
    console.error('Error in updateStage:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Completa una etapa procesal
 */
export async function completeStage(stageId: string, input: CompleteStageInput = {}) {
  try {
    const profile = await requireAuth();
    const validatedInput = completeStageSchema.parse(input);
    const supabase = createClient();

    // Obtener la etapa existente
    const { data: existingStage, error: fetchError } = await supabase
      .from('case_stages')
      .select('*')
      .eq('id', stageId)
      .single();

    if (fetchError || !existingStage) {
      throw new Error('Etapa no encontrada');
    }

    // Verificar acceso al caso
    const hasAccess = await canAccessCase(existingStage.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para acceder a este caso');
    }

    // Verificar permisos
    if (profile.role === 'cliente') {
      throw new Error('Sin permisos para completar etapas');
    }

    if (profile.role === 'abogado' && existingStage.responsable_id !== profile.id) {
      throw new Error('Solo puedes completar etapas de las que eres responsable');
    }

    const updateData = {
      estado: 'completada' as const,
      fecha_completada: validatedInput.fecha_completada || new Date().toISOString(),
      observaciones: validatedInput.observaciones,
    };

    const { data: updatedStage, error } = await supabase
      .from('case_stages')
      .update(updateData)
      .eq('id', stageId)
      .select(`
        *,
        responsable:profiles(nombre),
        case:cases(caratulado)
      `)
      .single();

    if (error) {
      console.error('Error completing stage:', error);
      throw new Error('Error al completar la etapa');
    }

    // Actualizar etapa actual del caso si es necesario
    await updateCaseCurrentStage(existingStage.case_id);

    // Log de auditoría
    await logAuditAction({
      action: 'COMPLETE',
      entity_type: 'case_stage',
      entity_id: stageId,
      diff_json: { completed: updateData },
    });

    revalidatePath(`/cases/${existingStage.case_id}`);

    return { success: true, stage: updatedStage };
  } catch (error) {
    console.error('Error in completeStage:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Elimina una etapa procesal
 */
export async function deleteStage(stageId: string) {
  try {
    const profile = await requireAuth();
    const supabase = createClient();

    // Obtener la etapa existente
    const { data: existingStage, error: fetchError } = await supabase
      .from('case_stages')
      .select('*')
      .eq('id', stageId)
      .single();

    if (fetchError || !existingStage) {
      throw new Error('Etapa no encontrada');
    }

    // Verificar acceso al caso
    const hasAccess = await canAccessCase(existingStage.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para acceder a este caso');
    }

    // Solo admin puede eliminar etapas
    if (profile.role !== 'admin_firma') {
      throw new Error('Sin permisos para eliminar etapas');
    }

    const { error } = await supabase
      .from('case_stages')
      .delete()
      .eq('id', stageId);

    if (error) {
      console.error('Error deleting stage:', error);
      throw new Error('Error al eliminar la etapa');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'DELETE',
      entity_type: 'case_stage',
      entity_id: stageId,
      diff_json: { deleted: existingStage },
    });

    revalidatePath(`/cases/${existingStage.case_id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in deleteStage:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Obtiene etapas con filtros
 */
export async function getStages(filters: StageFiltersInput = {}) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new Error('No autenticado');
    }

    const validatedFilters = stageFiltersSchema.parse(filters);
    const supabase = createClient();

    let query = supabase
      .from('case_stages')
      .select(`
        *,
        responsable:profiles(id, nombre),
        case:cases(id, caratulado)
      `);

    // Aplicar filtros de acceso según rol
    if (profile.role === 'cliente') {
      // Los clientes solo ven etapas públicas de sus casos
      query = query.eq('es_publica', true);
      
      // Obtener casos del cliente
      const { data: clientCases } = await supabase
        .from('case_clients')
        .select('case_id')
        .eq('client_profile_id', profile.id);
      
      const caseIds = clientCases?.map(cc => cc.case_id) || [];
      if (caseIds.length === 0) {
        return { success: true, stages: [], total: 0 };
      }
      
      query = query.in('case_id', caseIds);
    } else if (profile.role === 'abogado') {
      // Los abogados ven etapas de sus casos
      const { data: abogadoCases } = await supabase
        .from('cases')
        .select('id')
        .eq('abogado_responsable', profile.id);
      
      const caseIds = abogadoCases?.map(c => c.id) || [];
      if (caseIds.length === 0) {
        return { success: true, stages: [], total: 0 };
      }
      
      query = query.in('case_id', caseIds);
    }

    // Aplicar filtros adicionales
    if (validatedFilters.case_id) {
      // Verificar acceso al caso específico
      const hasAccess = await canAccessCase(validatedFilters.case_id);
      if (!hasAccess) {
        throw new Error('Sin permisos para acceder a este caso');
      }
      query = query.eq('case_id', validatedFilters.case_id);
    }

    if (validatedFilters.estado) {
      query = query.eq('estado', validatedFilters.estado);
    }

    if (validatedFilters.responsable_id) {
      query = query.eq('responsable_id', validatedFilters.responsable_id);
    }

    if (validatedFilters.es_publica !== undefined) {
      query = query.eq('es_publica', validatedFilters.es_publica);
    }

    if (validatedFilters.fecha_desde) {
      query = query.gte('fecha_programada', validatedFilters.fecha_desde);
    }

    if (validatedFilters.fecha_hasta) {
      query = query.lte('fecha_programada', validatedFilters.fecha_hasta);
    }

    // Paginación
    const from = (validatedFilters.page - 1) * validatedFilters.limit;
    const to = from + validatedFilters.limit - 1;

    const { data: stages, error, count } = await query
      .range(from, to)
      .order('orden', { ascending: true });

    if (error) {
      console.error('Error fetching stages:', error);
      throw new Error('Error al obtener etapas');
    }

    return { 
      success: true, 
      stages: stages || [], 
      total: count || 0,
      page: validatedFilters.page,
      limit: validatedFilters.limit,
    };
  } catch (error) {
    console.error('Error in getStages:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido',
      stages: [],
      total: 0,
    };
  }
}

/**
 * Obtiene una etapa por ID
 */
export async function getStageById(stageId: string) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new Error('No autenticado');
    }

    const supabase = createClient();

    const { data: stage, error } = await supabase
      .from('case_stages')
      .select(`
        *,
        responsable:profiles(id, nombre),
        case:cases(id, caratulado)
      `)
      .eq('id', stageId)
      .single();

    if (error || !stage) {
      throw new Error('Etapa no encontrada');
    }

    // Verificar acceso
    const hasAccess = await canAccessCase(stage.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para ver esta etapa');
    }

    // Los clientes solo pueden ver etapas públicas
    if (profile.role === 'cliente' && !stage.es_publica) {
      throw new Error('Sin permisos para ver esta etapa');
    }

    return { success: true, stage };
  } catch (error) {
    console.error('Error in getStageById:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Funciones auxiliares
 */

async function updateCaseCurrentStage(caseId: string) {
  const supabase = createClient();
  
  // Obtener la siguiente etapa pendiente
  const { data: nextStage } = await supabase
    .from('case_stages')
    .select('etapa')
    .eq('case_id', caseId)
    .eq('estado', 'pendiente')
    .order('orden', { ascending: true })
    .limit(1)
    .single();

  if (nextStage) {
    // Actualizar la etapa actual del caso
    await supabase
      .from('cases')
      .update({ etapa_actual: nextStage.etapa })
      .eq('id', caseId);
  }
}
