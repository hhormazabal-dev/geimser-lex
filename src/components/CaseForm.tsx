'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { createCase, updateCase } from '@/lib/actions/cases';
import {
  createCaseSchema,
  type CreateCaseInput,
  CASE_STATUSES,
  CASE_PRIORITIES,
  CASE_MATERIAS,
  REGIONES_CHILE,
} from '@/lib/validators/case';
import { formatRUT } from '@/lib/utils';
import { Loader2, Save, X } from 'lucide-react';
import type { Case } from '@/lib/supabase/types';

interface CaseFormProps {
  case?: Case;
  onCancel?: () => void;
}

export function CaseForm({ case: existingCase, onCancel }: CaseFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateCaseInput>({
    resolver: zodResolver(createCaseSchema),
    defaultValues: existingCase ? {
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
      estado: existingCase.estado || 'activo',
      fecha_inicio: existingCase.fecha_inicio || new Date().toISOString().split('T')[0],
      prioridad: existingCase.prioridad || 'media',
      valor_estimado: existingCase.valor_estimado || undefined,
      observaciones: existingCase.observaciones || '',
    } : {
      estado: 'activo',
      prioridad: 'media',
      etapa_actual: 'Ingreso Demanda',
      fecha_inicio: new Date().toISOString().split('T')[0],
    },
  });

  const rutCliente = watch('rut_cliente');

  const onSubmit = async (data: CreateCaseInput) => {
    setIsLoading(true);

    try {
      let result;
      
      if (existingCase) {
        result = await updateCase(existingCase.id, data);
      } else {
        result = await createCase(data);
      }

      if (result.success) {
        toast({
          title: existingCase ? 'Caso actualizado' : 'Caso creado',
          description: existingCase 
            ? 'El caso ha sido actualizado exitosamente'
            : 'El nuevo caso ha sido creado exitosamente',
        });

        if (result.case) {
          router.push(`/cases/${result.case.id}`);
        } else {
          router.push('/cases');
        }
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
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
          {/* Información básica */}
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
              <Label htmlFor='materia'>Materia</Label>
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

          {/* Información del cliente */}
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

          {/* Información procesal */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='tribunal'>Tribunal</Label>
              <Input
                id='tribunal'
                placeholder='1° Juzgado del Trabajo de Santiago'
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

          {/* Estado y prioridad */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='estado'>Estado</Label>
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

          <div className='space-y-2'>
            <Label htmlFor='observaciones'>Observaciones</Label>
            <textarea
              id='observaciones'
              rows={4}
              className='form-input'
              placeholder='Observaciones adicionales sobre el caso...'
              {...register('observaciones')}
              disabled={isLoading}
            />
            {errors.observaciones && (
              <p className='text-sm text-red-600'>{errors.observaciones.message}</p>
            )}
          </div>

          {/* Botones */}
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
