'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, requireAuth, canAccessCase } from '@/lib/auth/roles';
import { logAuditAction } from '@/lib/audit/log';
import {
  createInfoRequestSchema,
  updateInfoRequestSchema,
  respondInfoRequestSchema,
  infoRequestFiltersSchema,
  type CreateInfoRequestInput,
  type UpdateInfoRequestInput,
  type RespondInfoRequestInput,
  type InfoRequestFiltersInput,
} from '@/lib/validators/info-requests';
import type { InfoRequest, InfoRequestInsert } from '@/lib/supabase/types';

/**
 * Crea una nueva solicitud de información
 */
export async function createInfoRequest(input: CreateInfoRequestInput) {
  try {
    const profile = await requireAuth();
    const validatedInput = createInfoRequestSchema.parse(input);
    
    // Verificar acceso al caso
    const hasAccess = await canAccessCase(validatedInput.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para acceder a este caso');
    }

    const supabase = createClient();

    const requestData: InfoRequestInsert = {
      ...validatedInput,
      creador_id: profile.id,
      estado: 'pendiente',
    };

    const { data: newRequest, error } = await supabase
      .from('info_requests')
      .insert(requestData)
      .select(`
        *,
        creador:profiles(nombre),
        case:cases(caratulado)
      `)
      .single();

    if (error) {
      console.error('Error creating info request:', error);
      throw new Error('Error al crear la solicitud');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'CREATE',
      entity_type: 'info_request',
      entity_id: newRequest.id,
      diff_json: { created: requestData },
    });

    // Si es una solicitud de cliente, notificar al abogado
    if (profile.role === 'cliente') {
      // TODO: Implementar notificación por email
    }

    revalidatePath(`/cases/${validatedInput.case_id}`);

    return { success: true, request: newRequest };
  } catch (error) {
    console.error('Error in createInfoRequest:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Actualiza una solicitud de información
 */
export async function updateInfoRequest(requestId: string, input: UpdateInfoRequestInput) {
  try {
    const profile = await requireAuth();
    const validatedInput = updateInfoRequestSchema.parse(input);
    const supabase = createClient();

    // Obtener la solicitud existente
    const { data: existingRequest, error: fetchError } = await supabase
      .from('info_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !existingRequest) {
      throw new Error('Solicitud no encontrada');
    }

    // Verificar acceso al caso
    const hasAccess = await canAccessCase(existingRequest.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para acceder a este caso');
    }

    // Verificar permisos
    if (profile.role !== 'admin_firma' && existingRequest.creador_id !== profile.id) {
      // Los abogados pueden editar solicitudes de sus casos
      if (profile.role === 'abogado') {
        const { data: caseData } = await supabase
          .from('cases')
          .select('abogado_responsable')
          .eq('id', existingRequest.case_id)
          .single();
        
        if (!caseData || caseData.abogado_responsable !== profile.id) {
          throw new Error('Sin permisos para editar esta solicitud');
        }
      } else {
        throw new Error('Sin permisos para editar esta solicitud');
      }
    }

    const { data: updatedRequest, error } = await supabase
      .from('info_requests')
      .update(validatedInput)
      .eq('id', requestId)
      .select(`
        *,
        creador:profiles(nombre),
        case:cases(caratulado)
      `)
      .single();

    if (error) {
      console.error('Error updating info request:', error);
      throw new Error('Error al actualizar la solicitud');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'UPDATE',
      entity_type: 'info_request',
      entity_id: requestId,
      diff_json: { 
        from: existingRequest, 
        to: updatedRequest 
      },
    });

    revalidatePath(`/cases/${existingRequest.case_id}`);

    return { success: true, request: updatedRequest };
  } catch (error) {
    console.error('Error in updateInfoRequest:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Responde a una solicitud de información
 */
export async function respondInfoRequest(requestId: string, input: RespondInfoRequestInput) {
  try {
    const profile = await requireAuth();
    const validatedInput = respondInfoRequestSchema.parse(input);
    const supabase = createClient();

    // Obtener la solicitud existente
    const { data: existingRequest, error: fetchError } = await supabase
      .from('info_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !existingRequest) {
      throw new Error('Solicitud no encontrada');
    }

    // Verificar acceso al caso
    const hasAccess = await canAccessCase(existingRequest.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para acceder a este caso');
    }

    // Solo abogados y admin pueden responder
    if (profile.role === 'cliente') {
      throw new Error('Sin permisos para responder solicitudes');
    }

    const updateData = {
      respuesta: validatedInput.respuesta,
      archivo_adjunto: validatedInput.archivo_adjunto,
      respondido_por: profile.id,
      fecha_respuesta: new Date().toISOString(),
      estado: 'respondida' as const,
    };

    const { data: updatedRequest, error } = await supabase
      .from('info_requests')
      .update(updateData)
      .eq('id', requestId)
      .select(`
        *,
        creador:profiles(nombre),
        respondido_por_profile:profiles!info_requests_respondido_por_fkey(nombre),
        case:cases(caratulado)
      `)
      .single();

    if (error) {
      console.error('Error responding to info request:', error);
      throw new Error('Error al responder la solicitud');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'RESPOND',
      entity_type: 'info_request',
      entity_id: requestId,
      diff_json: { response: updateData },
    });

    // Notificar al creador de la solicitud
    // TODO: Implementar notificación por email

    revalidatePath(`/cases/${existingRequest.case_id}`);

    return { success: true, request: updatedRequest };
  } catch (error) {
    console.error('Error in respondInfoRequest:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Cierra una solicitud de información
 */
export async function closeInfoRequest(requestId: string) {
  try {
    const profile = await requireAuth();
    const supabase = createClient();

    // Obtener la solicitud existente
    const { data: existingRequest, error: fetchError } = await supabase
      .from('info_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !existingRequest) {
      throw new Error('Solicitud no encontrada');
    }

    // Verificar acceso al caso
    const hasAccess = await canAccessCase(existingRequest.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para acceder a este caso');
    }

    // Verificar permisos
    if (profile.role !== 'admin_firma' && existingRequest.creador_id !== profile.id) {
      // Los abogados pueden cerrar solicitudes de sus casos
      if (profile.role === 'abogado') {
        const { data: caseData } = await supabase
          .from('cases')
          .select('abogado_responsable')
          .eq('id', existingRequest.case_id)
          .single();
        
        if (!caseData || caseData.abogado_responsable !== profile.id) {
          throw new Error('Sin permisos para cerrar esta solicitud');
        }
      } else {
        throw new Error('Sin permisos para cerrar esta solicitud');
      }
    }

    const { data: updatedRequest, error } = await supabase
      .from('info_requests')
      .update({ estado: 'cerrada' })
      .eq('id', requestId)
      .select(`
        *,
        creador:profiles(nombre),
        case:cases(caratulado)
      `)
      .single();

    if (error) {
      console.error('Error closing info request:', error);
      throw new Error('Error al cerrar la solicitud');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'CLOSE',
      entity_type: 'info_request',
      entity_id: requestId,
      diff_json: { closed: true },
    });

    revalidatePath(`/cases/${existingRequest.case_id}`);

    return { success: true, request: updatedRequest };
  } catch (error) {
    console.error('Error in closeInfoRequest:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Obtiene solicitudes con filtros
 */
export async function getInfoRequests(filters: InfoRequestFiltersInput = {}) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new Error('No autenticado');
    }

    const validatedFilters = infoRequestFiltersSchema.parse(filters);
    const supabase = createClient();

    let query = supabase
      .from('info_requests')
      .select(`
        *,
        creador:profiles!info_requests_creador_id_fkey(id, nombre),
        respondido_por_profile:profiles!info_requests_respondido_por_fkey(id, nombre),
        case:cases(id, caratulado)
      `);

    // Aplicar filtros de acceso según rol
    if (profile.role === 'cliente') {
      // Los clientes solo ven solicitudes públicas de sus casos o las que crearon
      query = query.or(`creador_id.eq.${profile.id},es_publica.eq.true`);
      
      // Obtener casos del cliente
      const { data: clientCases } = await supabase
        .from('case_clients')
        .select('case_id')
        .eq('client_profile_id', profile.id);
      
      const caseIds = clientCases?.map(cc => cc.case_id) || [];
      if (caseIds.length === 0) {
        return { success: true, requests: [], total: 0 };
      }
      
      query = query.in('case_id', caseIds);
    } else if (profile.role === 'abogado') {
      // Los abogados ven solicitudes de sus casos
      const { data: abogadoCases } = await supabase
        .from('cases')
        .select('id')
        .eq('abogado_responsable', profile.id);
      
      const caseIds = abogadoCases?.map(c => c.id) || [];
      if (caseIds.length === 0) {
        return { success: true, requests: [], total: 0 };
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

    if (validatedFilters.tipo) {
      query = query.eq('tipo', validatedFilters.tipo);
    }

    if (validatedFilters.prioridad) {
      query = query.eq('prioridad', validatedFilters.prioridad);
    }

    if (validatedFilters.creador_id) {
      query = query.eq('creador_id', validatedFilters.creador_id);
    }

    if (validatedFilters.es_publica !== undefined) {
      query = query.eq('es_publica', validatedFilters.es_publica);
    }

    if (validatedFilters.fecha_desde) {
      query = query.gte('created_at', validatedFilters.fecha_desde);
    }

    if (validatedFilters.fecha_hasta) {
      query = query.lte('created_at', validatedFilters.fecha_hasta);
    }

    if (validatedFilters.search) {
      query = query.or(`titulo.ilike.%${validatedFilters.search}%,descripcion.ilike.%${validatedFilters.search}%`);
    }

    // Paginación
    const from = (validatedFilters.page - 1) * validatedFilters.limit;
    const to = from + validatedFilters.limit - 1;

    const { data: requests, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching info requests:', error);
      throw new Error('Error al obtener solicitudes');
    }

    return { 
      success: true, 
      requests: requests || [], 
      total: count || 0,
      page: validatedFilters.page,
      limit: validatedFilters.limit,
    };
  } catch (error) {
    console.error('Error in getInfoRequests:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido',
      requests: [],
      total: 0,
    };
  }
}

/**
 * Obtiene una solicitud por ID
 */
export async function getInfoRequestById(requestId: string) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new Error('No autenticado');
    }

    const supabase = createClient();

    const { data: request, error } = await supabase
      .from('info_requests')
      .select(`
        *,
        creador:profiles!info_requests_creador_id_fkey(id, nombre),
        respondido_por_profile:profiles!info_requests_respondido_por_fkey(id, nombre),
        case:cases(id, caratulado)
      `)
      .eq('id', requestId)
      .single();

    if (error || !request) {
      throw new Error('Solicitud no encontrada');
    }

    // Verificar acceso
    const hasAccess = await canAccessCase(request.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para ver esta solicitud');
    }

    // Los clientes solo pueden ver solicitudes públicas o las que crearon
    if (profile.role === 'cliente' && !request.es_publica && request.creador_id !== profile.id) {
      throw new Error('Sin permisos para ver esta solicitud');
    }

    return { success: true, request };
  } catch (error) {
    console.error('Error in getInfoRequestById:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}
