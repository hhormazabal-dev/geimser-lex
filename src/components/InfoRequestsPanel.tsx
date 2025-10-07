'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  createInfoRequest, 
  updateInfoRequest, 
  respondInfoRequest, 
  closeInfoRequest, 
  getInfoRequests 
} from '@/lib/actions/info-requests';
import { formatRelativeTime, isDateInPast } from '@/lib/utils';
import { 
  MessageCircle, 
  Plus, 
  Reply, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Calendar,
  User,
  Loader2,
  Send,
  X
} from 'lucide-react';
import type { InfoRequest } from '@/lib/supabase/types';
import type { CreateInfoRequestInput, RespondInfoRequestInput } from '@/lib/validators/info-requests';
import { 
  INFO_REQUEST_TYPES, 
  INFO_REQUEST_STATUSES, 
  INFO_REQUEST_PRIORITIES 
} from '@/lib/validators/info-requests';

interface InfoRequestsPanelProps {
  caseId: string;
  canCreateRequests?: boolean;
  canRespondRequests?: boolean;
  showPrivateRequests?: boolean;
}

export function InfoRequestsPanel({ 
  caseId, 
  canCreateRequests = false,
  canRespondRequests = false,
  showPrivateRequests = true 
}: InfoRequestsPanelProps) {
  const [requests, setRequests] = useState<InfoRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    titulo: '',
    descripcion: '',
    tipo: 'informacion' as const,
    prioridad: 'media' as const,
    fecha_limite: '',
    es_publica: true,
  });
  const [response, setResponse] = useState({
    respuesta: '',
    archivo_adjunto: '',
  });
  const { toast } = useToast();

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const result = await getInfoRequests({ case_id: caseId, page: 1, limit: 50 });
      
      if (result.success) {
        setRequests(result.requests);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al cargar solicitudes',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading requests:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al cargar solicitudes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [caseId]);

  const handleCreateRequest = async () => {
    if (!newRequest.titulo.trim() || !newRequest.descripcion.trim()) {
      toast({
        title: 'Error',
        description: 'El título y la descripción son requeridos',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const requestData: CreateInfoRequestInput = {
        case_id: caseId,
        titulo: newRequest.titulo.trim(),
        descripcion: newRequest.descripcion.trim(),
        tipo: newRequest.tipo,
        prioridad: newRequest.prioridad,
        fecha_limite: newRequest.fecha_limite || undefined,
        es_publica: newRequest.es_publica,
      };

      const result = await createInfoRequest(requestData);
      
      if (result.success) {
        toast({
          title: 'Solicitud creada',
          description: 'La solicitud ha sido creada exitosamente',
        });
        setNewRequest({
          titulo: '',
          descripcion: '',
          tipo: 'informacion',
          prioridad: 'media',
          fecha_limite: '',
          es_publica: true,
        });
        setShowCreateForm(false);
        await loadRequests();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al crear la solicitud',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating request:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al crear la solicitud',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRespondRequest = async (requestId: string) => {
    if (!response.respuesta.trim()) {
      toast({
        title: 'Error',
        description: 'La respuesta es requerida',
        variant: 'destructive',
      });
      return;
    }

    try {
      const responseData: RespondInfoRequestInput = {
        respuesta: response.respuesta.trim(),
        archivo_adjunto: response.archivo_adjunto || undefined,
      };

      const result = await respondInfoRequest(requestId, responseData);
      
      if (result.success) {
        toast({
          title: 'Respuesta enviada',
          description: 'La respuesta ha sido enviada exitosamente',
        });
        setResponse({ respuesta: '', archivo_adjunto: '' });
        setRespondingTo(null);
        await loadRequests();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al enviar la respuesta',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error responding to request:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al enviar la respuesta',
        variant: 'destructive',
      });
    }
  };

  const handleCloseRequest = async (requestId: string) => {
    try {
      const result = await closeInfoRequest(requestId);
      
      if (result.success) {
        toast({
          title: 'Solicitud cerrada',
          description: 'La solicitud ha sido cerrada',
        });
        await loadRequests();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al cerrar la solicitud',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error closing request:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al cerrar la solicitud',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'respondida':
        return <CheckCircle className='h-5 w-5 text-green-600' />;
      case 'en_revision':
        return <Clock className='h-5 w-5 text-blue-600' />;
      case 'cerrada':
        return <X className='h-5 w-5 text-gray-600' />;
      default:
        return <MessageCircle className='h-5 w-5 text-yellow-600' />;
    }
  };

  const getStatusBadge = (estado: string) => {
    const status = INFO_REQUEST_STATUSES.find(s => s.value === estado);
    if (!status) return null;

    const colorClasses = {
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      gray: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[status.color as keyof typeof colorClasses]}`}>
        {status.label}
      </span>
    );
  };

  const getPriorityBadge = (prioridad: string) => {
    const priority = INFO_REQUEST_PRIORITIES.find(p => p.value === prioridad);
    if (!priority) return null;

    const colorClasses = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      orange: 'bg-orange-100 text-orange-800',
      red: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[priority.color as keyof typeof colorClasses]}`}>
        {priority.label}
      </span>
    );
  };

  const getTypeIcon = (tipo: string) => {
    const typeInfo = INFO_REQUEST_TYPES.find(t => t.value === tipo);
    return typeInfo ? typeInfo.label : tipo;
  };

  const filteredRequests = showPrivateRequests 
    ? requests 
    : requests.filter(req => req.es_publica);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <MessageCircle className='h-5 w-5' />
            Solicitudes de Información
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
            <MessageCircle className='h-5 w-5' />
            Solicitudes de Información ({filteredRequests.length})
          </CardTitle>
          {canCreateRequests && (
            <Button
              size='sm'
              onClick={() => setShowCreateForm(!showCreateForm)}
              disabled={isCreating}
            >
              <Plus className='h-4 w-4 mr-2' />
              Nueva Solicitud
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Formulario para nueva solicitud */}
        {showCreateForm && canCreateRequests && (
          <Card className='border-dashed'>
            <CardContent className='pt-6'>
              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Título *
                  </label>
                  <input
                    type='text'
                    value={newRequest.titulo}
                    onChange={(e) => setNewRequest({ ...newRequest, titulo: e.target.value })}
                    placeholder='Título de la solicitud'
                    className='form-input'
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Descripción *
                  </label>
                  <textarea
                    value={newRequest.descripcion}
                    onChange={(e) => setNewRequest({ ...newRequest, descripcion: e.target.value })}
                    placeholder='Describe detalladamente lo que necesitas...'
                    rows={4}
                    className='form-input'
                  />
                </div>

                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div>
                    <label className='block text-sm font-medium mb-2'>
                      Tipo
                    </label>
                    <select
                      value={newRequest.tipo}
                      onChange={(e) => setNewRequest({ ...newRequest, tipo: e.target.value as any })}
                      className='form-input'
                    >
                      {INFO_REQUEST_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className='block text-sm font-medium mb-2'>
                      Prioridad
                    </label>
                    <select
                      value={newRequest.prioridad}
                      onChange={(e) => setNewRequest({ ...newRequest, prioridad: e.target.value as any })}
                      className='form-input'
                    >
                      {INFO_REQUEST_PRIORITIES.map(priority => (
                        <option key={priority.value} value={priority.value}>
                          {priority.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className='block text-sm font-medium mb-2'>
                      Fecha límite (opcional)
                    </label>
                    <input
                      type='date'
                      value={newRequest.fecha_limite}
                      onChange={(e) => setNewRequest({ ...newRequest, fecha_limite: e.target.value })}
                      className='form-input'
                    />
                  </div>
                </div>

                <div>
                  <label className='flex items-center gap-2'>
                    <input
                      type='checkbox'
                      checked={newRequest.es_publica}
                      onChange={(e) => setNewRequest({ ...newRequest, es_publica: e.target.checked })}
                    />
                    <span className='text-sm'>Visible para el abogado</span>
                  </label>
                </div>

                <div className='flex justify-end space-x-2'>
                  <Button
                    variant='outline'
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewRequest({
                        titulo: '',
                        descripcion: '',
                        tipo: 'informacion',
                        prioridad: 'media',
                        fecha_limite: '',
                        es_publica: true,
                      });
                    }}
                    disabled={isCreating}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateRequest} disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                        Creando...
                      </>
                    ) : (
                      'Crear Solicitud'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de solicitudes */}
        <div className='space-y-3'>
          {filteredRequests.map((request) => (
            <RequestItem
              key={request.id}
              request={request}
              canRespond={canRespondRequests}
              isResponding={respondingTo === request.id}
              response={response}
              onStartResponding={() => setRespondingTo(request.id)}
              onCancelResponding={() => {
                setRespondingTo(null);
                setResponse({ respuesta: '', archivo_adjunto: '' });
              }}
              onResponseChange={setResponse}
              onSendResponse={() => handleRespondRequest(request.id)}
              onClose={() => handleCloseRequest(request.id)}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
              getPriorityBadge={getPriorityBadge}
              getTypeIcon={getTypeIcon}
            />
          ))}
        </div>

        {filteredRequests.length === 0 && (
          <div className='text-center py-8 text-gray-500'>
            <MessageCircle className='h-12 w-12 mx-auto mb-4 text-gray-300' />
            <p>No hay solicitudes de información</p>
            {canCreateRequests && (
              <p className='text-sm mt-2'>
                Haz clic en "Nueva Solicitud" para crear la primera solicitud
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RequestItemProps {
  request: InfoRequest & { 
    creador?: { nombre: string };
    respondido_por_profile?: { nombre: string };
  };
  canRespond: boolean;
  isResponding: boolean;
  response: { respuesta: string; archivo_adjunto: string };
  onStartResponding: () => void;
  onCancelResponding: () => void;
  onResponseChange: (response: { respuesta: string; archivo_adjunto: string }) => void;
  onSendResponse: () => void;
  onClose: () => void;
  getStatusIcon: (estado: string) => React.ReactNode;
  getStatusBadge: (estado: string) => React.ReactNode;
  getPriorityBadge: (prioridad: string) => React.ReactNode;
  getTypeIcon: (tipo: string) => string;
}

function RequestItem({
  request,
  canRespond,
  isResponding,
  response,
  onStartResponding,
  onCancelResponding,
  onResponseChange,
  onSendResponse,
  onClose,
  getStatusIcon,
  getStatusBadge,
  getPriorityBadge,
  getTypeIcon,
}: RequestItemProps) {
  const isOverdue = request.fecha_limite && isDateInPast(request.fecha_limite) && request.estado !== 'respondida' && request.estado !== 'cerrada';

  return (
    <Card className={`border-l-4 ${isOverdue ? 'border-l-red-500' : 'border-l-blue-500'}`}>
      <CardContent className='pt-4'>
        <div className='flex items-start justify-between mb-3'>
          <div className='flex items-center gap-3'>
            {getStatusIcon(request.estado || 'pendiente')}
            <div>
              <h4 className='font-medium text-gray-900'>
                {request.titulo}
              </h4>
              <div className='flex items-center gap-2 mt-1'>
                {getStatusBadge(request.estado || 'pendiente')}
                {getPriorityBadge(request.prioridad || 'media')}
                <Badge variant='outline'>
                  {getTypeIcon(request.tipo || 'informacion')}
                </Badge>
                {!request.es_publica && (
                  <Badge variant='outline'>Privada</Badge>
                )}
              </div>
            </div>
          </div>
          
          {isOverdue && (
            <AlertTriangle className='h-5 w-5 text-red-500' />
          )}
        </div>

        <p className='text-sm text-gray-700 mb-3'>
          {request.descripcion}
        </p>

        <div className='flex items-center gap-4 text-sm text-gray-500 mb-3'>
          <div className='flex items-center gap-1'>
            <User className='h-4 w-4' />
            <span>{request.creador?.nombre || 'Usuario'}</span>
          </div>
          
          <span>{formatRelativeTime(request.created_at)}</span>
          
          {request.fecha_limite && (
            <div className='flex items-center gap-1'>
              <Calendar className='h-4 w-4' />
              <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                Límite: {new Date(request.fecha_limite).toLocaleDateString('es-CL')}
              </span>
            </div>
          )}
        </div>

        {/* Respuesta existente */}
        {request.respuesta && (
          <div className='bg-gray-50 rounded-lg p-3 mb-3'>
            <div className='flex items-center gap-2 mb-2'>
              <Reply className='h-4 w-4 text-blue-600' />
              <span className='text-sm font-medium'>
                Respuesta de {request.respondido_por_profile?.nombre || 'Abogado'}
              </span>
              <span className='text-xs text-gray-500'>
                {request.respondido_at && formatRelativeTime(request.respondido_at)}
              </span>
            </div>
            <p className='text-sm text-gray-700'>
              {request.respuesta}
            </p>
            {request.archivo_adjunto && (
              <a 
                href={request.archivo_adjunto} 
                target='_blank' 
                rel='noopener noreferrer'
                className='text-sm text-blue-600 hover:underline mt-2 inline-block'
              >
                Ver archivo adjunto
              </a>
            )}
          </div>
        )}

        {/* Formulario de respuesta */}
        {isResponding && (
          <div className='bg-blue-50 rounded-lg p-3 mb-3'>
            <div className='space-y-3'>
              <textarea
                value={response.respuesta}
                onChange={(e) => onResponseChange({ ...response, respuesta: e.target.value })}
                placeholder='Escribe tu respuesta...'
                rows={3}
                className='form-input'
              />
              <input
                type='url'
                value={response.archivo_adjunto}
                onChange={(e) => onResponseChange({ ...response, archivo_adjunto: e.target.value })}
                placeholder='URL del archivo adjunto (opcional)'
                className='form-input'
              />
              <div className='flex justify-end space-x-2'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={onCancelResponding}
                >
                  Cancelar
                </Button>
                <Button
                  size='sm'
                  onClick={onSendResponse}
                >
                  <Send className='h-4 w-4 mr-1' />
                  Enviar Respuesta
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Acciones */}
        {canRespond && request.estado !== 'cerrada' && (
          <div className='flex items-center gap-2'>
            {request.estado !== 'respondida' && !isResponding && (
              <Button
                size='sm'
                variant='outline'
                onClick={onStartResponding}
              >
                <Reply className='h-4 w-4 mr-1' />
                Responder
              </Button>
            )}
            
            {request.estado === 'respondida' && (
              <Button
                size='sm'
                variant='outline'
                onClick={onClose}
              >
                <X className='h-4 w-4 mr-1' />
                Cerrar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
