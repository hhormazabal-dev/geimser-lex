'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
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
  CASE_MATERIAS,
  REGIONES_CHILE,
} from '@/lib/validators/case';
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
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [clientOptions, setClientOptions] = useState<LightweightProfile[]>(clients);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const isAbogado = currentProfile.role === 'abogado';
  const defaultLawyerId = isAbogado ? currentProfile.id : undefined;

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
        estado: (existingCase.estado || 'activo') as CreateCaseInput['estado'],
        fecha_inicio: existingCase.fecha_inicio || new Date().toISOString().split('T')[0],
        abogado_responsable: existingLawyerId || defaultLawyerId,
        cliente_principal_id: existingCase.cliente_principal_id || undefined,
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
        observaciones: existingCase.observaciones || '',
        descripcion_inicial: existingCase.descripcion_inicial || '',
        objetivo_cliente: existingCase.objetivo_cliente || '',
        documentacion_recibida: existingCase.documentacion_recibida || '',
        workflow_state: (existingCase.workflow_state || 'preparacion') as CreateCaseInput['workflow_state'],
        validado_at: existingCase.validado_at || undefined,
        marcar_validado: Boolean(existingCase.validado_at),
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
        estado: 'activo',
        fecha_inicio: new Date().toISOString().split('T')[0],
        abogado_responsable: defaultLawyerId,
        cliente_principal_id: undefined,
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
        objetivo_cliente: '',
        documentacion_recibida: '',
        workflow_state: 'preparacion',
        marcar_validado: false,
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

  const rutCliente = watch('rut_cliente');
  const marcarValidado = watch('marcar_validado');
  const workflowState = watch('workflow_state');
  const modalidadCobro = watch('modalidad_cobro');
  const honorarioMoneda = watch('honorario_moneda');
  const honorarioTotal = watch('honorario_total_uf');
  const honorarioPagado = watch('honorario_pagado_uf');
  const honorarioPendiente =
    typeof honorarioTotal === 'number' && !Number.isNaN(honorarioTotal)
      ? Math.max((honorarioTotal ?? 0) - (honorarioPagado ?? 0), 0)
      : undefined;
  const newClientRut = watchNewClient('rut');
  const { ref: newClientRutRef, ...newClientRutField } = registerNewClient('rut');

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
  }, [clients]);

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

      const payload: CreateCaseInput = {
        ...data,
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

        router.push(createdCaseId ? `/cases/${createdCaseId}` : '/cases');
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

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedRut = formatRUT(e.target.value);
    setValue('rut_cliente', formattedRut);
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
        setValue('nombre_cliente', newClient.nombre);
        if (newClient.rut) {
          setValue('rut_cliente', newClient.rut);
        }

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

  return (
    <Card className='w-full max-w-4xl mx-auto'>
      <CardHeader>
        <CardTitle>
          {existingCase ? 'Editar Caso' : 'Nuevo Caso'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-8'>
          <section className='space-y-4'>
            <div>
              <h2 className='text-lg font-semibold text-gray-900'>Datos del caso</h2>
              <p className='text-sm text-gray-500'>Completa la información general del expediente.</p>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='numero_causa'>Número de Causa</Label>
                <Input
                  id='numero_causa'
                  placeholder='C-1234-2024'
                  {...register('numero_causa')}
                  disabled={isLoading}
                />
                {errors.numero_causa && (
                  <p className='text-sm text-red-600'>{errors.numero_causa.message}</p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='materia'>Materia *</Label>
                <select
                  id='materia'
                  className='form-input'
                  {...register('materia')}
                  disabled={isLoading}
                >
                  <option value=''>Seleccionar materia</option>
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
            </div>

            <div className='space-y-2'>
              <Label htmlFor='caratulado'>Caratulado *</Label>
              <Input
                id='caratulado'
                placeholder='Pérez con Empresa ABC'
                {...register('caratulado')}
                disabled={isLoading}
              />
              {errors.caratulado && (
                <p className='text-sm text-red-600'>{errors.caratulado.message}</p>
              )}
            </div>
          </section>

          <section className='space-y-4'>
            <div>
              <h2 className='text-lg font-semibold text-gray-900'>Cliente y contraparte</h2>
              <p className='text-sm text-gray-500'>Identifica a las partes involucradas.</p>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='nombre_cliente'>Nombre del Cliente *</Label>
                <Input
                  id='nombre_cliente'
                  placeholder='Juan Pérez'
                  {...register('nombre_cliente')}
                  disabled={isLoading}
                />
                {errors.nombre_cliente && (
                  <p className='text-sm text-red-600'>{errors.nombre_cliente.message}</p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='rut_cliente'>RUT del Cliente</Label>
                <Input
                  id='rut_cliente'
                  placeholder='12.345.678-9'
                  value={rutCliente || ''}
                  onChange={handleRutChange}
                  disabled={isLoading}
                />
                {errors.rut_cliente && (
                  <p className='text-sm text-red-600'>{errors.rut_cliente.message}</p>
                )}
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
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
                  <p className='text-xs text-gray-500'>No hay clientes registrados. Puedes vincularlo más tarde.</p>
                )}
                {errors.cliente_principal_id && (
                  <p className='text-sm text-red-600'>{errors.cliente_principal_id.message}</p>
                )}
                {isAddingClient && (
                  <form
                    onSubmit={onCreateClient}
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
                      <Button type='submit' disabled={isCreatingClient}>
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
                  </form>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='contraparte'>Contraparte</Label>
                <Input
                  id='contraparte'
                  placeholder='Empresa ABC S.A.'
                  {...register('contraparte')}
                  disabled={isLoading}
                />
                {errors.contraparte && (
                  <p className='text-sm text-red-600'>{errors.contraparte.message}</p>
                )}
              </div>
            </div>
          </section>

          <section className='space-y-4'>
            <div>
              <h2 className='text-lg font-semibold text-gray-900'>Detalle procesal</h2>
              <p className='text-sm text-gray-500'>Ingresa la información requerida por Supabase para seguimiento.</p>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='tribunal'>Tribunal</Label>
                <Input
                  id='tribunal'
                  placeholder='1° Juzgado Civil de Santiago'
                  {...register('tribunal')}
                  disabled={isLoading}
                />
                {errors.tribunal && (
                  <p className='text-sm text-red-600'>{errors.tribunal.message}</p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='region'>Región</Label>
                <select
                  id='region'
                  className='form-input'
                  {...register('region')}
                  disabled={isLoading}
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
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='comuna'>Comuna</Label>
                <Input
                  id='comuna'
                  placeholder='Santiago'
                  {...register('comuna')}
                  disabled={isLoading}
                />
                {errors.comuna && (
                  <p className='text-sm text-red-600'>{errors.comuna.message}</p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='fecha_inicio'>Fecha de Inicio</Label>
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
                  {...register('valor_estimado', { valueAsNumber: true })}
                  disabled={isLoading}
                />
                {errors.valor_estimado && (
                  <p className='text-sm text-red-600'>{errors.valor_estimado.message}</p>
                )}
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='estado'>Estado actual</Label>
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

              <div className='space-y-2'>
                <Label htmlFor='etapa_actual'>Etapa actual</Label>
                <Input
                  id='etapa_actual'
                  placeholder='Ingreso Demanda'
                  {...register('etapa_actual')}
                  disabled={isLoading}
                />
                {errors.etapa_actual && (
                  <p className='text-sm text-red-600'>{errors.etapa_actual.message}</p>
                )}
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='observaciones'>Observaciones</Label>
              <Textarea
                id='observaciones'
                rows={4}
                placeholder='Observaciones adicionales, riesgos o comentarios internos.'
                {...register('observaciones')}
                disabled={isLoading}
              />
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
                  {...register('honorario_total_uf', { valueAsNumber: true })}
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
                  {...register('honorario_pagado_uf', { valueAsNumber: true })}
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
                  {...register('honorario_variable_porcentaje', { valueAsNumber: true })}
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
              <h2 className='text-lg font-semibold text-gray-900'>Información inicial</h2>
              <p className='text-sm text-gray-500'>Describe el contexto y los objetivos del cliente para una correcta asignación.</p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='descripcion_inicial'>Descripción inicial *</Label>
              <Textarea
                id='descripcion_inicial'
                rows={5}
                placeholder='Resumen del caso, antecedentes relevantes y hechos principales.'
                {...register('descripcion_inicial')}
                disabled={isLoading}
              />
              {errors.descripcion_inicial && (
                <p className='text-sm text-red-600'>{errors.descripcion_inicial.message}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='objetivo_cliente'>Objetivo del cliente</Label>
              <Textarea
                id='objetivo_cliente'
                rows={4}
                placeholder='¿Qué espera lograr el cliente con este procedimiento?'
                {...register('objetivo_cliente')}
                disabled={isLoading}
              />
              {errors.objetivo_cliente && (
                <p className='text-sm text-red-600'>{errors.objetivo_cliente.message}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='documentacion_recibida'>Documentación recibida</Label>
              <Textarea
                id='documentacion_recibida'
                rows={4}
                placeholder='Detalle la documentación entregada por el cliente (contratos, boletas, respaldos, etc.).'
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
            <Button type='submit' disabled={isLoading}>
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
