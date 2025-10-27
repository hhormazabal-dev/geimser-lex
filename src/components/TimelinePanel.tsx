'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { requestCaseAdvance } from '@/lib/actions/cases';
import { cn, formatDate, formatRelativeTime, isDateInPast } from '@/lib/utils';
import { 
  Clock, 
  CheckCircle, 
  Circle, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar,
  User,
  Users,
  Gavel,
  Loader2,
  ChevronLeft,
  ChevronRight,
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
  requiere_pago: boolean;
  costo_uf: string;
  porcentaje_variable: string;
  enlace_pago: string;
  notas_pago: string;
  monto_variable_base: string;
  estado_pago: CreateStageInput['estado_pago'];
  monto_pagado_uf: string;
};

export function TimelinePanel({
  caseId,
  caseMateria = 'Civil',
  canManageStages = false,
  showPrivateStages = true,
  clientContext,
  onClientProgressChange,
  onStagesLoaded,
}: TimelinePanelProps) {
  const [stages, setStages] = useState<CaseStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStage, setNewStage] = useState<DraftStageState>({
    etapa: '',
    descripcion: '',
    fecha_programada: '',
    es_publica: true,
    isCustom: false,
    audiencia_tipo: '',
    requiere_testigos: false,
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
  const alcanceAutorizado = clientContext?.alcanceAutorizado ?? 0;
  const alcanceSolicitado = clientContext?.alcanceSolicitado ?? 0;
  const viewerRole = clientContext?.role ?? 'cliente';
  const clientMode = viewerRole === 'cliente';
  const [clientProgress, setClientProgress] = useState({
    solicitado: alcanceSolicitado,
    autorizado: alcanceAutorizado,
  });
  const [isRequestingStage, setIsRequestingStage] = useState<string | null>(null);
  const stageTrackRef = useRef<HTMLDivElement | null>(null);
  const prevStageCountRef = useRef<number>(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [hasAutoAligned, setHasAutoAligned] = useState(false);

  const updateScrollControls = useCallback(() => {
    const track = stageTrackRef.current;
    if (!track) {
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = track;
    setCanScrollPrev(scrollLeft > 12);
    setCanScrollNext(scrollLeft + clientWidth < scrollWidth - 12);
  }, []);

  const scrollTrack = useCallback((direction: 'prev' | 'next') => {
    const track = stageTrackRef.current;
    if (!track) return;
    const offset = direction === 'next' ? track.clientWidth * 0.75 : -track.clientWidth * 0.75;
    track.scrollBy({ left: offset, behavior: 'smooth' });
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(updateScrollControls);
    } else {
      updateScrollControls();
    }
  }, [updateScrollControls]);

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
          audiencia_tipo: '',
          requiere_testigos: false,
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

  const handleRequestAdvance = async (stage: CaseStage) => {
    if (!clientMode || !stage.id) return;

    setIsRequestingStage(stage.id);
    try {
      const result = await requestCaseAdvance(caseId, stage.id);
      if (result.success) {
        setClientProgress((prev) => ({
          autorizado: prev.autorizado,
          solicitado: result.requestedOrder ?? prev.solicitado,
        }));
        toast({
          title: 'Solicitud enviada',
          description: `Solicitaste avanzar hasta la etapa "${stage.etapa}".`,
        });
        await loadStages();
      } else {
        toast({
          title: 'No se pudo solicitar el avance',
          description: result.error ?? 'Intenta nuevamente en unos minutos.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error requesting case advance:', error);
      toast({
        title: 'Error inesperado',
        description: 'No pudimos registrar tu solicitud, intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setIsRequestingStage(null);
    }
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
  const etapasSolicitadas = etapasRequierenPago.filter((stage) => stage.estado_pago === 'solicitado').length;

  const findStageLabelByOrder = (order: number) => {
    if (!order) return null;
    const match = stages.find((stage) => (stage.orden ?? 0) === order);
    return match?.etapa ?? null;
  };

  const requestedStageLabel = clientMode ? findStageLabelByOrder(clientProgress.solicitado) : null;
  const authorizedStageLabel = clientMode ? findStageLabelByOrder(clientProgress.autorizado) : null;

  useEffect(() => {
    updateScrollControls();
    const track = stageTrackRef.current;
    if (!track) return;
    const handleScroll = () => updateScrollControls();
    track.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      track.removeEventListener('scroll', handleScroll);
    };
  }, [filteredStages.length, updateScrollControls]);

  useEffect(() => {
    if (isLoading) return;
    const track = stageTrackRef.current;
    if (!track) return;

    if (filteredStages.length === 0) {
      prevStageCountRef.current = 0;
      setHasAutoAligned(false);
      return;
    }

    const targetIndex = filteredStages.findIndex((stage) => stage.estado !== 'completado');
    const indexToReveal = targetIndex === -1 ? filteredStages.length - 1 : targetIndex;
    const targetChild = track.children.item(indexToReveal) as HTMLElement | null;

    const lengthChanged = prevStageCountRef.current !== filteredStages.length;
    if ((lengthChanged || !hasAutoAligned) && targetChild) {
      track.scrollTo({
        left: Math.max(0, targetChild.offsetLeft - 24),
        behavior: hasAutoAligned ? 'smooth' : 'auto',
      });
      setHasAutoAligned(true);
    }

    prevStageCountRef.current = filteredStages.length;
  }, [filteredStages, isLoading, hasAutoAligned]);

  useEffect(() => {
    if (showAddForm && etapasRequierenPago.length > 0) {
      setNewStage((prev) => ({ ...prev, requiere_pago: true }));
    }
  }, [showAddForm, etapasRequierenPago.length]);

  if (isLoading) {
    return (
      <Card className='shadow-[0_30px_60px_-35px_rgba(15,23,42,0.45)]'>
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
    <Card className='shadow-[0_30px_60px_-35px_rgba(15,23,42,0.45)]'>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='flex items-center gap-2'>
            <Clock className='h-5 w-5' />
            Timeline Procesal ({filteredStages.length})
          </CardTitle>
          {canManageStages && (
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
      </CardHeader>
      <CardContent className='space-y-6'>
        {etapasRequierenPago.length > 0 && (
          <div
            className={cn(
              'grid grid-cols-1 gap-4 rounded-2xl border border-sky-200/60 bg-white/80 p-5 text-sm text-foreground/70 shadow-sm backdrop-blur',
              clientMode ? 'md:grid-cols-4' : 'md:grid-cols-3'
            )}
          >
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.28em] text-foreground/45">Honorario distribuido</p>
              <p className="text-lg font-semibold text-foreground">{formatUf(totalCostoEtapas)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.28em] text-foreground/45">Pagado</p>
              <p className="text-lg font-semibold text-foreground">{formatUf(totalPagadoEtapas)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.28em] text-foreground/45">Etapas liberadas</p>
              <p className="text-lg font-semibold text-foreground">
                {etapasPagadas} / {etapasRequierenPago.length}
              </p>
              {etapasPendientesPago > 0 && (
                <p className="text-xs text-sky-600">Faltan {etapasPendientesPago} pago(s) para completar el plan.</p>
              )}
            </div>
            {clientMode && (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.28em] text-foreground/45">
                  Solicitadas por el cliente
                </p>
                <p className="text-lg font-semibold text-foreground">{etapasSolicitadas}</p>
              </div>
            )}
          </div>
        )}

        {clientMode && (
          <div className="rounded-2xl border border-white/40 bg-white/80 px-5 py-5 text-sm text-foreground/65 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-foreground/45">Alcance solicitado</p>
                <p className="text-base font-semibold text-foreground mt-1">
                  {clientProgress.solicitado > 0
                    ? requestedStageLabel ?? `Etapa ${clientProgress.solicitado}`
                    : 'Aún no definido'}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-foreground/45">Autorizado por el estudio</p>
                <p className="text-base font-semibold text-foreground mt-1">
                  {clientProgress.autorizado > 0
                    ? authorizedStageLabel ?? `Etapa ${clientProgress.autorizado}`
                    : 'Pendiente'}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-foreground/45">Etapas solicitadas</p>
                <p className="text-base font-semibold text-foreground mt-1">
                  {etapasSolicitadas} / {etapasRequierenPago.length}
                </p>
              </div>
            </div>
            {clientProgress.solicitado > clientProgress.autorizado && (
              <p className="mt-4 text-xs text-foreground/50">
                Estamos revisando tu solicitud para avanzar. Te notificaremos cuando esté aprobada.
              </p>
            )}
          </div>
        )}

        {/* Formulario para nueva etapa */}
        {showAddForm && canManageStages && (
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

                <div className='space-y-4 border-t border-white/40 pt-4'>
                  <label className='flex items-center gap-2 text-sm font-medium text-foreground/70'>
                    <input
                      type='checkbox'
                      className='rounded border-white/40'
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
                        <label className='block text-[12px] font-semibold uppercase tracking-[0.28em] text-foreground/45'>
                          Monto fijo (UF)
                        </label>
                        <input
                          type='number'
                          min='0'
                          step='0.01'
                          value={newStage.costo_uf}
                          onChange={(e) => setNewStage({ ...newStage, costo_uf: e.target.value })}
                          className='input-field'
                          placeholder='Ej: 5.0'
                        />
                      </div>
                      <div className='space-y-2'>
                        <label className='block text-[12px] font-semibold uppercase tracking-[0.28em] text-foreground/45'>
                          Componente variable (%)
                        </label>
                        <input
                          type='number'
                          min='0'
                          max='100'
                          step='0.1'
                          value={newStage.porcentaje_variable}
                          onChange={(e) => setNewStage({ ...newStage, porcentaje_variable: e.target.value })}
                          className='input-field'
                          placeholder='Ej: 10'
                        />
                      </div>
                      <div className='md:col-span-2 space-y-2'>
                        <label className='block text-[12px] font-semibold uppercase tracking-[0.28em] text-foreground/45'>
                          Base del variable
                        </label>
                        <textarea
                          rows={2}
                          value={newStage.monto_variable_base}
                          onChange={(e) => setNewStage({ ...newStage, monto_variable_base: e.target.value })}
                          className='input-field min-h-[90px] resize-y'
                          placeholder='Ej: 10% de lo obtenido o ahorrado.'
                        />
                      </div>
                      <div className='space-y-2'>
                        <label className='block text-[12px] font-semibold uppercase tracking-[0.28em] text-foreground/45'>
                          Link de pago (Payku)
                        </label>
                        <input
                          type='url'
                          value={newStage.enlace_pago}
                          onChange={(e) => setNewStage({ ...newStage, enlace_pago: e.target.value })}
                          className='input-field'
                          placeholder='https://...'
                        />
                      </div>
                      <div className='space-y-2'>
                        <label className='block text-[12px] font-semibold uppercase tracking-[0.28em] text-foreground/45'>
                          Notas internas
                        </label>
                        <textarea
                          rows={2}
                          value={newStage.notas_pago}
                          onChange={(e) => setNewStage({ ...newStage, notas_pago: e.target.value })}
                          className='input-field min-h-[90px] resize-y'
                          placeholder='Instrucciones u observaciones sobre el cobro.'
                        />
                      </div>
                      <div className='space-y-2'>
                        <label className='block text-[12px] font-semibold uppercase tracking-[0.28em] text-foreground/45'>
                          Estado inicial del pago
                        </label>
                        <select
                          value={newStage.estado_pago}
                          onChange={(e) =>
                            setNewStage({ ...newStage, estado_pago: e.target.value as CreateStageInput['estado_pago'] })
                          }
                          className='input-field'
                        >
                          {STAGE_PAYMENT_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className='space-y-2'>
                        <label className='block text-[12px] font-semibold uppercase tracking-[0.28em] text-foreground/45'>
                          Monto ya pagado (UF)
                        </label>
                        <input
                          type='number'
                          min='0'
                          step='0.01'
                          value={newStage.monto_pagado_uf}
                          onChange={(e) => setNewStage({ ...newStage, monto_pagado_uf: e.target.value })}
                          className='input-field'
                          placeholder='0.00'
                        />
                      </div>
                    </div>
                  )}

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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline de etapas */}
        <div className='space-y-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <p className='text-sm text-foreground/60'>Arrastra horizontalmente para revisar el avance del caso.</p>
            {filteredStages.length > 0 && (
              <div className='hidden md:flex items-center gap-2'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='rounded-full border border-white/40 bg-white/60 backdrop-blur'
                  onClick={() => scrollTrack('prev')}
                  disabled={!canScrollPrev}
                  aria-label='Ver etapas anteriores'
                >
                  <ChevronLeft className='h-4 w-4' />
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='rounded-full border border-white/40 bg-white/60 backdrop-blur'
                  onClick={() => scrollTrack('next')}
                  disabled={!canScrollNext}
                  aria-label='Ver etapas siguientes'
                >
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
            )}
          </div>
          <div className='relative'>
            {filteredStages.length > 0 && (
              <>
                <div className='pointer-events-none absolute inset-y-0 left-0 hidden w-16 bg-gradient-to-r from-white via-white/80 to-transparent md:block' />
                <div className='pointer-events-none absolute inset-y-0 right-0 hidden w-16 bg-gradient-to-l from-white via-white/80 to-transparent md:block' />
              </>
            )}
            <div
              ref={stageTrackRef}
              className='flex gap-4 overflow-x-auto pb-3 scroll-smooth snap-x snap-mandatory'
            >
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
                const requestDisabled =
                  isAuthorizedStage ||
                  isStageCompleted ||
                  (stage.estado_pago ?? 'pendiente') === 'pagado' ||
                  stageOrder <= clientProgress.solicitado ||
                  isRequestingStage === stage.id;
                const audienceLabel = stage.audiencia_tipo
                  ? STAGE_AUDIENCE_TYPES.find((option) => option.value === stage.audiencia_tipo)?.label ??
                    `Audiencia ${stage.audiencia_tipo}`
                  : null;
                const statusBadge = getStatusBadge(stage.estado || 'pendiente');
                const paymentBadge = stage.requiere_pago
                  ? getPaymentStatusBadge(stage.estado_pago ?? 'pendiente')
                  : null;

                return (
                  <div key={stage.id} className='snap-center shrink-0 basis-full min-w-[280px] sm:basis-[60%] lg:basis-[380px]'>
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
                              {paymentBadge}
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
                            stage.fecha_programada ||
                            stage.requiere_pago) && (
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
                              {stage.requiere_pago && (
                                <div className='rounded-2xl border border-white/40 bg-white/70 px-3 py-2'>
                                  <p className='text-[10px] uppercase tracking-[0.22em] text-foreground/40'>
                                    Cobranza
                                  </p>
                                  <p className='mt-1 text-sm font-medium text-foreground'>
                                    {formatUf(stage.costo_uf)}
                                  </p>
                                  {typeof stage.porcentaje_variable === 'number' && stage.porcentaje_variable > 0 && (
                                    <p className='mt-1 text-xs text-foreground/55'>
                                      Variable: {stage.porcentaje_variable}%{stage.monto_variable_base ? ` · ${stage.monto_variable_base}` : ''}
                                    </p>
                                  )}
                                  <p className='mt-1 text-xs text-foreground/55'>
                                    {stage.monto_pagado_uf && stage.monto_pagado_uf > 0
                                      ? `Pagado ${formatUf(stage.monto_pagado_uf)}`
                                      : 'Pago pendiente'}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                          {stage.notas_pago && (
                            <p className='rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-xs text-foreground/60 shadow-inner'>
                              {stage.notas_pago}
                            </p>
                          )}
                          {stage.estado_pago === 'solicitado' && (
                            <p className='flex items-center gap-2 text-xs text-amber-600'>
                              <AlertCircle className='h-3 w-3' />
                              Solicitud enviada{' '}
                              {stage.solicitado_at ? formatRelativeTime(stage.solicitado_at) : 'recientemente'}.
                            </p>
                          )}
                        </div>
                        <div className='flex flex-col gap-3'>
                          <div className='flex flex-wrap items-center gap-2'>
                            {stage.enlace_pago && (
                              <Button size='sm' variant='outline' className='rounded-full px-4' asChild>
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
                                  className='rounded-full px-4'
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
                                  className='rounded-full px-4'
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
                                  className='rounded-full px-4'
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
                            {clientMode && !canManageStages && (
                              <Button
                                size='sm'
                                variant='outline'
                                className='rounded-full px-4'
                                onClick={() => handleRequestAdvance(stage)}
                                disabled={requestDisabled}
                              >
                                {isRequestingStage === stage.id ? (
                                  <>
                                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                    Enviando…
                                  </>
                                ) : (
                                  <>
                                    <DollarSign className='h-4 w-4 mr-2' />
                                    Solicitar prepago
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                          {stage.estado_pago !== 'pagado' && stage.enlace_pago && (
                            <p className='flex items-center gap-1 text-xs text-foreground/55'>
                              <AlertCircle className='h-3 w-3' />
                              Comparte el enlace con el cliente para liberar esta etapa.
                            </p>
                          )}
                          {canManageStages && (
                            <div className='flex flex-wrap items-center gap-2 border-t border-white/30 pt-3'>
                              {stage.estado !== 'completado' && (
                                <Button
                                  size='sm'
                                  variant='outline'
                                  className='rounded-full px-4'
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
                                className='rounded-full px-3'
                                onClick={() => setEditingStage(stage.id)}
                              >
                                <Edit className='h-4 w-4' />
                              </Button>
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
      </CardContent>
    </Card>
  );
}
