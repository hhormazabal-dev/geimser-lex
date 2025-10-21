// src/lib/actions/cases.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
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

import { getStageTemplatesByMateria } from '@/lib/validators/stages';
import type { StageTemplate } from '@/lib/validators/stages';
import { findLegalFeeItemById } from '@/lib/pricing/legalFees';

import type {
  Case,
  CaseInsert,
  CaseUpdate,
  CaseStageInsert,
} from '@/lib/supabase/types';

/* -------------------------------------------------------------------------- */
/*                                   Utils                                    */
/* -------------------------------------------------------------------------- */

const sOrNull = (v: string | undefined | null): string | null => (v ?? null);
const nOrNull = (v: number | undefined | null): number | null => (v ?? null);

function stripUndefined<T extends Record<string, any>>(obj: T | undefined): Partial<T> {
  if (!obj) return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

async function getSB() {
  // si existe service key => usar cliente de servicio (bypassa RLS para jobs controlados)
  if (process.env.SUPABASE_SERVICE_KEY) return createServiceClient();
  // si no, usar el cliente SSR ligado a cookies/sesión
  return createServerClient();
}

/* -------------------------------------------------------------------------- */
/*                         Tipado fuerte de WorkflowState                      */
/* -------------------------------------------------------------------------- */

type Workflow = 'activo' | 'preparacion' | 'en_revision' | 'cerrado';
const WF_DEFAULT: Workflow = 'preparacion';

function parseWorkflow(v: unknown): Workflow {
  const valid: Workflow[] = ['activo', 'preparacion', 'en_revision', 'cerrado'];
  if (typeof v === 'string' && valid.includes(v as Workflow)) return v as Workflow;
  return WF_DEFAULT;
}

/* -------------------------------------------------------------------------- */
/*                                    CRUD                                    */
/* -------------------------------------------------------------------------- */

export async function createCase(input: CreateCaseInput) {
  try {
    const profile = await requireAuth(['abogado', 'analista']);
    const parsed = createCaseSchema.parse(input);
    const { marcar_validado, ...caseInput } = parsed;

    const supabase = await getSB();
    const nowIso = new Date().toISOString();

    const baseData: CaseInsert = {
      caratulado: caseInput.caratulado,
      nombre_cliente: caseInput.nombre_cliente,

      numero_causa: sOrNull(caseInput.numero_causa),
      materia: sOrNull(caseInput.materia),
      tribunal: sOrNull(caseInput.tribunal),
      region: sOrNull(caseInput.region),
      comuna: sOrNull(caseInput.comuna),
      rut_cliente: sOrNull(caseInput.rut_cliente),
      contraparte: sOrNull(caseInput.contraparte),
      etapa_actual: sOrNull(caseInput.etapa_actual),

      fecha_inicio: caseInput.fecha_inicio ?? null,
      abogado_responsable:
        caseInput.abogado_responsable ??
        (profile.role === 'abogado' ? profile.id : null),

      estado: caseInput.estado ?? 'activo',
      workflow_state: parseWorkflow(
        caseInput.workflow_state ?? (marcar_validado ? 'en_revision' : 'preparacion')
      ),
      prioridad: caseInput.prioridad ?? 'media',

      valor_estimado: nOrNull(caseInput.valor_estimado),
      honorario_total_uf: nOrNull(caseInput.honorario_total_uf),
      honorario_variable_porcentaje: nOrNull(caseInput.honorario_variable_porcentaje),
      honorario_variable_base: sOrNull(caseInput.honorario_variable_base),
      honorario_moneda: caseInput.honorario_moneda ?? 'UF',
      modalidad_cobro: caseInput.modalidad_cobro ?? 'prepago',
      honorario_notas: sOrNull(caseInput.honorario_notas),
      tarifa_referencia: sOrNull(caseInput.tarifa_referencia),
      honorario_pagado_uf:
        caseInput.honorario_pagado_uf !== undefined && caseInput.honorario_pagado_uf !== null
          ? Number(caseInput.honorario_pagado_uf)
          : 0,
      observaciones: sOrNull(caseInput.observaciones),

      cliente_principal_id: sOrNull((caseInput as any).cliente_principal_id),
      descripcion_inicial: sOrNull(caseInput.descripcion_inicial),
      documentacion_recibida: sOrNull(caseInput.documentacion_recibida),
      objetivo_cliente: sOrNull(caseInput.objetivo_cliente),

      created_at: nowIso,
      updated_at: nowIso,
      validado_at: marcar_validado ? (caseInput.validado_at ?? nowIso) : null,
    };

    const { data: newCase, error } = await supabase
      .from('cases')
      .insert(baseData)
      .select()
      .single();
    if (error) throw error;

    await upsertPrimaryClient(newCase.id, baseData.cliente_principal_id);
    await createInitialStages(newCase);

    await logAuditAction({
      action: 'CREATE',
      entity_type: 'case',
      entity_id: newCase.id,
      diff_json: { created: baseData },
    });

    revalidatePath('/cases');
    revalidatePath('/dashboard');
    return { success: true, case: newCase };
  } catch (error) {
    console.error('Error in createCase:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function createCaseFromBrief(input: CreateCaseFromBriefInput) {
  try {
    const profile = await requireAuth('abogado');
    const validated = createCaseFromBriefSchema.parse(input);

    const extracted = await extractCaseDataFromBrief(validated.brief);
    const overrides = stripUndefined(validated.overrides);

    // base con defaults seguros (string, no undefined) para los requeridos del schema
    const base: Partial<CreateCaseInput> = {
      caratulado: extracted.caratulado ?? 'Caso generado desde brief',
      nombre_cliente: extracted.nombre_cliente ?? 'Cliente por definir',
      materia: extracted.materia ?? 'Civil',
      etapa_actual: extracted.etapa_actual ?? 'Ingreso Demanda',
      estado: extracted.estado ?? 'activo',
      workflow_state: parseWorkflow(extracted.workflow_state ?? WF_DEFAULT),
      prioridad: extracted.prioridad ?? 'media',

      numero_causa: extracted.numero_causa ?? undefined,
      tribunal: extracted.tribunal ?? undefined,
      region: extracted.region ?? undefined,
      comuna: extracted.comuna ?? undefined,
      contraparte: extracted.contraparte ?? undefined,

      // 🔴 El schema exige string → nunca dejamos undefined
      descripcion_inicial: extracted.descripcion_inicial ?? 'Caso creado desde brief.',
      documentacion_recibida: extracted.documentacion_recibida ?? undefined,
      objetivo_cliente: extracted.objetivo_cliente ?? undefined,
      observaciones: extracted.observaciones ?? `Caso creado desde brief:\n\n${validated.brief}`,
      valor_estimado: extracted.valor_estimado ?? undefined,
      honorario_total_uf: extracted.honorario_total_uf ?? undefined,
      honorario_pagado_uf: extracted.honorario_pagado_uf ?? undefined,
      honorario_variable_porcentaje: extracted.honorario_variable_porcentaje ?? undefined,
      honorario_variable_base: extracted.honorario_variable_base ?? undefined,
      honorario_moneda: extracted.honorario_moneda ?? 'UF',
      modalidad_cobro: extracted.modalidad_cobro ?? 'prepago',
      honorario_notas: extracted.honorario_notas ?? undefined,
      tarifa_referencia: extracted.tarifa_referencia ?? undefined,
      rut_cliente: extracted.rut_cliente ?? undefined,
      cliente_principal_id: (extracted as any).cliente_principal_id ?? undefined,
      fecha_inicio: extracted.fecha_inicio ?? undefined,

      abogado_responsable: profile.id,
    };

    const caseData: CreateCaseInput = {
      ...base,
      ...overrides,

      // mantener literal seguro
      workflow_state: parseWorkflow((overrides as any)?.workflow_state ?? base.workflow_state),

      // reforzar TODOS los requeridos del schema (no undefined)
      caratulado: (overrides as any)?.caratulado ?? base.caratulado!,
      nombre_cliente: (overrides as any)?.nombre_cliente ?? base.nombre_cliente!,
      materia: (overrides as any)?.materia ?? base.materia!,
      etapa_actual: (overrides as any)?.etapa_actual ?? base.etapa_actual!,
      estado: (overrides as any)?.estado ?? base.estado!,
      prioridad: (overrides as any)?.prioridad ?? base.prioridad!,
      descripcion_inicial:
        (overrides as any)?.descripcion_inicial ?? base.descripcion_inicial ?? '',
      modalidad_cobro: (overrides as any)?.modalidad_cobro ?? base.modalidad_cobro ?? 'prepago',
      honorario_moneda: (overrides as any)?.honorario_moneda ?? base.honorario_moneda ?? 'UF',
      honorario_total_uf:
        (overrides as any)?.honorario_total_uf ?? (base.honorario_total_uf as number | undefined),
      honorario_pagado_uf:
        (overrides as any)?.honorario_pagado_uf ?? (base.honorario_pagado_uf as number | undefined),
      honorario_variable_porcentaje:
        (overrides as any)?.honorario_variable_porcentaje ??
        (base.honorario_variable_porcentaje as number | undefined),
      honorario_variable_base:
        (overrides as any)?.honorario_variable_base ?? base.honorario_variable_base,
      honorario_notas: (overrides as any)?.honorario_notas ?? base.honorario_notas,
      tarifa_referencia: (overrides as any)?.tarifa_referencia ?? base.tarifa_referencia,
    };

    return await createCase(caseData);
  } catch (error) {
    console.error('Error in createCaseFromBrief:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateCase(caseId: string, input: UpdateCaseInput) {
  try {
    const profile = await requireAuth();
    const validated = updateCaseSchema.parse(input);
    const { marcar_validado, ...rest } = validated;

    const supabase = await getSB();
    const { data: existingCase, error: fetchError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();
    if (fetchError || !existingCase) throw new Error('Caso no encontrado');

    const isAdmin = profile.role === 'admin_firma';
    const isLawyerOwner = profile.role === 'abogado' && existingCase.abogado_responsable === profile.id;
    const isAnalystOwner = profile.role === 'analista' && existingCase.analista_id === profile.id;
    if (!isAdmin && !isLawyerOwner && !isAnalystOwner) throw new Error('Sin permisos para editar este caso');
    if (isAnalystOwner && existingCase.workflow_state === 'cerrado') throw new Error('El caso ya fue cerrado');

    const nowIso = new Date().toISOString();

    const updatePayload: CaseUpdate = {
      updated_at: nowIso,

      ...(rest.caratulado !== undefined && { caratulado: rest.caratulado }),
      ...(rest.nombre_cliente !== undefined && { nombre_cliente: rest.nombre_cliente }),
      ...(rest.materia !== undefined && { materia: rest.materia }),
      ...(rest.etapa_actual !== undefined && { etapa_actual: rest.etapa_actual }),
      ...(rest.fecha_inicio !== undefined && { fecha_inicio: rest.fecha_inicio }),
      ...(rest.numero_causa !== undefined && { numero_causa: rest.numero_causa }),
      ...(rest.tribunal !== undefined && { tribunal: rest.tribunal }),
      ...(rest.region !== undefined && { region: rest.region }),
      ...(rest.comuna !== undefined && { comuna: rest.comuna }),
      ...(rest.contraparte !== undefined && { contraparte: rest.contraparte }),
      ...(rest.descripcion_inicial !== undefined && { descripcion_inicial: rest.descripcion_inicial }),
      ...(rest.documentacion_recibida !== undefined && { documentacion_recibida: rest.documentacion_recibida }),
      ...(rest.objetivo_cliente !== undefined && { objetivo_cliente: rest.objetivo_cliente }),
      ...(rest.observaciones !== undefined && { observaciones: rest.observaciones }),
      ...(rest.valor_estimado !== undefined && { valor_estimado: nOrNull(rest.valor_estimado) }),
      ...(rest.honorario_total_uf !== undefined && { honorario_total_uf: nOrNull(rest.honorario_total_uf) }),
      ...(rest.honorario_pagado_uf !== undefined && {
        honorario_pagado_uf:
          rest.honorario_pagado_uf !== null && rest.honorario_pagado_uf !== undefined
            ? Number(rest.honorario_pagado_uf)
            : 0,
      }),
      ...(rest.honorario_variable_porcentaje !== undefined && {
        honorario_variable_porcentaje: nOrNull(rest.honorario_variable_porcentaje),
      }),
      ...(rest.honorario_variable_base !== undefined && {
        honorario_variable_base: sOrNull(rest.honorario_variable_base),
      }),
      ...(rest.honorario_moneda !== undefined && { honorario_moneda: rest.honorario_moneda }),
      ...(rest.modalidad_cobro !== undefined && { modalidad_cobro: rest.modalidad_cobro }),
      ...(rest.honorario_notas !== undefined && { honorario_notas: sOrNull(rest.honorario_notas) }),
      ...(rest.tarifa_referencia !== undefined && { tarifa_referencia: sOrNull(rest.tarifa_referencia) }),
      ...(rest.rut_cliente !== undefined && { rut_cliente: rest.rut_cliente }),
      ...(rest.cliente_principal_id !== undefined && { cliente_principal_id: sOrNull(rest.cliente_principal_id) }),
      ...(rest.abogado_responsable !== undefined && { abogado_responsable: sOrNull(rest.abogado_responsable) }),
      ...(rest.analista_id !== undefined && { analista_id: sOrNull(rest.analista_id) }),
    };

    if (rest.estado !== undefined) updatePayload.estado = rest.estado;
    if (rest.prioridad !== undefined) updatePayload.prioridad = rest.prioridad;
    if (rest.workflow_state !== undefined) updatePayload.workflow_state = parseWorkflow(rest.workflow_state);

    if (marcar_validado !== undefined) {
      updatePayload.validado_at = marcar_validado ? (rest.validado_at ?? existingCase.validado_at ?? nowIso) : null;
      if (rest.workflow_state === undefined) {
        updatePayload.workflow_state = marcar_validado
          ? (existingCase.workflow_state === 'cerrado' ? 'cerrado' : 'en_revision')
          : 'preparacion';
      }
    }

    if (isAnalystOwner && !existingCase.analista_id) {
      updatePayload.analista_id = profile.id;
    }

    const { data: updatedCase, error } = await supabase
      .from('cases')
      .update(updatePayload)
      .eq('id', caseId)
      .select()
      .single();
    if (error) throw error;

    await upsertPrimaryClient(caseId, rest.cliente_principal_id ?? undefined);

    await logAuditAction({
      action: 'UPDATE',
      entity_type: 'case',
      entity_id: caseId,
      diff_json: { from: existingCase, to: updatedCase },
    });

    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/cases');
    revalidatePath('/dashboard');

    return { success: true, case: updatedCase };
  } catch (error) {
    console.error('Error in updateCase:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function assignLawyer(input: AssignLawyerInput) {
  try {
    await requireAuth('admin_firma');
    const validated = assignLawyerSchema.parse(input);
    const supabase = await getSB();

    const { data: updatedCase, error } = await supabase
      .from('cases')
      .update({ abogado_responsable: validated.abogado_id })
      .eq('id', validated.case_id)
      .select()
      .single();
    if (error) throw error;

    await logAuditAction({
      action: 'ASSIGN_LAWYER',
      entity_type: 'case',
      entity_id: validated.case_id,
      diff_json: { abogado_responsable: validated.abogado_id },
    });

    revalidatePath(`/cases/${validated.case_id}`);
    revalidatePath('/cases');
    revalidatePath('/dashboard');

    return { success: true, case: updatedCase };
  } catch (error) {
    console.error('Error in assignLawyer:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteCase(caseId: string) {
  try {
    await requireAuth('admin_firma');
    const supabase = await getSB();

    const { error } = await supabase.from('cases').delete().eq('id', caseId);
    if (error) throw error;

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
    return { success: false, error: (error as Error).message };
  }
}

export async function getCases(filters: Partial<CaseFiltersInput> = {}) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) throw new Error('No autenticado');

    const f: any = { ...(filters ?? {}) };
    if (f.page == null) f.page = 1;
    if (f.limit == null) f.limit = 10;
    const validatedFilters = caseFiltersSchema.parse(f);

    const supabase = await getSB();

    let query = supabase.from('cases').select(
      `
        *,
        abogado_responsable:profiles!cases_abogado_responsable_fkey(id, nombre),
        case_stages(id, etapa, estado, fecha_programada, orden)
      `,
      { count: 'exact' }
    );

    if (profile.role === 'abogado') {
      query = query.eq('abogado_responsable', profile.id);
    } else if (profile.role === 'analista') {
      query = query.eq('analista_id', profile.id);
    } else if (profile.role === 'cliente') {
      const { data: clientCases } = await supabase
        .from('case_clients')
        .select('case_id')
        .eq('client_profile_id', profile.id);
      const caseIds = clientCases?.map((cc: { case_id: string }) => cc.case_id) ?? [];
      if (caseIds.length === 0) {
        return { success: true, cases: [], total: 0, page: validatedFilters.page, limit: validatedFilters.limit };
      }
      query = query.in('id', caseIds);
    }

    if (validatedFilters.estado) query = query.eq('estado', validatedFilters.estado);
    if (validatedFilters.prioridad) query = query.eq('prioridad', validatedFilters.prioridad);
    if (validatedFilters.abogado_responsable) query = query.eq('abogado_responsable', validatedFilters.abogado_responsable);
    if (validatedFilters.materia) query = query.eq('materia', validatedFilters.materia);
    if (validatedFilters.fecha_inicio_desde) query = query.gte('fecha_inicio', validatedFilters.fecha_inicio_desde);
    if (validatedFilters.fecha_inicio_hasta) query = query.lte('fecha_inicio', validatedFilters.fecha_inicio_hasta);
    if (validatedFilters.search) {
      const s = validatedFilters.search;
      query = query.or(
        `caratulado.ilike.%${s}%,nombre_cliente.ilike.%${s}%,numero_causa.ilike.%${s}%`
      );
    }

    const from = (validatedFilters.page - 1) * validatedFilters.limit;
    const to = from + validatedFilters.limit - 1;

    const { data: cases, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return {
      success: true,
      cases: cases ?? [],
      total: count ?? 0,
      page: validatedFilters.page,
      limit: validatedFilters.limit,
    };
  } catch (error) {
    console.error('Error in getCases:', error);
    return { success: false, error: (error as Error).message, cases: [], total: 0 };
  }
}

export async function getCaseById(caseId: string) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) throw new Error('No autenticado');

    const supabase = await getSB();

    const { data: caseRow, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();
    if (caseError || !caseRow) throw new Error('Caso no encontrado');

    // autorización básica por rol
    if (profile.role === 'cliente') {
      const { data: clientCase } = await supabase
        .from('case_clients')
        .select('id')
        .eq('case_id', caseId)
        .eq('client_profile_id', profile.id)
        .maybeSingle();
      if (!clientCase) throw new Error('Sin permisos para ver este caso');
    }
    if (profile.role === 'abogado' && caseRow.abogado_responsable && caseRow.abogado_responsable !== profile.id) {
      throw new Error('Sin permisos para ver este caso');
    }
    if (profile.role === 'analista' && caseRow.analista_id && caseRow.analista_id !== profile.id) {
      throw new Error('Sin permisos para ver este caso');
    }

    const [lawyerProfile, stagesRes, notesRes, docsRes, reqsRes] = await Promise.all([
      (async () => {
        if (!caseRow.abogado_responsable) return null;
        const { data, error } = await supabase
          .from('profiles')
          .select('id, nombre, telefono, rut')
          .eq('id', caseRow.abogado_responsable)
          .maybeSingle();
        if (error) {
          console.error('Error fetching lawyer profile', caseId, error.message);
          return null;
        }
        return data;
      })(),
      supabase
        .from('case_stages')
        .select('*, responsable:profiles(id, nombre)')
        .eq('case_id', caseId)
        .order('orden', { ascending: true }),
      supabase
        .from('notes')
        .select('*, author:profiles(id, nombre)')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false }),
      supabase
        .from('documents')
        .select('*, uploader:profiles(id, nombre)')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false }),
      supabase
        .from('info_requests')
        .select('*, creador:profiles(id, nombre)')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false }),
    ]);

    const enrichedCase: any = {
      ...caseRow,
      abogado_responsable_id: caseRow.abogado_responsable,
      abogado_responsable: lawyerProfile
        ? {
            id: lawyerProfile.id,
            nombre: lawyerProfile.nombre,
            telefono: lawyerProfile.telefono,
            rut: lawyerProfile.rut,
          }
        : null,
      case_stages: stagesRes?.data ?? [],
      notes: notesRes?.data ?? [],
      documents: docsRes?.data ?? [],
      info_requests: reqsRes?.data ?? [],
    };

    return { success: true, case: enrichedCase };
  } catch (error) {
    console.error('Error in getCaseById:', error);
    return { success: false, error: (error as Error).message };
  }
}

/* -------------------------------------------------------------------------- */
/*                                 Auxiliares                                 */
/* -------------------------------------------------------------------------- */

async function upsertPrimaryClient(caseId: string, clientProfileId?: string | null) {
  if (!clientProfileId) return;
  try {
    const supabase = await getSB();
    await supabase
      .from('case_clients')
      .upsert([{ case_id: caseId, client_profile_id: clientProfileId }], {
        onConflict: 'case_id,client_profile_id',
      });
  } catch (error) {
    console.error('Error vinculando cliente principal al caso:', error);
  }
}

async function createInitialStages(caseRecord: Case) {
  const supabase = await getSB();

  const templates: StageTemplate[] = getStageTemplatesByMateria(caseRecord.materia || 'Civil');
  const baseDate = caseRecord.fecha_inicio ? new Date(caseRecord.fecha_inicio) : new Date();

  const tarifaReferencia = findLegalFeeItemById(caseRecord.tarifa_referencia);
  const totalAsignado =
    typeof caseRecord.honorario_total_uf === 'number'
      ? Number(caseRecord.honorario_total_uf)
      : tarifaReferencia?.montoUf ?? null;

  const shouldDistributeCosts =
    (caseRecord.modalidad_cobro ?? 'prepago') === 'prepago' &&
    caseRecord.honorario_moneda === 'UF' &&
    totalAsignado !== null;
  const honorarioTotal = shouldDistributeCosts ? totalAsignado : null;

  const toFixedUf = (value: number) => Number(value.toFixed(2));

  let cumulativeDays = 0;
  let allocatedUf = 0;

  const stages: CaseStageInsert[] = templates.map((template: StageTemplate, index: number) => {
    cumulativeDays += template.diasEstimados;

    const scheduledDate = new Date(baseDate.getTime());
    scheduledDate.setDate(scheduledDate.getDate() + cumulativeDays);
    const fechaStr = scheduledDate.toISOString().split('T')[0]; // YYYY-MM-DD

    let costoEtapa: number | null = null;
    if (honorarioTotal !== null) {
      const porcentaje = template.porcentajeHonorario ?? 0;
      if (porcentaje > 0) {
        if (index === templates.length - 1) {
          costoEtapa = toFixedUf(honorarioTotal - allocatedUf);
        } else {
          costoEtapa = toFixedUf(honorarioTotal * porcentaje);
          allocatedUf += costoEtapa;
        }
      }
    }

    return {
      case_id: caseRecord.id,
      etapa: template.etapa,
      descripcion: template.descripcion ?? null,
      estado: 'pendiente',
      orden: index + 1,
      es_publica: (template.esPublica ?? true) as boolean | null,
      fecha_programada: fechaStr ?? null, // string|null, nunca undefined
      fecha_cumplida: null,
      responsable_id: null,
      requiere_pago: shouldDistributeCosts,
      costo_uf: costoEtapa,
      porcentaje_variable: template.porcentajeVariable ?? null,
      estado_pago: 'pendiente',
      enlace_pago: null,
      notas_pago: template.notasPago ?? null,
      monto_variable_base:
        template.porcentajeVariable && template.notasPago ? template.notasPago : null,
      monto_pagado_uf: 0,
    };
  });

  if (stages.length === 0) return;
  await supabase.from('case_stages').insert(stages);
}

async function extractCaseDataFromBrief(brief: string): Promise<Partial<CreateCaseInput>> {
  const out: Partial<CreateCaseInput> = {};
  const lines = brief.toLowerCase().split('\n');

  for (const line of lines) {
    if (line.includes('caratulado') || line.includes('caso') || line.includes('demanda')) {
      const m = line.match(/(?:caratulado|caso|demanda)[:\s]+(.+)/);
      const val = m?.[1]?.trim();
      if (val) out.caratulado = val;
    }
    if (line.includes('cliente') || line.includes('demandante')) {
      const m = line.match(/(?:cliente|demandante)[:\s]+(.+)/);
      const val = m?.[1]?.trim();
      if (val) out.nombre_cliente = val;
    }
    if (line.includes('laboral')) out.materia = 'Laboral' as any;
    if (line.includes('civil')) out.materia = 'Civil' as any;
    if (line.includes('comercial')) out.materia = 'Comercial' as any;
    if (line.includes('penal')) out.materia = 'Penal' as any;
    if (line.includes('familia')) out.materia = 'Familia' as any;

    if (line.includes('urgente')) out.prioridad = 'urgente' as any;
    if (line.includes('alta prioridad')) out.prioridad = 'alta' as any;
    if (line.includes('baja prioridad')) out.prioridad = 'baja' as any;
  }

  out.observaciones = out.observaciones ?? `Caso creado desde brief:\n\n${brief}`;
  return out;
}
