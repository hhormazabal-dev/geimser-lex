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

async function getSB() {
  return createServerClient();
}

type CaseChangeSettings = {
  case_change_emails_enabled: boolean;
  calendar_links_enabled: boolean;
  case_change_send_to_lawyer: boolean;
  case_change_send_to_staff: boolean;
  case_change_send_to_clients: boolean;
};

function defaultCaseChangeSettings(): CaseChangeSettings {
  return {
    case_change_emails_enabled: true,
    calendar_links_enabled: true,
    case_change_send_to_lawyer: true,
    case_change_send_to_staff: false,
    case_change_send_to_clients: true,
  };
}

function buildCalendarLinks(args: {
  token: string;
  appUrl: string;
  dateOnly: string;
  title: string;
  details: string;
}) {
  const start = args.dateOnly.split('-').join('');
  const endDate = new Date(`${args.dateOnly}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const end = `${endDate.getUTCFullYear()}${String(endDate.getUTCMonth() + 1).padStart(2, '0')}${String(endDate.getUTCDate()).padStart(2, '0')}`;

  const google = new URL('https://calendar.google.com/calendar/render');
  google.searchParams.set('action', 'TEMPLATE');
  google.searchParams.set('text', args.title);
  google.searchParams.set('dates', `${start}/${end}`);
  google.searchParams.set('details', args.details);

  const outlook = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  outlook.searchParams.set('subject', args.title);
  outlook.searchParams.set('startdt', `${args.dateOnly}T00:00:00Z`);
  outlook.searchParams.set('enddt', `${args.dateOnly}T23:59:59Z`);
  outlook.searchParams.set('body', args.details);

  return {
    ics_url: `${args.appUrl}/api/calendar/ics?token=${encodeURIComponent(args.token)}`,
    google_url: google.toString(),
    outlook_url: outlook.toString(),
  };
}

async function sendNotificationEmail(to: string, template: string, data: Record<string, any>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return;
  try {
    await fetch(`${url}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ type: 'email', to, template, data }),
    });
  } catch (e) {
    console.warn('[notifications] send failed', e);
  }
}

async function notifyCaseChange(args: {
  actorEmail?: string | null;
  caseId: string;
  stage: { id: string; etapa?: string | null; descripcion?: string | null; fecha_programada?: string | null; es_publica?: boolean | null };
  updateType: string;
  description: string;
}) {
  const svc = createServiceClient() as any;

  const { data: caseRow } = await svc
    .from('cases')
    .select(
      `
        id,
        caratulado,
        organization_id,
        abogado_responsable:profiles(email)
      `
    )
    .eq('id', args.caseId)
    .maybeSingle();

  const orgId = String(caseRow?.organization_id ?? '');
  if (!orgId) return;

  const { data: settingsRow } = await svc
    .from('organization_notification_settings')
    .select('case_change_emails_enabled, calendar_links_enabled, case_change_send_to_lawyer, case_change_send_to_staff, case_change_send_to_clients')
    .eq('organization_id', orgId)
    .maybeSingle();

  const settings: CaseChangeSettings = {
    ...defaultCaseChangeSettings(),
    ...(settingsRow ?? {}),
  };
  if (!settings.case_change_emails_enabled) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://geimser-lex.vercel.app';
  const caseUrl = `${appUrl}/cases/${args.caseId}`;
  const actor = (args.actorEmail ?? '').trim().toLowerCase();

  const recipients = new Set<string>();

  if (settings.case_change_send_to_lawyer) {
    const lawyerEmail = String(caseRow?.abogado_responsable?.email ?? '').trim().toLowerCase();
    if (lawyerEmail) recipients.add(lawyerEmail);
  }

  if (settings.case_change_send_to_staff) {
    const { data: members } = await svc
      .from('org_members')
      .select('user_id, role')
      .eq('organization_id', orgId)
      .in('role', ['org_admin', 'staff']);
    const ids = Array.from(new Set((members ?? []).map((m: any) => m.user_id).filter(Boolean)));
    if (ids.length) {
      const { data: staffProfiles } = await svc.from('profiles').select('email, user_id').in('user_id', ids);
      for (const p of staffProfiles ?? []) {
        const email = String(p.email ?? '').trim().toLowerCase();
        if (email) recipients.add(email);
      }
    }
  }

  const canNotifyClients = Boolean(args.stage.es_publica ?? true);
  if (settings.case_change_send_to_clients && canNotifyClients) {
    const { data: clients } = await svc
      .from('case_clients')
      .select('client_profile:profiles(email)')
      .eq('case_id', args.caseId);
    for (const row of clients ?? []) {
      const email = String(row?.client_profile?.email ?? '').trim().toLowerCase();
      if (email) recipients.add(email);
    }
  }

  if (actor) recipients.delete(actor);
  if (recipients.size === 0) return;

  const stageName = args.stage.etapa ?? null;

  let calendar: any = null;
  const dateOnly = String(args.stage.fecha_programada ?? '').trim();
  if (settings.calendar_links_enabled && dateOnly) {
    const token = crypto.randomUUID();
    const { error: tokErr } = await svc.from('calendar_event_tokens').insert({
      token,
      organization_id: orgId,
      stage_id: args.stage.id,
      recipient_email: null,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
    });
    if (!tokErr) {
      calendar = buildCalendarLinks({
        token,
        appUrl,
        dateOnly,
        title: `${caseRow?.caratulado ?? 'Caso'} · ${stageName ?? 'Hito'}`,
        details: `${args.description}\n\nVer caso: ${caseUrl}`,
      });
    }
  }

  const data = {
    case_name: caseRow?.caratulado ?? 'Caso',
    update_type: args.updateType,
    description: args.description,
    stage_name: stageName,
    date: new Date().toISOString(),
    case_url: caseUrl,
    calendar,
  };

  await Promise.all(Array.from(recipients).map((to) => sendNotificationEmail(to, 'case_update', data)));
}

function normalizeDateOnlyInput(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.includes('T') ? (trimmed.split('T')[0] ?? trimmed) : trimmed;
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
      fecha_programada: normalizeDateOnlyInput(vi.fecha_programada) ?? null,
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

    await notifyCaseChange({
      actorEmail: (profile as any)?.email ?? null,
      caseId: vi.case_id,
      stage: {
        id: newStage.id,
        etapa: newStage.etapa ?? null,
        descripcion: newStage.descripcion ?? null,
        fecha_programada: newStage.fecha_programada ?? null,
        es_publica: newStage.es_publica ?? true,
      },
      updateType: 'Nueva etapa',
      description: `Se creó la etapa "${newStage.etapa}"${newStage.fecha_programada ? ` (fecha: ${newStage.fecha_programada})` : ''}.`,
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
    copyIfPresent(validatedInput, updatePayload, 'fecha_programada', 'fecha_programada', (v) => normalizeDateOnlyInput(v) ?? null);
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

    const changes: string[] = [];
    if (existingStage.etapa !== updatedStage.etapa) changes.push(`etapa: "${existingStage.etapa}" → "${updatedStage.etapa}"`);
    if (existingStage.estado !== updatedStage.estado) changes.push(`estado: ${existingStage.estado} → ${updatedStage.estado}`);
    if (existingStage.fecha_programada !== updatedStage.fecha_programada) {
      changes.push(`fecha: ${existingStage.fecha_programada ?? '—'} → ${updatedStage.fecha_programada ?? '—'}`);
    }
    if (existingStage.responsable_id !== updatedStage.responsable_id) changes.push('responsable actualizado');
    if (existingStage.es_publica !== updatedStage.es_publica) changes.push(`visibilidad: ${existingStage.es_publica ? 'pública' : 'privada'} → ${updatedStage.es_publica ? 'pública' : 'privada'}`);

    await notifyCaseChange({
      actorEmail: (profile as any)?.email ?? null,
      caseId: existingStage.case_id,
      stage: {
        id: updatedStage.id,
        etapa: updatedStage.etapa ?? null,
        descripcion: updatedStage.descripcion ?? null,
        fecha_programada: updatedStage.fecha_programada ?? null,
        es_publica: updatedStage.es_publica ?? true,
      },
      updateType: 'Etapa actualizada',
      description: changes.length ? `Cambios: ${changes.join(' · ')}` : `Se actualizó la etapa "${updatedStage.etapa}".`,
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

    const defaultDate = new Date().toISOString().split('T')[0]!;
    const rawCompletion = (validatedInput['fecha_completada'] as string | undefined)?.trim();
    const normalized =
      rawCompletion && rawCompletion.length > 0
        ? rawCompletion.includes('T')
          ? (rawCompletion.split('T')[0] ?? rawCompletion)
          : rawCompletion
        : defaultDate;
    const completionDate = normalized;

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

    // Auto-fix for legacy cases: If we finished "Audiencia de juicio", and next is "Sentencia", rename it to "En espera de sentencia".
    if (existingStage.etapa?.toLowerCase().includes('audiencia de juicio')) {
      const { data: nextStage } = await supabase
        .from('case_stages')
        .select('id, etapa')
        .eq('case_id', existingStage.case_id)
        .eq('estado', 'pendiente')
        .gt('orden', existingStage.orden!)
        .order('orden', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (
        nextStage &&
        nextStage.etapa.toLowerCase().includes('sentencia') &&
        !nextStage.etapa.toLowerCase().includes('en espera')
      ) {
        await supabase
          .from('case_stages')
          .update({ etapa: 'En espera de sentencia' })
          .eq('id', nextStage.id);
      }
    }

    await updateCaseCurrentStage(existingStage.case_id);

    await logAuditAction({
      action: 'COMPLETE',
      entity_type: 'case_stage',
      entity_id: stageId,
      diff_json: { completed: updatePayload },
    });

    await notifyCaseChange({
      actorEmail: (profile as any)?.email ?? null,
      caseId: existingStage.case_id,
      stage: {
        id: updatedStage.id,
        etapa: updatedStage.etapa ?? null,
        descripcion: updatedStage.descripcion ?? null,
        fecha_programada: updatedStage.fecha_programada ?? null,
        es_publica: updatedStage.es_publica ?? true,
      },
      updateType: 'Etapa completada',
      description: `Se completó la etapa "${updatedStage.etapa}" (cumplida: ${updatedStage.fecha_cumplida ?? 'hoy'}).`,
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
      const { data: abogadoCases } = await supabase
        .from('cases')
        .select('id')
        .eq('abogado_responsable', profile.id)
        // @ts-expect-error
        .is('deleted_at', null);
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
