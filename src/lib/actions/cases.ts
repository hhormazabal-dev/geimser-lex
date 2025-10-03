'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, requireAuth } from '@/lib/auth/roles';
import { logAuditAction } from '@/lib/audit/log';
import {
  createCaseSchema,
  updateCaseSchema,
  createCaseFromBriefSchema,
  assignLawyerSchema,
  caseFiltersSchema,
  type CreateCaseInput,
  type UpdateCaseInput,
  type CreateCaseFromBriefInput,
  type AssignLawyerInput,
  type CaseFiltersInput,
} from '@/lib/validators/case';
import type { Case, CaseInsert } from '@/lib/supabase/types';

/**
 * Crea un nuevo caso
 */
export async function createCase(input: CreateCaseInput) {
  try {
    const profile = await requireAuth('abogado');
    const validatedInput = createCaseSchema.parse(input);
    const supabase = createClient();

    // Si no se especifica abogado responsable, usar el usuario actual
    const caseData: CaseInsert = {
      ...validatedInput,
      abogado_responsable: validatedInput.abogado_responsable || profile.id,
      fecha_inicio: validatedInput.fecha_inicio || new Date().toISOString().split('T')[0],
    };

    const { data: newCase, error } = await supabase
      .from('cases')
      .insert(caseData)
      .select()
      .single();

    if (error) {
      console.error('Error creating case:', error);
      throw new Error('Error al crear el caso');
    }

    // Crear etapas iniciales del caso
    await createInitialStages(newCase.id);

    // Log de auditoría
    await logAuditAction({
      action: 'CREATE',
      entity_type: 'case',
      entity_id: newCase.id,
      diff_json: { created: caseData },
    });

    revalidatePath('/cases');
    revalidatePath('/dashboard');

    return { success: true, case: newCase };
  } catch (error) {
    console.error('Error in createCase:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Crea un caso a partir de un brief usando IA (simulado)
 */
export async function createCaseFromBrief(input: CreateCaseFromBriefInput) {
  try {
    const profile = await requireAuth('abogado');
    const validatedInput = createCaseFromBriefSchema.parse(input);
    
    // Simular procesamiento de IA para extraer información del brief
    const extractedData = await extractCaseDataFromBrief(validatedInput.brief);
    
    // Combinar datos extraídos con overrides del usuario
    const caseData: CreateCaseInput = {
      ...extractedData,
      ...validatedInput.overrides,
      abogado_responsable: profile.id,
    };

    return await createCase(caseData);
  } catch (error) {
    console.error('Error in createCaseFromBrief:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Actualiza un caso existente
 */
export async function updateCase(caseId: string, input: UpdateCaseInput) {
  try {
    const profile = await requireAuth();
    const validatedInput = updateCaseSchema.parse(input);
    const supabase = createClient();

    // Verificar acceso al caso
    const { data: existingCase, error: fetchError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();

    if (fetchError || !existingCase) {
      throw new Error('Caso no encontrado');
    }

    // Verificar permisos
    if (profile.role !== 'admin_firma' && existingCase.abogado_responsable !== profile.id) {
      throw new Error('Sin permisos para editar este caso');
    }

    const { data: updatedCase, error } = await supabase
      .from('cases')
      .update(validatedInput)
      .eq('id', caseId)
      .select()
      .single();

    if (error) {
      console.error('Error updating case:', error);
      throw new Error('Error al actualizar el caso');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'UPDATE',
      entity_type: 'case',
      entity_id: caseId,
      diff_json: { 
        from: existingCase, 
        to: updatedCase 
      },
    });

    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/cases');
    revalidatePath('/dashboard');

    return { success: true, case: updatedCase };
  } catch (error) {
    console.error('Error in updateCase:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Asigna un abogado a un caso
 */
export async function assignLawyer(input: AssignLawyerInput) {
  try {
    await requireAuth('admin_firma');
    const validatedInput = assignLawyerSchema.parse(input);
    const supabase = createClient();

    const { data: updatedCase, error } = await supabase
      .from('cases')
      .update({ abogado_responsable: validatedInput.abogado_id })
      .eq('id', validatedInput.case_id)
      .select()
      .single();

    if (error) {
      console.error('Error assigning lawyer:', error);
      throw new Error('Error al asignar abogado');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'ASSIGN_LAWYER',
      entity_type: 'case',
      entity_id: validatedInput.case_id,
      diff_json: { 
        abogado_responsable: validatedInput.abogado_id 
      },
    });

    revalidatePath(`/cases/${validatedInput.case_id}`);
    revalidatePath('/cases');
    revalidatePath('/dashboard');

    return { success: true, case: updatedCase };
  } catch (error) {
    console.error('Error in assignLawyer:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Elimina un caso (solo admin)
 */
export async function deleteCase(caseId: string) {
  try {
    await requireAuth('admin_firma');
    const supabase = createClient();

    const { error } = await supabase
      .from('cases')
      .delete()
      .eq('id', caseId);

    if (error) {
      console.error('Error deleting case:', error);
      throw new Error('Error al eliminar el caso');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'DELETE',
      entity_type: 'case',
      entity_id: caseId,
      diff_json: { deleted: true },
    });

    revalidatePath('/cases');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Error in deleteCase:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Obtiene casos con filtros
 */
export async function getCases(filters: CaseFiltersInput = {}) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new Error('No autenticado');
    }

    const validatedFilters = caseFiltersSchema.parse(filters);
    const supabase = createClient();

    let query = supabase
      .from('cases')
      .select(`
        *,
        abogado_responsable:profiles!cases_abogado_responsable_fkey(id, nombre),
        case_stages(id, etapa, estado, fecha_programada, orden)
      `);

    // Aplicar filtros de acceso según rol
    if (profile.role === 'abogado') {
      query = query.eq('abogado_responsable', profile.id);
    } else if (profile.role === 'cliente') {
      // Los clientes solo ven sus casos asignados
      const { data: clientCases } = await supabase
        .from('case_clients')
        .select('case_id')
        .eq('client_profile_id', profile.id);
      
      const caseIds = clientCases?.map(cc => cc.case_id) || [];
      if (caseIds.length === 0) {
        return { success: true, cases: [], total: 0 };
      }
      
      query = query.in('id', caseIds);
    }

    // Aplicar filtros adicionales
    if (validatedFilters.estado) {
      query = query.eq('estado', validatedFilters.estado);
    }
    if (validatedFilters.prioridad) {
      query = query.eq('prioridad', validatedFilters.prioridad);
    }
    if (validatedFilters.abogado_responsable) {
      query = query.eq('abogado_responsable', validatedFilters.abogado_responsable);
    }
    if (validatedFilters.materia) {
      query = query.eq('materia', validatedFilters.materia);
    }
    if (validatedFilters.fecha_inicio_desde) {
      query = query.gte('fecha_inicio', validatedFilters.fecha_inicio_desde);
    }
    if (validatedFilters.fecha_inicio_hasta) {
      query = query.lte('fecha_inicio', validatedFilters.fecha_inicio_hasta);
    }
    if (validatedFilters.search) {
      query = query.or(`caratulado.ilike.%${validatedFilters.search}%,nombre_cliente.ilike.%${validatedFilters.search}%,numero_causa.ilike.%${validatedFilters.search}%`);
    }

    // Paginación
    const from = (validatedFilters.page - 1) * validatedFilters.limit;
    const to = from + validatedFilters.limit - 1;

    const { data: cases, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cases:', error);
      throw new Error('Error al obtener casos');
    }

    return { 
      success: true, 
      cases: cases || [], 
      total: count || 0,
      page: validatedFilters.page,
      limit: validatedFilters.limit,
    };
  } catch (error) {
    console.error('Error in getCases:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido',
      cases: [],
      total: 0,
    };
  }
}

/**
 * Obtiene un caso por ID
 */
export async function getCaseById(caseId: string) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new Error('No autenticado');
    }

    const supabase = createClient();

    const { data: caseData, error } = await supabase
      .from('cases')
      .select(`
        *,
        abogado_responsable:profiles!cases_abogado_responsable_fkey(id, nombre, rut, telefono),
        case_stages(*, responsable:profiles(nombre)),
        notes(*, author:profiles(nombre)),
        documents(*, uploader:profiles(nombre)),
        info_requests(*, creador:profiles(nombre))
      `)
      .eq('id', caseId)
      .single();

    if (error || !caseData) {
      throw new Error('Caso no encontrado');
    }

    // Verificar acceso
    if (profile.role === 'abogado' && caseData.abogado_responsable?.id !== profile.id) {
      throw new Error('Sin permisos para ver este caso');
    }

    if (profile.role === 'cliente') {
      const { data: clientCase } = await supabase
        .from('case_clients')
        .select('id')
        .eq('case_id', caseId)
        .eq('client_profile_id', profile.id)
        .single();

      if (!clientCase) {
        throw new Error('Sin permisos para ver este caso');
      }
    }

    return { success: true, case: caseData };
  } catch (error) {
    console.error('Error in getCaseById:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Funciones auxiliares
 */

async function createInitialStages(caseId: string) {
  const supabase = createClient();
  
  const initialStages = [
    { etapa: 'Ingreso Demanda', orden: 1, es_publica: true },
    { etapa: 'Notificación', orden: 2, es_publica: true },
    { etapa: 'Contestación', orden: 3, es_publica: true },
    { etapa: 'Audiencia Preparación', orden: 4, es_publica: true },
    { etapa: 'Audiencia Juicio', orden: 5, es_publica: true },
    { etapa: 'Sentencia', orden: 6, es_publica: true },
  ];

  const stages = initialStages.map(stage => ({
    case_id: caseId,
    ...stage,
  }));

  await supabase.from('case_stages').insert(stages);
}

async function extractCaseDataFromBrief(brief: string): Promise<Partial<CreateCaseInput>> {
  // Simulación de extracción de datos usando IA
  // En producción, esto se conectaría a OpenAI o similar
  
  const extractedData: Partial<CreateCaseInput> = {};

  // Extraer información básica usando patrones simples
  const lines = brief.toLowerCase().split('\n');
  
  for (const line of lines) {
    // Buscar caratulado
    if (line.includes('caratulado') || line.includes('caso') || line.includes('demanda')) {
      const match = line.match(/(?:caratulado|caso|demanda)[:\s]+(.+)/);
      if (match) {
        extractedData.caratulado = match[1].trim();
      }
    }
    
    // Buscar cliente
    if (line.includes('cliente') || line.includes('demandante')) {
      const match = line.match(/(?:cliente|demandante)[:\s]+(.+)/);
      if (match) {
        extractedData.nombre_cliente = match[1].trim();
      }
    }
    
    // Buscar materia
    if (line.includes('laboral')) extractedData.materia = 'Laboral';
    if (line.includes('civil')) extractedData.materia = 'Civil';
    if (line.includes('comercial')) extractedData.materia = 'Comercial';
    if (line.includes('penal')) extractedData.materia = 'Penal';
    if (line.includes('familia')) extractedData.materia = 'Familia';
    
    // Buscar prioridad
    if (line.includes('urgente')) extractedData.prioridad = 'urgente';
    if (line.includes('alta prioridad')) extractedData.prioridad = 'alta';
    if (line.includes('baja prioridad')) extractedData.prioridad = 'baja';
  }

  // Valores por defecto si no se encontró información
  if (!extractedData.caratulado) {
    extractedData.caratulado = 'Caso generado desde brief';
  }
  if (!extractedData.nombre_cliente) {
    extractedData.nombre_cliente = 'Cliente por definir';
  }
  if (!extractedData.prioridad) {
    extractedData.prioridad = 'media';
  }

  extractedData.observaciones = `Caso creado desde brief:\n\n${brief}`;

  return extractedData;
}
