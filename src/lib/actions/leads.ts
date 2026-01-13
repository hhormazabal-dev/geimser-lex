'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';
import { createCase } from '@/lib/actions/cases';
import type { LeadRecord } from '@/lib/leads/types';
import { isDeudaCeroOrgName } from '@/lib/leads/org';
import {
  LEAD_STATUS_VALUES,
  LEAD_CONTACT_STATUSES,
  normalizeLeadStatus,
} from '@/lib/leads/status';

const LEAD_SOURCE = 'website_deudacero';
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
          'raw_payload',
          'created_at',
          'last_contact_at',
          'next_follow_up_at',
          'contact_notes',
          'case_id',
          'case_caratulado',
          'case_materia',
          'case_descripcion',
          'case_prioridad',
          'case_contraparte',
          'converted_at',
        ].join(', '),
      )
      .eq('organization_id', orgId)
      .eq('source', LEAD_SOURCE)
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
          'raw_payload',
          'created_at',
          'last_contact_at',
          'next_follow_up_at',
          'contact_notes',
          'case_id',
          'case_caratulado',
          'case_materia',
          'case_descripcion',
          'case_prioridad',
          'case_contraparte',
          'converted_at',
        ].join(', '),
      )
      .eq('organization_id', orgId)
      .eq('source', LEAD_SOURCE)
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
      .eq('source', LEAD_SOURCE)
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
      .eq('source', LEAD_SOURCE)
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
          'raw_payload',
          'created_at',
          'last_contact_at',
          'next_follow_up_at',
          'contact_notes',
          'case_id',
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
      .eq('source', LEAD_SOURCE)
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
          'raw_payload',
          'created_at',
          'last_contact_at',
          'next_follow_up_at',
          'contact_notes',
          'case_id',
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
          'raw_payload',
          'created_at',
          'last_contact_at',
          'next_follow_up_at',
          'contact_notes',
          'case_id',
          'case_caratulado',
          'case_materia',
          'case_descripcion',
          'case_prioridad',
          'case_contraparte',
          'converted_at',
        ].join(', '),
      )
      .eq('organization_id', orgId)
      .eq('source', LEAD_SOURCE)
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
      .eq('source', LEAD_SOURCE)
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
          'raw_payload',
          'created_at',
          'last_contact_at',
          'next_follow_up_at',
          'contact_notes',
          'case_id',
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

    return { success: true, caseId: result.case.id, lead: updated as LeadRecord };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'No se pudo convertir el lead en caso.',
    };
  }
}
