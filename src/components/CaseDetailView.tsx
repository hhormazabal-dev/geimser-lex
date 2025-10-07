'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NotesPanel } from '@/components/NotesPanel';
import { DocumentsPanel } from '@/components/DocumentsPanel';
import { TimelinePanel } from '@/components/TimelinePanel';
import { InfoRequestsPanel } from '@/components/InfoRequestsPanel';
import { CaseMessagesPanel } from '@/components/CaseMessagesPanel';
import { formatDate, formatCurrency, getInitials, stringToColor } from '@/lib/utils';
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
} from 'lucide-react';
import type { Profile, Case } from '@/lib/supabase/types';
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
  };
  profile: Profile;
  messages: CaseMessageDTO[];
}

export function CaseDetailView({ case: caseData, profile, messages }: CaseDetailViewProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'timeline' | 'documents' | 'notes' | 'messages' | 'requests' | 'clients'
  >('overview');
  const router = useRouter();

  const canEdit =
    profile.role === 'admin_firma' ||
    (profile.role === 'abogado' && caseData.abogado_responsable?.id === profile.id);

  const canManageStages = canEdit;
  const canManageDocuments = canEdit;
  const canManageNotes = profile.role !== 'cliente';
  const canManageRequests = profile.role !== 'cliente';
  const canManageClients = canEdit;

  const showPrivateContent = profile.role !== 'cliente';

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
                <p className="text-sm text-gray-500">LEXSER</p>
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
              {caseData.abogado_responsable && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2 flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Abogado Responsable
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-blue-800">
                      {caseData.abogado_responsable.nombre}
                    </p>
                    {caseData.abogado_responsable.telefono && (
                      <p className="flex items-center text-blue-700">
                        <Phone className="h-3 w-3 mr-1" />
                        {caseData.abogado_responsable.telefono}
                      </p>
                    )}
                    {caseData.abogado_responsable.email && (
                      <p className="flex items-center text-blue-700">
                        <Mail className="h-3 w-3 mr-1" />
                        {caseData.abogado_responsable.email}
                      </p>
                    )}
                  </div>
                </div>
              )}

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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CaseDetailView;