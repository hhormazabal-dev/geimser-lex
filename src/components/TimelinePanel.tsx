'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  createStage, 
  updateStage, 
  completeStage, 
  deleteStage, 
  getStages 
} from '@/lib/actions/stages';
import { formatDate, formatRelativeTime, isDateInPast } from '@/lib/utils';
import { 
  Clock, 
  CheckCircle, 
  Circle, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar,
  User,
  Loader2,
  DollarSign,
  ExternalLink,
  Wallet,
  AlertCircle,
  Link2,
  PiggyBank
} from 'lucide-react';
import type { CaseStage } from '@/lib/supabase/types';
import type { CreateStageInput } from '@/lib/validators/stages';
import { STAGE_STATUSES, STAGE_PAYMENT_STATUSES, getStageTemplatesByMateria } from '@/lib/validators/stages';

interface TimelinePanelProps {
  caseId: string;
  caseMateria?: string;
  canManageStages?: boolean;
  showPrivateStages?: boolean;
}

export function TimelinePanel({ 
  caseId, 
  caseMateria = 'Civil',
  canManageStages = false,
  showPrivateStages = true 
}: TimelinePanelProps) {
  const [stages, setStages] = useState<CaseStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStage, setNewStage] = useState({
    etapa: '',
    descripcion: '',
    fecha_programada: '',
    es_publica: true,
    isCustom: false,
    requiere_pago: false,
    costo_uf: '',
    porcentaje_variable: '',
    enlace_pago: '',
    notas_pago: '',
    monto_variable_base: '',
    estado_pago: 'pendiente' as CreateStageInput['estado_pago'],
    monto_pagado_uf: '',
  });
  const { toast } = useToast();
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [paymentActionStage, setPaymentActionStage] = useState<string | null>(null);

  const loadStages = async () => {
    setIsLoading(true);
    try {
      const result = await getStages({ case_id: caseId, page: 1, limit: 50 });
      
      if (result.success) {
        setStages(result.stages);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al cargar etapas',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading stages:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al cargar etapas',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStages();
  }, [caseId]);

  const handleCreateStage = async () => {
    if (!newStage.etapa.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre de la etapa es requerido',
        variant: 'destructive',
      });
      return;
    }

    const costoUf = newStage.costo_uf ? Number(newStage.costo_uf) : undefined;
    if (newStage.requiere_pago && (costoUf === undefined || Number.isNaN(costoUf))) {
      toast({
        title: 'Costo requerido',
        description: 'Debes indicar el costo en UF de la etapa para poder cobrarla.',
        variant: 'destructive',
      });
      return;
    }

    if (costoUf !== undefined && costoUf < 0) {
      toast({
        title: 'Monto inválido',
        description: 'El costo en UF debe ser un número positivo.',
        variant: 'destructive',
      });
      return;
    }

    const porcentajeVariable = newStage.porcentaje_variable
      ? Number(newStage.porcentaje_variable)
      : undefined;
    if (
      porcentajeVariable !== undefined &&
      (Number.isNaN(porcentajeVariable) || porcentajeVariable < 0 || porcentajeVariable > 100)
    ) {
      toast({
        title: 'Porcentaje inválido',
        description: 'El porcentaje variable debe estar entre 0% y 100%.',
        variant: 'destructive',
      });
      return;
    }

    const montoPagadoUf = newStage.monto_pagado_uf ? Number(newStage.monto_pagado_uf) : undefined;
    if (montoPagadoUf !== undefined && (Number.isNaN(montoPagadoUf) || montoPagadoUf < 0)) {
      toast({
        title: 'Monto pagado inválido',
        description: 'El monto pagado debe ser un número positivo.',
        variant: 'destructive',
      });
      return;
    }

    const enlacePago = newStage.enlace_pago?.trim();
    if (enlacePago && !/^https?:\/\//i.test(enlacePago)) {
      toast({
        title: 'URL inválida',
        description: 'El enlace de pago debe comenzar con http:// o https://',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const maxOrden = Math.max(...stages.map(s => s.orden || 0), 0);
      
      const stageData: CreateStageInput = {
        case_id: caseId,
        etapa: newStage.etapa.trim(),
        descripcion: newStage.descripcion.trim() || undefined,
        fecha_programada: newStage.fecha_programada || undefined,
        es_publica: newStage.es_publica,
        estado: 'pendiente',
        orden: maxOrden + 1,
        requiere_pago: newStage.requiere_pago,
        costo_uf: costoUf,
        porcentaje_variable: porcentajeVariable,
        estado_pago: newStage.estado_pago || 'pendiente',
        enlace_pago: enlacePago || undefined,
        notas_pago: newStage.notas_pago?.trim() || undefined,
        monto_variable_base: newStage.monto_variable_base?.trim() || undefined,
        monto_pagado_uf: montoPagadoUf,
      };

      const result = await createStage(stageData);
      
      if (result.success) {
        toast({
          title: 'Etapa creada',
          description: 'La etapa ha sido creada exitosamente',
        });
        setNewStage({
          etapa: '',
          descripcion: '',
          fecha_programada: '',
          es_publica: true,
          isCustom: false,
          requiere_pago: false,
          costo_uf: '',
          porcentaje_variable: '',
          enlace_pago: '',
          notas_pago: '',
          monto_variable_base: '',
          estado_pago: 'pendiente',
          monto_pagado_uf: '',
        });
        setShowAddForm(false);
        await loadStages();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al crear la etapa',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating stage:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al crear la etapa',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCompleteStage = async (stage: CaseStage) => {
    if (stage.requiere_pago && stage.estado_pago !== 'pagado') {
      toast({
        title: 'Pago pendiente',
        description: 'Debes registrar el pago de esta etapa antes de marcarla como completada.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setProcessingStage(stage.id);
      const result = await completeStage(stage.id);
      
      if (result.success) {
        toast({
          title: 'Etapa completada',
          description: 'La etapa ha sido marcada como completada',
        });
        await loadStages();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al completar la etapa',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error completing stage:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al completar la etapa',
        variant: 'destructive',
      });
    } finally {
      setProcessingStage(null);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta etapa?')) {
      return;
    }

    try {
      const result = await deleteStage(stageId);
      
      if (result.success) {
        toast({
          title: 'Etapa eliminada',
          description: 'La etapa ha sido eliminada exitosamente',
        });
        await loadStages();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al eliminar la etapa',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting stage:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al eliminar la etapa',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'completado':
        return <CheckCircle className='h-5 w-5 text-green-600' />;
      case 'en_proceso':
        return <Clock className='h-5 w-5 text-blue-600' />;
      default:
        return <Circle className='h-5 w-5 text-gray-400' />;
    }
  };

  const getStatusBadge = (estado: string) => {
    const status = STAGE_STATUSES.find(s => s.value === estado);
    if (!status) return null;

    const colorClasses = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[status.color as keyof typeof colorClasses]}`}>
        {status.label}
      </span>
    );
  };

  const formatUf = (value?: number | null) => {
    if (value === undefined || value === null) return '—';
    return `${new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)} UF`;
  };

  const getPaymentStatusBadge = (estado: string | null) => {
    if (!estado) return null;
    const status = STAGE_PAYMENT_STATUSES.find((s) => s.value === estado);
    if (!status) return null;

    const colorMap: Record<string, string> = {
      gray: 'bg-gray-100 text-gray-800',
      amber: 'bg-amber-100 text-amber-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
    };

    const color = colorMap[status.color] || 'bg-gray-100 text-gray-800';

    return <Badge className={color} variant="outline">{status.label}</Badge>;
  };

  const handleAssignPaymentLink = async (stage: CaseStage) => {
    const current = stage.enlace_pago ?? '';
    const input = prompt('Ingresa el enlace de pago de Payku para esta etapa', current);
    if (input === null) return;

    const trimmed = input.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast({
        title: 'URL inválida',
        description: 'Ingresa una URL válida que comience con http:// o https://',
        variant: 'destructive',
      });
      return;
    }

    try {
      setPaymentActionStage(stage.id);
      const result = await updateStage(stage.id, {
        enlace_pago: trimmed || undefined,
        requiere_pago: trimmed ? true : stage.requiere_pago,
      });
      if (!result.success) {
        toast({
          title: 'No se pudo guardar el enlace',
          description: result.error || 'Intenta nuevamente.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: trimmed ? 'Enlace de pago actualizado' : 'Enlace eliminado',
          description: trimmed
            ? 'Comparte este enlace con el cliente para cobrar la etapa.'
            : 'Se eliminó el enlace asociado a la etapa.',
        });
        await loadStages();
      }
    } catch (error) {
      console.error('Error setting payment link:', error);
      toast({
        title: 'Error inesperado',
        description: 'No pudimos guardar el enlace en este momento.',
        variant: 'destructive',
      });
    } finally {
      setPaymentActionStage(null);
    }
  };

  const handleRegisterPartialPayment = async (stage: CaseStage) => {
    const inspiration = stage.monto_pagado_uf ?? (stage.costo_uf ?? 0);
    const promptValue =
      inspiration > 0 ? inspiration.toString() : stage.costo_uf?.toString() ?? '';
    const input = prompt('Monto pagado (UF)', promptValue);
    if (input === null) return;
    const parsed = Number(input.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed < 0) {
      toast({
        title: 'Monto inválido',
        description: 'Ingresa un número válido en UF.',
        variant: 'destructive',
      });
      return;
    }

    const expected = stage.costo_uf ?? 0;
    const estado_pago = expected > 0 && parsed >= expected ? 'pagado' : 'parcial';

    try {
      setPaymentActionStage(stage.id);
      const result = await updateStage(stage.id, {
        estado_pago,
        monto_pagado_uf: parsed,
        requiere_pago: true,
      });
      if (!result.success) {
        toast({
          title: 'No se pudo registrar el pago',
          description: result.error || 'Vuelve a intentarlo.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Pago registrado',
          description:
            estado_pago === 'pagado'
              ? 'La etapa quedó marcada como pagada.'
              : 'Se registró un pago parcial.',
        });
        await loadStages();
      }
    } catch (error) {
      console.error('Error setting payment status:', error);
      toast({
        title: 'Error inesperado',
        description: 'No pudimos registrar el pago.',
        variant: 'destructive',
      });
    } finally {
      setPaymentActionStage(null);
    }
  };

  const handleMarkStagePaid = async (stage: CaseStage) => {
    if (stage.costo_uf && stage.monto_pagado_uf && stage.monto_pagado_uf < stage.costo_uf) {
      const confirmFull = confirm(
        'El monto registrado como pagado es menor al costo de la etapa. ¿Deseas marcarla como pagada de todas maneras?'
      );
      if (!confirmFull) return;
    }

    try {
      setPaymentActionStage(stage.id);
      const result = await updateStage(stage.id, {
        estado_pago: 'pagado',
        monto_pagado_uf: stage.costo_uf ?? stage.monto_pagado_uf ?? 0,
        requiere_pago: true,
      });
      if (!result.success) {
        toast({
          title: 'No se pudo marcar como pagado',
          description: result.error || 'Intenta nuevamente.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Pago completado',
          description: 'Esta etapa quedó marcada como pagada.',
        });
        await loadStages();
      }
    } catch (error) {
      console.error('Error marking stage paid:', error);
      toast({
        title: 'Error inesperado',
        description: 'No fue posible marcar la etapa como pagada.',
        variant: 'destructive',
      });
    } finally {
      setPaymentActionStage(null);
    }
  };

  const filteredStages = showPrivateStages 
    ? stages 
    : stages.filter(stage => stage.es_publica);

  const stageTemplates = getStageTemplatesByMateria(caseMateria);
  const totalCostoEtapas = stages.reduce((sum, stage) => sum + (stage.costo_uf ?? 0), 0);
  const totalPagadoEtapas = stages.reduce((sum, stage) => sum + (stage.monto_pagado_uf ?? 0), 0);
  const etapasRequierenPago = stages.filter((stage) => stage.requiere_pago);
  const etapasPagadas = etapasRequierenPago.filter((stage) => stage.estado_pago === 'pagado').length;
  const etapasPendientesPago = etapasRequierenPago.filter(
    (stage) => stage.estado_pago !== 'pagado'
  ).length;

  useEffect(() => {
    if (showAddForm && etapasRequierenPago.length > 0) {
      setNewStage((prev) => ({ ...prev, requiere_pago: true }));
    }
  }, [showAddForm, etapasRequierenPago.length]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Clock className='h-5 w-5' />
            Timeline Procesal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-6 w-6 animate-spin' />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='flex items-center gap-2'>
            <Clock className='h-5 w-5' />
            Timeline Procesal ({filteredStages.length})
          </CardTitle>
          {canManageStages && (
            <Button
              size='sm'
              onClick={() => setShowAddForm(!showAddForm)}
              disabled={isCreating}
            >
              <Plus className='h-4 w-4 mr-2' />
              Nueva Etapa
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-6'>
        {etapasRequierenPago.length > 0 && (
          <div className='grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900'>
            <div>
              <p className='text-xs uppercase tracking-wide text-blue-600'>Honorario distribuido</p>
              <p className='text-lg font-semibold'>{formatUf(totalCostoEtapas)}</p>
            </div>
            <div>
              <p className='text-xs uppercase tracking-wide text-blue-600'>Pagado</p>
              <p className='text-lg font-semibold'>{formatUf(totalPagadoEtapas)}</p>
            </div>
            <div>
              <p className='text-xs uppercase tracking-wide text-blue-600'>Etapas liberadas</p>
              <p className='text-lg font-semibold'>{etapasPagadas} / {etapasRequierenPago.length}</p>
              {etapasPendientesPago > 0 && (
                <p className='text-xs text-blue-700 mt-1'>Faltan {etapasPendientesPago} pago(s) para completar el plan.</p>
              )}
            </div>
          </div>
        )}

        {/* Formulario para nueva etapa */}
        {showAddForm && canManageStages && (
          <Card className='border-dashed'>
            <CardContent className='pt-6'>
              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Etapa
                  </label>
                  <select
                    value={newStage.isCustom ? 'custom' : newStage.etapa}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'custom') {
                        setNewStage({ ...newStage, etapa: '', descripcion: '', isCustom: true });
                        return;
                      }

                      const template = stageTemplates.find(stage => stage.etapa === value);
                      setNewStage({
                        ...newStage,
                        etapa: value,
                        descripcion: template?.descripcion || newStage.descripcion,
                        isCustom: false,
                        requiere_pago: template?.requierePago ?? newStage.requiere_pago,
                        costo_uf: template?.costoUF !== undefined ? template.costoUF.toString() : '',
                        porcentaje_variable:
                          template?.porcentajeVariable !== undefined
                            ? template.porcentajeVariable.toString()
                            : '',
                        monto_variable_base: template?.notasPago || '',
                        estado_pago: 'pendiente',
                        notas_pago: template?.notasPago || '',
                      });
                    }}
                    className='form-input'
                  >
                    <option value=''>Seleccionar etapa</option>
                    {stageTemplates.map(stage => (
                      <option key={stage.etapa} value={stage.etapa}>
                        {stage.etapa} {stage.diasEstimados ? `(≈ ${stage.diasEstimados} días)` : ''}
                      </option>
                    ))}
                    <option value='custom'>Etapa personalizada...</option>
                  </select>
                  {newStage.isCustom && (
                    <input
                      type='text'
                      placeholder='Nombre de la etapa personalizada'
                      value={newStage.etapa}
                      onChange={(e) => setNewStage({ ...newStage, etapa: e.target.value })}
                      className='form-input mt-2'
                    />
                  )}
                </div>
                
                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={newStage.descripcion}
                    onChange={(e) => setNewStage({ ...newStage, descripcion: e.target.value })}
                    placeholder='Descripción de la etapa...'
                    rows={3}
                    className='form-input'
                  />
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium mb-2'>
                      Fecha programada (opcional)
                    </label>
                    <input
                      type='date'
                      value={newStage.fecha_programada}
                      onChange={(e) => setNewStage({ ...newStage, fecha_programada: e.target.value })}
                      className='form-input'
                    />
                  </div>

                  <div>
                    <label className='block text-sm font-medium mb-2'>
                      Visibilidad
                    </label>
                    <select
                      value={newStage.es_publica ? 'publica' : 'privada'}
                      onChange={(e) => setNewStage({ ...newStage, es_publica: e.target.value === 'publica' })}
                      className='form-input'
                    >
                      <option value='publica'>Pública (visible para cliente)</option>
                      <option value='privada'>Privada (solo abogados)</option>
                    </select>
                  </div>
                </div>

                <div className='space-y-4 border-t border-gray-200 pt-4'>
                  <label className='flex items-center gap-2 text-sm font-medium text-gray-700'>
                    <input
                      type='checkbox'
                      className='rounded border-gray-300'
                      checked={newStage.requiere_pago}
                      onChange={(e) =>
                        setNewStage({
                          ...newStage,
                          requiere_pago: e.target.checked,
                          estado_pago: 'pendiente',
                        })
                      }
                    />
                    Esta etapa requiere pago para avanzar
                  </label>

                  {newStage.requiere_pago && (
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                      <div className='space-y-2'>
                        <label className='block text-sm font-medium'>Monto fijo (UF)</label>
                        <input
                          type='number'
                          min='0'
                          step='0.01'
                          value={newStage.costo_uf}
                          onChange={(e) => setNewStage({ ...newStage, costo_uf: e.target.value })}
                          className='form-input'
                          placeholder='Ej: 5.0'
                        />
                      </div>
                      <div className='space-y-2'>
                        <label className='block text-sm font-medium'>Componente variable (%)</label>
                        <input
                          type='number'
                          min='0'
                          max='100'
                          step='0.1'
                          value={newStage.porcentaje_variable}
                          onChange={(e) => setNewStage({ ...newStage, porcentaje_variable: e.target.value })}
                          className='form-input'
                          placeholder='Ej: 10'
                        />
                      </div>
                      <div className='md:col-span-2 space-y-2'>
                        <label className='block text-sm font-medium'>Base del variable</label>
                        <textarea
                          rows={2}
                          value={newStage.monto_variable_base}
                          onChange={(e) => setNewStage({ ...newStage, monto_variable_base: e.target.value })}
                          className='form-input'
                          placeholder='Ej: 10% de lo obtenido o ahorrado.'
                        />
                      </div>
                      <div className='space-y-2'>
                        <label className='block text-sm font-medium'>Link de pago (Payku)</label>
                        <input
                          type='url'
                          value={newStage.enlace_pago}
                          onChange={(e) => setNewStage({ ...newStage, enlace_pago: e.target.value })}
                          className='form-input'
                          placeholder='https://...'
                        />
                      </div>
                      <div className='space-y-2'>
                        <label className='block text-sm font-medium'>Notas internas</label>
                        <textarea
                          rows={2}
                          value={newStage.notas_pago}
                          onChange={(e) => setNewStage({ ...newStage, notas_pago: e.target.value })}
                          className='form-input'
                          placeholder='Instrucciones u observaciones sobre el cobro.'
                        />
                      </div>
                      <div className='space-y-2'>
                        <label className='block text-sm font-medium'>Estado inicial del pago</label>
                        <select
                          value={newStage.estado_pago}
                          onChange={(e) =>
                            setNewStage({ ...newStage, estado_pago: e.target.value as CreateStageInput['estado_pago'] })
                          }
                          className='form-input'
                        >
                          {STAGE_PAYMENT_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className='space-y-2'>
                        <label className='block text-sm font-medium'>Monto ya pagado (UF)</label>
                        <input
                          type='number'
                          min='0'
                          step='0.01'
                          value={newStage.monto_pagado_uf}
                          onChange={(e) => setNewStage({ ...newStage, monto_pagado_uf: e.target.value })}
                          className='form-input'
                          placeholder='0.00'
                        />
                      </div>
                    </div>
                  )}

                  <div className='flex justify-end space-x-2'>
                    <Button
                      variant='outline'
                      onClick={() => {
                        setShowAddForm(false);
                        setNewStage({
                          etapa: '',
                          descripcion: '',
                          fecha_programada: '',
                          es_publica: true,
                          isCustom: false,
                          requiere_pago: false,
                          costo_uf: '',
                          porcentaje_variable: '',
                          enlace_pago: '',
                          notas_pago: '',
                          monto_variable_base: '',
                          estado_pago: 'pendiente',
                          monto_pagado_uf: '',
                        });
                      }}
                      disabled={isCreating}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateStage} disabled={isCreating}>
                      {isCreating ? (
                        <>
                          <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                          Creando...
                        </>
                      ) : (
                        'Crear Etapa'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline de etapas */}
        <div className='relative'>
          {filteredStages.map((stage, index) => {
            const stageResponsable = (stage as { responsable?: { nombre?: string | null } | null }).responsable;

            return (
              <div key={stage.id} className='relative flex items-start space-x-4 pb-8'>
              {/* Línea vertical */}
              {index < filteredStages.length - 1 && (
                <div className='absolute left-2.5 top-8 w-0.5 h-full bg-gray-200' />
              )}
              
              {/* Icono de estado */}
              <div className='relative z-10 flex-shrink-0'>
                {getStatusIcon(stage.estado || 'pendiente')}
              </div>

              {/* Contenido de la etapa */}
              <div className='flex-1 min-w-0'>
                <Card className={`${stage.estado === 'completado' ? 'bg-green-50' : ''}`}>
                  <CardContent className='pt-4'>
                    <div className='flex items-start justify-between mb-3'>
                      <div className='flex-1'>
                        <h4 className='font-medium text-gray-900'>
                          {stage.etapa}
                        </h4>
                        {stage.descripcion && (
                          <p className='text-sm text-gray-600 mt-1'>
                            {stage.descripcion}
                          </p>
                        )}
                      </div>
                      
                      <div className='flex items-center gap-2 ml-4'>
                        {getStatusBadge(stage.estado || 'pendiente')}
                        {!stage.es_publica && (
                          <Badge variant='outline'>Privada</Badge>
                        )}
                      </div>
                    </div>

                    <div className='flex items-center gap-4 text-sm text-gray-500 mb-3'>
                      {stage.fecha_programada && (
                        <div className='flex items-center gap-1'>
                          <Calendar className='h-4 w-4' />
                          <span className={isDateInPast(stage.fecha_programada) && stage.estado !== 'completado' ? 'text-red-600 font-medium' : ''}>
                            {formatDate(stage.fecha_programada)}
                          </span>
                        </div>
                      )}
                      
                      {stageResponsable?.nombre && (
                        <div className='flex items-center gap-1'>
                          <User className='h-4 w-4' />
                          <span>{stageResponsable.nombre}</span>
                        </div>
                      )}

                      {stage.fecha_cumplida && (
                        <div className='text-green-600'>
                          Completado {formatRelativeTime(stage.fecha_cumplida)}
                        </div>
                      )}
                    </div>

                    {stage.requiere_pago && (
                      <div className='mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm space-y-2 text-amber-900'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                          <div className='flex items-center gap-2 font-semibold'>
                            <DollarSign className='h-4 w-4' />
                            <span>Costo de la etapa:</span>
                            <span>{formatUf(stage.costo_uf)}</span>
                          </div>
                          {getPaymentStatusBadge(stage.estado_pago || 'pendiente')}
                        </div>

                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 text-amber-800'>
                          <div className='flex items-center gap-2'>
                            <PiggyBank className='h-4 w-4' />
                            <span>Pagado: {formatUf(stage.monto_pagado_uf)}</span>
                          </div>
                          {stage.porcentaje_variable && (
                            <div className='flex items-center gap-2'>
                              <Wallet className='h-4 w-4' />
                              <span>
                                Variable: {stage.porcentaje_variable}% {stage.monto_variable_base ? `(${stage.monto_variable_base})` : ''}
                              </span>
                            </div>
                          )}
                        </div>

                        {stage.notas_pago && (
                          <p className='text-xs text-amber-700 bg-white/60 border border-amber-200 rounded-md px-3 py-2'>
                            {stage.notas_pago}
                          </p>
                        )}

                        <div className='flex flex-wrap items-center gap-2'>
                          {stage.enlace_pago && (
                            <Button size='sm' variant='outline' asChild>
                              <a href={stage.enlace_pago} target='_blank' rel='noopener noreferrer'>
                                <ExternalLink className='h-4 w-4 mr-2' />
                                Abrir enlace Payku
                              </a>
                            </Button>
                          )}
                          {canManageStages && (
                            <>
                          <Button
                            size='sm'
                            variant='ghost'
                            onClick={() => handleAssignPaymentLink(stage)}
                            disabled={paymentActionStage === stage.id}
                          >
                            {paymentActionStage === stage.id ? (
                              <>
                                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                Guardando…
                              </>
                            ) : (
                              <>
                                <Link2 className='h-4 w-4 mr-2' />
                                {stage.enlace_pago ? 'Editar enlace' : 'Asignar enlace'}
                              </>
                            )}
                          </Button>
                          <Button
                            size='sm'
                            variant='ghost'
                            onClick={() => handleRegisterPartialPayment(stage)}
                            disabled={paymentActionStage === stage.id}
                          >
                            {paymentActionStage === stage.id ? (
                              <>
                                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                Registrando…
                              </>
                            ) : (
                              <>
                                <PiggyBank className='h-4 w-4 mr-2' />
                                Registrar pago
                              </>
                            )}
                          </Button>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => handleMarkStagePaid(stage)}
                            disabled={paymentActionStage === stage.id}
                          >
                            {paymentActionStage === stage.id ? (
                              <>
                                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                Confirmando…
                              </>
                            ) : (
                              <>
                                <Wallet className='h-4 w-4 mr-2' />
                                Marcar pagado
                              </>
                            )}
                          </Button>
                            </>
                          )}
                        </div>

                        {stage.estado_pago !== 'pagado' && stage.enlace_pago && (
                          <p className='text-xs text-amber-700 flex items-center gap-1'>
                            <AlertCircle className='h-3 w-3' />
                            Comparte el enlace con el cliente para liberar esta etapa.
                          </p>
                        )}
                      </div>
                    )}

                    {canManageStages && (
                      <div className='flex items-center gap-2'>
                        {stage.estado !== 'completado' && (
                          <Button
                            size='sm'
                            variant='outline'
                          onClick={() => handleCompleteStage(stage)}
                          disabled={
                            processingStage === stage.id ||
                            (stage.requiere_pago && stage.estado_pago !== 'pagado')
                          }
                          >
                            {processingStage === stage.id ? (
                              <>
                                <Loader2 className='h-4 w-4 mr-1 animate-spin' />
                                Procesando…
                              </>
                            ) : (
                              <>
                                <CheckCircle className='h-4 w-4 mr-1' />
                                Completar
                              </>
                            )}
                          </Button>
                        )}
                        
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() => setEditingStage(stage.id)}
                        >
                          <Edit className='h-4 w-4' />
                        </Button>
                        
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() => handleDeleteStage(stage.id)}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
            );
          })}
        </div>

        {filteredStages.length === 0 && (
          <div className='text-center py-8 text-gray-500'>
            <Clock className='h-12 w-12 mx-auto mb-4 text-gray-300' />
            <p>No hay etapas definidas para este caso</p>
            {canManageStages && (
              <p className='text-sm mt-2'>
                Haz clic en "Nueva Etapa" para agregar la primera etapa
              </p>
            )}
          </div>
        )}

        {stageTemplates.length > 0 && (
          <div className='border-t pt-4 mt-2'>
            <h3 className='text-sm font-semibold text-gray-700'>Plan estimado de referencia para materia {caseMateria || 'Civil'}</h3>
            <p className='text-xs text-gray-500 mt-1'>Duraciones aproximadas en días a partir del inicio del caso.</p>
            <ul className='mt-3 space-y-2 text-sm text-gray-600'>
              {stageTemplates.map((template, idx) => (
                <li key={`${template.etapa}-${idx}`} className='flex items-start gap-2'>
                  <span className='mt-1 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0' />
                  <span>
                    <span className='font-medium text-gray-800'>{template.etapa}</span>
                    <span className='block text-gray-500'>
                      {template.descripcion}
                      {template.diasEstimados ? ` · ≈ ${template.diasEstimados} días` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
