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
import { cn, formatDate, isDateInPast } from '@/lib/utils';
import { 
  Clock, 
  CheckCircle, 
  Circle, 
  Plus, 
  Trash2, 
  Gavel,
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
import { STAGE_STATUSES, STAGE_PAYMENT_STATUSES, STAGE_AUDIENCE_TYPES, getStageTemplatesByMateria } from '@/lib/validators/stages';

interface TimelinePanelProps {
  caseId: string;
  caseMateria?: string;
  canManageStages?: boolean;
  showPrivateStages?: boolean;
  // Si es false, la UI del timeline NO debe mostrar información ni acciones de cobro/pagos.
  // La gestión de cobros se mueve a la sección /billing.
  showBillingSection?: boolean;
  clientContext?: {
    role: 'admin_firma' | 'analista' | 'abogado' | 'cliente';
    alcanceAutorizado: number;
    alcanceSolicitado: number;
  };
  onClientProgressChange?: (progress: Partial<{ solicitado: number; autorizado: number }>) => void;
  onStagesLoaded?: (stages: CaseStage[]) => void;
}

type DraftStageState = {
  etapa: string;
  descripcion: string;
  fecha_programada: string;
  es_publica: boolean;
  isCustom: boolean;
  audiencia_tipo: '' | NonNullable<CreateStageInput['audiencia_tipo']>;
  requiere_testigos: boolean;
};

export function TimelinePanel({
  caseId,
  caseMateria = 'Civil',
  canManageStages = false,
  showPrivateStages = true,
  showBillingSection = false,
  clientContext,
  onClientProgressChange,
  onStagesLoaded,
}: TimelinePanelProps) {
  const [stages, setStages] = useState<CaseStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStage, setNewStage] = useState<DraftStageState>({
    etapa: '',
    descripcion: '',
    fecha_programada: '',
    es_publica: true,
    isCustom: false,
    audiencia_tipo: '',
    requiere_testigos: false,
  });
  const { toast } = useToast();
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [paymentActionStage, setPaymentActionStage] = useState<string | null>(null);
  const alcanceAutorizado = clientContext?.alcanceAutorizado ?? 0;
  const alcanceSolicitado = clientContext?.alcanceSolicitado ?? 0;
  const viewerRole = clientContext?.role ?? 'cliente';
  const clientMode = viewerRole === 'cliente';
  const [clientProgress, setClientProgress] = useState({
    solicitado: alcanceSolicitado,
    autorizado: alcanceAutorizado,
  });
  const [activeSection, setActiveSection] = useState<'proceso' | 'cobro'>('proceso');
  const [hasInitializedSection, setHasInitializedSection] = useState(false);

  const loadStages = async () => {
    setIsLoading(true);
    try {
      const result = await getStages({ case_id: caseId, page: 1, limit: 50 });
      
      if (result.success) {
        setStages(result.stages);
        onStagesLoaded?.(result.stages);
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

  useEffect(() => {
    setHasInitializedSection(false);
    setActiveSection('proceso');
  }, [caseId]);

  useEffect(() => {
    setClientProgress({
      solicitado: alcanceSolicitado,
      autorizado: alcanceAutorizado,
    });
  }, [alcanceSolicitado, alcanceAutorizado]);

  useEffect(() => {
    if (!onClientProgressChange) return;
    if (
      clientProgress.autorizado !== alcanceAutorizado ||
      clientProgress.solicitado !== alcanceSolicitado
    ) {
      onClientProgressChange(clientProgress);
    }
  }, [clientProgress, onClientProgressChange, alcanceAutorizado, alcanceSolicitado]);

  const handleCreateStage = async () => {
    if (!newStage.etapa.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre de la etapa es requerido',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const maxOrden = Math.max(...stages.map(s => s.orden || 0), 0);

      const audienciaTipo = newStage.audiencia_tipo
        ? (newStage.audiencia_tipo as NonNullable<CreateStageInput['audiencia_tipo']>)
        : undefined;

      const stageData: CreateStageInput = {
        case_id: caseId,
        etapa: newStage.etapa.trim(),
        descripcion: newStage.descripcion.trim() || undefined,
        fecha_programada: newStage.fecha_programada || undefined,
        es_publica: newStage.es_publica,
        estado: 'pendiente',
        orden: maxOrden + 1,
        audiencia_tipo: audienciaTipo,
        requiere_testigos: newStage.requiere_testigos,
        requiere_pago: false,
        estado_pago: 'pendiente',
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
          audiencia_tipo: '',
          requiere_testigos: false,
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
        title: 'Gestión pendiente en Cobros',
        description: 'Esta etapa tiene un cobro pendiente. Registra el pago en Cobros para poder completarla.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setProcessingStage(stage.id);
      const normalize = (value: string) =>
        value
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
      const stageName = normalize(stage.etapa ?? '');
      const shouldAskDate =
        Boolean(stage.audiencia_tipo) || stageName.includes('audiencia') || stageName.includes('notific');

      const today = new Date().toISOString().split('T')[0]!;
      const suggested = stage.fecha_programada ?? today;

      const completionDate = shouldAskDate
        ? (() => {
            const input = prompt(
              stageName.includes('audiencia')
                ? 'Fecha en que se realizó la audiencia (YYYY-MM-DD)'
                : stageName.includes('notific')
                  ? 'Fecha en que se realizó la notificación (YYYY-MM-DD)'
                  : 'Fecha de cumplimiento de la etapa (YYYY-MM-DD)',
              suggested,
            );
            if (input === null) return null;
            const trimmed = input.trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
              toast({
                title: 'Fecha inválida',
                description: 'Usa el formato YYYY-MM-DD.',
                variant: 'destructive',
              });
              return null;
            }
            return trimmed;
          })()
        : today;

      if (completionDate === null) {
        setProcessingStage(null);
        return;
      }

      const result = await completeStage(stage.id, { fecha_completada: completionDate });
      
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
        return <CheckCircle className='h-5 w-5 text-emerald-500' />;
      case 'en_proceso':
        return <Clock className='h-5 w-5 text-sky-500' />;
      default:
        return <Circle className='h-5 w-5 text-foreground/35' />;
    }
  };

  const getStatusBadge = (estado: string) => {
    const status = STAGE_STATUSES.find(s => s.value === estado);
    if (!status) return null;

    const tone: Record<string, string> = {
      gray: 'border-white/25 bg-white/50 text-foreground/60',
      blue: 'border-sky-200/50 bg-sky-500/15 text-sky-600',
      green: 'border-emerald-200/50 bg-emerald-500/15 text-emerald-600',
      red: 'border-rose-200/50 bg-rose-500/15 text-rose-600',
    };

    return (
      <Badge
        variant="outline"
        className={cn(
          'px-3 py-1 text-xs font-medium tracking-wide',
          tone[status.color] ?? tone.gray
        )}
      >
        {status.label}
      </Badge>
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

    const tone: Record<string, string> = {
      gray: 'border-white/25 bg-white/50 text-foreground/60',
      amber: 'border-amber-200/60 bg-amber-400/20 text-amber-700',
      blue: 'border-sky-200/60 bg-sky-500/15 text-sky-600',
      green: 'border-emerald-200/60 bg-emerald-500/15 text-emerald-600',
      red: 'border-rose-200/60 bg-rose-500/15 text-rose-600',
    };

    return (
      <Badge
        variant="outline"
        className={cn(
          'px-3 py-1 text-xs font-medium tracking-wide',
          tone[status.color] ?? tone.gray
        )}
      >
        {status.label}
      </Badge>
    );
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

  const handleEditStageCost = async (stage: CaseStage) => {
    const current = stage.costo_uf ?? null;
    const input = prompt('Costo de la etapa (UF)', current !== null ? String(current) : '');
    if (input === null) return;

    const parsed = Number(input.trim().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast({
        title: 'Monto inválido',
        description: 'Ingresa un número válido (UF) mayor o igual a 0.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setPaymentActionStage(stage.id);
      const result = await updateStage(stage.id, {
        costo_uf: parsed,
        requiere_pago: true,
      });
      if (!result.success) {
        toast({
          title: 'No se pudo actualizar el costo',
          description: result.error || 'Intenta nuevamente.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Costo actualizado',
          description: `Nuevo costo: ${formatUf(parsed)}.`,
        });
        await loadStages();
      }
    } catch (error) {
      console.error('Error updating stage cost:', error);
      toast({
        title: 'Error inesperado',
        description: 'No pudimos actualizar el costo.',
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
  const etapasCobroOrdenadas = [...etapasRequierenPago].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const showPaymentTimeline = showBillingSection && etapasCobroOrdenadas.length > 0;
  const etapasPagadas = etapasRequierenPago.filter((stage) => stage.estado_pago === 'pagado').length;

  const findStageLabelByOrder = (order: number) => {
    if (!order) return null;
    const match = stages.find((stage) => (stage.orden ?? 0) === order);
    return match?.etapa ?? null;
  };

  const requestedStageLabel = clientMode ? findStageLabelByOrder(clientProgress.solicitado) : null;
  const authorizedStageLabel = clientMode ? findStageLabelByOrder(clientProgress.autorizado) : null;

  useEffect(() => {
    if (isLoading || hasInitializedSection) return;
    setActiveSection(showPaymentTimeline ? 'cobro' : 'proceso');
    setHasInitializedSection(true);
  }, [hasInitializedSection, isLoading, showPaymentTimeline]);

  useEffect(() => {
    if (!showPaymentTimeline && activeSection === 'cobro') {
      setActiveSection('proceso');
    }
  }, [activeSection, showPaymentTimeline]);

	  if (isLoading) {
	    return (
	      <Card className='w-full shadow-[0_30px_60px_-35px_rgba(15,23,42,0.45)]'>
	        <CardHeader>
	          <CardTitle className='flex items-center gap-2'>
	            <Clock className='h-5 w-5' />
	            Timeline
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
	    <Card className='w-full shadow-[0_30px_60px_-35px_rgba(15,23,42,0.45)] lg:col-span-full'>
		      <CardHeader>
		        <div className='flex items-center justify-between'>
		          <CardTitle className='flex items-center gap-2'>
		            <Clock className='h-5 w-5' />
		            {`Timeline Procesal (${filteredStages.length})`}
		          </CardTitle>
		          <div className='flex items-center gap-2'>
		            {showBillingSection && showPaymentTimeline && (
		              <>
		                <Button
		                  size='sm'
		                  variant={activeSection === 'proceso' ? 'default' : 'outline'}
	                  className='rounded-full px-4'
	                  onClick={() => setActiveSection('proceso')}
	                >
	                  Procesal
	                </Button>
		                <Button
		                  size='sm'
		                  variant={activeSection === 'cobro' ? 'default' : 'outline'}
		                  className='rounded-full px-4'
		                  onClick={() => setActiveSection('cobro')}
		                >
		                  Cobro
		                </Button>
		              </>
		            )}
	            {activeSection === 'proceso' && canManageStages && (
	              <Button
	                size='sm'
	                className='rounded-full px-4'
	                onClick={() => setShowAddForm(!showAddForm)}
	                disabled={isCreating}
	              >
	                <Plus className='h-4 w-4 mr-2' />
	                Nueva Etapa
	              </Button>
	            )}
	          </div>
	        </div>
      </CardHeader>
      <CardContent className='space-y-6'>
	        {activeSection === 'proceso' && clientMode && (
	          <div className="grid gap-4 sm:grid-cols-3">
	            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 shadow-sm">
	              <p className="text-sm font-medium text-slate-500">Alcance solicitado</p>
	              <p className="mt-3 text-base font-semibold text-slate-900">
	                {clientProgress.solicitado > 0
	                  ? requestedStageLabel ?? `Etapa ${clientProgress.solicitado}`
	                  : 'Aún no definido'}
	              </p>
	            </div>
	            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 shadow-sm">
	              <p className="text-sm font-medium text-slate-500">Autorizado por el estudio</p>
	              <p className="mt-3 text-base font-semibold text-slate-900">
	                {clientProgress.autorizado > 0
	                  ? authorizedStageLabel ?? `Etapa ${clientProgress.autorizado}`
	                  : 'Pendiente'}
	              </p>
	            </div>
	          </div>
	        )}

        {showBillingSection && activeSection === 'cobro' && etapasCobroOrdenadas.length > 0 && (
          <div className='rounded-3xl border border-white/40 bg-white/70 p-6 shadow-inner'>
            <div className='flex flex-wrap items-end justify-between gap-3'>
              <div>
                <h3 className='text-sm font-semibold text-foreground/70'>Etapas de cobro</h3>
                <p className='mt-1 text-xs text-foreground/50'>Timeline de pagos por etapa (más fácil de revisar).</p>
              </div>
              <div className='text-xs text-foreground/50 text-right'>
                <div>{etapasPagadas} / {etapasCobroOrdenadas.length} pagadas</div>
                <div>Total {formatUf(totalCostoEtapas)} · Pagado {formatUf(totalPagadoEtapas)}</div>
              </div>
            </div>

            <ol className='relative mt-5 space-y-4 border-l border-white/50 pl-6'>
              {etapasCobroOrdenadas.map((stage) => {
                const statusBadge = getPaymentStatusBadge(stage.estado_pago ?? 'pendiente');
                const icon = (() => {
                  if (stage.estado_pago === 'pagado') return <CheckCircle className='h-4 w-4 text-emerald-600' />;
                  if (stage.estado_pago === 'solicitado') return <PiggyBank className='h-4 w-4 text-sky-600' />;
                  if (stage.enlace_pago) return <Link2 className='h-4 w-4 text-amber-700' />;
                  return <DollarSign className='h-4 w-4 text-foreground/60' />;
                })();

                const canEditPayments = canManageStages && viewerRole !== 'cliente';
                const busy = paymentActionStage === stage.id;

                return (
                  <li key={stage.id} className='relative'>
                    <span className='absolute -left-[13px] top-4 flex h-7 w-7 items-center justify-center rounded-2xl border border-white/60 bg-white/90 shadow-sm'>
                      {icon}
                    </span>
                    <div className='rounded-2xl border border-white/40 bg-white/80 px-4 py-3 shadow-sm'>
                      <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div className='min-w-0'>
                          <p className='text-sm font-semibold text-foreground'>{stage.etapa}</p>
                          <div className='mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/55'>
                            {typeof stage.orden === 'number' && stage.orden > 0 && <span>Orden {stage.orden}</span>}
                            {stage.costo_uf !== null && stage.costo_uf !== undefined && <span>Costo {formatUf(stage.costo_uf)}</span>}
                            {stage.monto_pagado_uf !== null && stage.monto_pagado_uf !== undefined && (
                              <span>Pagado {formatUf(stage.monto_pagado_uf)}</span>
                            )}
                            {stage.fecha_programada && <span>Programada {formatDate(stage.fecha_programada)}</span>}
                            {stage.fecha_cumplida && <span>Cumplida {formatDate(stage.fecha_cumplida)}</span>}
                          </div>
                        </div>
                        <div className='flex items-center gap-2'>
                          {statusBadge}
                        </div>
                      </div>

                      {(stage.enlace_pago || canEditPayments) && (
                        <div className='mt-3 flex flex-wrap items-center gap-2'>
                          {stage.enlace_pago && (
                            <a
                              href={stage.enlace_pago}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-medium text-foreground/70 hover:bg-white'
                            >
                              <ExternalLink className='h-3 w-3' />
                              Abrir Payku
                            </a>
                          )}
                          {canEditPayments && (
                            <>
                              <Button
                                size='sm'
                                variant='outline'
                                className='rounded-full px-3'
                                onClick={() => handleEditStageCost(stage)}
                                disabled={busy}
                              >
                                <DollarSign className='mr-2 h-4 w-4' />
                                Editar costo
                              </Button>
                              <Button
                                size='sm'
                                variant='outline'
                                className='rounded-full px-3'
                                onClick={() => handleAssignPaymentLink(stage)}
                                disabled={busy}
                              >
                                {busy ? (
                                  <>
                                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                    Guardando…
                                  </>
                                ) : (
                                  <>
                                    <Link2 className='mr-2 h-4 w-4' />
                                    {stage.enlace_pago ? 'Editar enlace' : 'Asignar enlace'}
                                  </>
                                )}
                              </Button>
                              {stage.estado_pago !== 'pagado' && (
                                <>
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    className='rounded-full px-3'
                                    onClick={() => handleRegisterPartialPayment(stage)}
                                    disabled={busy}
                                  >
                                    <Wallet className='mr-2 h-4 w-4' />
                                    Registrar abono
                                  </Button>
                                  <Button
                                    size='sm'
                                    className='rounded-full px-3'
                                    onClick={() => handleMarkStagePaid(stage)}
                                    disabled={busy}
                                  >
                                    <CheckCircle className='mr-2 h-4 w-4' />
                                    Marcar pagado
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Formulario para nueva etapa */}
        {activeSection === 'proceso' && showAddForm && canManageStages && (
          <Card className='border border-dashed border-white/40 bg-white/80 shadow-lg'>
            <CardContent className='pt-6'>
              <div className='space-y-5'>
                <div>
                  <label className='block text-[12px] font-semibold uppercase tracking-[0.28em] text-foreground/45 mb-2'>
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
	                      });
	                    }}
	                    className='input-field'
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
                      className='input-field mt-2'
                    />
                  )}
                </div>
                
                <div>
                  <label className='block text-[12px] font-semibold uppercase tracking-[0.28em] text-foreground/45 mb-2'>
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={newStage.descripcion}
                    onChange={(e) => setNewStage({ ...newStage, descripcion: e.target.value })}
                    placeholder='Descripción de la etapa...'
                    rows={3}
                    className='input-field min-h-[120px] resize-y'
                  />
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <label className='block text-[12px] font-semibold uppercase tracking-[0.28em] text-foreground/45'>
                      Tipo de audiencia
                    </label>
                    <select
                      value={newStage.audiencia_tipo}
                      onChange={(event) => {
                        const value = event.target.value as DraftStageState['audiencia_tipo'];
                        setNewStage((prev) => ({
                          ...prev,
                          audiencia_tipo: value,
                          requiere_testigos: value === '' ? false : prev.requiere_testigos,
                        }));
                      }}
                      className='input-field'
                    >
                      <option value=''>Sin audiencia definida</option>
                      {STAGE_AUDIENCE_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className='space-y-3'>
                    <label className='block text-[12px] font-semibold uppercase tracking-[0.28em] text-foreground/45'>
                      Participación de testigos
                    </label>
                    <label
                      className={cn(
                        'flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm transition-colors',
                        newStage.audiencia_tipo
                          ? 'border-white/40 bg-white/70 text-foreground/70'
                          : 'border-dashed border-white/40 bg-white/40 text-foreground/45'
                      )}
                    >
                      <input
                        type='checkbox'
                        className='rounded border-white/40'
                        checked={newStage.requiere_testigos}
                        disabled={!newStage.audiencia_tipo}
                        onChange={(event) =>
                          setNewStage({ ...newStage, requiere_testigos: event.target.checked })
                        }
                      />
                      Se coordinarán testigos para esta audiencia
                    </label>
                    <p className='text-xs text-foreground/50'>
                      Esta información ayuda al equipo a planificar con tiempo la asistencia.
                    </p>
                  </div>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-[12px] font-semibold uppercase tracking-[0.28em] text-foreground/45 mb-2'>
                      Fecha programada (opcional)
                    </label>
                    <input
                      type='date'
                      value={newStage.fecha_programada}
                      onChange={(e) => setNewStage({ ...newStage, fecha_programada: e.target.value })}
                      className='input-field'
                    />
                  </div>

                  <div>
                    <label className='block text-[12px] font-semibold uppercase tracking-[0.28em] text-foreground/45 mb-2'>
                      Visibilidad
                    </label>
                    <select
                      value={newStage.es_publica ? 'publica' : 'privada'}
                      onChange={(e) => setNewStage({ ...newStage, es_publica: e.target.value === 'publica' })}
                      className='input-field'
                    >
                      <option value='publica'>Pública (visible para cliente)</option>
                      <option value='privada'>Privada (solo abogados)</option>
                    </select>
                  </div>
                </div>

	                <div className='flex justify-end space-x-2'>
	                    <Button
	                      variant='outline'
	                      className='rounded-full px-4'
	                      onClick={() => {
	                        setShowAddForm(false);
	                        setNewStage({
	                          etapa: '',
	                          descripcion: '',
	                          fecha_programada: '',
	                          es_publica: true,
	                          isCustom: false,
	                          audiencia_tipo: '',
	                          requiere_testigos: false,
	                        });
	                      }}
	                      disabled={isCreating}
	                    >
                      Cancelar
                    </Button>
	                    <Button className='rounded-full px-5' onClick={handleCreateStage} disabled={isCreating}>
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
	            </CardContent>
	          </Card>
	        )}

        {activeSection === 'proceso' && (
          <>
        {/* Timeline de etapas */}
        <div className='space-y-4'>
          <div className='flex flex-wrap items-center justify-between gap-3 lg:items-end'>
            <p className='text-sm text-foreground/60'>
              Revisa el avance completo: arrastra en pantallas pequeñas o navega la grilla en escritorio.
            </p>
          </div>
          <div className='relative lg:rounded-3xl lg:border lg:border-white/40 lg:bg-white/60 lg:p-6 lg:shadow-inner'>
            {filteredStages.length > 0 && (
              <>
                <div className='pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white via-white/80 to-transparent lg:hidden' />
                <div className='pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white via-white/80 to-transparent lg:hidden' />
              </>
            )}
            <div className='flex gap-4 overflow-x-auto pb-4 pl-2 pr-10 scroll-smooth snap-x snap-mandatory sm:pl-4 sm:pr-14 lg:grid lg:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))] lg:gap-4 lg:overflow-visible lg:p-0 lg:snap-none'>
	              {filteredStages.map((stage, index) => {
	                const stageResponsable = (stage as { responsable?: { nombre?: string | null } | null }).responsable;
	                const stageOrder = stage.orden ?? index + 1;
	                const isAuthorizedStage = clientMode && stageOrder <= clientProgress.autorizado;
	                const isRequestedStage = clientMode && stageOrder <= clientProgress.solicitado && stageOrder > clientProgress.autorizado;
	                const isStageCompleted = stage.estado === 'completado';
                const cardStateClasses = cn(
                  'h-full border border-white/35 bg-white/80 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl',
                  isStageCompleted && 'border-emerald-200/70 bg-emerald-50/70',
                  !isStageCompleted && isAuthorizedStage && 'border-emerald-200/60 bg-emerald-50/45',
                  !isStageCompleted && !isAuthorizedStage && isRequestedStage && 'border-sky-200/60 bg-sky-50/45'
                );
	                const audienceLabel = stage.audiencia_tipo
	                  ? STAGE_AUDIENCE_TYPES.find((option) => option.value === stage.audiencia_tipo)?.label ??
	                    `Audiencia ${stage.audiencia_tipo}`
	                  : null;
	                const statusBadge = getStatusBadge(stage.estado || 'pendiente');

                return (
                  <div
                    key={stage.id}
                    className='snap-start shrink-0 basis-full min-w-[300px] sm:min-w-[320px] md:min-w-[360px] lg:min-w-0 lg:w-full'
                  >
                    <Card className={cardStateClasses}>
                      <CardContent className='flex h-full flex-col gap-5 p-6'>
                        <div className='flex flex-col gap-4'>
                          <div className='flex items-start justify-between gap-3'>
                            <div className='flex items-start gap-3'>
                              <div className='flex h-11 w-11 items-center justify-center rounded-2xl border border-white/40 bg-white/80 shadow-sm'>
                                {getStatusIcon(stage.estado || 'pendiente')}
                              </div>
                              <div>
                                <p className='text-[11px] uppercase tracking-[0.28em] text-foreground/45'>
                                  Etapa {stageOrder}
                                </p>
                                <h4 className='mt-1 text-lg font-semibold text-foreground tracking-tight'>
                                  {stage.etapa}
                                </h4>
                              </div>
                            </div>
	                            <div className='flex flex-col items-end gap-2'>
	                              {statusBadge}
	                              {!stage.es_publica && (
	                                <Badge variant='outline' className='px-3 py-1 text-xs text-foreground/55'>Privada</Badge>
	                              )}
	                            </div>
	                          </div>
                          {stage.descripcion && (
                            <p className='text-sm leading-relaxed text-foreground/65'>
                              {stage.descripcion}
                            </p>
                          )}
	                          {(audienceLabel ||
	                            stage.requiere_testigos ||
	                            stageResponsable ||
	                            stage.fecha_programada) && (
	                            <div className='grid grid-cols-1 gap-3 text-xs text-foreground/60 sm:grid-cols-2'>
                              {stage.fecha_programada && (
                                <div className='rounded-2xl border border-white/40 bg-white/70 px-3 py-2'>
                                  <p className='text-[10px] uppercase tracking-[0.22em] text-foreground/40'>
                                    Fecha programada
                                  </p>
                                  <p className='mt-1 text-sm font-medium text-foreground'>
                                    {formatDate(stage.fecha_programada)}
                                  </p>
                                  {isDateInPast(stage.fecha_programada) && stage.estado !== 'completado' && (
                                    <p className='mt-1 text-[11px] text-rose-500'>Revisar seguimiento</p>
                                  )}
                                </div>
                              )}
                              {stageResponsable && (
                                <div className='rounded-2xl border border-white/40 bg-white/70 px-3 py-2'>
                                  <p className='text-[10px] uppercase tracking-[0.22em] text-foreground/40'>
                                    Responsable
                                  </p>
                                  <p className='mt-1 text-sm font-medium text-foreground'>
                                    {stageResponsable.nombre ?? 'Por asignar'}
                                  </p>
                                </div>
                              )}
	                              {audienceLabel && (
	                                <div className='rounded-2xl border border-white/40 bg-white/70 px-3 py-2'>
                                  <p className='text-[10px] uppercase tracking-[0.22em] text-foreground/40'>
                                    Audiencia
                                  </p>
                                  <p className='mt-1 flex items-center gap-2 text-sm font-medium text-foreground'>
                                    <Gavel className='h-4 w-4 text-sky-500' />
                                    {audienceLabel}
                                  </p>
                                  {stage.requiere_testigos && (
                                    <p className='mt-1 text-xs text-foreground/55'>Con coordinación de testigos.</p>
                                  )}
	                                </div>
	                              )}
	                            </div>
	                          )}
	                        </div>
	                        <div className='flex flex-col gap-3'>
	                          {canManageStages && (
	                            <div className='flex flex-wrap items-center gap-2 border-t border-white/30 pt-3'>
	                              {stage.estado !== 'completado' && (
	                                <Button
                                  size='sm'
                                  variant='outline'
                                  className='rounded-full px-4'
                                  onClick={() => handleCompleteStage(stage)}
	                                  disabled={
	                                    processingStage === stage.id
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
                                className='rounded-full px-3'
                                onClick={() => handleDeleteStage(stage.id)}
                              >
                                <Trash2 className='h-4 w-4' />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {filteredStages.length === 0 && (
          <div className='py-10 text-center text-foreground/60'>
            <Clock className='mx-auto mb-4 h-12 w-12 text-foreground/20' />
            <p className='text-base font-medium text-foreground/70'>No hay etapas definidas para este caso</p>
            {canManageStages && (
              <p className='mt-2 text-sm'>
                Haz clic en "Nueva Etapa" para agregar la primera etapa
              </p>
            )}
          </div>
        )}

        {stageTemplates.length > 0 && (
          <div className='mt-6 border-t border-white/30 pt-5'>
            <h3 className='text-sm font-semibold text-foreground/70'>Plan estimado de referencia para materia {caseMateria || 'Civil'}</h3>
            <p className='mt-1 text-xs text-foreground/50'>Duraciones aproximadas en días a partir del inicio del caso.</p>
            <ul className='mt-3 space-y-2 text-sm text-foreground/60'>
              {stageTemplates.map((template, idx) => (
                <li key={`${template.etapa}-${idx}`} className='flex items-start gap-2'>
                  <span className='mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-sky-500/70' />
                  <span>
                    <span className='font-medium text-foreground/75'>{template.etapa}</span>
                    <span className='block text-foreground/50'>
                      {template.descripcion}
                      {template.diasEstimados ? ` · ≈ ${template.diasEstimados} días` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
