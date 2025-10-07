'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentProfile, requireAuth, canAccessCase } from '@/lib/auth/roles'
import { logAuditAction } from '@/lib/audit/log'
import {
  createInfoRequestSchema,
  updateInfoRequestSchema,
  respondInfoRequestSchema,
  infoRequestFiltersSchema,
  type CreateInfoRequestInput,
  type UpdateInfoRequestInput,
  type RespondInfoRequestInput,
  type InfoRequestFiltersInput,
} from '@/lib/validators/info-requests'
import type { InfoRequestInsert } from '@/lib/supabase/types'

/* -------------------------------------------------------------------------- */
/*                                 Helpers TS                                 */
/* -------------------------------------------------------------------------- */

/**
 * Setter seguro y tipado: solo asigna si `value` no es undefined.
 * Evita `@ts-ignore` / `@ts-expect-error` y respeta exactOptionalPropertyTypes.
 */
function setIfDefined<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  key: K,
  value: T[K] | undefined
) {
  if (typeof value !== 'undefined') {
    obj[key] = value
  }
}

/** Normaliza fecha (string) a `string | null` para la columna `date` */
function normalizeDate(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

export async function createInfoRequest(input: CreateInfoRequestInput) {
  try {
    const profile = await requireAuth()
    const validated = createInfoRequestSchema.parse(input)

    // Autorización de acceso al caso
    const hasAccess = await canAccessCase(validated.case_id)
    if (!hasAccess) throw new Error('Sin permisos para acceder a este caso')

    const supabase = await createServerClient()

    // Construimos SOLO las columnas que existen en la tabla (según tu snapshot)
    const insertPayload: InfoRequestInsert = {
      case_id: validated.case_id,
      creador_id: profile.id,
      titulo: validated.titulo,
      descripcion: validated.descripcion,
      tipo: validated.tipo, // request_type: 'documento' | 'informacion' | 'reunion' | 'otro'
      prioridad: validated.prioridad, // case_priority
      es_publica: validated.es_publica ?? true,
      fecha_limite: normalizeDate(validated.fecha_limite), // date (string | null)
      // resto quedan omitidos para que DB use defaults/NULL:
      // estado (default 'pendiente'), created_at/updated_at, etc.
    }

    const { data: newRequest, error } = await supabase
      .from('info_requests')
      .insert(insertPayload)
      .select(`
        *,
        creador:profiles!info_requests_creador_id_fkey(id, nombre),
        case:cases(id, caratulado)
      `)
      .single()

    if (error) {
      console.error('createInfoRequest insert error:', error)
      throw new Error('Error al crear la solicitud')
    }

    await logAuditAction({
      action: 'CREATE',
      entity_type: 'info_request',
      entity_id: newRequest.id,
      diff_json: { created: insertPayload },
    })

    revalidatePath(`/cases/${validated.case_id}`)
    return { success: true, request: newRequest }
  } catch (error) {
    console.error('Error in createInfoRequest:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

export async function updateInfoRequest(requestId: string, input: UpdateInfoRequestInput) {
  try {
    const profile = await requireAuth()
    const validated = updateInfoRequestSchema.parse(input)
    const supabase = await createServerClient()

    // Obtener registro actual
    const { data: existing, error: fetchError } = await supabase
      .from('info_requests')
      .select('*')
      .eq('id', requestId)
      .single()
    if (fetchError || !existing) throw new Error('Solicitud no encontrada')

    const hasAccess = await canAccessCase(existing.case_id)
    if (!hasAccess) throw new Error('Sin permisos para acceder a este caso')

    // Autorización para editar:
    if (profile.role !== 'admin_firma' && existing.creador_id !== profile.id) {
      if (profile.role === 'abogado') {
        const { data: caseData } = await supabase
          .from('cases')
          .select('abogado_responsable')
          .eq('id', existing.case_id)
          .single()
        if (!caseData || caseData.abogado_responsable !== profile.id) {
          throw new Error('Sin permisos para editar esta solicitud')
        }
      } else {
        throw new Error('Sin permisos para editar esta solicitud')
      }
    }

    // Construir update parcial (tipado) sin undefined
    const updatePayload: Partial<InfoRequestInsert> = {}
    setIfDefined(updatePayload, 'titulo', validated.titulo)
    setIfDefined(updatePayload, 'descripcion', validated.descripcion)
    setIfDefined(updatePayload, 'tipo', validated.tipo)
    setIfDefined(updatePayload, 'prioridad', validated.prioridad)
    setIfDefined(updatePayload, 'es_publica', validated.es_publica)
    // fecha_limite es date -> string|null
    setIfDefined(updatePayload, 'fecha_limite', normalizeDate(validated.fecha_limite))
    // estado no está en el schema de update por ahora; si lo agregas, usa setIfDefined

    const { data: updated, error } = await supabase
      .from('info_requests')
      .update(updatePayload)
      .eq('id', requestId)
      .select(`
        *,
        creador:profiles!info_requests_creador_id_fkey(id, nombre),
        case:cases(id, caratulado)
      `)
      .single()

    if (error) {
      console.error('updateInfoRequest update error:', error)
      throw new Error('Error al actualizar la solicitud')
    }

    await logAuditAction({
      action: 'UPDATE',
      entity_type: 'info_request',
      entity_id: requestId,
      diff_json: { from: existing, to: updated },
    })

    revalidatePath(`/cases/${existing.case_id}`)
    return { success: true, request: updated }
  } catch (error) {
    console.error('Error in updateInfoRequest:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Respond                                   */
/* -------------------------------------------------------------------------- */

export async function respondInfoRequest(requestId: string, input: RespondInfoRequestInput) {
  try {
    const profile = await requireAuth()
    const validated = respondInfoRequestSchema.parse(input)
    const supabase = await createServerClient()

    const { data: existing, error: fetchError } = await supabase
      .from('info_requests')
      .select('*')
      .eq('id', requestId)
      .single()
    if (fetchError || !existing) throw new Error('Solicitud no encontrada')

    const hasAccess = await canAccessCase(existing.case_id)
    if (!hasAccess) throw new Error('Sin permisos para acceder a este caso')

    if (profile.role === 'cliente') {
      throw new Error('Sin permisos para responder solicitudes')
    }

    const nowISO = new Date().toISOString()
    const responsePayload: Partial<InfoRequestInsert> = {
      respuesta: validated.respuesta,
      archivo_adjunto: (input as any)?.archivo_adjunto ?? null,
      respondido_por: profile.id,
      respondido_at: nowISO,
      estado: 'respondida' as any, // request_status enum acepta 'respondida'
    }

    const { data: updated, error } = await supabase
      .from('info_requests')
      .update(responsePayload)
      .eq('id', requestId)
      .select(`
        *,
        creador:profiles!info_requests_creador_id_fkey(id, nombre),
        respondido_por_profile:profiles!info_requests_respondido_por_fkey(id, nombre),
        case:cases(id, caratulado)
      `)
      .single()

    if (error) {
      console.error('respondInfoRequest update error:', error)
      throw new Error('Error al responder la solicitud')
    }

    await logAuditAction({
      action: 'RESPOND',
      entity_type: 'info_request',
      entity_id: requestId,
      diff_json: { response: responsePayload },
    })

    revalidatePath(`/cases/${existing.case_id}`)
    return { success: true, request: updated }
  } catch (error) {
    console.error('Error in respondInfoRequest:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Close                                    */
/* -------------------------------------------------------------------------- */

export async function closeInfoRequest(requestId: string) {
  try {
    const profile = await requireAuth()
    const supabase = await createServerClient()

    const { data: existing, error: fetchError } = await supabase
      .from('info_requests')
      .select('*')
      .eq('id', requestId)
      .single()
    if (fetchError || !existing) throw new Error('Solicitud no encontrada')

    const hasAccess = await canAccessCase(existing.case_id)
    if (!hasAccess) throw new Error('Sin permisos para acceder a este caso')

    if (profile.role !== 'admin_firma' && existing.creador_id !== profile.id) {
      if (profile.role === 'abogado') {
        const { data: caseData } = await supabase
          .from('cases')
          .select('abogado_responsable')
          .eq('id', existing.case_id)
          .single()
        if (!caseData || caseData.abogado_responsable !== profile.id) {
          throw new Error('Sin permisos para cerrar esta solicitud')
        }
      } else {
        throw new Error('Sin permisos para cerrar esta solicitud')
      }
    }

    const { data: updated, error } = await supabase
      .from('info_requests')
      .update({ estado: 'cerrada' as any }) // request_status enum acepta 'cerrada'
      .eq('id', requestId)
      .select(`
        *,
        creador:profiles!info_requests_creador_id_fkey(id, nombre),
        case:cases(id, caratulado)
      `)
      .single()

    if (error) {
      console.error('closeInfoRequest update error:', error)
      throw new Error('Error al cerrar la solicitud')
    }

    await logAuditAction({
      action: 'CLOSE',
      entity_type: 'info_request',
      entity_id: requestId,
      diff_json: { closed: true },
    })

    revalidatePath(`/cases/${existing.case_id}`)
    return { success: true, request: updated }
  } catch (error) {
    console.error('Error in closeInfoRequest:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                               List / Filters                               */
/* -------------------------------------------------------------------------- */

export async function getInfoRequests(
  filters: InfoRequestFiltersInput = { page: 1, limit: 20 }
) {
  try {
    const profile = await getCurrentProfile()
    if (!profile) throw new Error('No autenticado')

    const validated = infoRequestFiltersSchema.parse(filters)
    const supabase = await createServerClient()

    let query = supabase
      .from('info_requests')
      .select(
        `
        *,
        creador:profiles!info_requests_creador_id_fkey(id, nombre),
        respondido_por_profile:profiles!info_requests_respondido_por_fkey(id, nombre),
        case:cases(id, caratulado)
        `,
        { count: 'exact' }
      )

    // Filtrado por rol
    if (profile.role === 'cliente') {
      // Puede ver lo que creó o lo público dentro de sus casos
      query = query.or(`creador_id.eq.${profile.id},es_publica.eq.true`)
      const { data: clientCases } = await supabase
        .from('case_clients')
        .select('case_id')
        .eq('client_profile_id', profile.id)
      const caseIds = clientCases?.map((c: { case_id: string }) => c.case_id) || []
      if (caseIds.length === 0) return { success: true, requests: [], total: 0 }
      query = query.in('case_id', caseIds)
    } else if (profile.role === 'abogado') {
      const { data: abogadoCases } = await supabase
        .from('cases')
        .select('id')
        .eq('abogado_responsable', profile.id)
      const caseIds = abogadoCases?.map((c: { id: string }) => c.id) || []
      if (caseIds.length === 0) return { success: true, requests: [], total: 0 }
      query = query.in('case_id', caseIds)
    }

    // Filtros explícitos
    if (validated.case_id) {
      const hasAccess = await canAccessCase(validated.case_id)
      if (!hasAccess) throw new Error('Sin permisos para acceder a este caso')
      query = query.eq('case_id', validated.case_id)
    }

    if (validated.estado) query = query.eq('estado', validated.estado)
    if (validated.tipo) query = query.eq('tipo', validated.tipo)
    if (validated.prioridad) query = query.eq('prioridad', validated.prioridad)
    if (validated.creador_id) query = query.eq('creador_id', validated.creador_id)
    if (validated.es_publica !== undefined) query = query.eq('es_publica', validated.es_publica)
    if (validated.search) {
      query = query.or(
        `titulo.ilike.%${validated.search}%,descripcion.ilike.%${validated.search}%`
      )
    }

    const from = (validated.page - 1) * validated.limit
    const to = from + validated.limit - 1

    const { data: requests, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('getInfoRequests query error:', error)
      throw new Error('Error al obtener solicitudes')
    }

    return {
      success: true,
      requests: requests || [],
      total: count ?? requests?.length ?? 0,
      page: validated.page,
      limit: validated.limit,
    }
  } catch (error) {
    console.error('Error in getInfoRequests:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      requests: [],
      total: 0,
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Get One                                   */
/* -------------------------------------------------------------------------- */

export async function getInfoRequestById(requestId: string) {
  try {
    const profile = await getCurrentProfile()
    if (!profile) throw new Error('No autenticado')

    const supabase = await createServerClient()

    const { data: request, error } = await supabase
      .from('info_requests')
      .select(`
        *,
        creador:profiles!info_requests_creador_id_fkey(id, nombre),
        respondido_por_profile:profiles!info_requests_respondido_por_fkey(id, nombre),
        case:cases(id, caratulado)
      `)
      .eq('id', requestId)
      .single()

    if (error || !request) throw new Error('Solicitud no encontrada')

    const hasAccess = await canAccessCase(request.case_id)
    if (!hasAccess) throw new Error('Sin permisos para ver esta solicitud')

    if (profile.role === 'cliente' && !request.es_publica && request.creador_id !== profile.id) {
      throw new Error('Sin permisos para ver esta solicitud')
    }

    return { success: true, request }
  } catch (error) {
    console.error('Error in getInfoRequestById:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
