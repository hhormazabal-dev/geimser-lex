'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NotesPanel } from '@/components/NotesPanel';
import { DocumentsPanel } from '@/components/DocumentsPanel';
import { TimelinePanel } from '@/components/TimelinePanel';
import { InfoRequestsPanel } from '@/components/InfoRequestsPanel';
import { CaseMessagesPanel } from '@/components/CaseMessagesPanel';
import { formatDate, formatCurrency, getInitials, stringToColor } from '@/lib/utils';
import { CASE_SENTENCE_STATUSES } from '@/lib/validators/case';
import { 
  Scale, 
  FileText, 
  Clock, 
  MessageCircle, 
  User, 
  Phone, 
  Mail,
  Calendar,
  AlertCircle,
  CheckCircle,
  Eye
} from 'lucide-react';
import type { Profile, Case } from '@/lib/supabase/types';
import type { CaseMessageDTO } from '@/lib/actions/messages';
import LogoutButton from '@/components/LogoutButton';

type CaseFieldsForClient = Pick<
  Case,
  | 'id'
  | 'caratulado'
  | 'numero_causa'
  | 'estado'
  | 'prioridad'
  | 'etapa_actual'
  | 'sentencia_estado'
  | 'sentencia_fecha'
  | 'honorario_moneda'
  | 'honorario_total_uf'
  | 'honorario_pagado_uf'
  | 'modalidad_cobro'
  | 'valor_estimado'
  | 'fecha_inicio'
  | 'updated_at'
  | 'tribunal'
  | 'materia'
  | 'observaciones'
  | 'contraparte'
>;

export type ClientPortalCase = CaseFieldsForClient & {
  abogado_responsable: Case['abogado_responsable'];
  abogado_responsable_profile?: {
    id: string;
    nombre: string | null;
    email?: string | null;
    telefono?: string | null;
  } | null;
};

interface ClientDashboardProps {
  profile: Pick<Profile, 'id' | 'nombre' | 'email'> & { email?: string | null };
  cases: ClientPortalCase[];
}

const CASE_META_REGEX = /<!--case-form-meta:[\s\S]*?-->/g;

function cleanObservaciones(value?: string | null): string {
  if (!value) return '';
  return value.replace(CASE_META_REGEX, '').trim();
}

const SENTENCE_STATUS_LABELS: Record<string, string> = CASE_SENTENCE_STATUSES.reduce(
  (acc, item) => {
    acc[item.value] = item.label;
    return acc;
  },
  {} as Record<string, string>,
);

function getSentenceStatusLabel(status?: string | null): string {
  if (!status || status === 'no_registra') return 'Sin sentencia registrada';
  return SENTENCE_STATUS_LABELS[status] ?? 'Sin sentencia registrada';
}

export function ClientDashboard({ profile, cases }: ClientDashboardProps) {
  const [selectedCase, setSelectedCase] = useState<ClientPortalCase | null>(cases[0] || null);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'documents' | 'notes' | 'messages' | 'requests'>('overview');
  const lawyerData = selectedCase?.abogado_responsable_profile
    ? {
        nombre: selectedCase.abogado_responsable_profile.nombre ?? null,
        telefono: selectedCase.abogado_responsable_profile.telefono ?? null,
        email: selectedCase.abogado_responsable_profile.email ?? null,
      }
    : null;

  useEffect(() => {
    if (!cases.length) {
      setSelectedCase(null);
      return;
    }

    setSelectedCase((prev) => {
      if (!prev) return cases[0] ?? null;
      const next = cases.find((item) => item.id === prev.id);
      return next ?? cases[0] ?? null;
    });
  }, [cases]);

  const summary = useMemo(() => {
    if (!cases.length) {
      return {
        totalCases: 0,
        activeCases: 0,
        closedCases: 0,
        ufTotals: { total: 0, paid: 0, pending: 0, hasMixedCurrencies: false },
      };
    }

    const totalCases = cases.length;
    const activeCases = cases.filter((item) => item.estado === 'activo').length;
    const closedCases = cases.filter((item) => item.estado === 'terminado' || item.estado === 'archivado').length;
    const ufCases = cases.filter((item) => (item.honorario_moneda ?? 'UF') === 'UF');
    const totalUf = ufCases.reduce((acc, item) => acc + (item.honorario_total_uf ?? 0), 0);
    const paidUf = ufCases.reduce((acc, item) => acc + (item.honorario_pagado_uf ?? 0), 0);
    const pendingUf = Math.max(totalUf - paidUf, 0);

    return {
      totalCases,
      activeCases,
      closedCases,
      ufTotals: {
        total: totalUf,
        paid: paidUf,
        pending: pendingUf,
        hasMixedCurrencies: ufCases.length > 0 && ufCases.length !== cases.length,
      },
    };
  }, [cases]);

  const observacionesTexto = useMemo(
    () => cleanObservaciones(selectedCase?.observaciones ?? null),
    [selectedCase?.observaciones]
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      activo: 'default',
      suspendido: 'secondary',
      archivado: 'outline',
      terminado: 'destructive',
    };

    const colors: Record<string, string> = {
      activo: 'bg-green-100 text-green-800',
      suspendido: 'bg-yellow-100 text-yellow-800',
      archivado: 'bg-gray-100 text-gray-800',
      terminado: 'bg-blue-100 text-blue-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgente':
        return <AlertCircle className='h-4 w-4 text-red-600' />;
      case 'alta':
        return <AlertCircle className='h-4 w-4 text-orange-600' />;
      case 'media':
        return <Clock className='h-4 w-4 text-blue-600' />;
      default:
        return <CheckCircle className='h-4 w-4 text-gray-600' />;
    }
  };

  const tabs = [
    { id: 'overview', label: 'Resumen', icon: Eye },
    { id: 'timeline', label: 'Progreso', icon: Clock },
    { id: 'documents', label: 'Documentos', icon: FileText },
    { id: 'notes', label: 'Notas', icon: MessageCircle },
    { id: 'messages', label: 'Mensajes', icon: MessageCircle },
    { id: 'requests', label: 'Solicitudes', icon: MessageCircle },
  ] as const;

  const formatUf = (value?: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    return `${new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)} UF`;
  };

  const getPaymentProgress = (caseItem: ClientPortalCase) => {
    const total = caseItem.honorario_total_uf ?? 0;
    if (!total || total <= 0) return 0;
    const paid = caseItem.honorario_pagado_uf ?? 0;
    return Math.min(100, Math.round((paid / total) * 100));
  };

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <div className='bg-white shadow-sm border-b'>
        <div className='mx-auto w-full max-w-[1760px] px-4 lg:px-6'>
          <div className='flex items-center justify-between h-16'>
            <div className='flex items-center space-x-4'>
              <Scale className='h-8 w-8 text-blue-600' />
              <div>
                <h1 className='text-xl font-semibold text-gray-900'>Portal Cliente</h1>
                <p className='text-sm text-gray-500'>Xel Chile</p>
              </div>
            </div>
            
            <div className='flex items-center space-x-4'>
              <div className='text-right'>
                <p className='text-sm font-medium text-gray-900'>{profile.nombre}</p>
                <p className='text-xs text-gray-500'>{profile.email ?? 'Sin correo registrado'}</p>
              </div>
              <div 
                className='h-10 w-10 rounded-full flex items-center justify-center text-white font-medium'
                style={{ backgroundColor: stringToColor(profile.nombre) }}
              >
                {getInitials(profile.nombre)}
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>

      <div className='mx-auto w-full max-w-[1760px] px-4 lg:px-6 py-8'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12'>
          <Card className='bg-white shadow-sm col-span-1 md:col-span-3 lg:col-span-3'>
            <CardContent className='pt-6'>
              <p className='text-xs uppercase tracking-wide text-gray-500'>Casos totales</p>
              <p className='mt-2 text-3xl font-semibold text-gray-900'>{summary.totalCases}</p>
              <p className='mt-1 text-sm text-gray-500'>
                {summary.activeCases} activos · {summary.closedCases} cerrados
              </p>
            </CardContent>
          </Card>
          <Card className='bg-white shadow-sm col-span-1 md:col-span-3 lg:col-span-3'>
            <CardContent className='pt-6'>
              <p className='text-xs uppercase tracking-wide text-gray-500'>Honorarios comprometidos</p>
              <p className='mt-2 text-3xl font-semibold text-gray-900'>{formatUf(summary.ufTotals.total)}</p>
              <p className='mt-1 text-sm text-gray-500'>Suma de casos en UF</p>
            </CardContent>
          </Card>
          <Card className='bg-white shadow-sm col-span-1 md:col-span-3 lg:col-span-3'>
            <CardContent className='pt-6'>
              <p className='text-xs uppercase tracking-wide text-gray-500'>Pagado a la fecha</p>
              <p className='mt-2 text-3xl font-semibold text-emerald-600'>{formatUf(summary.ufTotals.paid)}</p>
              <p className='mt-1 text-sm text-gray-500'>Incluye abonos registrados</p>
            </CardContent>
          </Card>
          <Card className='bg-white shadow-sm col-span-1 md:col-span-3 lg:col-span-3'>
            <CardContent className='pt-6'>
              <p className='text-xs uppercase tracking-wide text-gray-500'>Saldo pendiente</p>
              <p className='mt-2 text-3xl font-semibold text-orange-600'>{formatUf(summary.ufTotals.pending)}</p>
              <p className='mt-1 text-sm text-gray-500'>Por pagar según registro</p>
            </CardContent>
          </Card>
        </div>

        {summary.ufTotals.hasMixedCurrencies && (
          <div className='mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700'>
            Algunos expedientes están configurados en otra moneda. Los totales se muestran solo en UF.
          </div>
        )}

        <div className='grid grid-cols-1 gap-6 lg:grid-cols-[272px_minmax(0,1fr)_300px] lg:gap-8'>
          {/* Sidebar - Lista de casos */}
          <div className='lg:sticky lg:top-24 lg:h-[calc(100dvh-6rem)] lg:overflow-auto'>
            <Card className='h-full'>
              <CardHeader>
                <CardTitle className='text-lg'>Mis Casos</CardTitle>
              </CardHeader>
              <CardContent className='p-0'>
                <div className='space-y-1'>
                  {cases.map((caseItem) => (
                    <button
                      key={caseItem.id}
                      onClick={() => setSelectedCase(caseItem)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                        selectedCase?.id === caseItem.id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
                      }`}
                    >
                      <div className='space-y-2'>
                        <h3 className='font-medium text-sm text-gray-900 line-clamp-2'>
                          {caseItem.caratulado}
                        </h3>
                        <div className='flex items-center justify-between'>
                          {getStatusBadge(caseItem.estado || 'activo')}
                          {getPriorityIcon(caseItem.prioridad || 'media')}
                        </div>
                        {caseItem.etapa_actual && (
                          <p className='text-xs text-gray-500'>
                            {caseItem.etapa_actual}
                          </p>
                        )}
                        <div className='text-xs text-gray-500'>
                          {caseItem.honorario_total_uf !== null ? (
                            <>
                              <p>{formatUf(caseItem.honorario_total_uf)} total</p>
                              <p className='mt-1 flex items-center justify-between'>
                                <span>Pagado</span>
                                <span className='font-medium text-gray-800'>
                                  {formatUf(caseItem.honorario_pagado_uf)}
                                </span>
                              </p>
                              <div className='mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200'>
                                <div
                                  className='h-full rounded-full bg-blue-500 transition-all'
                                  style={{ width: `${getPaymentProgress(caseItem)}%` }}
                                />
                              </div>
                            </>
                          ) : (
                            <p className='text-gray-400'>Honorarios por definir</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                
                {cases.length === 0 && (
                  <div className='p-8 text-center text-gray-500'>
                    <Scale className='h-12 w-12 mx-auto mb-4 text-gray-300' />
                    <p>No tienes casos asignados</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Contenido principal */}
          <div className='w-full min-w-0'>
            {selectedCase ? (
              <div className='space-y-6 min-w-0'>
                {/* Header del caso */}
                <Card>
                  <CardContent className='pt-6'>
                    <div className='flex items-start justify-between mb-4'>
                      <div className='flex-1'>
                        <h2 className='text-2xl font-bold text-gray-900 mb-2'>
                          {selectedCase.caratulado}
                        </h2>
                      <div className='flex flex-wrap items-center gap-2 text-sm text-gray-600'>
                        {selectedCase.numero_causa && <span>Causa: {selectedCase.numero_causa}</span>}
                        {selectedCase.materia && <span>Materia: {selectedCase.materia}</span>}
                        {selectedCase.tribunal && <span>Tribunal: {selectedCase.tribunal}</span>}
                      </div>
                    </div>
                    <div className='flex flex-col items-end space-y-2'>
                      {getStatusBadge(selectedCase.estado || 'activo')}
                      {selectedCase.etapa_actual && <Badge variant='outline'>{selectedCase.etapa_actual}</Badge>}
                      {selectedCase.sentencia_estado && selectedCase.sentencia_estado !== 'no_registra' && (
                        <span className='text-xs text-gray-600'>
                          Sentencia: {getSentenceStatusLabel(selectedCase.sentencia_estado)}
                          {selectedCase.sentencia_fecha && (
                            <> · {formatDate(selectedCase.sentencia_fecha)}</>
                          )}
                        </span>
                      )}
                    </div>
                    </div>

                    {selectedCase.honorario_total_uf !== null && (
                      <>
                        <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
                          <div className='rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-center'>
                            <p className='text-xs font-medium uppercase tracking-wide text-blue-600'>Honorario total</p>
                            <p className='mt-2 text-lg font-semibold text-blue-900'>{formatUf(selectedCase.honorario_total_uf)}</p>
                          </div>
                          <div className='rounded-lg border border-emerald-100 bg-emerald-50/70 p-4 text-center'>
                            <p className='text-xs font-medium uppercase tracking-wide text-emerald-600'>Pagado</p>
                            <p className='mt-2 text-lg font-semibold text-emerald-900'>{formatUf(selectedCase.honorario_pagado_uf)}</p>
                          </div>
                          <div className='rounded-lg border border-orange-100 bg-orange-50/70 p-4 text-center'>
                            <p className='text-xs font-medium uppercase tracking-wide text-orange-600'>Saldo pendiente</p>
                            <p className='mt-2 text-lg font-semibold text-orange-900'>
                              {formatUf(Math.max((selectedCase.honorario_total_uf ?? 0) - (selectedCase.honorario_pagado_uf ?? 0), 0))}
                            </p>
                            <p className='mt-2 text-xs text-orange-600'>Avance {getPaymentProgress(selectedCase)}%</p>
                          </div>
                        </div>
                        <div className='mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200'>
                          <div
                            className='h-full rounded-full bg-blue-500 transition-all'
                            style={{ width: `${getPaymentProgress(selectedCase)}%` }}
                          />
                        </div>
                      </>
                    )}

                    {/* Información del abogado */}
                    {lawyerData && (
                      <div className='mt-4 rounded-lg bg-gray-50 p-4'>
                        <h3 className='mb-2 flex items-center font-medium text-gray-900'>
                          <User className='mr-2 h-4 w-4' />
                          Abogado Responsable
                        </h3>
                        <div className='space-y-1 text-sm text-gray-600'>
                          <p>{lawyerData.nombre ?? 'Por confirmar'}</p>
                          {lawyerData.telefono && (
                            <p className='flex items-center'>
                              <Phone className='mr-1 h-3 w-3' />
                              {lawyerData.telefono}
                            </p>
                          )}
                          {lawyerData.email && (
                            <p className='flex items-center'>
                              <Mail className='mr-1 h-3 w-3' />
                              {lawyerData.email}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Información adicional */}
                    <div className='mt-4 grid grid-cols-1 gap-4 md:grid-cols-3'>
                      {selectedCase.fecha_inicio && (
                        <div className='rounded-lg bg-blue-50 p-3 text-center'>
                          <Calendar className='mx-auto mb-1 h-5 w-5 text-blue-600' />
                          <p className='text-xs font-medium text-blue-600'>Fecha Inicio</p>
                          <p className='text-sm text-blue-900'>{formatDate(selectedCase.fecha_inicio)}</p>
                        </div>
                      )}

                      {selectedCase.valor_estimado && (
                        <div className='rounded-lg bg-green-50 p-3 text-center'>
                          <span className='mb-1 block text-lg'>💰</span>
                          <p className='text-xs font-medium text-green-600'>Valor Estimado</p>
                          <p className='text-sm text-green-900'>{formatCurrency(selectedCase.valor_estimado)}</p>
                        </div>
                      )}

                      {selectedCase.contraparte && (
                        <div className='rounded-lg bg-orange-50 p-3 text-center'>
                          <User className='mx-auto mb-1 h-5 w-5 text-orange-600' />
                          <p className='text-xs font-medium text-orange-600'>Contraparte</p>
                          <p className='text-sm text-orange-900'>{selectedCase.contraparte}</p>
                        </div>
                      )}

                      {selectedCase.sentencia_estado && selectedCase.sentencia_estado !== 'no_registra' && (
                        <div className='rounded-lg bg-purple-50 p-3 text-center'>
                          <Calendar className='mx-auto mb-1 h-5 w-5 text-purple-600' />
                          <p className='text-xs font-medium text-purple-600'>Sentencia</p>
                          <p className='text-sm text-purple-900'>
                            {getSentenceStatusLabel(selectedCase.sentencia_estado)}
                          </p>
                          {selectedCase.sentencia_fecha && (
                            <p className='mt-1 text-xs text-purple-700'>
                              {formatDate(selectedCase.sentencia_fecha)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Tabs de navegación */}
                <div className='border-b border-gray-200'>
                  <nav className='-mb-px flex space-x-8'>
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                            activeTab === tab.id
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <Icon className='h-4 w-4' />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Contenido de las tabs */}
                <div className='mt-6 min-w-0'>
                  {activeTab === 'overview' && (
                    <div className='space-y-6 min-w-0'>
                      {observacionesTexto && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Observaciones del Caso</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className='text-gray-700 whitespace-pre-wrap'>
                              {observacionesTexto}
                            </p>
                          </CardContent>
                        </Card>
                      )}
                      <Card>
                        <CardHeader>
                          <CardTitle className='text-lg'>Progreso Reciente</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <TimelinePanel 
                            caseId={selectedCase.id}
                            caseMateria={selectedCase.materia ?? 'General'}
                            canManageStages={false}
                            showPrivateStages={false}
                          />
                        </CardContent>
                      </Card>

                      <Card className='lg:hidden'>
                        <CardHeader>
                          <CardTitle className='text-lg'>Documentos Recientes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <DocumentsPanel 
                            caseId={selectedCase.id}
                            canUpload={false}
                            canEdit={false}
                            canDelete={false}
                            showPrivateDocuments={false}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {activeTab === 'timeline' && (
                    <TimelinePanel 
                      caseId={selectedCase.id}
                      caseMateria={selectedCase.materia ?? 'General'}
                      canManageStages={false}
                      showPrivateStages={false}
                    />
                  )}

                  {activeTab === 'documents' && (
                    <DocumentsPanel 
                      caseId={selectedCase.id}
                      canUpload={false}
                      canEdit={false}
                      canDelete={false}
                      showPrivateDocuments={false}
                    />
                  )}

                  {activeTab === 'notes' && (
                    <NotesPanel 
                      caseId={selectedCase.id}
                      canCreateNotes={false}
                      canEditNotes={false}
                      showPrivateNotes={false}
                    />
                  )}

                  {activeTab === 'messages' && (
                    <CaseMessagesPanel
                      caseId={selectedCase.id}
                      initialMessages={[] as CaseMessageDTO[]}
                      currentProfileId={profile.id}
                      allowSend={true}
                    />
                  )}

                  {activeTab === 'requests' && (
                    <InfoRequestsPanel
                      caseId={selectedCase.id}
                      canCreateRequests={true}
                      canRespondRequests={false}
                      showPrivateRequests={false}
                    />
                  )}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className='pt-6'>
                  <div className='text-center py-12'>
                    <Scale className='h-16 w-16 mx-auto mb-4 text-gray-300' />
                    <h3 className='text-lg font-medium text-gray-900 mb-2'>
                      Bienvenido al Portal Cliente
                    </h3>
                    <p className='text-gray-600'>
                      Selecciona un caso de la lista para ver su información detallada
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Rail derecho */}
          <div className='hidden lg:flex lg:flex-col lg:gap-6 lg:sticky lg:top-24 lg:h-[calc(100dvh-6rem)] lg:overflow-auto'>
            {selectedCase && (
              <Card className='w-full'>
                <CardHeader>
                  <CardTitle className='text-lg'>Documentos Recientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <DocumentsPanel 
                    caseId={selectedCase.id}
                    canUpload={false}
                    canEdit={false}
                    canDelete={false}
                    showPrivateDocuments={false}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
