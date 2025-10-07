'use client';

import { useState } from 'react';
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

interface ClientDashboardProps {
  profile: Profile & { email?: string | null };
  cases: Case[];
}

export function ClientDashboard({ profile, cases }: ClientDashboardProps) {
  const [selectedCase, setSelectedCase] = useState<Case | null>(cases[0] || null);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'documents' | 'notes' | 'messages' | 'requests'>('overview');
  const lawyerData =
    selectedCase &&
    typeof (selectedCase as any).abogado_responsable === 'object' &&
    (selectedCase as any).abogado_responsable !== null
      ? ((selectedCase as any).abogado_responsable as {
          nombre?: string | null;
          telefono?: string | null;
          email?: string | null;
        })
      : null;

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

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <div className='bg-white shadow-sm border-b'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center justify-between h-16'>
            <div className='flex items-center space-x-4'>
              <Scale className='h-8 w-8 text-blue-600' />
              <div>
                <h1 className='text-xl font-semibold text-gray-900'>Portal Cliente</h1>
                <p className='text-sm text-gray-500'>LEXSER</p>
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

      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        <div className='grid grid-cols-1 lg:grid-cols-4 gap-8'>
          {/* Sidebar - Lista de casos */}
          <div className='lg:col-span-1'>
            <Card>
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
          <div className='lg:col-span-3'>
            {selectedCase ? (
              <div className='space-y-6'>
                {/* Header del caso */}
                <Card>
                  <CardContent className='pt-6'>
                    <div className='flex items-start justify-between mb-4'>
                      <div className='flex-1'>
                        <h2 className='text-2xl font-bold text-gray-900 mb-2'>
                          {selectedCase.caratulado}
                        </h2>
                        <div className='flex items-center space-x-4 text-sm text-gray-600'>
                          {selectedCase.numero_causa && (
                            <span>Causa: {selectedCase.numero_causa}</span>
                          )}
                          {selectedCase.materia && (
                            <span>Materia: {selectedCase.materia}</span>
                          )}
                          {selectedCase.tribunal && (
                            <span>Tribunal: {selectedCase.tribunal}</span>
                          )}
                        </div>
                      </div>
                      <div className='flex flex-col items-end space-y-2'>
                        {getStatusBadge(selectedCase.estado || 'activo')}
                        {selectedCase.etapa_actual && (
                          <Badge variant='outline'>
                            {selectedCase.etapa_actual}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Información del abogado */}
                    {lawyerData && (
                      <div className='bg-gray-50 rounded-lg p-4'>
                        <h3 className='font-medium text-gray-900 mb-2 flex items-center'>
                          <User className='h-4 w-4 mr-2' />
                          Abogado Responsable
                        </h3>
                        <div className='space-y-1 text-sm text-gray-600'>
                          <p>{lawyerData.nombre ?? 'Por confirmar'}</p>
                          {lawyerData.telefono && (
                            <p className='flex items-center'>
                              <Phone className='h-3 w-3 mr-1' />
                              {lawyerData.telefono}
                            </p>
                          )}
                          {lawyerData.email && (
                            <p className='flex items-center'>
                              <Mail className='h-3 w-3 mr-1' />
                              {lawyerData.email}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Información adicional */}
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mt-4'>
                      {selectedCase.fecha_inicio && (
                        <div className='text-center p-3 bg-blue-50 rounded-lg'>
                          <Calendar className='h-5 w-5 mx-auto mb-1 text-blue-600' />
                          <p className='text-xs text-blue-600 font-medium'>Fecha Inicio</p>
                          <p className='text-sm text-blue-900'>
                            {formatDate(selectedCase.fecha_inicio)}
                          </p>
                        </div>
                      )}
                      
                      {selectedCase.valor_estimado && (
                        <div className='text-center p-3 bg-green-50 rounded-lg'>
                          <span className='text-lg mb-1 block'>💰</span>
                          <p className='text-xs text-green-600 font-medium'>Valor Estimado</p>
                          <p className='text-sm text-green-900'>
                            {formatCurrency(selectedCase.valor_estimado)}
                          </p>
                        </div>
                      )}

                      {selectedCase.contraparte && (
                        <div className='text-center p-3 bg-orange-50 rounded-lg'>
                          <User className='h-5 w-5 mx-auto mb-1 text-orange-600' />
                          <p className='text-xs text-orange-600 font-medium'>Contraparte</p>
                          <p className='text-sm text-orange-900'>
                            {selectedCase.contraparte}
                          </p>
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
                <div className='mt-6'>
                  {activeTab === 'overview' && (
                    <div className='space-y-6'>
                      {selectedCase.observaciones && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Observaciones del Caso</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className='text-gray-700 whitespace-pre-wrap'>
                              {selectedCase.observaciones}
                            </p>
                          </CardContent>
                        </Card>
                      )}
                      
                      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
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

                        <Card>
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
        </div>
      </div>
    </div>
  );
}
