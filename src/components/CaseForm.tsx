'use client';

import { useEffect, useState } from 'react';
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
import {
  createCaseSchema,
  type CreateCaseInput,
  CASE_STATUSES,
  CASE_PRIORITIES,
  CASE_WORKFLOW_STATES,
  CASE_MATERIAS,
  REGIONES_CHILE,
} from '@/lib/validators/case';
import { formatRUT } from '@/lib/utils';
import { Loader2, Save, X } from 'lucide-react';
import type { Case, Profile } from '@/lib/supabase/types';

type LightweightProfile = Pick<Profile, 'id' | 'nombre' | 'role'>;

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

export function CaseForm({
  case: existingCase,
  onCancel,
  lawyers,
  clients,
  currentProfile,
}: CaseFormProps) {
  const [isLoading, setIsLoading] = useState(false);
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

  const rutCliente = watch('rut_cliente');
  const marcarValidado = watch('marcar_validado');
  const workflowState = watch('workflow_state');

  useEffect(() => {
    if (!existingCase) {
      setValue('workflow_state', marcarValidado ? 'en_revision' : 'preparacion');
    }
  }, [marcarValidado, existingCase, setValue]);

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
                <Label htmlFor='cliente_principal_id'>Cliente principal *</Label>
                <Controller
                  control={control}
                  name='cliente_principal_id'
                  render={({ field }) => (
                    <select
                      id='cliente_principal_id'
                      className='form-input'
                      value={field.value || ''}
                      onChange={(event) => field.onChange(event.target.value || undefined)}
                      disabled={isLoading || clients.length === 0}
                    >
                      <option value=''>Selecciona un cliente</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {clients.length === 0 && (
                  <p className='text-xs text-gray-500'>No hay clientes registrados. Puedes vincularlo más tarde.</p>
                )}
                {errors.cliente_principal_id && (
                  <p className='text-sm text-red-600'>{errors.cliente_principal_id.message}</p>
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
