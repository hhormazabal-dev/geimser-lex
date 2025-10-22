'use client';

import { useState, useMemo, useEffect, useTransition, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NotesPanel } from '@/components/NotesPanel';
import { DocumentsPanel } from '@/components/DocumentsPanel';
import { TimelinePanel } from '@/components/TimelinePanel';
import { InfoRequestsPanel } from '@/components/InfoRequestsPanel';
import { CaseMessagesPanel } from '@/components/CaseMessagesPanel';
import { formatDate, formatCurrency, getInitials, stringToColor } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { authorizeCaseAdvance, assignLawyer, listAvailableLawyers } from '@/lib/actions/cases';
import { createCaseCounterparty, deleteCaseCounterparty } from '@/lib/actions/counterparties';
import {
  ArrowLeft,
  Scale,
  FileText,
  Clock,
  MessageCircle,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  DollarSign,
  Edit,
  Users,
  Wallet,
  Loader2,
  Trash2,
} from 'lucide-react';
import type { Profile, Case, CaseStage, CaseCounterparty } from '@/lib/supabase/types';
import type { CaseMessageDTO } from '@/lib/actions/messages';

interface CaseDetailViewProps {
  case: Omit<Case, 'abogado_responsable'> & {
    fecha_termino?: string | null;
    abogado_responsable?: {
      id: string;
      nombre: string;
      telefono?: string;
      email?: string;
    };
    clients?: Array<{
      id: string;
      nombre: string;
      email: string;
      telefono?: string;
    }>;
    case_stages?: CaseStage[];
    counterparties?: CaseCounterparty[];
  };
  profile: Profile;
  messages: CaseMessageDTO[];
}

export function CaseDetailView({ case: caseData, profile, messages }: CaseDetailViewProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'timeline' | 'documents' | 'notes' | 'messages' | 'requests' | 'clients'
  >('overview');
  const router = useRouter();
  const { toast } = useToast();
  const [stageCatalog, setStageCatalog] = useState<CaseStage[]>(caseData.case_stages ?? []);
  const [clientAdvance, setClientAdvance] = useState({
    solicitado: caseData.alcance_cliente_solicitado ?? 0,
    autorizado: caseData.alcance_cliente_autorizado ?? 0,
  });
  const [counterparties, setCounterparties] = useState<CaseCounterparty[]>(caseData.counterparties ?? []);
  const [counterpartyForm, setCounterpartyForm] = useState({
    nombre: '',
    rut: '',
    tipo: 'demandado' as 'demandado' | 'demandante' | 'tercero',
  });
  const [isSubmittingCounterparty, startTransitionCounterparty] = useTransition();
  const [pendingDeleteCounterparty, setPendingDeleteCounterparty] = useState<string | null>(null);
  const [currentLawyer, setCurrentLawyer] = useState<{
    id: string;
    nombre: string;
    telefono?: string | null;
    email?: string | null;
  } | null>(
    caseData.abogado_responsable
      ? {
          id: caseData.abogado_responsable.id,
          nombre: caseData.abogado_responsable.nombre,
          telefono: caseData.abogado_responsable.telefono ?? null,
          email: caseData.abogado_responsable.email ?? null,
        }
      : null,
  );
  const [availableLawyers, setAvailableLawyers] = useState<
    Array<{ id: string; nombre: string; email: string | null; telefono: string | null }>
  >(
    caseData.abogado_responsable
      ? [
          {
            id: caseData.abogado_responsable.id,
            nombre: caseData.abogado_responsable.nombre,
            email: caseData.abogado_responsable.email ?? null,
            telefono: caseData.abogado_responsable.telefono ?? null,
          },
        ]
      : [],
  );
  const [selectedLawyerId, setSelectedLawyerId] = useState<string>(caseData.abogado_responsable?.id ?? '');
  const [isLoadingLawyers, setIsLoadingLawyers] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const stageNamesByOrder = useMemo(() => {
    const map = new Map<number, string>();
    stageCatalog.forEach((stage) => {
      const order = stage.orden ?? 0;
      if (order > 0 && !map.has(order)) {
        map.set(order, stage.etapa);
      }
    });
    return map;
  }, [stageCatalog]);
  const requestedStageName = clientAdvance.solicitado > 0 ? stageNamesByOrder.get(clientAdvance.solicitado) ?? null : null;
  const authorizedStageName = clientAdvance.autorizado > 0 ? stageNamesByOrder.get(clientAdvance.autorizado) ?? null : null;
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  useEffect(() => {
    setStageCatalog(caseData.case_stages ?? []);
  }, [caseData.case_stages]);

  useEffect(() => {
    setClientAdvance({
      solicitado: caseData.alcance_cliente_solicitado ?? 0,
      autorizado: caseData.alcance_cliente_autorizado ?? 0,
    });
  }, [caseData.alcance_cliente_solicitado, caseData.alcance_cliente_autorizado]);

  useEffect(() => {
    setCounterparties(caseData.counterparties ?? []);
  }, [caseData.counterparties]);

  useEffect(() => {
    if (caseData.abogado_responsable) {
      setCurrentLawyer({
        id: caseData.abogado_responsable.id,
        nombre: caseData.abogado_responsable.nombre,
        telefono: caseData.abogado_responsable.telefono ?? null,
        email: caseData.abogado_responsable.email ?? null,
      });
      setSelectedLawyerId(caseData.abogado_responsable.id);
    } else {
      setCurrentLawyer(null);
      setSelectedLawyerId('');
    }
  }, [
    caseData.abogado_responsable?.id,
    caseData.abogado_responsable?.nombre,
    caseData.abogado_responsable?.telefono,
    caseData.abogado_responsable?.email,
  ]);

  const canEdit =
    profile.role === 'admin_firma' ||
    (profile.role === 'abogado' && caseData.abogado_responsable?.id === profile.id);
  const canReassign = profile.role === 'admin_firma' || profile.role === 'analista';

  const canManageStages = canEdit;
  const canManageDocuments = canEdit;
  const canManageNotes = profile.role !== 'cliente';
  const canManageRequests = profile.role !== 'cliente';
  const canManageClients = canEdit;

  const showPrivateContent = profile.role !== 'cliente';

  const fetchAvailableLawyers = useCallback(
    async (ensureLawyer?: {
      id: string;
      nombre: string;
      email: string | null;
      telefono: string | null;
    }) => {
      if (!canReassign) return;
      setIsLoadingLawyers(true);
      try {
        const result = await listAvailableLawyers();
        if (result.success) {
          let options =
            (result.lawyers ?? []).map((lawyer: any) => ({
              id: lawyer.id,
              nombre: (lawyer.nombre ?? 'Sin nombre') as string,
              email: lawyer.email ?? null,
              telefono: lawyer.telefono ?? null,
            })) ?? [];

          const fallback =
            ensureLawyer ??
            (currentLawyer
              ? {
                  id: currentLawyer.id,
                  nombre: currentLawyer.nombre,
                  email: currentLawyer.email ?? null,
                  telefono: currentLawyer.telefono ?? null,
                }
              : null);

          if (fallback && !options.some((lawyer) => lawyer.id === fallback.id)) {
            options = [...options, fallback];
          }

          options.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
          setAvailableLawyers(options);
        } else {
          toast({
            title: 'No se pudo cargar el equipo',
            description: result.error ?? 'Intenta nuevamente en unos minutos.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error fetching lawyers:', error);
        toast({
          title: 'Error',
          description: 'No pudimos obtener la lista de abogados disponibles.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingLawyers(false);
      }
    },
    [canReassign, currentLawyer, toast],
  );

  useEffect(() => {
    fetchAvailableLawyers().catch(() => {
      /* la notificación ya se maneja dentro */
    });
  }, [fetchAvailableLawyers]);

  useEffect(() => {
    if (!currentLawyer && selectedLawyerId) {
      const match = availableLawyers.find((lawyer) => lawyer.id === selectedLawyerId);
      if (match) {
        setCurrentLawyer(match);
      }
    }
  }, [availableLawyers, currentLawyer, selectedLawyerId]);

  useEffect(() => {
    setSelectedLawyerId(currentLawyer?.id ?? '');
  }, [currentLawyer?.id]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      activo: 'bg-green-100 text-green-800',
      suspendido: 'bg-yellow-100 text-yellow-800',
      archivado: 'bg-gray-100 text-gray-800',
      terminado: 'bg-blue-100 text-blue-800',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          variants[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      baja: 'bg-gray-100 text-gray-800',
      media: 'bg-blue-100 text-blue-800',
      alta: 'bg-orange-100 text-orange-800',
      urgente: 'bg-red-100 text-red-800',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          variants[priority] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  const formatUf = (value?: number | null) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '—';
    return `${new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)} UF`;
  };

  const handleReassignLawyer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canReassign) return;

    if (!selectedLawyerId) {
      toast({
        title: 'Selecciona un abogado',
        description: 'Debes elegir un abogado para reasignar el caso.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedLawyerId === currentLawyer?.id) {
      toast({
        title: 'Sin cambios',
        description: 'El caso ya está asignado a ese abogado.',
      });
      return;
    }

    setIsReassigning(true);
    try {
      const result = await assignLawyer({
        case_id: caseData.id,
        abogado_id: selectedLawyerId,
      });

      if (result.success) {
        const resolvedLawyer =
          (result.lawyer as { id: string; nombre: string | null; email: string | null; telefono: string | null } | null) ??
          availableLawyers.find((lawyer) => lawyer.id === selectedLawyerId) ??
          null;

        if (resolvedLawyer) {
          const normalized = {
            id: resolvedLawyer.id,
            nombre: resolvedLawyer.nombre ?? 'Sin nombre',
            email: resolvedLawyer.email ?? null,
            telefono: resolvedLawyer.telefono ?? null,
          };
          setCurrentLawyer(normalized);
          await fetchAvailableLawyers(normalized);
        } else {
          setCurrentLawyer(null);
          await fetchAvailableLawyers();
        }

        toast({
          title: 'Caso reasignado',
          description: 'Actualizamos el abogado responsable sin afectar el historial del caso.',
        });
      } else {
        toast({
          title: 'No se pudo reasignar',
          description: result.error ?? 'Intenta nuevamente en unos minutos.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error reassigning lawyer:', error);
      toast({
        title: 'Error inesperado',
        description: 'No pudimos reasignar este caso, intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setIsReassigning(false);
    }
  };

  const honorarioTotal = caseData.honorario_total_uf ?? null;
  const honorarioPagado = caseData.honorario_pagado_uf ?? 0;
  const honorarioPendiente =
    honorarioTotal !== null ? Math.max(honorarioTotal - honorarioPagado, 0) : null;

  const handleAuthorizeAdvance = async (targetOrder: number) => {
    if (!targetOrder || targetOrder <= 0) return;
    setIsAuthorizing(true);
    try {
      const result = await authorizeCaseAdvance(caseData.id, targetOrder);
      if (result.success) {
        const authorizedOrder = result.authorizedOrder ?? targetOrder;
        setClientAdvance((prev) => ({ ...prev, autorizado: authorizedOrder }));
        toast({
          title: 'Avance autorizado',
          description: `Se autorizó avanzar hasta ${
            stageNamesByOrder.get(authorizedOrder) ?? `la etapa ${authorizedOrder}`
          }.`,
        });
        router.refresh();
      } else {
        toast({
          title: 'No se pudo autorizar',
          description: result.error ?? 'Intenta nuevamente en unos minutos.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error authorizing advance', error);
      toast({
        title: 'Error inesperado',
        description: 'No fue posible autorizar el avance solicitado.',
        variant: 'destructive',
      });
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleCounterpartyInputChange = (field: 'nombre' | 'rut' | 'tipo', value: string) => {
    setCounterpartyForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateCounterparty = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransitionCounterparty(async () => {
      const result = await createCaseCounterparty({
        caseId: caseData.id,
        nombre: counterpartyForm.nombre,
        rut: counterpartyForm.rut || undefined,
        tipo: counterpartyForm.tipo,
      });

      if (result.success) {
        setCounterparties((prev) => [result.counterparty, ...prev]);
        setCounterpartyForm({ nombre: '', rut: '', tipo: 'demandado' as 'demandado' | 'demandante' | 'tercero' });
        toast({
          title: 'Contraparte agregada',
          description: 'Registramos la contraparte en el expediente.',
        });
      } else {
        toast({
          title: 'No se pudo agregar la contraparte',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  const handleDeleteCounterparty = async (id: string) => {
    setPendingDeleteCounterparty(id);
    try {
      const result = await deleteCaseCounterparty({ id });
      if (result.success) {
        setCounterparties((prev) => prev.filter((item) => item.id !== id));
        toast({ title: 'Contraparte eliminada' });
      } else {
        toast({
          title: 'No se pudo eliminar la contraparte',
          description: result.error,
          variant: 'destructive',
        });
      }
    } finally {
      setPendingDeleteCounterparty(null);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Resumen', icon: Scale },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'documents', label: 'Documentos', icon: FileText },
    { id: 'notes', label: 'Notas', icon: MessageCircle },
    { id: 'messages', label: 'Mensajes', icon: MessageCircle },
    { id: 'requests', label: 'Solicitudes', icon: MessageCircle },
    ...(canManageClients ? [{ id: 'clients', label: 'Clientes', icon: Users }] : []),
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <Scale className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Detalle del Caso</h1>
                <p className="text-sm text-gray-500">Xel Chile</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {canEdit && (
                <Button size="sm" variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Caso
                </Button>
              )}
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{profile.nombre}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {profile.role.replace('_', ' ')}
                </p>
              </div>
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-white font-medium text-sm"
                style={{ backgroundColor: stringToColor(profile.nombre) }}
              >
                {getInitials(profile.nombre)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header del caso */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">{caseData.caratulado}</h2>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  {caseData.numero_causa && (
                    <span className="flex items-center">
                      <Scale className="h-4 w-4 mr-1" />
                      Causa: {caseData.numero_causa}
                    </span>
                  )}
                  {caseData.materia && <span>Materia: {caseData.materia}</span>}
                  {caseData.tribunal && (
                    <span className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      {caseData.tribunal}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end space-y-2">
                {getStatusBadge(caseData.estado || 'activo')}
                {caseData.prioridad && getPriorityBadge(caseData.prioridad)}
                {caseData.etapa_actual && <Badge variant="outline">{caseData.etapa_actual}</Badge>}
              </div>
            </div>

            {/* Información principal */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* Abogado responsable */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2 flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Abogado Responsable
                </h3>
                {currentLawyer ? (
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-blue-800">{currentLawyer.nombre}</p>
                    {currentLawyer.telefono && (
                      <p className="flex items-center text-blue-700">
                        <Phone className="h-3 w-3 mr-1" />
                        {currentLawyer.telefono}
                      </p>
                    )}
                    {currentLawyer.email && (
                      <p className="flex items-center text-blue-700">
                        <Mail className="h-3 w-3 mr-1" />
                        {currentLawyer.email}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-blue-700">Este caso aún no tiene un abogado asignado.</p>
                )}

                {canReassign && (
                  <form className="mt-4 space-y-2" onSubmit={handleReassignLawyer}>
                    <Label htmlFor="case-lawyer-select" className="text-xs uppercase tracking-wide text-blue-800">
                      Reasignar / asignar abogado
                    </Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        id="case-lawyer-select"
                        className="form-input flex-1"
                        value={selectedLawyerId}
                        onChange={(event) => setSelectedLawyerId(event.target.value)}
                        disabled={isLoadingLawyers || isReassigning}
                      >
                        <option value="">{isLoadingLawyers ? 'Cargando abogados…' : 'Selecciona un abogado'}</option>
                        {availableLawyers.map((lawyer) => (
                          <option key={lawyer.id} value={lawyer.id}>
                            {lawyer.nombre}
                            {lawyer.email ? ` • ${lawyer.email}` : ''}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="submit"
                        disabled={isReassigning || !selectedLawyerId || selectedLawyerId === currentLawyer?.id}
                      >
                        {isReassigning ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Guardando…
                          </>
                        ) : (
                          'Actualizar'
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-blue-700">
                      Los cambios quedan registrados automáticamente en el historial del caso.
                    </p>
                  </form>
                )}
              </div>

              {/* Cliente */}
              {caseData.nombre_cliente && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-medium text-green-900 mb-2 flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Cliente
                  </h3>
                  <p className="text-sm font-medium text-green-800">{caseData.nombre_cliente}</p>
                  {caseData.rut_cliente && (
                    <p className="text-sm text-green-700">RUT: {caseData.rut_cliente}</p>
                  )}
                </div>
              )}

              {/* Fechas */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-medium text-purple-900 mb-2 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Fechas
                </h3>
                <div className="space-y-1 text-sm text-purple-700">
                  {caseData.fecha_inicio && <p>Inicio: {formatDate(caseData.fecha_inicio)}</p>}
                  {caseData.fecha_termino && <p>Término: {formatDate(caseData.fecha_termino)}</p>}
                </div>
              </div>

              {/* Valor */}
              {caseData.valor_estimado && (
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h3 className="font-medium text-yellow-900 mb-2 flex items-center">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Valor Estimado
                  </h3>
                  <p className="text-lg font-bold text-yellow-800">
                    {formatCurrency(caseData.valor_estimado)}
                  </p>
                </div>
              )}

              {(clientAdvance.solicitado > 0 || clientAdvance.autorizado > 0) && (
                <div className="bg-sky-50 rounded-lg p-4">
                  <h3 className="font-medium text-sky-900 mb-2 flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Alcance del cliente
                  </h3>
                  <p className="text-sm text-sky-700">
                    {clientAdvance.solicitado > 0
                      ? `Solicitado: ${requestedStageName ?? `Etapa ${clientAdvance.solicitado}`}`
                      : 'Sin solicitudes vigentes'}
                  </p>
                  <p className="text-sm text-sky-700">
                    {clientAdvance.autorizado > 0
                      ? `Autorizado: ${authorizedStageName ?? `Etapa ${clientAdvance.autorizado}`}`
                      : 'Aprobación pendiente'}
                  </p>
                  {(profile.role === 'admin_firma' || profile.role === 'analista') &&
                    clientAdvance.solicitado > clientAdvance.autorizado && (
                    <Button
                      size="sm"
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-sky-600 text-white hover:bg-sky-700"
                      onClick={() => handleAuthorizeAdvance(clientAdvance.solicitado)}
                      disabled={isAuthorizing}
                    >
                      {isAuthorizing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Autorizando…
                        </>
                      ) : (
                        'Autorizar solicitud'
                      )}
                    </Button>
                    )}
                </div>
              )}

              {(honorarioTotal !== null || caseData.tarifa_referencia) && (
                <div className="bg-indigo-50 rounded-lg p-4">
                  <h3 className="font-medium text-indigo-900 mb-2 flex items-center">
                    <Wallet className="h-4 w-4 mr-2" />
                    Honorarios
                  </h3>
                  <div className="space-y-1 text-sm text-indigo-800">
                    {caseData.modalidad_cobro && (
                      <p className="uppercase text-xs tracking-wide text-indigo-600">
                        {caseData.modalidad_cobro}
                      </p>
                    )}
                    {honorarioTotal !== null && (
                      <p className="font-semibold">Total: {formatUf(honorarioTotal)}</p>
                    )}
                    {honorarioTotal !== null && (
                      <p>Pagado: {formatUf(honorarioPagado)}</p>
                    )}
                    {honorarioPendiente !== null && (
                      <p>Pendiente: {formatUf(honorarioPendiente)}</p>
                    )}
                    {caseData.honorario_variable_porcentaje && (
                      <p>
                        Variable: {caseData.honorario_variable_porcentaje}%
                        {caseData.honorario_variable_base
                          ? ` (${caseData.honorario_variable_base})`
                          : ''}
                      </p>
                    )}
                    {caseData.tarifa_referencia && (
                      <p className="text-xs text-indigo-600">
                        Tarifa: {caseData.tarifa_referencia}
                      </p>
                    )}
                    {caseData.honorario_notas && (
                      <p className="text-xs text-indigo-700 whitespace-pre-wrap">
                        {caseData.honorario_notas}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Contraparte */}
            {caseData.contraparte && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-gray-900 mb-2">Contraparte</h3>
                <p className="text-gray-700">{caseData.contraparte}</p>
              </div>
            )}

            {/* Observaciones */}
            {caseData.observaciones && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Observaciones</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{caseData.observaciones}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs de navegación */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Contenido de las tabs */}
        <div>
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <TimelinePanel
                  caseId={caseData.id}
                  caseMateria={caseData.materia ?? 'General'}
                  canManageStages={canManageStages}
                  showPrivateStages={showPrivateContent}
                  clientContext={{
                    role: profile.role === 'usuario' ? 'cliente' : profile.role,
                    alcanceAutorizado: clientAdvance.autorizado,
                    alcanceSolicitado: clientAdvance.solicitado,
                  }}
                  onClientProgressChange={(progress) => {
                    setClientAdvance((prev) => {
                      const nextSolicitado = progress.solicitado ?? prev.solicitado;
                      const nextAutorizado = progress.autorizado ?? prev.autorizado;
                      if (
                        nextSolicitado === prev.solicitado &&
                        nextAutorizado === prev.autorizado
                      ) {
                        return prev;
                      }
                      return { solicitado: nextSolicitado, autorizado: nextAutorizado };
                    });
                  }}
                  onStagesLoaded={setStageCatalog}
                />
              </div>
              <div className="space-y-6">
                <DocumentsPanel
                  caseId={caseData.id}
                  canUpload={canManageDocuments}
                  canEdit={canManageDocuments}
                  canDelete={canManageDocuments}
                  showPrivateDocuments={showPrivateContent}
                />
                <InfoRequestsPanel
                  caseId={caseData.id}
                  canCreateRequests={true}
                  canRespondRequests={canManageRequests}
                  showPrivateRequests={showPrivateContent}
                />
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <TimelinePanel
              caseId={caseData.id}
              caseMateria={caseData.materia ?? 'General'}
              canManageStages={canManageStages}
              showPrivateStages={showPrivateContent}
              clientContext={{
                role: profile.role === 'usuario' ? 'cliente' : profile.role,
                alcanceAutorizado: clientAdvance.autorizado,
                alcanceSolicitado: clientAdvance.solicitado,
              }}
              onClientProgressChange={(progress) => {
                setClientAdvance((prev) => {
                  const nextSolicitado = progress.solicitado ?? prev.solicitado;
                  const nextAutorizado = progress.autorizado ?? prev.autorizado;
                  if (nextSolicitado === prev.solicitado && nextAutorizado === prev.autorizado) {
                    return prev;
                  }
                  return { solicitado: nextSolicitado, autorizado: nextAutorizado };
                });
              }}
              onStagesLoaded={setStageCatalog}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentsPanel
              caseId={caseData.id}
              canUpload={canManageDocuments}
              canEdit={canManageDocuments}
              canDelete={canManageDocuments}
              showPrivateDocuments={showPrivateContent}
            />
          )}

          {activeTab === 'notes' && (
            <NotesPanel
              caseId={caseData.id}
              canCreateNotes={canManageNotes}
              canEditNotes={canManageNotes}
              showPrivateNotes={showPrivateContent}
            />
          )}

          {activeTab === 'messages' && (
            <CaseMessagesPanel
              caseId={caseData.id}
              initialMessages={messages}
              currentProfileId={profile.id}
              allowSend={profile.role !== 'cliente'}
            />
          )}

          {activeTab === 'requests' && (
            <InfoRequestsPanel
              caseId={caseData.id}
              canCreateRequests={true}
              canRespondRequests={canManageRequests}
              showPrivateRequests={showPrivateContent}
            />
          )}

          {activeTab === 'clients' && canManageClients && (
            <div className="space-y-6">
              {/* Lista de clientes asociados */}
              {caseData.clients && caseData.clients.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Clientes Asociados ({caseData.clients.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {caseData.clients.map((client) => (
                        <div
                          key={client.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-medium"
                              style={{ backgroundColor: stringToColor(client.nombre) }}
                            >
                              {getInitials(client.nombre)}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{client.nombre}</h4>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span className="flex items-center">
                                  <Mail className="h-3 w-3 mr-1" />
                                  {client.email}
                                </span>
                                {client.telefono && (
                                  <span className="flex items-center">
                                    <Phone className="h-3 w-3 mr-1" />
                                    {client.telefono}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline">Cliente</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Contrapartes (demandados)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={handleCreateCounterparty} className="grid gap-4 md:grid-cols-[1.2fr_1fr_0.8fr_auto]">
                    <div className="space-y-2">
                      <Label htmlFor="counterparty_nombre">Nombre completo *</Label>
                      <Input
                        id="counterparty_nombre"
                        placeholder="Empresa demandada o persona"
                        value={counterpartyForm.nombre}
                        onChange={(event) => handleCounterpartyInputChange('nombre', event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="counterparty_rut">RUT</Label>
                      <Input
                        id="counterparty_rut"
                        placeholder="12.345.678-9"
                        value={counterpartyForm.rut}
                        onChange={(event) => handleCounterpartyInputChange('rut', event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="counterparty_tipo">Rol</Label>
                      <select
                        id="counterparty_tipo"
                        className="form-input"
                        value={counterpartyForm.tipo}
                        onChange={(event) => handleCounterpartyInputChange('tipo', event.target.value as 'demandado' | 'demandante' | 'tercero')}
                      >
                        <option value="demandado">Demandado</option>
                        <option value="demandante">Demandante</option>
                        <option value="tercero">Tercero</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmittingCounterparty || counterpartyForm.nombre.trim().length < 2}
                      >
                        {isSubmittingCounterparty ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Registrando…
                          </>
                        ) : (
                          'Agregar'
                        )}
                      </Button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    {counterparties.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Aún no se agregan demandados al expediente. Regístralos para tener claridad de las partes involucradas.
                      </p>
                    ) : (
                      counterparties.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900">{item.nombre}</span>
                            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-600">
                                {item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)}
                              </span>
                              {item.rut && <span>RUT: {item.rut}</span>}
                              <span>Agregado: {item.created_at ? formatDate(item.created_at) : '—'}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full text-slate-400 hover:text-red-600"
                            onClick={() => handleDeleteCounterparty(item.id)}
                            disabled={pendingDeleteCounterparty === item.id}
                          >
                            {pendingDeleteCounterparty === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CaseDetailView;
