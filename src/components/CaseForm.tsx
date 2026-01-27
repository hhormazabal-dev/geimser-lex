'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Controller, useController, useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createCase, updateCase, deleteCase } from '@/lib/actions/cases';
import { uploadDocument } from '@/lib/actions/documents';
import { createClientProfile } from '@/lib/actions/clients';
import {
  createCaseSchema,
  type CreateCaseInput,
  CASE_STATUSES,
  CASE_PRIORITIES,
  CASE_WORKFLOW_STATES,
  CASE_SENTENCE_STATUSES,
  CASE_MATERIAS,
  REGIONES_CHILE,
} from '@/lib/validators/case';
import { STAGE_AUDIENCE_TYPES, getStageTemplatesByMateria } from '@/lib/validators/stages';
import { createClientSchema, type CreateClientInput } from '@/lib/validators/clients';
import { cn, formatDate, formatRUT } from '@/lib/utils';
import { Loader2, Save, X, Trash2, Paperclip, UploadCloud } from 'lucide-react';
import type { Case, Profile } from '@/lib/supabase/types';

type LightweightProfile = Pick<Profile, 'id' | 'nombre' | 'role' | 'rut' | 'telefono' | 'email'>;

interface CaseFormProps {
  case?: Omit<Case, 'abogado_responsable'> & {
    abogado_responsable?: { id: string } | string | null;
    abogado_responsable_id?: string | null;
  };
  onCancel?: () => void;
  lawyers: LightweightProfile[];
  clients: LightweightProfile[];
  currentProfile: Pick<Profile, 'id' | 'role' | 'nombre'>;
  variant?: 'wizard' | 'default';
}

const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;

type PartyRow = {
  id: string;
  nombre: string;
  rut: string;
};

type CaseFormMeta = {
  notification?: 'realizada' | 'no_realizada';
};

const OBSERVACIONES_META_PREFIX = '<!--case-form-meta:';
const OBSERVACIONES_META_SUFFIX = '-->';
const OBSERVACIONES_META_REGEX = /<!--case-form-meta:[\s\S]*?-->/g;

function createRandomRowId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `party-${crypto.randomUUID()}`;
  }
  return `party-${Math.random().toString(36).slice(2, 9)}`;
}

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

type TribunalOption = { id: string; name: string };

function filterTribunalesByMateria(tribunales: TribunalOption[], materia?: string | null): TribunalOption[] {
  const materiaKey = materia ? normalizeText(materia) : '';
  if (!materiaKey) return tribunales;

  const includesAny = (haystack: string, needles: string[]) => needles.some((needle) => haystack.includes(needle));

  const wantLaboral = includesAny(materiaKey, ['laboral', 'trabaj']);
  const wantFamilia = materiaKey.includes('familia');
  const wantPenal = materiaKey.includes('penal');
  const wantCivil = materiaKey.includes('civil');
  const wantComercial = materiaKey.includes('comercial');

  const filtered = tribunales.filter((tribunal) => {
    const name = normalizeText(tribunal.name);

    if (wantLaboral) {
      return includesAny(name, ['trabajo', 'laboral', 'cobranza laboral', 'previsional']);
    }

    if (wantFamilia) {
      return name.includes('familia');
    }

    if (wantPenal) {
      return includesAny(name, ['garantia', 'juicio oral', 'oral en lo penal', 'top', 'tribunal de juicio oral']);
    }

    if (wantCivil || wantComercial) {
      const includesCivil = includesAny(name, ['civil', 'letras']);
      const excludesOther = !includesAny(name, [
        'garantia',
        'juicio oral',
        'oral en lo penal',
        'familia',
        'trabajo',
        'laboral',
        'previsional',
      ]);
      return includesCivil && excludesOther;
    }

    return tribunales.length > 0;
  });

  return filtered.length > 0 ? filtered : tribunales;
}

function createPartyRow(overrides?: Partial<PartyRow>): PartyRow {
  return {
    id: overrides?.id ?? createRandomRowId(),
    nombre: overrides?.nombre?.trim() ?? '',
    rut: overrides?.rut ? formatRUT(overrides.rut) : '',
  };
}

function parsePartyRows(raw: string | null | undefined, kind: 'demandante' | 'demandado'): PartyRow[] {
  if (!raw) return [];

  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^(.*?)(?:\s*\(RUT[:\s]+(.+?)\))?$/i);
      const nombre = match?.[1]?.trim() ?? line;
      const rut = match?.[2]?.trim() ?? '';
      // Determinístico para SSR/CSR (evita hydration mismatch)
      return createPartyRow({ id: `${kind}-${index}`, nombre, rut });
    });
}

function ensurePartyRows(
  rows: PartyRow[],
  kind: 'demandante' | 'demandado',
  fallbackRut?: string | null,
): PartyRow[] {
  if (rows.length === 0) {
    // Determinístico para SSR/CSR (evita hydration mismatch)
    return [createPartyRow({ id: `${kind}-0`, rut: fallbackRut ?? '' })];
  }

  return rows.map((row, index) => ({
    ...row,
    rut:
      index === 0 && fallbackRut && !row.rut
        ? formatRUT(fallbackRut)
        : row.rut
          ? formatRUT(row.rut)
          : '',
  }));
}

function serializePartyRows(rows: PartyRow[]): string {
  return rows
    .map(row => {
      const nombre = row.nombre.trim();
      if (!nombre) return null;
      const rut = row.rut.trim();
      return rut ? `${nombre} (RUT ${rut})` : nombre;
    })
    .filter(Boolean)
    .join('\n');
}

function parseObservacionesMeta(value?: string | null): { text: string; meta: CaseFormMeta } {
  if (!value) return { text: '', meta: {} };

  const start = value.indexOf(OBSERVACIONES_META_PREFIX);
  if (start === -1) return { text: value, meta: {} };

  const end = value.indexOf(OBSERVACIONES_META_SUFFIX, start);
  if (end === -1) return { text: value, meta: {} };

  const metaContent = value.slice(start + OBSERVACIONES_META_PREFIX.length, end).trim();
  let meta: CaseFormMeta = {};
  if (metaContent) {
    try {
      meta = JSON.parse(metaContent) as CaseFormMeta;
    } catch {
      meta = {};
    }
  }

  const leadingText = value.slice(0, start).trimEnd();
  const trailingText = value.slice(end + OBSERVACIONES_META_SUFFIX.length).trim();
  const text = trailingText ? `${leadingText}${leadingText ? '\n\n' : ''}${trailingText}` : leadingText;

  return { text, meta };
}

function cleanObservacionesText(value?: string | null): string {
  if (!value) return '';
  return value.replace(OBSERVACIONES_META_REGEX, '').trim();
}

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
};

export function CaseForm({
  case: existingCase,
  onCancel,
  lawyers,
  clients,
  currentProfile,
  variant = 'default',
}: CaseFormProps) {
  const { text: initialObservacionesText, meta: initialFormMeta } = parseObservacionesMeta(
    existingCase?.observaciones ?? '',
  );

  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const terminoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [terminoFile, setTerminoFile] = useState<File | null>(null);
  const [clientOptions, setClientOptions] = useState<LightweightProfile[]>(clients);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const { toast } = useToast();

  const isAbogado = currentProfile.role === 'abogado';
  const defaultLawyerId = isAbogado ? currentProfile.id : undefined;

  const toOptionalNumber = (value: unknown) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const FIELD_LABELS: Record<string, string> = {
    cliente_principal_id: 'Cliente principal',
    clientes_principales_extra_ids: 'Co-clientes principales',
    nombre_cliente: 'Demandante(s)',
    rut_cliente: 'RUT demandante principal',
    caratulado: 'Carátula',
    materia: 'Materia',
    descripcion_inicial: 'Antecedentes / descripción inicial',
    documentacion_recibida: 'Documentación recibida',
    region: 'Región',
    comuna: 'Comuna (asiento del tribunal)',
    tribunal: 'Tribunal',
    fecha_inicio: 'Fecha de ingreso',
    notificacion_demanda_estado: 'Notificación de la demanda',
    notificacion_demanda_fecha: 'Fecha de notificación',
    etapa_actual: 'Acto / etapa actual',
    estado: 'Estado del expediente',
    termino_documento_id: 'Documento de término',
    prioridad: 'Prioridad',
    valor_estimado: 'Cuantía (monto en disputa)',
    abogado_responsable: 'Abogado patrocinante',
    analista_id: 'Analista',
    sentencia_estado: 'Estado de sentencia',
    sentencia_fecha: 'Fecha de sentencia',
    audiencia_inicial_fecha: 'Fecha de audiencia',
    fecha_desistimiento: 'Fecha de desistimiento',
    honorario_total_uf: 'Honorario total',
    honorario_pagado_uf: 'Monto pagado',
    honorario_variable_porcentaje: 'Porcentaje variable',
    honorario_variable_base: 'Base variable',
    honorario_moneda: 'Moneda honorarios',
    modalidad_cobro: 'Modalidad de cobro',
    honorario_notas: 'Notas de honorarios',
    tarifa_referencia: 'Tarifa referencial',
    workflow_state: 'Estado interno (workflow)',
  };

  const FIELD_ORDER = [
    'cliente_principal_id',
    'clientes_principales_extra_ids',
    'nombre_cliente',
    'rut_cliente',
    'caratulado',
    'materia',
    'descripcion_inicial',
    'documentacion_recibida',
    'region',
    'comuna',
    'tribunal',
    'fecha_inicio',
    'notificacion_demanda_estado',
    'notificacion_demanda_fecha',
    'etapa_actual',
    'estado',
    'termino_documento_id',
    'fecha_desistimiento',
    'prioridad',
    'sentencia_estado',
    'sentencia_fecha',
    'abogado_responsable',
    'analista_id',
    'honorario_total_uf',
    'honorario_pagado_uf',
    'honorario_variable_porcentaje',
    'honorario_variable_base',
    'modalidad_cobro',
    'honorario_moneda',
    'tarifa_referencia',
    'workflow_state',
  ] as const;

  const collectFormErrors = (
    formErrors: FieldErrors<CreateCaseInput>,
  ): Array<{ name: string; message: string }> => {
    const collected: Array<{ name: string; message: string }> = [];

    const visit = (value: unknown, path: string[]) => {
      if (!value || typeof value !== 'object') return;
      const maybeMessage = (value as { message?: unknown }).message;
      if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) {
        collected.push({ name: path.join('.'), message: maybeMessage.trim() });
      }

      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key === 'message' || key === 'type' || key === 'ref') continue;
        visit(child, [...path, key]);
      }
    };

    for (const [key, value] of Object.entries(formErrors ?? {})) {
      visit(value, [key]);
    }

    const unique = new Map<string, { name: string; message: string }>();
    for (const item of collected) {
      const normalizedKey = `${item.name}:${item.message}`;
      if (!unique.has(normalizedKey)) unique.set(normalizedKey, item);
    }

    const items = Array.from(unique.values());
    const orderIndex = new Map<string, number>(FIELD_ORDER.map((name, index) => [name, index]));
    items.sort((a, b) => {
      const aKey = a.name.split('.')[0] ?? a.name;
      const bKey = b.name.split('.')[0] ?? b.name;
      const aOrder = orderIndex.get(aKey);
      const bOrder = orderIndex.get(bKey);
      if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
      if (aOrder !== undefined) return -1;
      if (bOrder !== undefined) return 1;
      return aKey.localeCompare(bKey, 'es');
    });

    return items;
  };

  const focusFirstError = (formErrors: FieldErrors<CreateCaseInput>) => {
    const firstField = collectFormErrors(formErrors)[0]?.name?.split('.')[0];
    const fallbackField = Object.keys(formErrors ?? {})[0];
    const targetField = firstField || fallbackField;
    if (!targetField) return;

    const candidate =
      document.getElementById(targetField) ??
      (document.querySelector(`[name="${targetField}"]`) as HTMLElement | null);
    if (!candidate) return;

    candidate.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (
      candidate instanceof HTMLInputElement ||
      candidate instanceof HTMLTextAreaElement ||
      candidate instanceof HTMLSelectElement
    ) {
      candidate.focus();
    }
  };

  const onInvalid = (formErrors: FieldErrors<CreateCaseInput>) => {
    focusFirstError(formErrors);
    const issues = collectFormErrors(formErrors);
    const maxToShow = 6;
    const visible = issues.slice(0, maxToShow);
    const remaining = Math.max(issues.length - visible.length, 0);
    const description = visible.length
      ? `${visible
        .map((issue) => {
          const key = issue.name.split('.')[0] ?? issue.name;
          const label = FIELD_LABELS[key] ?? key;
          return `- ${label}: ${issue.message}`;
        })
        .join('\n')}${remaining > 0 ? `\n- …y ${remaining} más` : ''}`
      : 'Hay campos con errores o incompletos. Corrígelos y vuelve a intentar.';
    toast({
      title: 'Revisa el formulario',
      description,
      variant: 'destructive',
    });
  };

  const existingLawyerId = existingCase
    ? (existingCase as any).abogado_responsable_id ||
    (typeof existingCase.abogado_responsable === 'string'
      ? existingCase.abogado_responsable
      : existingCase.abogado_responsable?.id)
    : undefined;

  const toDateInputValue = (val?: string | Date | null) => {
    if (!val) return '';
    const str = val instanceof Date ? val.toISOString() : String(val);
    return str.split('T')[0] ?? '';
  };

  const defaultValues: Partial<CreateCaseInput> = existingCase
    ? {
      numero_causa: existingCase.numero_causa || '',
      caratulado: existingCase.caratulado,
      materia: existingCase.materia || '',
      tribunal: existingCase.tribunal || '',
      region: existingCase.region || '',
      comuna: existingCase.comuna || '',
      rut_cliente: existingCase.rut_cliente || '',
      nombre_cliente: existingCase.nombre_cliente,
      contraparte: existingCase.contraparte || '',
      etapa_actual: existingCase.etapa_actual || 'Ingreso Demanda',
      sentencia_estado: (existingCase as any).sentencia_estado ?? 'no_registra',
      sentencia_fecha: toDateInputValue((existingCase as any).sentencia_fecha),
      estado: (existingCase.estado || 'activo') as CreateCaseInput['estado'],
      fecha_inicio: toDateInputValue(existingCase.fecha_inicio || new Date()),
      notificacion_demanda_estado:
        (existingCase as any).notificacion_demanda_estado ?? initialFormMeta.notification ?? null,
      notificacion_demanda_fecha: toDateInputValue((existingCase as any).notificacion_demanda_fecha),
      fecha_desistimiento: toDateInputValue((existingCase as any).fecha_desistimiento),
      termino_documento_id: (existingCase as any).termino_documento_id ?? null,
      abogado_responsable: existingLawyerId || defaultLawyerId,
      cliente_principal_id: existingCase.cliente_principal_id ?? '',
      clientes_principales_extra_ids:
        ((existingCase as any).clients as Array<{ id: string; is_primary?: boolean }> | undefined)
          ?.filter((client) => Boolean(client?.is_primary) && client.id !== (existingCase.cliente_principal_id ?? ''))
          .map((client) => client.id) ?? [],
      prioridad: (existingCase.prioridad || 'media') as CreateCaseInput['prioridad'],
      valor_estimado: existingCase.valor_estimado || undefined,
      honorario_total_uf: (existingCase as any).honorario_total_uf ?? undefined,
      honorario_pagado_uf: (existingCase as any).honorario_pagado_uf ?? undefined,
      honorario_variable_porcentaje: (existingCase as any).honorario_variable_porcentaje ?? undefined,
      honorario_variable_base: (existingCase as any).honorario_variable_base ?? '',
      honorario_moneda: (existingCase as any).honorario_moneda ?? 'UF',
      modalidad_cobro: (existingCase as any).modalidad_cobro ?? 'prepago',
      honorario_notas: (existingCase as any).honorario_notas ?? '',
      tarifa_referencia: (existingCase as any).tarifa_referencia ?? '',
      observaciones: initialObservacionesText,
      descripcion_inicial: existingCase.descripcion_inicial || '',
      documentacion_recibida: existingCase.documentacion_recibida || '',
      workflow_state: (existingCase.workflow_state || 'preparacion') as CreateCaseInput['workflow_state'],
      validado_at: existingCase.validado_at || undefined,
      marcar_validado: Boolean(existingCase.validado_at),
      audiencia_inicial_tipo: undefined,
      audiencia_inicial_fecha: '',
      audiencia_inicial_requiere_testigos: false,
    }
    : {
      numero_causa: '',
      caratulado: '',
      materia: '',
      tribunal: '',
      region: '',
      comuna: '',
      rut_cliente: '',
      nombre_cliente: '',
      contraparte: '',
      etapa_actual: 'Ingreso Demanda',
      sentencia_estado: 'no_registra',
      sentencia_fecha: '',
      estado: 'activo',
      fecha_inicio: toDateInputValue(new Date()),
      notificacion_demanda_estado: null,
      notificacion_demanda_fecha: '',
      fecha_desistimiento: '',
      termino_documento_id: null,
      abogado_responsable: defaultLawyerId,
      cliente_principal_id: '',
      clientes_principales_extra_ids: [],
      prioridad: 'media',
      valor_estimado: undefined,
      honorario_total_uf: undefined,
      honorario_pagado_uf: 0,
      honorario_variable_porcentaje: undefined,
      honorario_variable_base: '',
      honorario_moneda: 'UF',
      modalidad_cobro: 'prepago',
      honorario_notas: '',
      tarifa_referencia: '',
      observaciones: '',
      descripcion_inicial: '',
      documentacion_recibida: '',
      workflow_state: 'preparacion',
      marcar_validado: false,
      audiencia_inicial_tipo: undefined,
      audiencia_inicial_fecha: '',
      audiencia_inicial_requiere_testigos: false,
    };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateCaseInput>({
    resolver: zodResolver(createCaseSchema),
    defaultValues,
  });

  const initialDemandantes = ensurePartyRows(
    parsePartyRows(defaultValues.nombre_cliente ?? '', 'demandante'),
    'demandante',
    defaultValues.rut_cliente,
  );
  const initialDemandados = ensurePartyRows(
    parsePartyRows(defaultValues.contraparte ?? '', 'demandado'),
    'demandado',
  );

  const [demandantes, setDemandantes] = useState<PartyRow[]>(initialDemandantes);
  const [demandados, setDemandados] = useState<PartyRow[]>(initialDemandados);

  const { field: nombreClienteField } = useController({ name: 'nombre_cliente', control });
  const { field: rutClienteField } = useController({ name: 'rut_cliente', control });
  const { field: contraparteField } = useController({ name: 'contraparte', control });

  const {
    register: registerNewClient,
    handleSubmit: handleSubmitNewClient,
    reset: resetNewClientForm,
    formState: { errors: newClientErrors },
    setValue: setNewClientValue,
    watch: watchNewClient,
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      nombre: '',
      email: '',
      rut: '',
      telefono: '',
    },
  });

  useEffect(() => {
    const serializedDemandantes = serializePartyRows(demandantes);
    if (serializedDemandantes !== (nombreClienteField.value as string | undefined)) {
      nombreClienteField.onChange(serializedDemandantes);
    }
  }, [demandantes, nombreClienteField]);

  useEffect(() => {
    const primaryRut = demandantes[0]?.rut ?? '';
    if ((rutClienteField.value as string | undefined) !== primaryRut) {
      rutClienteField.onChange(primaryRut);
    }
  }, [demandantes, rutClienteField]);

  useEffect(() => {
    const serializedDemandados = serializePartyRows(demandados);
    if (serializedDemandados !== (contraparteField.value as string | undefined)) {
      contraparteField.onChange(serializedDemandados);
    }
  }, [demandados, contraparteField]);

  const clientePrincipalId = watch('cliente_principal_id');
  const clientesPrincipalesExtraIds = watch('clientes_principales_extra_ids');
  const caratuladoValue = watch('caratulado');
  const materiaValue = watch('materia');
  const descripcionInicialValue = watch('descripcion_inicial');
  const regionValue = watch('region');
  const comunaValue = watch('comuna');
  const tribunalValue = watch('tribunal');
  const fechaInicioValue = watch('fecha_inicio');
  const notificacionEstado = watch('notificacion_demanda_estado');
  const marcarValidado = watch('marcar_validado');
  const workflowState = watch('workflow_state');
  const audienciaInicialTipo = watch('audiencia_inicial_tipo');
  const audienciaInicialFecha = watch('audiencia_inicial_fecha');
  const audienciaInicialRequiereTestigos = watch('audiencia_inicial_requiere_testigos');
  const sentenciaEstado = watch('sentencia_estado');
  const estadoExpediente = watch('estado');
  const terminoDocumentoId = watch('termino_documento_id');
  const newClientRut = watchNewClient('rut');
  const { ref: newClientRutRef, ...newClientRutField } = registerNewClient('rut');

  const step1Done = Boolean(demandantes[0]?.nombre.trim());
  const step2Done = Boolean(caratuladoValue?.trim()) && Boolean(materiaValue?.trim());
  const step3Done = (descripcionInicialValue ?? '').trim().length >= 20;
  const currentStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 4;
  const showSentenciaFecha = sentenciaEstado === 'programada' || sentenciaEstado === 'dictada';
  const showDesistimientoFecha = estadoExpediente === 'terminado_desistido_demandante';
  const showTerminoDocumento = estadoExpediente === 'terminado';
  const isWizard = variant === 'wizard' && !existingCase;
  const canSubmit = Boolean(existingCase) || (step1Done && step2Done && step3Done);

  const terminoDocumento = useMemo(() => {
    if (!existingCase) return null;
    const docs = (existingCase as any).documents as Array<{ id: string; nombre?: string; url?: string }> | undefined;
    const id =
      (typeof terminoDocumentoId === 'string' && terminoDocumentoId.length > 0
        ? terminoDocumentoId
        : ((existingCase as any).termino_documento_id as string | null | undefined)) ?? null;
    if (!docs || !id) return null;
    return docs.find((doc) => doc.id === id) ?? null;
  }, [existingCase, terminoDocumentoId]);

  const timelinePreview = (() => {
    const materia = (materiaValue ?? '').trim();
    if (!materia) return null;
    const templates = getStageTemplatesByMateria(materia);
    const baseDate = (() => {
      const raw = fechaInicioValue?.trim();
      if (!raw) return new Date();
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? new Date() : d;
    })();

    let cumulativeDays = 0;
    const items = templates.slice(0, 8).map((t) => {
      cumulativeDays += t.diasEstimados;
      const scheduled = new Date(baseDate.getTime());
      scheduled.setDate(scheduled.getDate() + cumulativeDays);
      const iso = scheduled.toISOString().split('T')[0]!;
      return { ...t, fecha: iso };
    });

    return {
      total: templates.length,
      items,
    };
  })();

  const scrollToStep = (step: 1 | 2 | 3 | 4) => {
    const el = document.getElementById(`case-form-step-${step}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const [comunaOptions, setComunaOptions] = useState<Array<{ code: string; name: string }>>([]);
  const [tribunalOptionsRaw, setTribunalOptionsRaw] = useState<TribunalOption[]>([]);
  const [selectedComunaCode, setSelectedComunaCode] = useState('');
  const [selectedTribunalId, setSelectedTribunalId] = useState('');
  const [isLoadingComunas, setIsLoadingComunas] = useState(false);
  const [isLoadingTribunales, setIsLoadingTribunales] = useState(false);
  const [pjudError, setPjudError] = useState<string | null>(null);

  const updateDemandanteNombre = (id: string, value: string) => {
    setDemandantes(prev =>
      prev.map(row => (row.id === id ? { ...row, nombre: value } : row)),
    );
  };

  const updateDemandanteRut = (id: string, value: string) => {
    const formatted = formatRUT(value);
    setDemandantes(prev =>
      prev.map(row => (row.id === id ? { ...row, rut: formatted } : row)),
    );
  };

  const addDemandante = () => {
    setDemandantes(prev => [...prev, createPartyRow()]);
  };

  const removeDemandante = (id: string) => {
    setDemandantes(prev => (prev.length > 1 ? prev.filter(row => row.id !== id) : prev));
  };

  const updateDemandadoNombre = (id: string, value: string) => {
    setDemandados(prev =>
      prev.map(row => (row.id === id ? { ...row, nombre: value } : row)),
    );
  };

  const updateDemandadoRut = (id: string, value: string) => {
    const formatted = formatRUT(value);
    setDemandados(prev =>
      prev.map(row => (row.id === id ? { ...row, rut: formatted } : row)),
    );
  };

  const addDemandado = () => {
    setDemandados(prev => [...prev, createPartyRow()]);
  };

  const removeDemandado = (id: string) => {
    setDemandados(prev => (prev.length > 1 ? prev.filter(row => row.id !== id) : prev));
  };

  const formatUf = (value?: number) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '—';
    return `${new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)} UF`;
  };

  useEffect(() => {
    if (!existingCase) {
      setValue('workflow_state', marcarValidado ? 'en_revision' : 'preparacion');
    }
  }, [marcarValidado, existingCase, setValue]);

  useEffect(() => {
    setClientOptions(clients);
    if (clients.length === 0) {
      setIsAddingClient(true);
    }
  }, [clients]);

  useEffect(() => {
    if (!clientePrincipalId) return;
    const selectedClient = clientOptions.find((client) => client.id === clientePrincipalId);
    if (!selectedClient) return;

    setDemandantes((prev) => {
      const firstRow = prev[0] ?? createPartyRow();
      const nextFirstRow: PartyRow = {
        ...firstRow,
        nombre: firstRow.nombre.trim().length > 0 ? firstRow.nombre : selectedClient.nombre,
        rut:
          firstRow.rut.trim().length > 0
            ? firstRow.rut
            : selectedClient.rut
              ? formatRUT(selectedClient.rut)
              : firstRow.rut,
      };

      const didChange =
        nextFirstRow.nombre !== firstRow.nombre || nextFirstRow.rut !== firstRow.rut;
      if (!didChange) return prev;

      return [nextFirstRow, ...prev.slice(1)];
    });
  }, [clientePrincipalId, clientOptions]);

  useEffect(() => {
    if (!clientePrincipalId) return;
    const current = Array.isArray(clientesPrincipalesExtraIds) ? clientesPrincipalesExtraIds : [];
    if (!current.includes(clientePrincipalId)) return;
    setValue(
      'clientes_principales_extra_ids',
      current.filter((id) => id !== clientePrincipalId),
      { shouldDirty: true, shouldValidate: true },
    );
  }, [clientePrincipalId, clientesPrincipalesExtraIds, setValue]);

  useEffect(() => {
    if (existingCase) return;
    if ((caratuladoValue ?? '').trim().length > 0) return;
    const demandante = demandantes[0]?.nombre.trim() ?? '';
    const demandado = demandados[0]?.nombre.trim() ?? '';
    if (!demandante || !demandado) return;
    setValue('caratulado', `${demandante} c/ ${demandado}`, { shouldDirty: true });
  }, [existingCase, caratuladoValue, demandantes, demandados, setValue]);

  useEffect(() => {
    if (!regionValue) {
      setComunaOptions([]);
      setSelectedComunaCode('');
      setTribunalOptionsRaw([]);
      setSelectedTribunalId('');
      setPjudError(null);
      return;
    }

    let canceled = false;
    setIsLoadingComunas(true);
    setPjudError(null);

    fetch(`/api/pjud/cities?region=${encodeURIComponent(regionValue)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error ?? 'No se pudieron cargar comunas.');
        }
        return json.comunas as Array<{ code: string; name: string }>;
      })
      .then((comunas) => {
        if (canceled) return;
        setComunaOptions(comunas ?? []);
      })
      .catch((err) => {
        if (canceled) return;
        setComunaOptions([]);
        setPjudError(err instanceof Error ? err.message : 'No se pudieron cargar comunas.');
      })
      .finally(() => {
        if (canceled) return;
        setIsLoadingComunas(false);
      });

    return () => {
      canceled = true;
    };
  }, [regionValue]);

  useEffect(() => {
    if (!regionValue) return;
    if (!comunaValue) return;
    if (selectedComunaCode) return;
    if (comunaOptions.length === 0) return;

    const target = normalizeText(comunaValue);
    const match = comunaOptions.find((option) => normalizeText(option.name) === target);
    if (match) {
      setSelectedComunaCode(match.code);
    }
  }, [comunaOptions, comunaValue, regionValue, selectedComunaCode]);

  useEffect(() => {
    if (!selectedComunaCode) {
      setTribunalOptionsRaw([]);
      setSelectedTribunalId('');
      return;
    }

    let canceled = false;
    setIsLoadingTribunales(true);
    setPjudError(null);

    fetch(`/api/pjud/courts?comunaCode=${encodeURIComponent(selectedComunaCode)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error ?? 'No se pudieron cargar tribunales.');
        }
        return json.tribunales as Array<{ id: string; name: string }>;
      })
      .then((tribunales) => {
        if (canceled) return;
        setTribunalOptionsRaw(tribunales ?? []);
      })
      .catch((err) => {
        if (canceled) return;
        setTribunalOptionsRaw([]);
        setPjudError(err instanceof Error ? err.message : 'No se pudieron cargar tribunales.');
      })
      .finally(() => {
        if (canceled) return;
        setIsLoadingTribunales(false);
      });

    return () => {
      canceled = true;
    };
  }, [selectedComunaCode]);

  const tribunalOptions = useMemo(() => {
    const filtered = filterTribunalesByMateria(tribunalOptionsRaw, materiaValue);
    if (!selectedTribunalId) return filtered;

    const selected = tribunalOptionsRaw.find((option) => option.id === selectedTribunalId);
    if (!selected) return filtered;

    if (filtered.some((option) => option.id === selectedTribunalId)) return filtered;
    return [selected, ...filtered];
  }, [materiaValue, selectedTribunalId, tribunalOptionsRaw]);

  useEffect(() => {
    if (!tribunalValue) return;
    if (selectedTribunalId) return;
    if (tribunalOptionsRaw.length === 0) return;

    const target = normalizeText(tribunalValue);
    const match = tribunalOptionsRaw.find((option) => normalizeText(option.name) === target);
    if (match) {
      setSelectedTribunalId(match.id);
    }
  }, [selectedTribunalId, tribunalOptionsRaw, tribunalValue]);

  const resetFileSelection = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetTerminoFileSelection = () => {
    setTerminoFile(null);
    if (terminoFileInputRef.current) {
      terminoFileInputRef.current.value = '';
    }
  };

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const oversized = files.filter(file => file.size > MAX_ATTACHMENT_SIZE_BYTES);
    if (oversized.length > 0) {
      toast({
        title: 'Archivo demasiado grande',
        description: `Los siguientes archivos superan el límite de 20 MB: ${oversized
          .map(file => file.name)
          .join(', ')}`,
        variant: 'destructive',
      });
    }

    const validFiles = files.filter(file => file.size <= MAX_ATTACHMENT_SIZE_BYTES);
    if (validFiles.length > 0) {
      setSelectedFiles((prev) => {
        const existingKeys = new Set(prev.map(file => `${file.name}-${file.size}-${file.lastModified}`));
        const deduped = validFiles.filter(file => {
          const key = `${file.name}-${file.size}-${file.lastModified}`;
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        });
        if (deduped.length === 0) {
          return prev;
        }
        return [...prev, ...deduped];
      });
    }

    event.target.value = '';
  };

  const handleTerminoFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      toast({
        title: 'Archivo demasiado grande',
        description: 'El documento de término no puede superar 20 MB.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    setTerminoFile(file);
    event.target.value = '';
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, fileIndex) => fileIndex !== index));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = async (data: CreateCaseInput) => {
    setIsLoading(true);

    try {
      const shouldValidate = Boolean(data.marcar_validado);
      const nowIso = new Date().toISOString();

      const serializedDemandantes = serializePartyRows(demandantes);
      const serializedDemandados = serializePartyRows(demandados);
      const primaryRut = demandantes[0]?.rut ?? '';

      const observacionesFinales = cleanObservacionesText(data.observaciones);

      const payload: CreateCaseInput = {
        ...data,
        nombre_cliente: serializedDemandantes,
        contraparte: serializedDemandados,
        rut_cliente: primaryRut,
        observaciones: observacionesFinales,
        validado_at: shouldValidate
          ? data.validado_at ?? existingCase?.validado_at ?? nowIso
          : null,
        workflow_state: existingCase
          ? data.workflow_state
          : shouldValidate
            ? 'en_revision'
            : 'preparacion',
      };

      const terminoFileFromAttachments =
        !terminoFile && payload.estado === 'terminado' && selectedFiles.length > 0 ? selectedFiles[0] : null;
      const effectiveTerminoFile = terminoFile ?? terminoFileFromAttachments;
      const attachmentsToUpload = terminoFileFromAttachments ? selectedFiles.slice(1) : selectedFiles;
      const shouldCreateThenAttachTermino =
        !existingCase && payload.estado === 'terminado' && Boolean(effectiveTerminoFile);

      // Regla de negocio: si el caso se marca como "Terminado", debe existir un documento de término asociado.
      // Para edición, subimos el archivo y guardamos su ID en `termino_documento_id` antes de llamar al server action.
      if (payload.estado === 'terminado') {
        const legacyNoDoc = Boolean((existingCase as any)?.termino_sin_documento);
        if (!legacyNoDoc) {
          if (!existingCase) {
            if (!effectiveTerminoFile) {
              toast({
                title: 'Documento requerido',
                description: 'Debes adjuntar un documento de término para guardar el estado “Terminado”.',
                variant: 'destructive',
              });
              setIsLoading(false);
              return;
            }
          } else if (!payload.termino_documento_id && !effectiveTerminoFile && !terminoDocumentoId) {
            toast({
              title: 'Documento requerido',
              description: 'Debes adjuntar un documento de término para guardar el estado “Terminado”.',
              variant: 'destructive',
            });
            setIsLoading(false);
            return;
          }

          let terminoId = (payload.termino_documento_id as string | null | undefined) ?? null;
          if (!terminoId && typeof terminoDocumentoId === 'string' && terminoDocumentoId.length > 0) {
            terminoId = terminoDocumentoId;
          }

          if (effectiveTerminoFile && existingCase) {
            const formData = new FormData();
            formData.append('case_id', existingCase.id);
            formData.append('file', effectiveTerminoFile);
            formData.append('nombre', effectiveTerminoFile.name);
            formData.append('visibilidad', 'privado');

            const uploadResult = await uploadDocument(formData);
            if (!uploadResult.success || !uploadResult.document?.id) {
              toast({
                title: 'No se pudo cargar el documento de término',
                description: uploadResult.error ?? 'Error desconocido al cargar el documento.',
                variant: 'destructive',
              });
              setIsLoading(false);
              return;
            }

            terminoId = uploadResult.document.id as string;
            setValue('termino_documento_id', terminoId as any, { shouldDirty: true, shouldValidate: false });
          }

          if (!terminoId && existingCase) {
            toast({
              title: 'Documento requerido',
              description: 'Debes adjuntar un documento de término para guardar el estado “Terminado”.',
              variant: 'destructive',
            });
            setIsLoading(false);
            return;
          }

          if (terminoId) {
            payload.termino_documento_id = terminoId as any;
          }
        }
      }

      let result;

      if (existingCase) {
        result = await updateCase(existingCase.id, payload);
      } else {
        result = await createCase(
          shouldCreateThenAttachTermino
            ? ({
              ...payload,
              estado: 'activo',
              termino_documento_id: null,
            } as any)
            : payload,
        );
      }

      if (result.success) {
        toast({
          title: existingCase ? 'Caso actualizado' : 'Caso creado',
          description: existingCase
            ? 'El caso ha sido actualizado exitosamente'
            : 'El nuevo caso ha sido creado exitosamente',
        });

        const createdCaseId = (result as { case?: { id: string } }).case?.id;

        if (!existingCase && shouldCreateThenAttachTermino && createdCaseId && effectiveTerminoFile) {
          const formData = new FormData();
          formData.append('case_id', createdCaseId);
          formData.append('file', effectiveTerminoFile);
          formData.append('nombre', effectiveTerminoFile.name);
          formData.append('visibilidad', 'privado');

          const uploadResult = await uploadDocument(formData);
          if (!uploadResult.success || !uploadResult.document?.id) {
            toast({
              title: 'Caso creado, pero falta el documento de término',
              description: uploadResult.error ?? 'No se pudo cargar el documento de término.',
              variant: 'destructive',
            });
          } else {
            const finalizeResult = await updateCase(createdCaseId, {
              estado: 'terminado',
              termino_documento_id: uploadResult.document.id,
            } as any);

            if (!finalizeResult.success) {
              toast({
                title: 'Caso creado, pero no se pudo marcar como Terminado',
                description: finalizeResult.error ?? 'Intenta nuevamente en unos minutos.',
                variant: 'destructive',
              });
            }
          }

          resetTerminoFileSelection();
        }

        if (!existingCase && attachmentsToUpload.length > 0) {
          if (createdCaseId) {
            let successfulUploads = 0;
            const failedUploads: Array<{ fileName: string; message?: string }> = [];

            for (const file of attachmentsToUpload) {
              const formData = new FormData();
              formData.append('case_id', createdCaseId);
              formData.append('file', file);
              formData.append('nombre', file.name);
              formData.append('visibilidad', 'privado');

              const uploadResult = await uploadDocument(formData);
              if (uploadResult.success) {
                successfulUploads += 1;
              } else {
                failedUploads.push({
                  fileName: file.name,
                  ...(uploadResult.error ? { message: uploadResult.error } : {}),
                });
              }
            }

            if (failedUploads.length > 0) {
              toast({
                title: 'Algunos documentos no se cargaron',
                description: failedUploads
                  .map(failure => `${failure.fileName}: ${failure.message ?? 'Error desconocido'}`)
                  .join(', '),
                variant: 'destructive',
              });
            } else if (successfulUploads > 0) {
              toast({
                title: 'Documentos cargados',
                description: `Se cargaron ${successfulUploads} documento${successfulUploads > 1 ? 's' : ''} correctamente.`,
              });
            }
          } else {
            toast({
              title: 'Documentos no cargados',
              description: 'No se pudo obtener el ID del caso recién creado para adjuntar los documentos.',
              variant: 'destructive',
            });
          }

          resetFileSelection();
        }

        if (existingCase) {
          resetTerminoFileSelection();
          window.location.assign(`/cases/${existingCase.id}`);
          return;
        }

        if (!createdCaseId) {
          console.error('[CaseForm] createCase() returned success but no case.id', result);
          toast({
            title: 'Caso creado, pero sin identificador',
            description:
              'No pudimos obtener el ID del caso recién creado para redirigir. Ve al listado de casos y verifica si aparece.',
            variant: 'destructive',
          });
          return;
        }

        window.location.assign(`/cases/${createdCaseId}`);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Ocurrió un error inesperado',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: 'Error',
        description: 'Ocurrió un error inesperado',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewClientRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedRut = formatRUT(e.target.value);
    setNewClientValue('rut', formattedRut, { shouldDirty: true, shouldValidate: true });
  };

  const onCreateClient = handleSubmitNewClient(async (clientData) => {
    setIsCreatingClient(true);
    try {
      const result = await createClientProfile(clientData);
      if (result.success) {
        const newClient = {
          id: result.client.id,
          nombre: result.client.nombre,
          role: 'cliente' as const,
          rut: result.client.rut,
          telefono: result.client.telefono,
          email: result.client.email,
        };

        setClientOptions((prev) => {
          const exists = prev.some((client) => client.id === newClient.id);
          if (exists) {
            return prev.map((client) => (client.id === newClient.id ? newClient : client));
          }
          return [...prev, newClient].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        });

        setValue('cliente_principal_id', newClient.id);
        setDemandantes((prev) => {
          if (prev.length === 0) {
            return [createPartyRow({ nombre: newClient.nombre, rut: newClient.rut ?? '' })];
          }

          return prev.map((row, index) =>
            index === 0
              ? {
                ...row,
                nombre: newClient.nombre,
                rut: newClient.rut ? formatRUT(newClient.rut) : row.rut,
              }
              : row,
          );
        });

        toast({
          title: 'Cliente creado',
          description: `${newClient.nombre} fue añadido al directorio y seleccionado en el caso.`,
        });

        resetNewClientForm();
        setIsAddingClient(false);
      } else {
        toast({
          title: 'No se pudo crear el cliente',
          description: result.error || 'Revisa los datos e inténtalo nuevamente.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating client from CaseForm:', error);
      toast({
        title: 'Error inesperado',
        description: 'Ocurrió un error al crear el cliente.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingClient(false);
    }
  });

  const cancelNewClientCreation = () => {
    resetNewClientForm();
    setIsAddingClient(false);
  };

  const handleCreateClientClick = () => {
    void onCreateClient();
  };

  const handleNewClientKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void onCreateClient();
    }
  };

  useEffect(() => {
    if (!audienciaInicialTipo) {
      setValue('audiencia_inicial_requiere_testigos', false);
    }
  }, [audienciaInicialTipo, setValue]);

  useEffect(() => {
    if ((!audienciaInicialTipo || audienciaInicialTipo.endsWith('_sin_fecha')) && audienciaInicialFecha) {
      setValue('audiencia_inicial_fecha', '', { shouldDirty: true, shouldValidate: true });
    }
  }, [audienciaInicialFecha, audienciaInicialTipo, setValue]);

  useEffect(() => {
    const current = watch('fecha_desistimiento');
    if (!showDesistimientoFecha && current) {
      setValue('fecha_desistimiento', '', { shouldDirty: true, shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDesistimientoFecha, setValue]);

  return (
    <div
      className={cn(
        'w-full',
        isWizard && 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start',
      )}
    >
      <Card className={cn('w-full', !isWizard && 'max-w-4xl mx-auto')}>
        <CardHeader>
          <div className='space-y-4'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <CardTitle>{existingCase ? 'Editar Caso' : 'Nuevo Caso'}</CardTitle>
              {isWizard && (
                <div className="flex items-center gap-2">
                  <Badge variant={step1Done ? 'info' : 'outline'}>Partes</Badge>
                  <Badge variant={step2Done ? 'info' : 'outline'}>Carátula</Badge>
                  <Badge variant={step3Done ? 'info' : 'outline'}>Antecedentes</Badge>
                </div>
              )}
            </div>
            <div className='flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]'>
              {([
                { step: 1, label: 'Paso 1 · Partes', enabled: true },
                { step: 2, label: 'Paso 2 · Carátula', enabled: step1Done },
                { step: 3, label: 'Paso 3 · Antecedentes', enabled: step1Done && step2Done },
                { step: 4, label: 'Paso 4 · Revisión', enabled: step1Done && step2Done && step3Done },
              ] as const).map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => s.enabled && scrollToStep(s.step)}
                  disabled={!s.enabled}
                  className={cn(
                    'rounded-full px-3 py-1 transition',
                    s.step < currentStep ? 'bg-slate-900 text-white shadow-sm' : '',
                    s.step === currentStep ? 'bg-slate-100 text-slate-700' : '',
                    s.step > currentStep ? 'bg-slate-100 text-slate-400' : '',
                    !s.enabled && 'cursor-not-allowed opacity-70',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className='text-sm text-slate-500'>
              Completa el expediente en el orden natural: partes → carátula/competencia → antecedentes → revisión interna + timeline por etapas.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className='space-y-8'>
            <section id='case-form-step-1' className='space-y-4 scroll-mt-24'>
              <div>
                <h2 className='text-lg font-semibold text-gray-900'>Partes</h2>
                <p className='text-sm text-gray-500'>Identifica al cliente, a quién representas y la contraparte.</p>
              </div>

              <div className='space-y-6'>
                <div className='space-y-2'>
                  <Label>Parte representada (cliente) *</Label>
                  <p className='text-xs text-gray-500'>Ingresa la parte representada por fila. La primera queda registrada como titular del expediente.</p>
                  <div className='space-y-2'>
                    {demandantes.map((demandante, index) => (
                      <div
                        key={demandante.id}
                        className='flex flex-col gap-2 md:flex-row md:items-center'
                      >
                        <Input
                          id={index === 0 ? 'nombre_cliente' : undefined}
                          value={demandante.nombre}
                          onChange={(event) => updateDemandanteNombre(demandante.id, event.target.value)}
                          placeholder={index === 0 ? 'Demandante principal' : 'Demandante adicional'}
                          disabled={isLoading}
                          className='md:flex-1'
                          aria-label={
                            index === 0
                              ? 'Nombre del demandante principal'
                              : `Nombre de demandante ${index + 1}`
                          }
                        />
                        <Input
                          id={index === 0 ? 'rut_cliente' : `demandante-rut-${demandante.id}`}
                          value={demandante.rut}
                          onChange={(event) => updateDemandanteRut(demandante.id, event.target.value)}
                          placeholder='RUT (opcional)'
                          disabled={isLoading}
                          className='md:w-48'
                          aria-label='RUT demandante'
                        />
                        {index > 0 && (
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            onClick={() => removeDemandante(demandante.id)}
                            disabled={isLoading}
                            aria-label='Quitar demandante'
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className='flex flex-wrap items-center gap-3'>
                    <Button type='button' variant='outline' size='sm' onClick={addDemandante} disabled={isLoading}>
                      Agregar demandante
                    </Button>
                    <span className='text-xs text-gray-500'>Puedes dejar nombres adicionales en blanco si no los necesitas.</span>
                  </div>
                  {errors.nombre_cliente && (
                    <p className='text-sm text-red-600'>{errors.nombre_cliente.message}</p>
                  )}
                  {errors.rut_cliente && (
                    <p className='text-sm text-red-600'>{errors.rut_cliente.message}</p>
                  )}
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='abogado_responsable'>Abogado patrocinante</Label>
                    <Controller
                      control={control}
                      name='abogado_responsable'
                      render={({ field }) => (
                        <select
                          id='abogado_responsable'
                          className='form-input'
                          value={field.value || ''}
                          onChange={(event) => field.onChange(event.target.value || undefined)}
                          disabled={isLoading || lawyers.length === 0}
                        >
                          <option value=''>Selecciona un abogado</option>
                          {lawyers.map(lawyer => (
                            <option key={lawyer.id} value={lawyer.id}>
                              {lawyer.nombre}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                    {lawyers.length === 0 && (
                      <p className='text-xs text-gray-500'>
                        No hay abogados disponibles. Un administrador debe registrarlos.
                      </p>
                    )}
                    <p className='text-xs text-gray-500'>
                      Queda registrado en `cases.abogado_responsable` (FK a perfiles) como abogado patrocinante del expediente.
                    </p>
                    {errors.abogado_responsable && (
                      <p className='text-sm text-red-600'>{errors.abogado_responsable.message}</p>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <div className='flex items-center justify-between gap-2'>
                      <Label htmlFor='cliente_principal_id'>Cliente principal (opcional)</Label>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => setIsAddingClient((prev) => !prev)}
                        disabled={isLoading}
                      >
                        {isAddingClient ? 'Cerrar' : 'Crear cliente'}
                      </Button>
                    </div>
                    <Controller
                      control={control}
                      name='cliente_principal_id'
                      render={({ field }) => (
                        <select
                          id='cliente_principal_id'
                          className='form-input'
                          value={field.value || ''}
                          onChange={(event) => field.onChange(event.target.value || undefined)}
                          disabled={isLoading || clientOptions.length === 0}
                        >
                          <option value=''>Selecciona un cliente</option>
                          {clientOptions.map(client => (
                            <option key={client.id} value={client.id}>
                              {client.nombre}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                    {clientOptions.length === 0 && (
                      <p className='text-xs text-gray-500'>
                        No hay clientes registrados. Puedes crear el caso igual y vincular el cliente después.
                      </p>
                    )}
                    {errors.cliente_principal_id && (
                      <p className='text-sm text-red-600'>{errors.cliente_principal_id.message}</p>
                    )}
                    <Controller
                      control={control}
                      name='clientes_principales_extra_ids'
                      render={({ field }) => {
                        const selected = new Set<string>((field.value as string[] | undefined) ?? []);
                        const options = clientOptions.filter((client) => client.id !== clientePrincipalId);
                        if (options.length === 0) return <></>;

                        return (
                          <div className='mt-4 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-4'>
                            <p className='text-xs font-semibold uppercase tracking-[0.28em] text-gray-600'>
                              Co-clientes principales (opcional)
                            </p>
                            <p className='text-xs text-gray-500'>
                              Marca más de un cliente principal si el expediente tiene varios representados. Tendrán acceso al portal del caso.
                            </p>
                            <div className='mt-3 grid gap-2'>
                              {options.map((client) => {
                                const checked = selected.has(client.id);
                                return (
                                  <label
                                    key={client.id}
                                    className='flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700'
                                  >
                                    <input
                                      type='checkbox'
                                      className='h-4 w-4'
                                      checked={checked}
                                      onChange={(event) => {
                                        const next = new Set(selected);
                                        if (event.target.checked) next.add(client.id);
                                        else next.delete(client.id);
                                        field.onChange(Array.from(next));
                                      }}
                                      disabled={isLoading}
                                    />
                                    <span className='min-w-0 truncate'>{client.nombre}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }}
                    />
                    {isAddingClient && (
                      <div
                        role='group'
                        aria-label='Formulario para crear cliente'
                        onKeyDown={handleNewClientKeyDown}
                        className='mt-4 space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4'
                      >
                        <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                          <div className='space-y-2'>
                            <Label htmlFor='new_client_nombre'>Nombre del cliente</Label>
                            <Input
                              id='new_client_nombre'
                              placeholder='Juana Pérez'
                              {...registerNewClient('nombre')}
                              disabled={isCreatingClient}
                            />
                            {newClientErrors.nombre && (
                              <p className='text-xs text-red-600'>{newClientErrors.nombre.message}</p>
                            )}
                          </div>
                          <div className='space-y-2'>
                            <Label htmlFor='new_client_email'>Correo</Label>
                            <Input
                              id='new_client_email'
                              type='email'
                              placeholder='cliente@correo.com'
                              {...registerNewClient('email')}
                              disabled={isCreatingClient}
                            />
                            {newClientErrors.email && (
                              <p className='text-xs text-red-600'>{newClientErrors.email.message}</p>
                            )}
                          </div>
                          <div className='space-y-2'>
                            <Label htmlFor='new_client_rut'>RUT</Label>
                            <Input
                              id='new_client_rut'
                              placeholder='12.345.678-9'
                              name={newClientRutField.name}
                              ref={newClientRutRef}
                              onBlur={newClientRutField.onBlur}
                              value={newClientRut || ''}
                              onChange={handleNewClientRutChange}
                              disabled={isCreatingClient}
                            />
                            {newClientErrors.rut && (
                              <p className='text-xs text-red-600'>{newClientErrors.rut.message}</p>
                            )}
                          </div>
                          <div className='space-y-2'>
                            <Label htmlFor='new_client_telefono'>Teléfono</Label>
                            <Input
                              id='new_client_telefono'
                              placeholder='+56 9 1234 5678'
                              {...registerNewClient('telefono')}
                              disabled={isCreatingClient}
                            />
                            {newClientErrors.telefono && (
                              <p className='text-xs text-red-600'>{newClientErrors.telefono.message}</p>
                            )}
                          </div>
                        </div>
                        <div className='flex justify-end gap-2'>
                          <Button
                            type='button'
                            variant='ghost'
                            onClick={cancelNewClientCreation}
                            disabled={isCreatingClient}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type='button'
                            onClick={handleCreateClientClick}
                            disabled={isCreatingClient}
                          >
                            {isCreatingClient ? (
                              <>
                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                Guardando...
                              </>
                            ) : (
                              'Guardar cliente'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className='space-y-2 md:col-span-2'>
                    <Label>Demandado(s) / Acusado(s)</Label>
                    <p className='text-xs text-gray-500'>Registra cada demandado/acusado y su RUT si ya se encuentra disponible.</p>
                    <div className='space-y-2'>
                      {demandados.map((demandado, index) => (
                        <div
                          key={demandado.id}
                          className='flex flex-col gap-2 md:flex-row md:items-center'
                        >
                          <Input
                            id={index === 0 ? 'contraparte' : undefined}
                            value={demandado.nombre}
                            onChange={(event) => updateDemandadoNombre(demandado.id, event.target.value)}
                            placeholder={index === 0 ? 'Persona o entidad demandada' : 'Otra parte demandada'}
                            disabled={isLoading}
                            className='md:flex-1'
                            aria-label={
                              index === 0
                                ? 'Nombre del demandado principal'
                                : `Nombre de demandado ${index + 1}`
                            }
                          />
                          <Input
                            id={`demandado-rut-${demandado.id}`}
                            value={demandado.rut}
                            onChange={(event) => updateDemandadoRut(demandado.id, event.target.value)}
                            placeholder='RUT (opcional)'
                            disabled={isLoading}
                            className='md:w-48'
                            aria-label='RUT demandado'
                          />
                          {index > 0 && (
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              onClick={() => removeDemandado(demandado.id)}
                              disabled={isLoading}
                              aria-label='Quitar demandado'
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={addDemandado}
                      disabled={isLoading}
                    >
                      Agregar demandado
                    </Button>
                    {errors.contraparte && (
                      <p className='text-sm text-red-600'>{errors.contraparte.message}</p>
                    )}
                    {isWizard && (
                      <div className='flex justify-end pt-2'>
                        <Button type='button' variant='outline' onClick={() => scrollToStep(2)} disabled={!step1Done}>
                          Continuar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className='space-y-4'>
              <div>
                <h2 className='text-lg font-semibold text-gray-900'>Carátula y competencia</h2>
                <p className='text-sm text-gray-500'>Completa la identificación jurídica del expediente.</p>
              </div>

              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='caratulado'>Caratulado *</Label>
                  <Input
                    id='caratulado'
                    placeholder='Pérez c/ Empresa ABC'
                    {...register('caratulado')}
                    disabled={isLoading}
                  />
                  {errors.caratulado && (
                    <p className='text-sm text-red-600'>{errors.caratulado.message}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='numero_causa'>RIT/ROL (N° de causa)</Label>
                  <Input
                    id='numero_causa'
                    placeholder='C-1234-2024 (si ya existe)'
                    {...register('numero_causa')}
                    disabled={isLoading}
                  />
                  {errors.numero_causa && (
                    <p className='text-sm text-red-600'>{errors.numero_causa.message}</p>
                  )}
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='materia'>Competencia *</Label>
                <select
                  id='materia'
                  className='form-input'
                  {...register('materia')}
                  disabled={isLoading}
                >
                  <option value=''>Seleccionar competencia</option>
                  {CASE_MATERIAS.map(materia => (
                    <option key={materia} value={materia}>
                      {materia}
                    </option>
                  ))}
                </select>
                {errors.materia && (
                  <p className='text-sm text-red-600'>{errors.materia.message}</p>
                )}
              </div>
              {isWizard && (
                <div className='flex justify-end'>
                  <Button type='button' variant='outline' onClick={() => scrollToStep(3)} disabled={!step2Done}>
                    Continuar
                  </Button>
                </div>
              )}
            </section>

            <section className='space-y-4'>
              <div>
                <h2 className='text-lg font-semibold text-gray-900'>Antecedentes y pretensiones</h2>
                <p className='text-sm text-gray-500'>Resume hechos, lo que se busca obtener y el contexto relevante.</p>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='descripcion_inicial'>Hechos y pretensiones *</Label>
                <Textarea
                  id='descripcion_inicial'
                  rows={12}
                  placeholder='Describe el caso: hechos relevantes, pretensión, urgencias y próximos actos.'
                  {...register('descripcion_inicial')}
                  disabled={isLoading}
                />
                {errors.descripcion_inicial && (
                  <p className='text-sm text-red-600'>{errors.descripcion_inicial.message}</p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='documentacion_recibida'>Documentación recibida</Label>
                <Textarea
                  id='documentacion_recibida'
                  rows={4}
                  placeholder='Lista breve: contrato, finiquito, correos, escrituras, sentencias previas, etc.'
                  {...register('documentacion_recibida')}
                  disabled={isLoading}
                />
                {errors.documentacion_recibida && (
                  <p className='text-sm text-red-600'>{errors.documentacion_recibida.message}</p>
                )}
              </div>
              {isWizard && (
                <div className='flex justify-end'>
                  <Button type='button' variant='outline' onClick={() => scrollToStep(4)} disabled={!step3Done}>
                    Continuar
                  </Button>
                </div>
              )}
            </section>

            {!existingCase && (
              <section className='space-y-4'>
                <div>
                  <h2 className='text-lg font-semibold text-gray-900'>Documentos de respaldo</h2>
                  <p className='text-sm text-gray-500'>
                    Adjunta antecedentes relevantes para el equipo. Tamaño máximo de 20 MB por archivo.
                  </p>
                </div>

                <div className='space-y-3'>
                  <div className='space-y-2'>
                    <Label htmlFor='case_documents'>Archivos</Label>
                    <div className='space-y-3 rounded-md border border-dashed border-muted-foreground/40 p-4'>
                      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='flex items-center gap-2 text-sm text-gray-600'>
                          <UploadCloud className='h-4 w-4 text-gray-500' />
                          <span>Selecciona uno o más archivos de hasta 20 MB cada uno.</span>
                        </div>
                        {selectedFiles.length > 0 && (
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={resetFileSelection}
                            disabled={isLoading}
                          >
                            <X className='mr-2 h-4 w-4' />
                            Limpiar selección
                          </Button>
                        )}
                      </div>
                      <Input
                        id='case_documents'
                        type='file'
                        multiple
                        onChange={handleFilesSelected}
                        disabled={isLoading}
                        ref={fileInputRef}
                      />
                      <p className='text-xs text-gray-500'>
                        Se aceptan archivos PDF, Word, imágenes y texto. Máximo 20 MB por archivo.
                      </p>
                    </div>
                  </div>

                  {selectedFiles.length > 0 && (
                    <ul className='space-y-2'>
                      {selectedFiles.map((file, index) => (
                        <li
                          key={`${file.name}-${file.lastModified}-${index}`}
                          className='flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm'
                        >
                          <div className='flex items-center gap-2'>
                            <Paperclip className='h-4 w-4 text-gray-500' />
                            <div>
                              <p className='font-medium text-gray-900'>{file.name}</p>
                              <p className='text-xs text-gray-500'>{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            onClick={() => removeSelectedFile(index)}
                            disabled={isLoading}
                            aria-label={`Quitar ${file.name}`}
                          >
                            <Trash2 className='h-4 w-4 text-gray-500' />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}

            <section id='case-form-step-2' className='space-y-4 scroll-mt-24'>
              <div>
                <h2 className='text-lg font-semibold text-gray-900'>Estado procesal</h2>
                <p className='text-sm text-gray-500'>
                  Completa los datos procesales en orden deductivo: región → comuna (asiento) → tribunal → etapa/hitos.
                </p>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='region'>Región</Label>
                  <select
                    id='region'
                    className='form-input'
                    {...register('region')}
                    disabled={isLoading}
                    onChange={(event) => {
                      const value = event.target.value;
                      setValue('region', value, { shouldDirty: true, shouldValidate: true });
                      setValue('comuna', '', { shouldDirty: true, shouldValidate: true });
                      setValue('tribunal', '', { shouldDirty: true, shouldValidate: true });
                      setSelectedComunaCode('');
                      setSelectedTribunalId('');
                    }}
                  >
                    <option value=''>Seleccionar región</option>
                    {REGIONES_CHILE.map(region => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                  {errors.region && (
                    <p className='text-sm text-red-600'>{errors.region.message}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='comuna'>Comuna (asiento del tribunal)</Label>
                  {pjudError && regionValue ? (
                    <Input
                      id='comuna'
                      placeholder='Ingresa comuna'
                      {...register('comuna')}
                      disabled={isLoading}
                    />
                  ) : (
                    <select
                      id='comuna'
                      className='form-input'
                      value={selectedComunaCode}
                      onChange={(event) => {
                        const code = event.target.value;
                        setSelectedComunaCode(code);
                        setSelectedTribunalId('');
                        setTribunalOptionsRaw([]);
                        const selected = comunaOptions.find((option) => option.code === code);
                        setValue('comuna', selected?.name ?? '', { shouldDirty: true, shouldValidate: true });
                        setValue('tribunal', '', { shouldDirty: true, shouldValidate: true });
                      }}
                      disabled={isLoading || !regionValue || isLoadingComunas || comunaOptions.length === 0}
                    >
                      <option value=''>
                        {regionValue
                          ? isLoadingComunas
                            ? 'Cargando comunas...'
                            : 'Seleccionar comuna'
                          : 'Selecciona región primero'}
                      </option>
                      {comunaOptions.map((comuna) => (
                        <option key={comuna.code} value={comuna.code}>
                          {comuna.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {!regionValue && (
                    <p className='text-xs text-gray-500'>Selecciona una región para listar sus comunas.</p>
                  )}
                  {errors.comuna && (
                    <p className='text-sm text-red-600'>{errors.comuna.message}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='tribunal'>Tribunal</Label>
                  {pjudError ? (
                    <Input
                      id='tribunal'
                      placeholder='Ingresa el tribunal (ej: 1° Juzgado Civil de Santiago)'
                      {...register('tribunal')}
                      disabled={isLoading}
                    />
                  ) : (
                    <select
                      id='tribunal'
                      className='form-input'
                      value={selectedTribunalId}
                      onChange={(event) => {
                        const id = event.target.value;
                        setSelectedTribunalId(id);
                        const selected = tribunalOptions.find((option) => option.id === id);
                        setValue('tribunal', selected?.name ?? '', { shouldDirty: true, shouldValidate: true });
                      }}
                      disabled={isLoading || isLoadingTribunales || !selectedComunaCode}
                    >
                      <option value=''>
                        {!selectedComunaCode
                          ? 'Selecciona comuna primero'
                          : isLoadingTribunales
                            ? 'Cargando tribunales...'
                            : 'Seleccionar tribunal'}
                      </option>
                      {tribunalOptions.map((tribunal) => (
                        <option key={tribunal.id} value={tribunal.id}>
                          {tribunal.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {pjudError && (
                    <p className='text-xs text-amber-700'>
                      No se pudo cargar el directorio PJUD. Puedes ingresar el tribunal manualmente.
                    </p>
                  )}
                  {errors.tribunal && (
                    <p className='text-sm text-red-600'>{errors.tribunal.message}</p>
                  )}
                </div>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='fecha_inicio'>Fecha de Ingreso</Label>
                  <Input
                    id='fecha_inicio'
                    type='date'
                    {...register('fecha_inicio')}
                    disabled={isLoading}
                  />
                  {errors.fecha_inicio && (
                    <p className='text-sm text-red-600'>{errors.fecha_inicio.message}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='valor_estimado'>Cuantía (monto en disputa, CLP)</Label>
                  <Input
                    id='valor_estimado'
                    type='number'
                    placeholder='5000000'
                    {...register('valor_estimado', { setValueAs: toOptionalNumber })}
                    disabled={isLoading}
                  />
                  <p className='text-xs text-gray-500'>Monto reclamado o en discusión (no corresponde a honorarios).</p>
                  {errors.valor_estimado && (
                    <p className='text-sm text-red-600'>{errors.valor_estimado.message}</p>
                  )}
                </div>
              </div>

              {showSentenciaFecha ? (
                <div className='rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600'>
                  Ya existe una sentencia {sentenciaEstado === 'dictada' ? 'dictada' : 'programada'}: no se solicitan datos
                  de notificación ni audiencia inicial.
                </div>
              ) : (
                <>
                  <div className='space-y-2'>
                    <Label>Notificación de la demanda</Label>
                    <div className='flex flex-wrap gap-2'>
                      {([
                        { value: 'realizada', label: 'Realizada' },
                        { value: 'no_realizada', label: 'Pendiente' },
                      ] as const).map(option => (
                        <Button
                          key={option.value}
                          type='button'
                          variant={notificacionEstado === option.value ? 'default' : 'outline'}
                          onClick={() => {
                            setValue('notificacion_demanda_estado', option.value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                            if (option.value !== 'realizada') {
                              setValue('notificacion_demanda_fecha', '', { shouldDirty: true, shouldValidate: true });
                            }
                          }}
                          disabled={isLoading}
                          aria-pressed={notificacionEstado === option.value}
                        >
                          {option.label}
                        </Button>
                      ))}
                      <Button
                        type='button'
                        variant={notificacionEstado === null ? 'default' : 'ghost'}
                        onClick={() => {
                          setValue('notificacion_demanda_estado', null, { shouldDirty: true, shouldValidate: true });
                          setValue('notificacion_demanda_fecha', '', { shouldDirty: true, shouldValidate: true });
                        }}
                        disabled={isLoading}
                        aria-pressed={notificacionEstado === null}
                      >
                        Sin registrar
                      </Button>
                    </div>
                    {notificacionEstado === 'realizada' && (
                      <div className='mt-3 grid gap-2 md:max-w-xs'>
                        <Label htmlFor='notificacion_demanda_fecha'>Fecha de notificación</Label>
                        <Input
                          id='notificacion_demanda_fecha'
                          type='date'
                          {...register('notificacion_demanda_fecha')}
                          disabled={isLoading}
                        />
                        {errors.notificacion_demanda_fecha && (
                          <p className='text-sm text-red-600'>{errors.notificacion_demanda_fecha.message}</p>
                        )}
                      </div>
                    )}
                    <p className='text-xs text-gray-500'>
                      Se añadirá automáticamente a las observaciones al guardar.
                    </p>
                  </div>

                  <div className='space-y-2'>
                    <h3 className='text-sm font-semibold text-gray-900'>Primer hito: audiencia</h3>
                    <p className='text-xs text-gray-500'>
                      Define el tipo de audiencia que esperas como primer hito y si requerirá coordinación de testigos.
                    </p>
                  </div>

                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-3'>
                      <Label>Tipo de audiencia inicial</Label>
                      <div className='grid gap-2'>
                        <label
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${audienciaInicialTipo
                            ? 'border-slate-200 bg-white text-slate-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                            }`}
                        >
                          <input
                            type='radio'
                            value=''
                            className='text-slate-600'
                            {...register('audiencia_inicial_tipo')}
                          />
                          Sin audiencia definida por ahora
                        </label>
                        {STAGE_AUDIENCE_TYPES.map((option) => (
                          <label
                            key={option.value}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${audienciaInicialTipo === option.value
                              ? 'border-sky-300 bg-sky-50 text-sky-700'
                              : 'border-slate-200 bg-white text-slate-700'
                              }`}
                          >
                            <input
                              type='radio'
                              value={option.value}
                              className='text-slate-600'
                              {...register('audiencia_inicial_tipo')}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      <div className='mt-4 space-y-2'>
                        <Label htmlFor='audiencia_inicial_fecha'>Fecha de audiencia</Label>
                        <Input
                          id='audiencia_inicial_fecha'
                          type='date'
                          {...register('audiencia_inicial_fecha')}
                          disabled={
                            isLoading ||
                            !audienciaInicialTipo ||
                            audienciaInicialTipo.endsWith('_sin_fecha')
                          }
                        />
                        {(!audienciaInicialTipo || audienciaInicialTipo.endsWith('_sin_fecha')) && (
                          <p className='text-xs text-gray-500'>
                            Se habilita cuando seleccionas una audiencia con fecha.
                          </p>
                        )}
                        {errors.audiencia_inicial_fecha && (
                          <p className='text-sm text-red-600'>{errors.audiencia_inicial_fecha.message}</p>
                        )}
                      </div>
                    </div>

                    <div className='space-y-3'>
                      <Label>Participación de testigos</Label>
                      <Controller
                        control={control}
                        name='audiencia_inicial_requiere_testigos'
                        render={({ field }) => (
                          <label
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${audienciaInicialTipo
                              ? 'border-slate-200 bg-white text-slate-700'
                              : 'border-dashed border-slate-200 bg-slate-50 text-slate-500'
                              }`}
                          >
                            <input
                              type='checkbox'
                              className='rounded border-slate-300'
                              checked={Boolean(field.value)}
                              onChange={(event) => field.onChange(event.target.checked)}
                              onBlur={field.onBlur}
                              ref={field.ref}
                              name={field.name}
                              disabled={!audienciaInicialTipo}
                            />
                            Se coordinarán testigos para esta audiencia
                          </label>
                        )}
                      />
                      <p className='text-xs text-gray-500'>
                        Esta marca solo aplica si defines una audiencia inicial y se reflejará en la primera etapa del timeline.
                      </p>
                    </div>
                  </div>
                </>
              )}

              <div className='space-y-2'>
                <h3 className='text-sm font-semibold text-gray-900'>Sentencia</h3>
                <p className='text-xs text-gray-500'>
                  Registra si el caso cuenta con sentencia programada o dictada (y su fecha).
                </p>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='sentencia_estado'>Estado de sentencia</Label>
                  <select
                    id='sentencia_estado'
                    className='form-input'
                    {...register('sentencia_estado')}
                    disabled={isLoading}
                  >
                    {CASE_SENTENCE_STATUSES.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.sentencia_estado && (
                    <p className='text-sm text-red-600'>{errors.sentencia_estado.message}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='sentencia_fecha'>Fecha de sentencia</Label>
                  <Input
                    id='sentencia_fecha'
                    type='date'
                    {...register('sentencia_fecha')}
                    disabled={isLoading || !showSentenciaFecha}
                  />
                  {!showSentenciaFecha && (
                    <p className='text-xs text-gray-500'>
                      Se habilita cuando el estado es “programada” o “dictada”.
                    </p>
                  )}
                  {errors.sentencia_fecha && (
                    <p className='text-sm text-red-600'>{errors.sentencia_fecha.message}</p>
                  )}
                </div>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='etapa_actual'>Acto / etapa actual</Label>
                  <Input
                    id='etapa_actual'
                    placeholder='Ingreso demanda, Notificación, Audiencia, Sentencia, Recurso, etc.'
                    {...register('etapa_actual')}
                    disabled={isLoading}
                  />
                  {errors.etapa_actual && (
                    <p className='text-sm text-red-600'>{errors.etapa_actual.message}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='estado'>Estado del expediente</Label>
                  <select
                    id='estado'
                    className='form-input'
                    {...register('estado')}
                    disabled={isLoading}
                  >
                    {CASE_STATUSES.map(status => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                  <input type="hidden" {...register('termino_documento_id')} />
                  {errors.estado && (
                    <p className='text-sm text-red-600'>{errors.estado.message}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='prioridad'>Prioridad</Label>
                  <select
                    id='prioridad'
                    className='form-input'
                    {...register('prioridad')}
                    disabled={isLoading}
                  >
                    {CASE_PRIORITIES.map(priority => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                  {errors.prioridad && (
                    <p className='text-sm text-red-600'>{errors.prioridad.message}</p>
                  )}
                </div>
              </div>

              {showDesistimientoFecha && (
                <div className='mt-4 grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='fecha_desistimiento'>Fecha de desistimiento</Label>
                    <Input
                      id='fecha_desistimiento'
                      type='date'
                      {...register('fecha_desistimiento')}
                      disabled={isLoading}
                    />
                    {errors.fecha_desistimiento && (
                      <p className='text-sm text-red-600'>{errors.fecha_desistimiento.message}</p>
                    )}
                  </div>
                </div>
              )}

              {showTerminoDocumento && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">Documento de término (obligatorio)</p>
                      <p className="text-xs text-slate-500">
                        Para guardar el estado “Terminado” debes asociar un documento (PDF, Word o imagen).
                      </p>
                      {terminoDocumento?.url && (
                        <a
                          className="inline-flex items-center gap-2 text-xs font-medium text-sky-700 hover:underline"
                          href={terminoDocumento.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Paperclip className="h-4 w-4" />
                          {terminoDocumento.nombre ?? 'Ver documento de término'}
                        </a>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        ref={terminoFileInputRef}
                        type="file"
                        accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/gif,text/plain"
                        onChange={handleTerminoFileSelected}
                        disabled={isLoading}
                      />
                      {terminoFile && (
                        <Button type="button" variant="outline" onClick={resetTerminoFileSelection} disabled={isLoading}>
                          Quitar
                        </Button>
                      )}
                    </div>
                  </div>

                  {terminoFile && (
                    <p className="mt-2 text-xs text-slate-600">
                      Seleccionado: {terminoFile.name} ({formatFileSize(terminoFile.size)})
                    </p>
                  )}

                  {errors.termino_documento_id && (
                    <p className="mt-2 text-sm text-red-600">{errors.termino_documento_id.message}</p>
                  )}
                </div>
              )}

              <div className='space-y-2'>
                <Label htmlFor='observaciones'>Observaciones internas</Label>
                <Textarea
                  id='observaciones'
                  rows={4}
                  placeholder='Próximos actos, riesgos, gestiones internas y cualquier contexto relevante.'
                  {...register('observaciones')}
                  disabled={isLoading}
                />
                <p className='text-xs text-gray-500'>
                  Si registras el estado de notificación, se añadirá automáticamente a estas observaciones al guardar.
                </p>
                {errors.observaciones && (
                  <p className='text-sm text-red-600'>{errors.observaciones.message}</p>
                )}
              </div>
            </section>

            <section id='case-form-step-3' className='space-y-4 scroll-mt-24'>
              <div>
                <h2 className='text-lg font-semibold text-gray-900'>Antecedentes</h2>
                <p className='text-sm text-gray-500'>
                  Los cobros y pagos se gestionan por fuera del expediente en la sección <span className="font-medium">Cobros</span>.
                </p>
              </div>

              <div className='rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700'>
                Crea el caso y luego registra cobros desde <span className="font-semibold">Cobros</span> (no se configuran al crear el expediente).
              </div>
            </section>

            <section id='case-form-step-4' className='space-y-4 scroll-mt-24'>
              <div>
                <h2 className='text-lg font-semibold text-gray-900'>Asignación y workflow</h2>
                <p className='text-sm text-gray-500'>Define el estado interno del expediente y la revisión previa a la asignación.</p>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='workflow_state'>Estado interno</Label>
                <select
                  id='workflow_state'
                  className='form-input'
                  {...register('workflow_state')}
                  disabled={isLoading}
                >
                  {CASE_WORKFLOW_STATES.map(state => (
                    <option key={state.value} value={state.value}>
                      {state.label}
                    </option>
                  ))}
                </select>
                {errors.workflow_state && (
                  <p className='text-sm text-red-600'>{errors.workflow_state.message}</p>
                )}
              </div>

              <div className='rounded-md border border-gray-200 bg-gray-50 p-4'>
                <label className='flex items-start space-x-3'>
                  <input
                    type='checkbox'
                    className='mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                    {...register('marcar_validado')}
                    disabled={isLoading}
                  />
                  <span>
                    <span className='font-medium text-gray-900'>Marcar caso como validado y listo para asignación</span>
                    <p className='text-sm text-gray-500 mt-1'>Al validar el caso se notificará al abogado patrocinante y al cliente principal, y se activará el timeline automático.</p>
                  </span>
                </label>
                {errors.marcar_validado && (
                  <p className='text-sm text-red-600 mt-2'>{errors.marcar_validado.message}</p>
                )}

                {marcarValidado && (
                  <div className='mt-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md p-3'>
                    Revisa que la información esté completa. El workflow pasará a <strong>"{CASE_WORKFLOW_STATES.find(state => state.value === workflowState)?.label ?? 'Revisión interna'}"</strong> y el equipo recibirá un resumen del caso junto al timeline sugerido.
                  </div>
                )}
              </div>
            </section>

            <div className='flex items-center justify-between w-full'>
              <div>
                {existingCase && currentProfile.role === 'admin_firma' && (
                  <Button
                    type='button'
                    variant='destructive'
                    onClick={async () => {
                      if (!confirm('¿Estás seguro de eliminar este caso? Esta acción no se puede deshacer.')) return;
                      setIsLoading(true);
                      try {
                        const result = await deleteCase(existingCase.id);
                        if (result.success) {
                          toast({ title: 'Caso eliminado', description: 'El expediente ha sido eliminado correctamente.' });
                          window.location.href = '/cases';
                        } else {
                          toast({ title: 'Error', description: result.error ?? 'No se pudo eliminar el caso', variant: 'destructive' });
                        }
                      } catch (error) {
                        console.error(error);
                        toast({ title: 'Error', description: 'Ocurrió un error inesperado', variant: 'destructive' });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                  >
                    <Trash2 className='w-4 h-4 mr-2' />
                    Eliminar caso
                  </Button>
                )}
              </div>
              <div className='flex space-x-4'>
                {onCancel && (
                  <Button
                    type='button'
                    variant='outline'
                    onClick={onCancel}
                    disabled={isLoading}
                  >
                    <X className='w-4 h-4 mr-2' />
                    Cancelar
                  </Button>
                )}
                <Button type='submit' disabled={isLoading || !canSubmit}>
                  {isLoading ? (
                    <>
                      <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                      {existingCase ? 'Actualizando...' : 'Creando...'}
                    </>
                  ) : (
                    <>
                      <Save className='w-4 h-4 mr-2' />
                      {existingCase ? 'Actualizar Caso' : 'Crear Caso'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {isWizard && (
        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {([
                  { step: 1, label: 'Partes', done: step1Done },
                  { step: 2, label: 'Carátula', done: step2Done },
                  { step: 3, label: 'Antecedentes', done: step3Done },
                  { step: 4, label: 'Revisión', done: canSubmit },
                ] as const).map((s) => (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => scrollToStep(s.step)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/50 px-4 py-3 text-left transition hover:bg-white/80',
                      s.done && 'border-primary/25 bg-primary/10',
                    )}
                  >
                    <span className="text-sm font-semibold text-foreground">{s.label}</span>
                    <Badge variant={s.done ? 'info' : 'outline'} className="shrink-0">
                      {s.done ? 'Listo' : 'Pendiente'}
                    </Badge>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/55 p-4 text-sm text-foreground/70">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/50">Estado</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{CASE_WORKFLOW_STATES.find((s) => s.value === workflowState)?.label ?? '—'}</Badge>
                  <Badge variant="outline">{CASE_PRIORITIES.find((p) => p.value === watch('prioridad'))?.label ?? '—'}</Badge>
                </div>
                {audienciaInicialTipo && (
                  <p className="mt-2 text-xs text-foreground/60">
                    Audiencia: <span className="font-semibold text-foreground">{audienciaInicialTipo}</span>
                    {audienciaInicialRequiereTestigos ? ' · con testigos' : ''}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {timelinePreview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timeline sugerido</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/70">
                  Se generarán <span className="font-semibold text-foreground">{timelinePreview.total}</span> etapas automáticamente al crear el caso.
                </p>
                <div className="mt-3 space-y-2">
                  {timelinePreview.items.map((item) => (
                    <div key={item.etapa} className="rounded-2xl border border-white/20 bg-white/55 px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">{item.etapa}</p>
                      <p className="mt-1 text-xs text-foreground/55">Estimado: {formatDate(item.fecha)}</p>
                    </div>
                  ))}
                </div>
                {timelinePreview.total > timelinePreview.items.length && (
                  <p className="mt-2 text-xs text-foreground/55">
                    Mostrando {timelinePreview.items.length} de {timelinePreview.total} etapas.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </aside>
      )}
    </div>
  );
}
