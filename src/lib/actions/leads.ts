'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';
import { createCase } from '@/lib/actions/cases';
import { logAuditAction } from '@/lib/audit/log';
import type { LeadRecord } from '@/lib/leads/types';
import { DEUDA_CERO_LEAD_SOURCES, isDeudaCeroOrgName } from '@/lib/leads/org';
import { detectLeadOrigin, normalizeLeadOrigin, type LeadOrigin } from '@/lib/leads/origin';
import {
  LEAD_STATUS_VALUES,
  LEAD_CONTACT_STATUSES,
  normalizeLeadStatus,
} from '@/lib/leads/status';

const PRIORITY_VALUES = new Set(['baja', 'media', 'alta', 'urgente']);

function normalizeText(value?: string | null) {
  const trimmed = String(value ?? '').trim();
  return trimmed.length ? trimmed : null;
}

function parseDateInput(value?: string | null) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return new Date(`${raw}T12:00:00Z`).toISOString();
}

function resolveLeadOrigin(lead: Pick<LeadRecord, 'origin' | 'raw_payload'>): LeadOrigin {
  const normalized = normalizeLeadOrigin(lead.origin);
  if (normalized !== 'unknown') return normalized;
  if (lead.raw_payload && typeof lead.raw_payload === 'object' && !Array.isArray(lead.raw_payload)) {
    return detectLeadOrigin(lead.raw_payload as Record<string, unknown>);
  }
  return 'unknown';
}

function toDateKey(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildLeadObservaciones(lead: LeadRecord) {
  const lines: string[] = ['Lead Deuda Cero'];
  if (lead.full_name) lines.push(`Nombre: ${lead.full_name}`);
  if (lead.email) lines.push(`Email: ${lead.email}`);
  if (lead.phone) lines.push(`Telefono: ${lead.phone}`);
  if (lead.rut) lines.push(`RUT: ${lead.rut}`);
  if (lead.lead_type) lines.push(`Tipo: ${lead.lead_type}`);
  if (lead.message) {
    lines.push('');
    lines.push('Mensaje:');
    lines.push(lead.message);
  }
  return lines.join('\n');
}

async function requireDeudaCeroAdmin() {
  const profile = await requireAuth('admin_firma');
  const orgId = (profile as any)?.active_organization_id ?? null;
  if (!orgId) throw new Error('Debes seleccionar una empresa activa.');

  const supabase = (await createServerClient()) as any;
  const { data: orgRow, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .maybeSingle();

  if (orgError) throw orgError;
  if (!orgRow || !isDeudaCeroOrgName(orgRow.name)) {
    throw new Error('Esta vista es exclusiva para Deuda Cero.');
  }

  return { profile, supabase, orgId };
}

export async function listDeudaCeroLeads(): Promise<{ success: boolean; data?: LeadRecord[]; error?: string }> {
  try {
    const { supabase, orgId } = await requireDeudaCeroAdmin();

    const { data, error } = await supabase
      .from('leads')
      .select(
        [
          'id',
          'organization_id',
          'full_name',
          'email',
          'phone',
          'rut',
          'message',
          'lead_type',
          'status',
          'source',
          'origin',
          'raw_payload',
          'created_at',
          'last_contact_at',
          'next_follow_up_at',
          'contact_notes',
          'case_id',
          'assigned_lawyer_id',
          'assigned_at',
          'case_caratulado',
          'case_materia',
          'case_descripcion',
          'case_prioridad',
          'case_contraparte',
          'converted_at',
        ].join(', '),
      )
      .eq('organization_id', orgId)
      .in('source', DEUDA_CERO_LEAD_SOURCES)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: (data ?? []) as LeadRecord[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'No se pudieron cargar los leads.',
    };
  }
}

export async function getDeudaCeroLead(id: string): Promise<{ success: boolean; lead?: LeadRecord; error?: string }> {
  try {
    const { supabase, orgId } = await requireDeudaCeroAdmin();
    const leadId = normalizeText(id);
    if (!leadId) return { success: false, error: 'Lead inválido.' };

    const { data, error } = await supabase
      .from('leads')
      .select(
        [
          'id',
          'organization_id',
          'full_name',
          'email',
          'phone',
          'rut',
          'message',
          'lead_type',
          'status',
          'source',
          'origin',
          'raw_payload',
          'created_at',
          'last_contact_at',
          'next_follow_up_at',
          'contact_notes',
          'case_id',
          'assigned_lawyer_id',
          'assigned_at',
          'case_caratulado',
          'case_materia',
          'case_descripcion',
          'case_prioridad',
          'case_contraparte',
          'converted_at',
        ].join(', '),
      )
      .eq('organization_id', orgId)
      .in('source', DEUDA_CERO_LEAD_SOURCES)
      .eq('id', leadId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { success: false, error: 'Lead no encontrado.' };

    return { success: true, lead: data as LeadRecord };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'No se pudo cargar el lead.',
    };
  }
}

export async function updateLeadStatus(input: {
  id: string;
  status: string;
  contactNotes?: string | null;
  nextFollowUpAt?: string | null;
}): Promise<{ success: boolean; lead?: LeadRecord; error?: string }> {
  try {
    const { supabase, orgId } = await requireDeudaCeroAdmin();
    const leadId = normalizeText(input.id);
    if (!leadId) return { success: false, error: 'Lead inválido.' };

    const normalizedStatus = normalizeLeadStatus(input.status);
    if (!normalizedStatus || !LEAD_STATUS_VALUES.has(normalizedStatus)) {
      return { success: false, error: 'Estado inválido.' };
    }

    const { data: current, error: currentError } = await supabase
      .from('leads')
      .select('id, case_id')
      .eq('organization_id', orgId)
      .in('source', DEUDA_CERO_LEAD_SOURCES)
      .eq('id', leadId)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current) return { success: false, error: 'Lead no encontrado.' };

    if (normalizedStatus === 'convertido' && !current.case_id) {
      return { success: false, error: 'El lead aún no tiene caso asociado.' };
    }

    const updates: Record<string, unknown> = {
      status: normalizedStatus,
      contact_notes: normalizeText(input.contactNotes),
      next_follow_up_at: parseDateInput(input.nextFollowUpAt),
    };

    if (LEAD_CONTACT_STATUSES.has(normalizedStatus)) {
      updates.last_contact_at = new Date().toISOString();
    }

    if (normalizedStatus === 'convertido') {
      updates.converted_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('organization_id', orgId)
      .in('source', DEUDA_CERO_LEAD_SOURCES)
      .eq('id', leadId)
      .select(
        [
          'id',
          'organization_id',
          'full_name',
          'email',
          'phone',
          'rut',
          'message',
          'lead_type',
          'status',
          'source',
          'origin',
          'raw_payload',
          'created_at',
          'last_contact_at',
          'next_follow_up_at',
          'contact_notes',
          'case_id',
          'assigned_lawyer_id',
          'assigned_at',
          'case_caratulado',
          'case_materia',
          'case_descripcion',
          'case_prioridad',
          'case_contraparte',
          'converted_at',
        ].join(', '),
      )
      .single();

    if (error) throw error;

    revalidatePath('/dashboard/admin/leads');
    revalidatePath(`/dashboard/admin/leads/${leadId}`);

    await logAuditAction({
      action: 'LEAD_STATUS',
      entity_type: 'lead',
      entity_id: leadId,
      diff_json: {
        status: normalizedStatus,
        next_follow_up_at: updates.next_follow_up_at,
      },
    });

    return { success: true, lead: data as LeadRecord };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'No se pudo actualizar el lead.',
    };
  }
}

export async function updateLeadCaseData(input: {
  id: string;
  caseCaratulado?: string | null;
  caseMateria?: string | null;
  caseDescripcion?: string | null;
  casePrioridad?: string | null;
  caseContraparte?: string | null;
}): Promise<{ success: boolean; lead?: LeadRecord; error?: string }> {
  try {
    const { supabase, orgId } = await requireDeudaCeroAdmin();
    const leadId = normalizeText(input.id);
    if (!leadId) return { success: false, error: 'Lead inválido.' };

    const priorityValue = normalizeText(input.casePrioridad);
    const sanitizedPriority = priorityValue && PRIORITY_VALUES.has(priorityValue) ? priorityValue : null;

    const updates: Record<string, unknown> = {
      case_caratulado: normalizeText(input.caseCaratulado),
      case_materia: normalizeText(input.caseMateria),
      case_descripcion: normalizeText(input.caseDescripcion),
      case_prioridad: sanitizedPriority,
      case_contraparte: normalizeText(input.caseContraparte),
    };

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('organization_id', orgId)
      .in('source', DEUDA_CERO_LEAD_SOURCES)
      .eq('id', leadId)
      .select(
        [
          'id',
          'organization_id',
          'full_name',
          'email',
          'phone',
          'rut',
          'message',
          'lead_type',
          'status',
          'source',
          'origin',
          'raw_payload',
          'created_at',
          'last_contact_at',
          'next_follow_up_at',
          'contact_notes',
          'case_id',
          'assigned_lawyer_id',
          'assigned_at',
          'case_caratulado',
          'case_materia',
          'case_descripcion',
          'case_prioridad',
          'case_contraparte',
          'converted_at',
        ].join(', '),
      )
      .single();

    if (error) throw error;

    revalidatePath('/dashboard/admin/leads');
    revalidatePath(`/dashboard/admin/leads/${leadId}`);

    await logAuditAction({
      action: 'LEAD_CASE_DATA',
      entity_type: 'lead',
      entity_id: leadId,
      diff_json: {
        case_caratulado: updates.case_caratulado,
        case_materia: updates.case_materia,
        case_prioridad: updates.case_prioridad,
      },
    });

    return { success: true, lead: data as LeadRecord };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'No se pudieron actualizar los datos del caso.',
    };
  }
}

export async function convertLeadToCase(input: {
  id: string;
  abogadoResponsableId: string;
}): Promise<{ success: boolean; caseId?: string; lead?: LeadRecord; error?: string }> {
  try {
    const { supabase, orgId } = await requireDeudaCeroAdmin();
    const leadId = normalizeText(input.id);
    const abogadoResponsableId = normalizeText(input.abogadoResponsableId);
    if (!leadId || !abogadoResponsableId) {
      return { success: false, error: 'Debes seleccionar un abogado responsable.' };
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select(
        [
          'id',
          'organization_id',
          'full_name',
          'email',
          'phone',
          'rut',
          'message',
          'lead_type',
          'status',
          'source',
          'origin',
          'raw_payload',
          'created_at',
          'last_contact_at',
          'next_follow_up_at',
          'contact_notes',
          'case_id',
          'assigned_lawyer_id',
          'assigned_at',
          'case_caratulado',
          'case_materia',
          'case_descripcion',
          'case_prioridad',
          'case_contraparte',
          'converted_at',
        ].join(', '),
      )
      .eq('organization_id', orgId)
      .in('source', DEUDA_CERO_LEAD_SOURCES)
      .eq('id', leadId)
      .maybeSingle();

    if (leadError) throw leadError;
    if (!lead) return { success: false, error: 'Lead no encontrado.' };
    if (lead.case_id) return { success: false, error: 'El lead ya tiene un caso asociado.' };

    const caratulado = normalizeText(lead.case_caratulado);
    const materia = normalizeText(lead.case_materia);
    const descripcion = normalizeText(lead.case_descripcion);

    if (!caratulado || !materia || !descripcion) {
      return { success: false, error: 'Completa caratulado, materia y descripcion antes de crear el caso.' };
    }

    if (descripcion.length < 20) {
      return { success: false, error: 'La descripcion del caso debe tener al menos 20 caracteres.' };
    }

    const result = await createCase({
      caratulado,
      materia,
      descripcion_inicial: descripcion,
      nombre_cliente: lead.full_name,
      rut_cliente: lead.rut ?? undefined,
      contraparte: normalizeText(lead.case_contraparte) ?? undefined,
      prioridad: (normalizeText(lead.case_prioridad) ?? 'media') as any,
      workflow_state: 'preparacion',
      estado: 'activo',
      etapa_actual: 'Ingreso Demanda',
      abogado_responsable: abogadoResponsableId,
      honorario_moneda: 'UF',
      modalidad_cobro: 'prepago',
      observaciones: buildLeadObservaciones(lead as LeadRecord),
    });

    if (!result.success || !result.case) {
      return { success: false, error: result.error ?? 'No se pudo crear el caso.' };
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('leads')
      .update({ status: 'convertido', case_id: result.case.id, converted_at: nowIso })
      .eq('organization_id', orgId)
      .in('source', DEUDA_CERO_LEAD_SOURCES)
      .eq('id', leadId)
      .select(
        [
          'id',
          'organization_id',
          'full_name',
          'email',
          'phone',
          'rut',
          'message',
          'lead_type',
          'status',
          'source',
          'origin',
          'raw_payload',
          'created_at',
          'last_contact_at',
          'next_follow_up_at',
          'contact_notes',
          'case_id',
          'assigned_lawyer_id',
          'assigned_at',
          'case_caratulado',
          'case_materia',
          'case_descripcion',
          'case_prioridad',
          'case_contraparte',
          'converted_at',
        ].join(', '),
      )
      .single();

    if (updateError) throw updateError;

    revalidatePath('/dashboard/admin/leads');
    revalidatePath(`/dashboard/admin/leads/${leadId}`);
    revalidatePath('/cases');

    await logAuditAction({
      action: 'LEAD_CONVERT',
      entity_type: 'lead',
      entity_id: leadId,
      diff_json: { case_id: result.case.id, abogado_responsable: abogadoResponsableId },
    });

    return { success: true, caseId: result.case.id, lead: updated as LeadRecord };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'No se pudo convertir el lead en caso.',
    };
  }
}

export async function updateLeadAssignment(input: {
  id: string;
  assignedLawyerId: string | null;
}): Promise<{ success: boolean; lead?: LeadRecord; error?: string }> {
  try {
    const { supabase, orgId } = await requireDeudaCeroAdmin();
    const leadId = normalizeText(input.id);
    if (!leadId) return { success: false, error: 'Lead inválido.' };

    const assignedLawyerId = normalizeText(input.assignedLawyerId) ?? null;
    const updates: Record<string, unknown> = {
      assigned_lawyer_id: assignedLawyerId,
      assigned_at: assignedLawyerId ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('organization_id', orgId)
      .in('source', DEUDA_CERO_LEAD_SOURCES)
      .eq('id', leadId)
      .select(
        [
          'id',
          'organization_id',
          'full_name',
          'email',
          'phone',
          'rut',
          'message',
          'lead_type',
          'status',
          'source',
          'origin',
          'raw_payload',
          'created_at',
          'last_contact_at',
          'next_follow_up_at',
          'contact_notes',
          'case_id',
          'assigned_lawyer_id',
          'assigned_at',
          'case_caratulado',
          'case_materia',
          'case_descripcion',
          'case_prioridad',
          'case_contraparte',
          'converted_at',
        ].join(', '),
      )
      .single();

    if (error) throw error;

    revalidatePath('/dashboard/admin/leads');
    revalidatePath(`/dashboard/admin/leads/${leadId}`);

    await logAuditAction({
      action: 'LEAD_ASSIGN',
      entity_type: 'lead',
      entity_id: leadId,
      diff_json: { assigned_lawyer_id: assignedLawyerId },
    });

    return { success: true, lead: data as LeadRecord };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'No se pudo asignar el lead.',
    };
  }
}

export async function getLeadControlPanelData(days: number = 30) {
  try {
    const { supabase, orgId } = await requireDeudaCeroAdmin();
    const now = new Date();
    const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const fromWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fromDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, created_at, origin, raw_payload, status, case_id, assigned_lawyer_id')
      .eq('organization_id', orgId)
      .in('source', DEUDA_CERO_LEAD_SOURCES)
      .gte('created_at', fromDate.toISOString());

    if (error) throw error;

    const rows = (leads ?? []) as Array<{
      id: string;
      created_at: string | null;
      origin: string | null;
      raw_payload: unknown;
      status: string | null;
      case_id: string | null;
      assigned_lawyer_id: string | null;
    }>;

    const dailyMap = new Map<
      string,
      { total: number; bot: number; form: number; unknown: number; assigned: number; converted: number; typed: number }
    >();

    const ensureDay = (key: string) => {
      if (!dailyMap.has(key)) {
        dailyMap.set(key, { total: 0, bot: 0, form: 0, unknown: 0, assigned: 0, converted: 0, typed: 0 });
      }
      return dailyMap.get(key)!;
    };

    const sum = {
      today: { total: 0, bot: 0, form: 0, unknown: 0, assigned: 0, converted: 0, typed: 0 },
      week: { total: 0, bot: 0, form: 0, unknown: 0, assigned: 0, converted: 0, typed: 0 },
      month: { total: 0, bot: 0, form: 0, unknown: 0, assigned: 0, converted: 0, typed: 0 },
    };

    const applySum = (bucket: typeof sum.today, origin: LeadOrigin, row: typeof rows[number]) => {
      bucket.total += 1;
      bucket[origin] += 1;
      if (row.assigned_lawyer_id) bucket.assigned += 1;
      if (row.case_id) bucket.converted += 1;
      if (row.status && row.status !== 'new') bucket.typed += 1;
    };

    for (const row of rows) {
      const origin = resolveLeadOrigin({ origin: row.origin, raw_payload: row.raw_payload } as LeadRecord);
      const dateKey = toDateKey(row.created_at);
      if (dateKey) {
        const day = ensureDay(dateKey);
        day.total += 1;
        day[origin] += 1;
        if (row.assigned_lawyer_id) day.assigned += 1;
        if (row.case_id) day.converted += 1;
        if (row.status && row.status !== 'new') day.typed += 1;
      }

      const createdAt = row.created_at ? new Date(row.created_at) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) continue;
      if (createdAt >= fromDay) applySum(sum.today, origin, row);
      if (createdAt >= fromWeek) applySum(sum.week, origin, row);
      if (createdAt >= fromDate) applySum(sum.month, origin, row);
    }

    const daily = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    const { data: recentActions } = await supabase
      .from('audit_log')
      .select('id, action, created_at, actor:profiles(nombre)')
      .eq('organization_id', orgId)
      .eq('entity_type', 'lead')
      .order('created_at', { ascending: false })
      .limit(15);

    return {
      success: true,
      summary: sum,
      daily,
      recentActions: recentActions ?? [],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'No se pudo cargar el panel de control.',
      summary: null,
      daily: [],
      recentActions: [],
    };
  }
}
