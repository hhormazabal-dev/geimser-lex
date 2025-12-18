'use client';

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Controller, useController, useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createCase, updateCase } from '@/lib/actions/cases';
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
import { STAGE_AUDIENCE_TYPES } from '@/lib/validators/stages';
import { createClientSchema, type CreateClientInput } from '@/lib/validators/clients';
import { formatRUT } from '@/lib/utils';
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

const generateRowId = () => `party-${Math.random().toString(36).slice(2, 9)}`;

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function createPartyRow(overrides?: Partial<PartyRow>): PartyRow {
  return {
    id: overrides?.id ?? generateRowId(),
    nombre: overrides?.nombre?.trim() ?? '',
    rut: overrides?.rut ? formatRUT(overrides.rut) : '',
  };
}

function parsePartyRows(raw?: string | null): PartyRow[] {
  if (!raw) return [];

  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^(.*?)(?:\s*\(RUT[:\s]+(.+?)\))?$/i);
      const nombre = match?.[1]?.trim() ?? line;
      const rut = match?.[2]?.trim() ?? '';
      return createPartyRow({ nombre, rut });
    });
}

function ensurePartyRows(rows: PartyRow[], fallbackRut?: string | null): PartyRow[] {
  if (rows.length === 0) {
    return [createPartyRow({ rut: fallbackRut ?? '' })];
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

function composeObservacionesMeta(text: string | undefined, meta: CaseFormMeta): string {
  const cleaned = (text ?? '').trim();
  const refinedMeta: CaseFormMeta = {};

  if (meta.notification) {
    refinedMeta.notification = meta.notification;
  }

  if (Object.keys(refinedMeta).length === 0) {
    return cleaned;
  }

  return `${cleaned}${cleaned ? '\n\n' : ''}${OBSERVACIONES_META_PREFIX}${JSON.stringify(refinedMeta)}${OBSERVACIONES_META_SUFFIX}`;
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
}: CaseFormProps) {
  const { text: initialObservacionesText, meta: initialFormMeta } = parseObservacionesMeta(
    existingCase?.observaciones ?? '',
  );

  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
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

  const focusFirstError = (formErrors: FieldErrors<CreateCaseInput>) => {
    const firstField = Object.keys(formErrors ?? {})[0];
    if (!firstField) return;

    const candidate =
      document.getElementById(firstField) ??
      (document.querySelector(`[name="${firstField}"]`) as HTMLElement | null);
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
    toast({
      title: 'Revisa el formulario',
      description: 'Hay campos con errores o incompletos. Corrígelos y vuelve a intentar.',
      variant: 'destructive',
    });
  };

  const existingLawyerId = existingCase
    ? (existingCase as any).abogado_responsable_id ||
      (typeof existingCase.abogado_responsable === 'string'
        ? existingCase.abogado_responsable
        : existingCase.abogado_responsable?.id)
    : undefined;

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
        sentencia_fecha: (existingCase as any).sentencia_fecha ?? '',
        estado: (existingCase.estado || 'activo') as CreateCaseInput['estado'],
        fecha_inicio: existingCase.fecha_inicio || new Date().toISOString().split('T')[0],
        abogado_responsable: existingLawyerId || defaultLawyerId,
        cliente_principal_id: existingCase.cliente_principal_id ?? '',
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
        fecha_inicio: new Date().toISOString().split('T')[0],
        abogado_responsable: defaultLawyerId,
        cliente_principal_id: '',
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
    parsePartyRows(defaultValues.nombre_cliente ?? ''),
    defaultValues.rut_cliente,
  );
  const initialDemandados = ensurePartyRows(parsePartyRows(defaultValues.contraparte ?? ''));

  const [demandantes, setDemandantes] = useState<PartyRow[]>(initialDemandantes);
  const [demandados, setDemandados] = useState<PartyRow[]>(initialDemandados);
  const [notificacionEstado, setNotificacionEstado] = useState<
    CaseFormMeta['notification'] | null
  >(initialFormMeta.notification ?? null);

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
  const caratuladoValue = watch('caratulado');
  const materiaValue = watch('materia');
  const descripcionInicialValue = watch('descripcion_inicial');
  const regionValue = watch('region');
  const comunaValue = watch('comuna');
  const tribunalValue = watch('tribunal');
  const marcarValidado = watch('marcar_validado');
  const workflowState = watch('workflow_state');
  const modalidadCobro = watch('modalidad_cobro');
  const honorarioMoneda = watch('honorario_moneda');
  const honorarioTotal = watch('honorario_total_uf');
  const audienciaInicialTipo = watch('audiencia_inicial_tipo');
  const audienciaInicialRequiereTestigos = watch('audiencia_inicial_requiere_testigos');
  const sentenciaEstado = watch('sentencia_estado');
  const honorarioPagado = watch('honorario_pagado_uf');
  const honorarioPendiente =
    typeof honorarioTotal === 'number' && !Number.isNaN(honorarioTotal)
      ? Math.max((honorarioTotal ?? 0) - (honorarioPagado ?? 0), 0)
      : undefined;
  const newClientRut = watchNewClient('rut');
  const { ref: newClientRutRef, ...newClientRutField } = registerNewClient('rut');

  const step1Done = Boolean(clientePrincipalId) && Boolean(demandantes[0]?.nombre.trim());
  const step2Done = Boolean(caratuladoValue?.trim()) && Boolean(materiaValue?.trim());
  const step3Done = (descripcionInicialValue ?? '').trim().length >= 20;
  const currentStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 4;
  const showSentenciaFecha = sentenciaEstado === 'programada' || sentenciaEstado === 'dictada';

  const [comunaOptions, setComunaOptions] = useState<Array<{ code: string; name: string }>>([]);
  const [tribunalOptions, setTribunalOptions] = useState<Array<{ id: string; name: string }>>([]);
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
      setTribunalOptions([]);
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
      setTribunalOptions([]);
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
        setTribunalOptions(tribunales ?? []);
      })
      .catch((err) => {
        if (canceled) return;
        setTribunalOptions([]);
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

  useEffect(() => {
    if (!tribunalValue) return;
    if (selectedTribunalId) return;
    if (tribunalOptions.length === 0) return;

    const target = normalizeText(tribunalValue);
    const match = tribunalOptions.find((option) => normalizeText(option.name) === target);
    if (match) {
      setSelectedTribunalId(match.id);
    }
  }, [selectedTribunalId, tribunalOptions, tribunalValue]);

  const resetFileSelection = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

      const metaObservaciones: CaseFormMeta = {};
      if (notificacionEstado) {
        metaObservaciones.notification = notificacionEstado;
      }

      const observacionesFinales = composeObservacionesMeta(data.observaciones, metaObservaciones);

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

      let result;
      
      if (existingCase) {
        result = await updateCase(existingCase.id, payload);
      } else {
        result = await createCase(payload);
      }

      if (result.success) {
        toast({
          title: existingCase ? 'Caso actualizado' : 'Caso creado',
          description: existingCase
            ? 'El caso ha sido actualizado exitosamente'
            : 'El nuevo caso ha sido creado exitosamente',
        });

        const createdCaseId = (result as { case?: { id: string } }).case?.id;

        if (!existingCase && selectedFiles.length > 0) {
          if (createdCaseId) {
            let successfulUploads = 0;
            const failedUploads: Array<{ fileName: string; message?: string }> = [];

            for (const file of selectedFiles) {
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

  return (
    <Card className='w-full max-w-4xl mx-auto'>
      <CardHeader>
        <div className='space-y-4'>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <CardTitle>{existingCase ? 'Editar Caso' : 'Nuevo Caso'}</CardTitle>
          </div>
          <div className='flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em]'>
            <span
              className={`rounded-full px-3 py-1 transition ${
                1 < currentStep
                  ? 'bg-slate-900 text-white shadow-sm'
                  : currentStep === 1
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              Paso 1 · Partes
            </span>
            <span
              className={`rounded-full px-3 py-1 ${
                2 < currentStep
                  ? 'bg-slate-900 text-white shadow-sm'
                  : currentStep === 2
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              Paso 2 · Carátula
            </span>
            <span
              className={`rounded-full px-3 py-1 ${
                3 < currentStep
                  ? 'bg-slate-900 text-white shadow-sm'
                  : currentStep === 3
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              Paso 3 · Antecedentes
            </span>
            <span
              className={`rounded-full px-3 py-1 ${
                currentStep === 4 ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-400'
              }`}
            >
              Paso 4 · Revisión
            </span>
          </div>
          <p className='text-sm text-slate-500'>
            Completa el expediente en el mismo orden en que se arma un caso: partes, carátula/competencia, antecedentes y luego el estado procesal y la asignación interna.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className='space-y-8'>
          <section className='space-y-4'>
            <div>
              <h2 className='text-lg font-semibold text-gray-900'>Partes</h2>
              <p className='text-sm text-gray-500'>Identifica al cliente, a quién representas y la contraparte.</p>
            </div>

            <div className='space-y-6'>
              <div className='space-y-2'>
                <Label>Demandantes *</Label>
                <p className='text-xs text-gray-500'>Ingresa un demandante por fila. El primero queda registrado como titular del expediente.</p>
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
                  <div className='flex items-center justify-between gap-2'>
                    <Label htmlFor='cliente_principal_id'>Cliente principal *</Label>
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
                    rules={{ required: 'Selecciona un cliente registrado para continuar.' }}
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
                    <p className='text-xs font-medium text-red-500'>
                      No hay clientes registrados. Crea primero el cliente para habilitar la creación del caso.
                    </p>
                  )}
                  {errors.cliente_principal_id && (
                    <p className='text-sm text-red-600'>{errors.cliente_principal_id.message}</p>
                  )}
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
                  <Label>Demandados</Label>
                  <p className='text-xs text-gray-500'>Registra cada demandado y su RUT si ya se encuentra disponible.</p>
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

	          <section className='space-y-4'>
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
	                      setTribunalOptions([]);
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
                <Label htmlFor='valor_estimado'>Valor Estimado (CLP)</Label>
                <Input
                  id='valor_estimado'
                  type='number'
                  placeholder='5000000'
                  {...register('valor_estimado', { setValueAs: toOptionalNumber })}
                  disabled={isLoading}
                />
	                {errors.valor_estimado && (
	                  <p className='text-sm text-red-600'>{errors.valor_estimado.message}</p>
	                )}
	              </div>
	            </div>

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
                    onClick={() => setNotificacionEstado(option.value)}
                    disabled={isLoading}
                    aria-pressed={notificacionEstado === option.value}
                  >
                    {option.label}
                  </Button>
                ))}
                <Button
                  type='button'
                  variant={notificacionEstado === null ? 'default' : 'ghost'}
                  onClick={() => setNotificacionEstado(null)}
                  disabled={isLoading}
                  aria-pressed={notificacionEstado === null}
                >
                  Sin registrar
                </Button>
              </div>
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
	                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
	                      audienciaInicialTipo
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
	                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
	                        audienciaInicialTipo === option.value
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
	              </div>

	              <div className='space-y-3'>
	                <Label>Participación de testigos</Label>
	                <Controller
	                  control={control}
	                  name='audiencia_inicial_requiere_testigos'
	                  render={({ field }) => (
	                    <label
	                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
	                        audienciaInicialTipo
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

	          <section className='space-y-4'>
	            <div>
	              <h2 className='text-lg font-semibold text-gray-900'>Honorarios y cobro prepago</h2>
              <p className='text-sm text-gray-500'>Define cómo se cobrará este caso. El timeline bloqueará etapas hasta registrar el pago correspondiente.</p>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='modalidad_cobro'>Modalidad de cobro</Label>
                <select
                  id='modalidad_cobro'
                  className='form-input'
                  {...register('modalidad_cobro')}
                  disabled={isLoading}
                >
                  <option value='prepago'>Prepago por etapas</option>
                  <option value='postpago'>Postpago</option>
                  <option value='mixto'>Mixto</option>
                </select>
                {errors.modalidad_cobro && (
                  <p className='text-sm text-red-600'>{errors.modalidad_cobro.message}</p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='honorario_moneda'>Moneda base</Label>
                <select
                  id='honorario_moneda'
                  className='form-input'
                  {...register('honorario_moneda')}
                  disabled={isLoading}
                >
                  <option value='UF'>UF</option>
                  <option value='CLP'>CLP</option>
                  <option value='USD'>USD</option>
                </select>
                {errors.honorario_moneda && (
                  <p className='text-sm text-red-600'>{errors.honorario_moneda.message}</p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='tarifa_referencia'>Tarifa de referencia</Label>
                <Input
                  id='tarifa_referencia'
                  placeholder='Ej: civil_juicio_ordinario_mayor_cuantia'
                  {...register('tarifa_referencia')}
                  disabled={isLoading}
                />
                <p className='text-xs text-gray-500'>Usa el identificador definido en la tabla de tarifas de Xel Chile para asociar el timeline automáticamente.</p>
                {errors.tarifa_referencia && (
                  <p className='text-sm text-red-600'>{errors.tarifa_referencia.message}</p>
                )}
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='honorario_total_uf'>Honorario total (UF)</Label>
                <Input
                  id='honorario_total_uf'
                  type='number'
                  min='0'
                  step='0.01'
                  placeholder='30'
                  {...register('honorario_total_uf', { setValueAs: toOptionalNumber })}
                  disabled={isLoading || honorarioMoneda !== 'UF'}
                />
                {honorarioMoneda !== 'UF' && (
                  <p className='text-xs text-gray-500'>Para otras monedas detalla el valor en notas.</p>
                )}
                {errors.honorario_total_uf && (
                  <p className='text-sm text-red-600'>{errors.honorario_total_uf.message}</p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='honorario_pagado_uf'>Monto pagado (UF)</Label>
                <Input
                  id='honorario_pagado_uf'
                  type='number'
                  min='0'
                  step='0.01'
                  placeholder='0'
                  {...register('honorario_pagado_uf', { setValueAs: toOptionalNumber })}
                  disabled={isLoading || honorarioMoneda !== 'UF'}
                />
                {errors.honorario_pagado_uf && (
                  <p className='text-sm text-red-600'>{errors.honorario_pagado_uf.message}</p>
                )}
              </div>

              <div className='space-y-2'>
                <Label>Saldo pendiente (UF)</Label>
                <div className='h-10 flex items-center rounded-md border border-dashed border-gray-300 px-3 text-sm font-medium text-gray-700 bg-gray-50'>
                  {honorarioPendiente !== undefined ? formatUf(honorarioPendiente) : '—'}
                </div>
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='honorario_variable_porcentaje'>Componente variable (%)</Label>
                <Input
                  id='honorario_variable_porcentaje'
                  type='number'
                  min='0'
                  max='100'
                  step='0.1'
                  placeholder='10'
                  {...register('honorario_variable_porcentaje', { setValueAs: toOptionalNumber })}
                  disabled={isLoading}
                />
                {errors.honorario_variable_porcentaje && (
                  <p className='text-sm text-red-600'>{errors.honorario_variable_porcentaje.message}</p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='honorario_variable_base'>Base del variable</Label>
                <Textarea
                  id='honorario_variable_base'
                  rows={2}
                  placeholder='Ej: 10% de lo obtenido o de lo ahorrado por la defensa.'
                  {...register('honorario_variable_base')}
                  disabled={isLoading}
                />
                {errors.honorario_variable_base && (
                  <p className='text-sm text-red-600'>{errors.honorario_variable_base.message}</p>
                )}
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='honorario_notas'>Notas de honorarios</Label>
              <Textarea
                id='honorario_notas'
                rows={3}
                placeholder='Detalle acuerdos específicos, descuentos, o condiciones especiales.'
                {...register('honorario_notas')}
                disabled={isLoading}
              />
              {errors.honorario_notas && (
                <p className='text-sm text-red-600'>{errors.honorario_notas.message}</p>
              )}
            </div>

            <div className='rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900'>
              <p className='font-medium'>Prepago por etapas</p>
              <p className='mt-1'>El cliente podrá avanzar pagando etapa por etapa. Cada fase del timeline exigirá un pago registrado para habilitar las acciones del equipo jurídico. Puedes copiar y compartir los enlaces de Payku desde el detalle del caso.</p>
            </div>
          </section>

          <section className='space-y-4'>
            <div>
              <h2 className='text-lg font-semibold text-gray-900'>Asignación y workflow</h2>
              <p className='text-sm text-gray-500'>Define quién liderará el caso y el estado interno del expediente.</p>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='abogado_responsable'>Abogado responsable</Label>
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
                  <p className='text-xs text-gray-500'>No hay abogados disponibles. Un administrador debe registrarlos.</p>
                )}
                {errors.abogado_responsable && (
                  <p className='text-sm text-red-600'>{errors.abogado_responsable.message}</p>
                )}
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
                  <p className='text-sm text-gray-500 mt-1'>Al validar el caso se notificará al abogado responsable y al cliente principal, y se activará el timeline automático.</p>
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

          <div className='flex justify-end space-x-4'>
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
            <Button type='submit' disabled={isLoading || !clientePrincipalId}>
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
        </form>
      </CardContent>
    </Card>
  );
}
