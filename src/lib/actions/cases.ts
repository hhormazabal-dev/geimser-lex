// src/lib/actions/cases.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
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
import { ZodError } from 'zod';

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
const CASE_META_REGEX = /<!--case-form-meta:[\s\S]*?-->/g;

function trimTextOrNull(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeObservaciones(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const cleaned = value.replace(CASE_META_REGEX, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

const tsOrNull = (v: string | undefined | null): string | null => {
  if (v === undefined || v === null) return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type ParsedPartyRow = { nombre: string; rut: string | null };

function parseSerializedPartyRows(raw?: string | null): ParsedPartyRow[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)(?:\s*\(RUT[:\s]+(.+?)\))?\s*$/i);
      const nombre = (match?.[1] ?? line).trim();
      const rut = (match?.[2] ?? '').trim();
      return { nombre, rut: rut.length > 0 ? rut : null };
    })
    .filter((row) => row.nombre.length > 0);
}

async function syncDemandadoCounterparties(
  supabase: Awaited<ReturnType<typeof getSB>>,
  caseId: string,
  contraparteRaw?: string | null,
) {
  const { error: deleteError } = await supabase
    .from('case_counterparties')
    .delete()
    .eq('case_id', caseId)
    .eq('tipo', 'demandado');
  if (deleteError) throw deleteError;

  const parties = parseSerializedPartyRows(contraparteRaw);
  if (parties.length === 0) return;

  const { error: insertError } = await supabase.from('case_counterparties').insert(
    parties.map((party) => ({
      case_id: caseId,
      nombre: party.nombre,
      rut: party.rut,
      tipo: 'demandado',
    })),
  );
  if (insertError) throw insertError;
}

function stripUndefined<T extends Record<string, any>>(obj: T | undefined): Partial<T> {
  if (!obj) return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

const formatZodError = (error: ZodError) => {
  const rawMessages = error.issues
    .map((issue) => issue.message?.trim())
    .filter((message): message is string => Boolean(message));
  const uniqueMessages = Array.from(new Set(rawMessages));
  const meaningfulMessages = uniqueMessages.filter((message) => message.toLowerCase() !== 'required');
  const messages = meaningfulMessages.length ? meaningfulMessages : uniqueMessages;
  return messages.length ? messages.join(' ') : 'Datos incompletos o inválidos. Revisa el formulario.';
};

async function getSB() {
  return createServerClient();
}

function canUseServiceClient() {
  return false;
}

async function getPrivilegedSB() {
  return createServerClient();
}

function normalizeDateOnlyInput(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.includes('T') ? (trimmed.split('T')[0] ?? trimmed) : trimmed;
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

function normalizeAudienceType(
  value: CreateCaseInput['audiencia_inicial_tipo'],
): 'preparatoria' | 'juicio' | undefined {
  if (!value) return undefined;
  if (value.startsWith('preparatoria')) return 'preparatoria';
  if (value.startsWith('juicio')) return 'juicio';
  return undefined;
}

/* -------------------------------------------------------------------------- */
/*                                    CRUD                                    */
/* -------------------------------------------------------------------------- */

export async function createCase(input: CreateCaseInput) {
  try {
    // admin_firma debe tener al menos los mismos permisos que abogado/analista
    const profile = await requireAuth(['admin_firma', 'abogado', 'analista']);
    const parsed = createCaseSchema.parse(input);
    const {
      marcar_validado,
      audiencia_inicial_tipo,
      audiencia_inicial_fecha,
      audiencia_inicial_requiere_testigos,
      clientes_principales_extra_ids,
      ...caseInput
    } = parsed;

    if (caseInput.estado === 'terminado' && !caseInput.termino_documento_id) {
      return {
        success: false,
        error: 'Para marcar un expediente como “Terminado” debes adjuntar y asociar un documento de término.',
      };
    }

    // En la práctica, si el creador no es abogado (y por tanto no "se autoasigna"),
    // exigimos abogado responsable para que no existan causas huérfanas.
    if ((profile.role === 'admin_firma' || profile.role === 'analista') && !caseInput.abogado_responsable) {
      throw new Error('Debes asignar un abogado responsable antes de crear el caso.');
    }

    const supabase = await getSB();
    const nowIso = new Date().toISOString();
    const numeroCausaClean = trimTextOrNull(caseInput.numero_causa);
    const tribunalClean = trimTextOrNull(caseInput.tribunal);

    if (numeroCausaClean) {
      let query = supabase.from('cases').select('id');
      query = query.eq('numero_causa', numeroCausaClean);
      query = tribunalClean ? query.eq('tribunal', tribunalClean) : query.is('tribunal', null);

      // Evita falsos positivos cross-org (especialmente para super admins).
      const orgId = (profile as any)?.active_organization_id ?? null;
      if (orgId) query = query.eq('organization_id', orgId);

      const { data: existing, error: numeroError } = await query.limit(1).maybeSingle();

      if (numeroError && numeroError.code !== 'PGRST116') throw numeroError;
      if (existing) {
        return {
          success: false,
          error: 'Ya existe un expediente registrado con ese número de causa para ese tribunal.',
        };
      }
    }

    const baseData: CaseInsert & Record<string, any> = {
      caratulado: caseInput.caratulado,
      nombre_cliente: caseInput.nombre_cliente,

      numero_causa: numeroCausaClean,
      materia: sOrNull(caseInput.materia),
      tribunal: tribunalClean,
      region: sOrNull(caseInput.region),
      comuna: sOrNull(caseInput.comuna),
      rut_cliente: sOrNull(caseInput.rut_cliente),
      contraparte: sOrNull(caseInput.contraparte),
      etapa_actual: sOrNull(caseInput.etapa_actual),
      sentencia_estado: caseInput.sentencia_estado ?? 'no_registra',
      sentencia_fecha:
        caseInput.sentencia_fecha && caseInput.sentencia_fecha.trim().length > 0
          ? caseInput.sentencia_fecha
          : null,
      notificacion_demanda_estado: sOrNull((caseInput as any).notificacion_demanda_estado),
      notificacion_demanda_fecha: normalizeDateOnlyInput((caseInput as any).notificacion_demanda_fecha),
      fecha_desistimiento: normalizeDateOnlyInput((caseInput as any).fecha_desistimiento),

      fecha_inicio: caseInput.fecha_inicio ?? null,
      abogado_responsable:
        caseInput.abogado_responsable ??
        (profile.role === 'abogado' ? profile.id : null),

      estado: (caseInput.estado ?? 'activo') as any,
      termino_documento_id: sOrNull((caseInput as any).termino_documento_id),
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
      observaciones: sanitizeObservaciones(caseInput.observaciones),
      alcance_cliente_autorizado:
        typeof caseInput.alcance_cliente_autorizado === 'number'
          ? caseInput.alcance_cliente_autorizado
          : 0,
      alcance_cliente_solicitado:
        typeof caseInput.alcance_cliente_solicitado === 'number'
          ? caseInput.alcance_cliente_solicitado
          : 0,

      next_action_title: tsOrNull((caseInput as any).next_action_title),
      next_action_at: tsOrNull((caseInput as any).next_action_at),
      next_action_owner_id: sOrNull((caseInput as any).next_action_owner_id),

      cliente_principal_id: sOrNull((caseInput as any).cliente_principal_id),
      descripcion_inicial: sOrNull(caseInput.descripcion_inicial),
      documentacion_recibida: sOrNull(caseInput.documentacion_recibida),

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

    await upsertPrimaryClients(newCase.id, [
      baseData.cliente_principal_id,
      ...((clientes_principales_extra_ids ?? []) as string[]),
    ]);
    await syncDemandadoCounterparties(supabase, newCase.id, baseData.contraparte);
    await createInitialStages(newCase);

    const normalizedAudience = normalizeAudienceType(audiencia_inicial_tipo);
    if (normalizedAudience) {
      await applyInitialAudiencePreferences(newCase, {
        audienciaTipo: normalizedAudience,
        ...(audiencia_inicial_fecha && audiencia_inicial_fecha.trim().length > 0
          ? { fechaProgramada: audiencia_inicial_fecha }
          : {}),
        ...(audiencia_inicial_requiere_testigos !== undefined && {
          requiereTestigos: audiencia_inicial_requiere_testigos ? true : false,
        }),
      });
    }

    await logAuditAction({
      action: 'CREATE',
      entity_type: 'case',
      entity_id: newCase.id,
      diff_json: { created: baseData },
    });

    revalidatePath('/cases');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/abogado');
    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/analista');
    return { success: true, case: newCase };
  } catch (error) {
    console.error('Error in createCase:', error);
    if (error instanceof ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    const message =
      (error as { message?: string })?.message ?? 'Ocurrió un error inesperado al crear el caso.';
    return { success: false, error: message };
  }
}

export async function createCaseFromBrief(input: CreateCaseFromBriefInput) {
  try {
    // Permitir también a admin_firma generar casos desde briefs
    const profile = await requireAuth(['admin_firma', 'abogado']);
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

      // Mantener requeridos del schema con fallback seguros.
      descripcion_inicial: extracted.descripcion_inicial ?? 'Caso creado desde brief.',
      documentacion_recibida: extracted.documentacion_recibida ?? undefined,
      observaciones: sanitizeObservaciones(extracted.observaciones) ?? `Caso creado desde brief:\n\n${validated.brief}`,
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
      alcance_cliente_autorizado:
        (overrides as any)?.alcance_cliente_autorizado ??
        (base.alcance_cliente_autorizado as number | undefined),
      alcance_cliente_solicitado:
        (overrides as any)?.alcance_cliente_solicitado ??
        (base.alcance_cliente_solicitado as number | undefined),
      cliente_principal_id: (overrides as any)?.cliente_principal_id ?? base.cliente_principal_id,
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
    const {
      marcar_validado,
      audiencia_inicial_tipo,
      audiencia_inicial_fecha,
      audiencia_inicial_requiere_testigos,
      clientes_principales_extra_ids,
      ...rest
    } = validated;

    const supabase = await getSB();
    const { data: existingCase, error: fetchError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();
    if (fetchError || !existingCase) throw new Error('Caso no encontrado');

    const isAdmin = profile.role === 'admin_firma';
    let isLawyerOwner = false;
    if (profile.role === 'abogado') {
      isLawyerOwner = existingCase.abogado_responsable === profile.id;
      if (!isLawyerOwner) {
        const { data: collaborator } = await supabase
          .from('case_collaborators')
          .select('id')
          .eq('case_id', caseId)
          .eq('abogado_id', profile.id)
          .maybeSingle();
        isLawyerOwner = Boolean(collaborator);
      }
    }
    const isAnalystOwner = profile.role === 'analista' && existingCase.analista_id === profile.id;
    if (!isAdmin && !isLawyerOwner && !isAnalystOwner) throw new Error('Sin permisos para editar este caso');
    if (isAnalystOwner && existingCase.workflow_state === 'cerrado') throw new Error('El caso ya fue cerrado');

    const nowIso = new Date().toISOString();

    const nextEstado = (rest.estado ?? existingCase.estado ?? 'activo') as string;
    const nextTerminoDocumentoId =
      rest.termino_documento_id !== undefined
        ? rest.termino_documento_id
        : ((existingCase as any).termino_documento_id ?? null);
    const hasLegacyTerminoException = Boolean((existingCase as any).termino_sin_documento);

    if (nextEstado === 'terminado' && !nextTerminoDocumentoId && !hasLegacyTerminoException) {
      throw new Error('Debes adjuntar y asociar un documento de término antes de marcar el caso como “Terminado”.');
    }

    const updatePayload: CaseUpdate & Record<string, any> = {
      updated_at: nowIso,

      ...(rest.caratulado !== undefined && { caratulado: rest.caratulado }),
      ...(rest.nombre_cliente !== undefined && { nombre_cliente: rest.nombre_cliente }),
      ...(rest.materia !== undefined && { materia: rest.materia }),
      ...(rest.etapa_actual !== undefined && { etapa_actual: rest.etapa_actual }),
      ...(rest.fecha_inicio !== undefined && { fecha_inicio: rest.fecha_inicio }),
      ...(rest.numero_causa !== undefined && {
        numero_causa:
          trimTextOrNull(typeof rest.numero_causa === 'string' ? rest.numero_causa : null),
      }),
      ...(rest.tribunal !== undefined && { tribunal: trimTextOrNull(rest.tribunal) }),
      ...(rest.region !== undefined && { region: rest.region }),
      ...(rest.comuna !== undefined && { comuna: rest.comuna }),
      ...(rest.contraparte !== undefined && { contraparte: rest.contraparte }),
      ...(rest.descripcion_inicial !== undefined && { descripcion_inicial: rest.descripcion_inicial }),
      ...(rest.documentacion_recibida !== undefined && { documentacion_recibida: rest.documentacion_recibida }),
      ...(rest.observaciones !== undefined && { observaciones: sanitizeObservaciones(rest.observaciones) }),
      ...(rest.termino_documento_id !== undefined && { termino_documento_id: rest.termino_documento_id }),
      ...(rest.sentencia_estado !== undefined && { sentencia_estado: rest.sentencia_estado }),
      ...(rest.sentencia_fecha !== undefined && {
        sentencia_fecha:
          rest.sentencia_fecha && rest.sentencia_fecha.trim().length > 0
            ? rest.sentencia_fecha
            : null,
      }),
      ...(rest.notificacion_demanda_estado !== undefined && {
        notificacion_demanda_estado: sOrNull(rest.notificacion_demanda_estado),
      }),
      ...(rest.notificacion_demanda_fecha !== undefined && {
        notificacion_demanda_fecha: normalizeDateOnlyInput(rest.notificacion_demanda_fecha as any),
      }),
      ...(rest.fecha_desistimiento !== undefined && {
        fecha_desistimiento: normalizeDateOnlyInput(rest.fecha_desistimiento as any),
      }),
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
      ...(rest.alcance_cliente_solicitado !== undefined && {
        alcance_cliente_solicitado:
          rest.alcance_cliente_solicitado === null
            ? 0
            : Number(rest.alcance_cliente_solicitado),
      }),
      ...(rest.alcance_cliente_autorizado !== undefined && {
        alcance_cliente_autorizado:
          rest.alcance_cliente_autorizado === null
            ? 0
            : Number(rest.alcance_cliente_autorizado),
      }),
      ...(rest.next_action_title !== undefined && {
        next_action_title: tsOrNull(rest.next_action_title),
      }),
      ...(rest.next_action_at !== undefined && {
        next_action_at: tsOrNull(rest.next_action_at),
      }),
      ...(rest.next_action_owner_id !== undefined && {
        next_action_owner_id: sOrNull(rest.next_action_owner_id),
      }),
    };

    if (rest.estado !== undefined) updatePayload.estado = rest.estado as any;
    if (rest.prioridad !== undefined) updatePayload.prioridad = rest.prioridad;
    if (rest.workflow_state !== undefined) updatePayload.workflow_state = parseWorkflow(rest.workflow_state);

    // Evita duplicados dentro del mismo tribunal (mismo número puede existir en distintos tribunales).
    const nextNumero = rest.numero_causa !== undefined ? trimTextOrNull(rest.numero_causa) : trimTextOrNull(existingCase.numero_causa);
    const nextTribunal =
      rest.tribunal !== undefined ? trimTextOrNull(rest.tribunal) : trimTextOrNull((existingCase as any).tribunal);
    const numeroOrTribunalChanged =
      (rest.numero_causa !== undefined && nextNumero !== trimTextOrNull(existingCase.numero_causa)) ||
      (rest.tribunal !== undefined && nextTribunal !== trimTextOrNull((existingCase as any).tribunal));

    if (numeroOrTribunalChanged && nextNumero) {
      let query = supabase
        .from('cases')
        .select('id')
        .eq('numero_causa', nextNumero)
        .neq('id', caseId);

      query = nextTribunal ? query.eq('tribunal', nextTribunal) : query.is('tribunal', null);

      if ((existingCase as any).organization_id) {
        query = query.eq('organization_id', (existingCase as any).organization_id);
      }

      const { data: existingNumero, error: numeroError } = await query.limit(1).maybeSingle();

      if (numeroError && numeroError.code !== 'PGRST116') throw numeroError;
      if (existingNumero) {
        return {
          success: false,
          error: 'Ya existe otro expediente con ese número de causa para ese tribunal.',
        };
      }
    }

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

    if (
      rest.cliente_principal_id !== undefined ||
      clientes_principales_extra_ids !== undefined
    ) {
      const primaryBase = rest.cliente_principal_id ?? existingCase.cliente_principal_id ?? null;
      const extra = (clientes_principales_extra_ids ?? []) as string[];
      await upsertPrimaryClients(caseId, [primaryBase, ...extra]);
    }

    if (rest.contraparte !== undefined) {
      await syncDemandadoCounterparties(supabase, caseId, rest.contraparte);
    } else if (existingCase.contraparte) {
      const { data: existingDemandados, error: counterpartiesError } = await supabase
        .from('case_counterparties')
        .select('id')
        .eq('case_id', caseId)
        .eq('tipo', 'demandado')
        .limit(1)
        .maybeSingle();
      if (counterpartiesError) throw counterpartiesError;
      if (!existingDemandados) {
        await syncDemandadoCounterparties(supabase, caseId, existingCase.contraparte);
      }
    }

    if (rest.fecha_inicio !== undefined || rest.materia !== undefined) {
      // Mantiene cuadratura entre fechas del expediente y fechas programadas del timeline (solo etapas pendientes).
      await syncPendingStageSchedule({
        id: updatedCase.id,
        materia: (updatedCase as any).materia ?? null,
        fecha_inicio: (updatedCase as any).fecha_inicio ?? null,
      } as any);
    }

    await logAuditAction({
      action: 'UPDATE',
      entity_type: 'case',
      entity_id: caseId,
      diff_json: { from: existingCase, to: updatedCase },
    });

    const normalizedAudience = normalizeAudienceType(audiencia_inicial_tipo);
    if (normalizedAudience) {
      await applyInitialAudiencePreferences(updatedCase as Case, {
        audienciaTipo: normalizedAudience,
        ...(audiencia_inicial_fecha && audiencia_inicial_fecha.trim().length > 0
          ? { fechaProgramada: audiencia_inicial_fecha }
          : {}),
        ...(audiencia_inicial_requiere_testigos !== undefined && {
          requiereTestigos: audiencia_inicial_requiere_testigos ? true : false,
        }),
      });
    }

    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/cases');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/abogado');
    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/analista');

    return { success: true, case: updatedCase };
  } catch (error) {
    console.error('Error in updateCase:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function requestCaseAdvance(caseId: string, stageId: string) {
  try {
    const profile = await requireAuth('cliente');
    const supabase = await getSB();

    const { data: caseRow, error: caseError } = await supabase
      .from('cases')
      .select('id, cliente_principal_id, alcance_cliente_autorizado, alcance_cliente_solicitado')
      .eq('id', caseId)
      .maybeSingle();
    if (caseError || !caseRow) throw new Error('Caso no encontrado');

    let hasAccess = caseRow.cliente_principal_id === profile.id;
    if (!hasAccess) {
      const { data: link } = await supabase
        .from('case_clients')
        .select('id')
        .eq('case_id', caseId)
        .eq('client_profile_id', profile.id)
        .maybeSingle();
      hasAccess = Boolean(link);
    }
    if (!hasAccess) throw new Error('Sin permisos para solicitar avances en este caso');

    const { data: stageRow, error: stageError } = await supabase
      .from('case_stages')
      .select('id, case_id, orden, requiere_pago, es_publica, estado, estado_pago')
      .eq('id', stageId)
      .maybeSingle();
    if (stageError || !stageRow) throw new Error('Etapa no encontrada');
    if (stageRow.case_id !== caseId) throw new Error('La etapa seleccionada no pertenece al caso');
    if (stageRow.es_publica === false) throw new Error('No puedes solicitar una etapa privada');
    if (stageRow.estado === 'completado') throw new Error('La etapa ya se encuentra completada');

    const targetOrder = stageRow.orden ?? 0;
    if (targetOrder <= 0) throw new Error('La etapa seleccionada no tiene un orden válido');

    const authorizedOrder = caseRow.alcance_cliente_autorizado ?? 0;
    const requestedOrder = caseRow.alcance_cliente_solicitado ?? 0;

    if (targetOrder <= authorizedOrder) {
      return {
        success: false,
        error: 'Esa etapa ya está autorizada para ejecución.',
      };
    }

    const effectiveRequested = Math.max(targetOrder, requestedOrder ?? 0);
    const nowIso = new Date().toISOString();

    const { error: updateCaseError } = await supabase
      .from('cases')
      .update({
        alcance_cliente_solicitado: effectiveRequested,
        updated_at: nowIso,
      })
      .eq('id', caseId);
    if (updateCaseError) throw updateCaseError;

    const { error: updateStagesError } = await supabase
      .from('case_stages')
      .update({
        estado_pago: 'solicitado',
        solicitado_por: profile.id,
        solicitado_at: nowIso,
      })
      .eq('case_id', caseId)
      .lte('orden', targetOrder)
      .eq('requiere_pago', true)
      .in('estado_pago', ['pendiente', 'vencido']);
    if (updateStagesError) throw updateStagesError;

    await logAuditAction({
      action: 'REQUEST_ADVANCE',
      entity_type: 'case',
      entity_id: caseId,
      diff_json: {
        requested_order: effectiveRequested,
        requested_stage_id: stageId,
        requested_by: profile.id,
      },
    });

    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/dashboard');

    return { success: true, requestedOrder: effectiveRequested };
  } catch (error) {
    console.error('Error in requestCaseAdvance:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function authorizeCaseAdvance(caseId: string, targetOrder: number) {
  try {
    const profile = await requireAuth(['admin_firma', 'analista']);
    const supabase = await getSB();

    if (!Number.isInteger(targetOrder) || targetOrder <= 0) {
      throw new Error('Debes seleccionar una etapa válida para autorizar.');
    }

    const { data: caseRow, error: caseError } = await supabase
      .from('cases')
      .select('id, alcance_cliente_autorizado, alcance_cliente_solicitado')
      .eq('id', caseId)
      .maybeSingle();
    if (caseError || !caseRow) throw new Error('Caso no encontrado');

    const currentAuthorized = caseRow.alcance_cliente_autorizado ?? 0;
    const currentRequested = caseRow.alcance_cliente_solicitado ?? 0;

    if (targetOrder <= currentAuthorized) {
      return {
        success: false,
        error: 'Ya existe un alcance igual o superior autorizado.',
      };
    }

    const cappedOrder = currentRequested > 0 ? Math.min(targetOrder, currentRequested) : targetOrder;

    const { data: stageExists } = await supabase
      .from('case_stages')
      .select('id')
      .eq('case_id', caseId)
      .eq('orden', cappedOrder)
      .maybeSingle();
    if (!stageExists) throw new Error('La etapa seleccionada no existe en el caso');

    const nowIso = new Date().toISOString();

    const { error: updateCaseError } = await supabase
      .from('cases')
      .update({
        alcance_cliente_autorizado: cappedOrder,
        alcance_cliente_solicitado: Math.max(currentRequested ?? 0, cappedOrder),
        updated_at: nowIso,
      })
      .eq('id', caseId);
    if (updateCaseError) throw updateCaseError;

    const { error: stageUpdateError } = await supabase
      .from('case_stages')
      .update({
        estado_pago: 'en_proceso',
      })
      .eq('case_id', caseId)
      .lte('orden', cappedOrder)
      .eq('requiere_pago', true)
      .in('estado_pago', ['solicitado']);
    if (stageUpdateError) throw stageUpdateError;

    await logAuditAction({
      action: 'AUTHORIZE_ADVANCE',
      entity_type: 'case',
      entity_id: caseId,
      diff_json: {
        authorized_order: cappedOrder,
        authorized_by: profile.id,
      },
    });

    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/dashboard');

    return { success: true, authorizedOrder: cappedOrder };
  } catch (error) {
    console.error('Error in authorizeCaseAdvance:', error);
    return { success: false, error: (error as Error).message };
  }
}

type LawyerSummary = {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean | null;
};

export async function listAvailableLawyers() {
  try {
    const profile = await requireAuth(['admin_firma', 'analista']);
    const orgId = (profile as { active_organization_id?: string | null }).active_organization_id ?? null;
    if (!orgId) {
      return {
        success: false as const,
        lawyers: [] as LawyerSummary[],
        error: 'Debes seleccionar una empresa activa primero.',
      };
    }
    const supabase = await getSB();

    const { data: members, error: membersError } = await (supabase as any)
      .from('org_members')
      .select('user_id, role')
      .eq('organization_id', orgId)
      .in('role', ['lawyer', 'org_admin']);
    if (membersError) throw membersError;

    const userIds = Array.from(
      new Set((members ?? []).map((member: { user_id?: string | null }) => member.user_id).filter(Boolean) as string[]),
    );

    if (userIds.length === 0) {
      return { success: true as const, lawyers: [] as LawyerSummary[] };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, nombre, email, telefono, activo')
      .in('user_id', userIds)
      .eq('activo', true)
      .order('nombre', { ascending: true });
    if (error) throw error;

    const lawyers: LawyerSummary[] =
      (data as Array<{ id: string; nombre: string | null; email: string | null; telefono: string | null; activo: boolean | null }> | null)?.map(
        (row) => ({
          id: row.id,
          nombre: row.nombre,
          email: row.email,
          telefono: row.telefono,
          activo: row.activo,
        }),
      ) ?? [];

    return { success: true as const, lawyers };
  } catch (error) {
    console.error('Error in listAvailableLawyers:', error);
    return { success: false as const, lawyers: [] as LawyerSummary[], error: (error as Error).message };
  }
}

export async function assignLawyer(input: AssignLawyerInput) {
  try {
    const profile = await requireAuth(['admin_firma', 'analista']);
    const validated = assignLawyerSchema.parse(input);
    const supabase = await getSB();

    const { data: existingCase, error: fetchError } = await supabase
      .from('cases')
      .select('id, abogado_responsable')
      .eq('id', validated.case_id)
      .single();
    if (fetchError || !existingCase) throw fetchError ?? new Error('Caso no encontrado');

    if (existingCase.abogado_responsable === validated.abogado_id) {
      return {
        success: false as const,
        error: 'El caso ya está asignado a ese abogado.',
      };
    }

    const nowIso = new Date().toISOString();
    const { data: updatedCase, error } = await supabase
      .from('cases')
      .update({ abogado_responsable: validated.abogado_id, updated_at: nowIso })
      .eq('id', validated.case_id)
      .select('id, abogado_responsable')
      .single();
    if (error) throw error;

    const { data: newLawyerProfile } = await supabase
      .from('profiles')
      .select('id, nombre, email, telefono')
      .eq('id', validated.abogado_id)
      .maybeSingle<{ id: string; nombre: string | null; email: string | null; telefono: string | null }>();

    await logAuditAction({
      action: 'ASSIGN_LAWYER',
      entity_type: 'case',
      entity_id: validated.case_id,
      diff_json: {
        previous_lawyer: existingCase.abogado_responsable ?? null,
        new_lawyer: validated.abogado_id,
        changed_by: profile.id,
      },
    });

    revalidatePath(`/cases/${validated.case_id}`);
    revalidatePath('/cases');
    revalidatePath('/dashboard');

    return {
      success: true as const,
      case: updatedCase,
      lawyer: newLawyerProfile ?? null,
    };
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
        cliente_principal:profiles!cases_cliente_principal_id_fkey(id, nombre, rut),
        abogado_responsable:profiles!cases_abogado_responsable_fkey(id, nombre),
        case_stages(id, etapa, estado, fecha_programada, orden),
        counterparties:case_counterparties(nombre, tipo)
      `,
      { count: 'exact' }
    );

    if (profile.role === 'abogado') {
      const { data: collaboratorRows } = await supabase
        .from('case_collaborators')
        .select('case_id')
        .eq('abogado_id', profile.id)
        .limit(10000);

      const collaboratorCaseIds = (collaboratorRows ?? [])
        .map((row: { case_id?: string | null }) => row.case_id)
        .filter((id): id is string => Boolean(id));

      if (collaboratorCaseIds.length > 0) {
        query = query.or(`abogado_responsable.eq.${profile.id},id.in.(${collaboratorCaseIds.join(',')})`);
      } else {
        query = query.eq('abogado_responsable', profile.id);
      }
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
    if (validatedFilters.workflow_state) query = query.eq('workflow_state', validatedFilters.workflow_state);
    if (validatedFilters.abogado_responsable) query = query.eq('abogado_responsable', validatedFilters.abogado_responsable);
    if (validatedFilters.materia) query = query.eq('materia', validatedFilters.materia);
    if (validatedFilters.fecha_inicio_desde) query = query.gte('fecha_inicio', validatedFilters.fecha_inicio_desde);
    if (validatedFilters.fecha_inicio_hasta) query = query.lte('fecha_inicio', validatedFilters.fecha_inicio_hasta);
    if (validatedFilters.search) {
      const s = validatedFilters.search;
      // Búsqueda centrada en identificadores únicos del expediente
      query = query.or(`caratulado.ilike.%${s}%,numero_causa.ilike.%${s}%`);
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

    let isCollaborator = false;

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
      const { data: collaborator } = await supabase
        .from('case_collaborators')
        .select('id')
        .eq('case_id', caseId)
        .eq('abogado_id', profile.id)
        .maybeSingle();
      if (!collaborator) throw new Error('Sin permisos para ver este caso');
      isCollaborator = true;
    }
    const [lawyerProfile, stagesRes, notesRes, docsRes, reqsRes, counterpartiesRes, clientsRes] = await Promise.all([
      (async () => {
        if (!caseRow.abogado_responsable) return null;
        const { data, error } = await supabase
          .from('profiles')
          .select('id, nombre, telefono, rut, email')
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
        .select('*, responsable:profiles!case_stages_responsable_id_fkey(id, nombre)')
        .eq('case_id', caseId)
        .order('orden', { ascending: true }),
      supabase
        .from('notes')
        .select('*, author:profiles!notes_author_id_fkey(id, nombre)')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false }),
      supabase
        .from('documents')
        .select('*, uploader:profiles!documents_uploader_id_fkey(id, nombre)')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false }),
      supabase
        .from('info_requests')
        .select('*, creador:profiles!info_requests_creador_id_fkey(id, nombre)')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false }),
      supabase
        .from('case_counterparties')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false }),
      supabase
        .from('case_clients')
        .select('client_profile_id,is_primary,client:profiles!case_clients_client_profile_id_fkey(id, nombre, email, telefono, rut)')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true }),
    ]);

    const enrichedCase: any = {
      ...caseRow,
      is_collaborator: isCollaborator,
      abogado_responsable_id: caseRow.abogado_responsable,
      abogado_responsable: lawyerProfile
        ? {
            id: lawyerProfile.id,
            nombre: lawyerProfile.nombre,
            telefono: lawyerProfile.telefono,
            rut: lawyerProfile.rut,
            email: (lawyerProfile as any).email ?? null,
          }
        : null,
      case_stages: stagesRes?.data ?? [],
      notes: notesRes?.data ?? [],
      documents: docsRes?.data ?? [],
      info_requests: reqsRes?.data ?? [],
      counterparties: counterpartiesRes?.data ?? [],
      clients:
      clientsRes?.data
          ?.map((item: { is_primary?: boolean | null; client: { id: string; nombre: string; email: string; telefono: string | null; rut?: string | null } | null }) =>
            item.client ? { ...item.client, is_primary: Boolean(item.is_primary) } : null,
          )
          .filter((client): client is { id: string; nombre: string; email: string; telefono: string | null; rut?: string | null; is_primary: boolean } => Boolean(client)) ??
        [],
    };

    // Fallback: si no hay case_clients, intenta al menos mostrar el cliente principal.
    if ((enrichedCase.clients?.length ?? 0) === 0 && (caseRow as any).cliente_principal_id) {
      const { data: primaryClient } = await supabase
        .from('profiles')
        .select('id, nombre, email, telefono, rut')
        .eq('id', (caseRow as any).cliente_principal_id)
        .maybeSingle();
      if (primaryClient?.id) {
        enrichedCase.clients = [{ ...primaryClient, is_primary: true }];
      }
    }

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

async function upsertPrimaryClients(caseId: string, clientProfileIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(clientProfileIds.filter((id): id is string => Boolean(id && id.trim()))));
  if (ids.length === 0) return;

  try {
    const supabase = await getSB();
    // Normalizamos flags: primero desmarcamos todos, luego marcamos solo los seleccionados.
    await supabase.from('case_clients').update({ is_primary: false }).eq('case_id', caseId);
    await supabase
      .from('case_clients')
      .upsert(
        ids.map((id) => ({ case_id: caseId, client_profile_id: id, is_primary: true })),
        { onConflict: 'case_id,client_profile_id' },
      );
  } catch (error) {
    console.error('Error actualizando clientes principales del caso:', error);
  }
}

async function createInitialStages(caseRecord: Case) {
  const supabase = await getPrivilegedSB();

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
  const { error } = await supabase.from('case_stages').insert(stages);
  if (error) {
    console.error('Error creando etapas iniciales:', { case_id: caseRecord.id, message: error.message });
  }
}

async function syncPendingStageSchedule(caseRecord: Pick<Case, 'id' | 'materia' | 'fecha_inicio'>) {
  const baseIso = caseRecord.fecha_inicio ?? null;
  if (!baseIso) return;

  const baseDate = new Date(baseIso);
  if (Number.isNaN(baseDate.getTime())) return;

  const templates: StageTemplate[] = getStageTemplatesByMateria(caseRecord.materia || 'Civil');
  if (templates.length === 0) return;

  const scheduleByOrder = new Map<number, string>();
  let cumulativeDays = 0;
  for (let index = 0; index < templates.length; index += 1) {
    const template = templates[index]!;
    cumulativeDays += template.diasEstimados;
    const scheduledDate = new Date(baseDate.getTime());
    scheduledDate.setDate(scheduledDate.getDate() + cumulativeDays);
    scheduleByOrder.set(index + 1, scheduledDate.toISOString().split('T')[0]!);
  }

  const supabase = await getPrivilegedSB();
  const { data: stages, error } = await supabase
    .from('case_stages')
    .select('id, orden, estado, fecha_cumplida')
    .eq('case_id', caseRecord.id);
  if (error) throw error;

  const nowIso = new Date().toISOString();
  const pending = (stages as any[] | null) ?? [];
  const updates = pending
    .map((stage) => {
      const order = Number(stage.orden ?? 0);
      if (!order || order <= 0) return null;
      const nextDate = scheduleByOrder.get(order);
      if (!nextDate) return null;
      if (stage.estado === 'completado' || stage.fecha_cumplida) return null;
      return { id: stage.id as string, fecha_programada: nextDate, updated_at: nowIso };
    })
    .filter(Boolean) as Array<{ id: string; fecha_programada: string; updated_at: string }>;

  if (updates.length === 0) return;

  await Promise.all(
    updates.map((u) =>
      supabase.from('case_stages').update({ fecha_programada: u.fecha_programada, updated_at: u.updated_at }).eq('id', u.id),
    ),
  );
}

async function applyInitialAudiencePreferences(
  caseRecord: Case,
  options: { audienciaTipo?: 'preparatoria' | 'juicio'; requiereTestigos?: boolean | null; fechaProgramada?: string },
) {
  const { audienciaTipo, requiereTestigos, fechaProgramada } = options;
  if (!audienciaTipo) return;

  try {
    const supabase = await getPrivilegedSB();

    const { data: stages, error: stagesError } = await supabase
      .from('case_stages')
      .select('id, etapa, orden, audiencia_tipo')
      .eq('case_id', caseRecord.id)
      .order('orden', { ascending: true });

    if (stagesError) {
      console.error('Error buscando etapas para audiencia inicial:', stagesError);
      return;
    }

    const normalize = (value: string) =>
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const normalizedFecha = normalizeDateOnlyInput(fechaProgramada);
    const rows = (stages as any[] | null) ?? [];

    const bestStage = (() => {
      if (rows.length === 0) return null;
      const candidates = rows
        .map((row) => {
          const etapa = String(row.etapa ?? '');
          const etapaNorm = normalize(etapa);
          const hasAudienceWord = etapaNorm.includes('audiencia');
          const hasJuicioWord = etapaNorm.includes('juicio') || etapaNorm.includes('alegatos') || etapaNorm.includes('vista');
          const hasPrepWord = etapaNorm.includes('preparator') || etapaNorm.includes('preliminar');
          const typedMatch = row.audiencia_tipo === audienciaTipo;

          const score = (() => {
            if (typedMatch) return 0;
            if (audienciaTipo === 'juicio' && hasJuicioWord) return 0;
            if (audienciaTipo === 'preparatoria' && hasPrepWord) return 0;
            if (hasAudienceWord) return 1;
            return 2;
          })();

          return { row, score, orden: Number(row.orden ?? 0) };
        })
        .sort((a, b) => a.score - b.score || a.orden - b.orden);

      return candidates[0]?.row ?? null;
    })();

    let stageId = (bestStage?.id as string | undefined) ?? null;

    // Si no hay ninguna etapa (casos legacy), creamos una para no perder la fecha ingresada.
    if (!stageId) {
      const etapa =
        audienciaTipo === 'preparatoria' ? 'Audiencia preparatoria' : 'Audiencia de juicio';
      const maxOrden = rows.reduce((max, row) => Math.max(max, Number(row.orden ?? 0)), 0);
      const { data: inserted, error: insertError } = await supabase
        .from('case_stages')
        .insert({
          case_id: caseRecord.id,
          etapa,
          descripcion: 'Etapa creada automáticamente desde el formulario de audiencia inicial.',
          estado: 'pendiente',
          orden: Math.max(maxOrden + 1, 1),
          es_publica: true,
          responsable_id: null,
          fecha_programada: normalizedFecha,
          fecha_cumplida: null,
          audiencia_tipo: audienciaTipo,
          requiere_testigos: Boolean(requiereTestigos),
        } as any)
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creando etapa para audiencia inicial:', {
          case_id: caseRecord.id,
          message: insertError.message,
        });
        return;
      }
      stageId = inserted?.id ?? null;
    }

    if (!stageId) return;

    // 1) Actualizamos fecha siempre por separado (evita fallas por columnas ausentes / payload mixto).
    if (normalizedFecha) {
      const { error: fechaError } = await supabase
        .from('case_stages')
        .update({ fecha_programada: normalizedFecha })
        .eq('id', stageId);
      if (fechaError) {
        console.error('Error actualizando fecha de audiencia inicial:', {
          case_id: caseRecord.id,
          stage_id: stageId,
          message: fechaError.message,
        });
      }
    }

    // 2) Intentamos guardar metadata de audiencia (si la DB aún no tiene columnas, lo logueamos y seguimos).
    const { error: metaError } = await supabase
      .from('case_stages')
      .update({
        audiencia_tipo: audienciaTipo,
        requiere_testigos: Boolean(requiereTestigos),
      })
      .eq('id', stageId);
    if (metaError) {
      console.error('Error actualizando metadata de audiencia inicial:', {
        case_id: caseRecord.id,
        stage_id: stageId,
        message: metaError.message,
      });
    }
  } catch (error) {
    console.error('Error aplicando preferencia de audiencia inicial:', error);
  }
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
