'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
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
import type { CaseStage } from '@/lib/supabase/types';

// Payloads tipados hacia DB
type CreateStageDB = Pick<
  CaseStage,
  | 'case_id'
  | 'etapa'
  | 'orden'
  | 'estado'
  | 'es_publica'
  | 'responsable_id'
  | 'descripcion'
  | 'fecha_programada'
  | 'fecha_cumplida'
  | 'audiencia_tipo'
  | 'requiere_testigos'
  | 'requiere_pago'
  | 'costo_uf'
  | 'porcentaje_variable'
  | 'estado_pago'
  | 'enlace_pago'
  | 'notas_pago'
  | 'monto_variable_base'
  | 'monto_pagado_uf'
  | 'solicitado_por'
  | 'solicitado_at'
>;
type UpdateStageDB = Partial<
  Pick<
    CaseStage,
    | 'etapa'
    | 'orden'
    | 'estado'
    | 'es_publica'
    | 'responsable_id'
    | 'descripcion'
    | 'fecha_programada'
    | 'audiencia_tipo'
    | 'requiere_testigos'
    | 'fecha_cumplida'
    | 'requiere_pago'
    | 'costo_uf'
    | 'porcentaje_variable'
    | 'estado_pago'
    | 'enlace_pago'
    | 'notas_pago'
    | 'monto_variable_base'
    | 'monto_pagado_uf'
    | 'solicitado_por'
    | 'solicitado_at'
  >
>;
type CompleteStageDB = Partial<Pick<CaseStage, 'estado' | 'fecha_cumplida' | 'descripcion'>>;

const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getSB() {
  if (hasServiceKey) return createServiceClient();
  return createServerClient();
}

// Helper: copia condicional leyendo por índice (evita TS2339 aunque el tipo sea {}).
function copyIfPresent<T extends object, K extends keyof any>(
  src: any,
  dst: T,
  srcKey: K,
  dstKey: keyof T,
  map?: (v: any) => any
) {
  if (src && Object.prototype.hasOwnProperty.call(src, srcKey)) {
    const val = src[srcKey as any];
    (dst as any)[dstKey] = map ? map(val) : val;
  }
}

/**
 * Crea una nueva etapa procesal
 */
export async function createStage(input: CreateStageInput) {
  try {
    const profile = await requireAuth();
    const validatedInput = createStageSchema.parse(input) as CreateStageInput;
    const hasAccess = await canAccessCase(validatedInput.case_id);
    if (!hasAccess) throw new Error('Sin permisos para acceder a este caso');
    if (profile.role === 'cliente') throw new Error('Sin permisos para crear etapas');

    const supabase = await getSB();

    const vi: any = validatedInput;
    const stageData: CreateStageDB = {
      case_id: vi.case_id,
      etapa: vi.etapa,
      orden: vi.orden,
      estado: vi.estado,
      es_publica: vi.es_publica,
      responsable_id: vi.responsable_id ?? profile.id,
      descripcion: vi.descripcion ?? null,
      fecha_programada: vi.fecha_programada ?? null,
      // validators -> DB
      fecha_cumplida: vi.fecha_completada ?? null,
      audiencia_tipo: vi.audiencia_tipo ?? null,
      requiere_testigos: vi.requiere_testigos ?? false,
      requiere_pago: vi.requiere_pago ?? false,
      costo_uf: vi.costo_uf ?? null,
      porcentaje_variable: vi.porcentaje_variable ?? null,
      estado_pago: vi.estado_pago ?? 'pendiente',
      enlace_pago: vi.enlace_pago ?? null,
      notas_pago: vi.notas_pago ?? null,
      monto_variable_base: vi.monto_variable_base ?? null,
      monto_pagado_uf: vi.monto_pagado_uf ?? 0,
      solicitado_por: null,
      solicitado_at: null,
    };

    const { data: newStage, error } = await supabase
      .from('case_stages')
      .insert(stageData)
      .select(`
        *,
        responsable:profiles!case_stages_responsable_id_fkey(nombre)
      `)
      .single();

    if (error) throw new Error('Error al crear la etapa');

    await logAuditAction({
      action: 'CREATE',
      entity_type: 'case_stage',
      entity_id: newStage.id,
      diff_json: { created: stageData },
    });

    revalidatePath(`/cases/${vi.case_id}`);
    return { success: true, stage: newStage };
  } catch (error) {
    console.error('Error in createStage:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Actualiza una etapa procesal
 */
export async function updateStage(stageId: string, input: UpdateStageInput) {
  try {
    const profile = await requireAuth();
    const validatedInput = updateStageSchema.parse(input) as unknown as Record<string, any>;
    const supabase = await getSB();

    const { data: existingStage, error: fetchError } = await supabase
      .from('case_stages')
      .select('*')
      .eq('id', stageId)
      .single();
    if (fetchError || !existingStage) throw new Error('Etapa no encontrada');

    const hasAccess = await canAccessCase(existingStage.case_id);
    if (!hasAccess) throw new Error('Sin permisos para acceder a este caso');
    if (profile.role === 'cliente') throw new Error('Sin permisos para editar etapas');
    if (profile.role === 'abogado' && existingStage.responsable_id !== profile.id) {
      throw new Error('Solo puedes editar etapas de las que eres responsable');
    }

    const updatePayload: UpdateStageDB = {};

    // Copias seguras (sin notación de punto sobre {}):
    copyIfPresent(validatedInput, updatePayload, 'etapa', 'etapa');
    copyIfPresent(validatedInput, updatePayload, 'orden', 'orden');
    copyIfPresent(validatedInput, updatePayload, 'estado', 'estado');
    copyIfPresent(validatedInput, updatePayload, 'es_publica', 'es_publica');
    copyIfPresent(validatedInput, updatePayload, 'responsable_id', 'responsable_id');
    copyIfPresent(validatedInput, updatePayload, 'descripcion', 'descripcion', (v) => (v ?? null));
    copyIfPresent(validatedInput, updatePayload, 'fecha_programada', 'fecha_programada', (v) => (v ?? null));
    // validators -> DB
    copyIfPresent(validatedInput, updatePayload, 'fecha_completada', 'fecha_cumplida', (v) => (v ?? null));
    copyIfPresent(validatedInput, updatePayload, 'audiencia_tipo', 'audiencia_tipo', (v) => (v ?? null));
    copyIfPresent(validatedInput, updatePayload, 'requiere_testigos', 'requiere_testigos', (v) => Boolean(v));
    copyIfPresent(validatedInput, updatePayload, 'requiere_pago', 'requiere_pago');
    copyIfPresent(validatedInput, updatePayload, 'costo_uf', 'costo_uf', (v) => (v ?? null));
    copyIfPresent(validatedInput, updatePayload, 'porcentaje_variable', 'porcentaje_variable', (v) => (v ?? null));
    copyIfPresent(validatedInput, updatePayload, 'estado_pago', 'estado_pago');
    copyIfPresent(validatedInput, updatePayload, 'enlace_pago', 'enlace_pago', (v) => (v ?? null));
    copyIfPresent(validatedInput, updatePayload, 'notas_pago', 'notas_pago', (v) => (v ?? null));
    copyIfPresent(validatedInput, updatePayload, 'monto_variable_base', 'monto_variable_base', (v) => (v ?? null));
    copyIfPresent(validatedInput, updatePayload, 'monto_pagado_uf', 'monto_pagado_uf', (v) => (v ?? null));
    copyIfPresent(validatedInput, updatePayload, 'solicitado_por', 'solicitado_por');
    copyIfPresent(validatedInput, updatePayload, 'solicitado_at', 'solicitado_at', (v) => (v ?? null));

    const { data: updatedStage, error } = await supabase
      .from('case_stages')
      .update(updatePayload)
      .eq('id', stageId)
      .select(`
        *,
        responsable:profiles!case_stages_responsable_id_fkey(nombre)
      `)
      .single();

    if (error) throw new Error('Error al actualizar la etapa');

    await logAuditAction({
      action: 'UPDATE',
      entity_type: 'case_stage',
      entity_id: stageId,
      diff_json: { from: existingStage, to: updatedStage },
    });

    revalidatePath(`/cases/${existingStage.case_id}`);
    return { success: true, stage: updatedStage };
  } catch (error) {
    console.error('Error in updateStage:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Completa una etapa procesal
 */
export async function completeStage(stageId: string, input: CompleteStageInput = {}) {
  try {
    const profile = await requireAuth();
    const validatedInput = completeStageSchema.parse(input) as unknown as Record<string, any>;
    const supabase = await getSB();

    const { data: existingStage, error: fetchError } = await supabase
      .from('case_stages')
      .select('*')
      .eq('id', stageId)
      .single();
    if (fetchError || !existingStage) throw new Error('Etapa no encontrada');

    const hasAccess = await canAccessCase(existingStage.case_id);
    if (!hasAccess) throw new Error('Sin permisos para acceder a este caso');
    if (profile.role === 'cliente') throw new Error('Sin permisos para completar etapas');
    if (profile.role === 'abogado' && existingStage.responsable_id !== profile.id) {
      throw new Error('Solo puedes completar etapas de las que eres responsable');
    }
    if (existingStage.requiere_pago && existingStage.estado_pago !== 'pagado') {
      throw new Error('Debes registrar el pago de esta etapa antes de completarla');
    }

    const completionDate = validatedInput['fecha_completada'] || new Date().toISOString();

    const updatePayload: CompleteStageDB = {
      estado: 'completado',
      fecha_cumplida: completionDate,
    };
    // observaciones -> descripcion
    copyIfPresent(validatedInput, updatePayload, 'observaciones', 'descripcion', (v) => (v ?? null));

    const { data: updatedStage, error } = await supabase
      .from('case_stages')
      .update(updatePayload)
      .eq('id', stageId)
      .select(`
        *,
        responsable:profiles!case_stages_responsable_id_fkey(nombre)
      `)
      .single();

    if (error) throw new Error('Error al completar la etapa');

    await updateCaseCurrentStage(existingStage.case_id);

    await logAuditAction({
      action: 'COMPLETE',
      entity_type: 'case_stage',
      entity_id: stageId,
      diff_json: { completed: updatePayload },
    });

    revalidatePath(`/cases/${existingStage.case_id}`);
    return { success: true, stage: updatedStage };
  } catch (error) {
    console.error('Error in completeStage:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Elimina una etapa procesal
 */
export async function deleteStage(stageId: string) {
  try {
    const profile = await requireAuth();
    const supabase = await getSB();

    const { data: existingStage, error: fetchError } = await supabase
      .from('case_stages')
      .select('*')
      .eq('id', stageId)
      .single();
    if (fetchError || !existingStage) throw new Error('Etapa no encontrada');

    const hasAccess = await canAccessCase(existingStage.case_id);
    if (!hasAccess) throw new Error('Sin permisos para acceder a este caso');
    if (profile.role !== 'admin_firma') throw new Error('Sin permisos para eliminar etapas');

    const { error } = await supabase.from('case_stages').delete().eq('id', stageId);
    if (error) throw new Error('Error al eliminar la etapa');

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
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * Obtiene etapas con filtros
 */
export async function getStages(filters?: Partial<StageFiltersInput>) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) throw new Error('No autenticado');

    const input = { page: 1, limit: 20, ...(filters ?? {}) };
    const validatedFilters = stageFiltersSchema.parse(input) as any;

    const supabase = await getSB();

    let query = supabase
      .from('case_stages')
      .select(
        `
        *,
        responsable:profiles!case_stages_responsable_id_fkey(id, nombre)
      `,
        { count: 'exact' }
      );

    if (profile.role === 'cliente') {
      query = query.eq('es_publica', true);
      const { data: clientCases } = await supabase
        .from('case_clients')
        .select('case_id')
        .eq('client_profile_id', profile.id);
      const caseIds = clientCases?.map((cc: { case_id: string }) => cc.case_id) || [];
      if (caseIds.length === 0) {
        return { success: true, stages: [], total: 0, page: validatedFilters.page, limit: validatedFilters.limit };
      }
      query = query.in('case_id', caseIds);
    } else if (profile.role === 'abogado') {
      const { data: abogadoCases } = await supabase.from('cases').select('id').eq('abogado_responsable', profile.id);
      const caseIds = abogadoCases?.map((c: { id: string }) => c.id) || [];
      if (caseIds.length === 0) {
        return { success: true, stages: [], total: 0, page: validatedFilters.page, limit: validatedFilters.limit };
      }
      query = query.in('case_id', caseIds);
    }

    if (validatedFilters.case_id) {
      const hasAccess = await canAccessCase(validatedFilters.case_id);
      if (!hasAccess) throw new Error('Sin permisos para acceder a este caso');
      query = query.eq('case_id', validatedFilters.case_id);
    }
    if (validatedFilters.estado) query = query.eq('estado', validatedFilters.estado);
    if (validatedFilters.responsable_id) query = query.eq('responsable_id', validatedFilters.responsable_id);
    if (validatedFilters.es_publica !== undefined) query = query.eq('es_publica', validatedFilters.es_publica);
    if (validatedFilters.fecha_desde) query = query.gte('fecha_programada', validatedFilters.fecha_desde);
    if (validatedFilters.fecha_hasta) query = query.lte('fecha_programada', validatedFilters.fecha_hasta);

    const { data: stages, error, count } = await query.order('orden', { ascending: true });
    if (error) {
      console.error('[getStages] Supabase error', error);
      throw new Error(error.message || 'Error al obtener etapas');
    }

    const from = (validatedFilters.page - 1) * validatedFilters.limit;
    const paginatedStages = stages?.slice(from, from + validatedFilters.limit) ?? [];

    return {
      success: true,
      stages: paginatedStages,
      total: count ?? stages?.length ?? 0,
      page: validatedFilters.page,
      limit: validatedFilters.limit,
    };
  } catch (error) {
    console.error('Error in getStages:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido', stages: [], total: 0 };
  }
}

/**
 * Función auxiliar
 */
async function updateCaseCurrentStage(caseId: string) {
  const supabase = await getSB();

  const { data: nextStage } = await supabase
    .from('case_stages')
    .select('etapa')
    .eq('case_id', caseId)
    .eq('estado', 'pendiente')
    .order('orden', { ascending: true })
    .limit(1)
    .maybeSingle();

  const nextEtapa = (nextStage as { etapa: string } | null)?.etapa ?? null;
  if (nextEtapa) {
    await supabase.from('cases').update({ etapa_actual: nextEtapa }).eq('id', caseId);
  }
}
