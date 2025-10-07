'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { notificationClient } from '@/lib/notifications/client';
import { formatRelativeTime } from '@/lib/utils';
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Filter,
  Loader2,
  TrendingUp,
  Send
} from 'lucide-react';

interface NotificationLog {
  id: string;
  type: string;
  recipient: string;
  subject?: string | null;
  template: string;
  data: any;
  status: string;
  error_message?: string | null;
  sent_at?: string | null;
  created_at: string;
}

interface NotificationStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byTemplate: Record<string, number>;
  successRate: number;
}

interface NotificationManagerProps {
  canManage?: boolean;
}

/** Type guard para convertir unknown -> NotificationLog de forma segura */
function isNotificationLog(v: unknown): v is NotificationLog {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.type === 'string' &&
    typeof o.recipient === 'string' &&
    typeof o.template === 'string' &&
    typeof o.status === 'string' &&
    typeof o.created_at === 'string'
  );
}

/** Normaliza claves string (evita undefined/null en UI) */
const s = (v: string | null | undefined): string => (typeof v === 'string' ? v : '');

export function NotificationManager({ canManage = false }: NotificationManagerProps) {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    template: '',
    recipient: '',
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [logsResult, statsResult] = await Promise.all([
        notificationClient.getNotificationLogs({
          ...filters,
          limit: 50,
        }),
        notificationClient.getNotificationStats(selectedPeriod),
      ]);

      // Logs
      if (logsResult.success) {
        const raw = Array.isArray(logsResult.logs) ? logsResult.logs : [];
        const safe = raw.filter(isNotificationLog);
        setLogs(safe);
      } else {
        toast({
          title: 'Error',
          description: logsResult.error || 'Error al cargar logs',
          variant: 'destructive',
        });
        setLogs([]); // aseguremos un estado consistente
      }

      // Stats
      if (statsResult.success) {
        setStats(statsResult.stats ?? null);
      } else {
        toast({
          title: 'Error',
          description: statsResult.error || 'Error al cargar estadísticas',
          variant: 'destructive',
        });
        setStats(null);
      }
    } catch (error) {
      console.error('Error loading notification data:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al cargar datos',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, filters.type, filters.status, filters.template, filters.recipient, selectedPeriod]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      status: '',
      template: '',
      recipient: '',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className='h-4 w-4 text-green-600' />;
      case 'failed':
        return <XCircle className='h-4 w-4 text-red-600' />;
      case 'pending':
        return <Clock className='h-4 w-4 text-yellow-600' />;
      default:
        return <AlertTriangle className='h-4 w-4 text-gray-600' />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      sent: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      bounced: 'bg-orange-100 text-orange-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className='h-4 w-4' />;
      case 'sms':
        return <MessageSquare className='h-4 w-4' />;
      default:
        return <Bell className='h-4 w-4' />;
    }
  };

  const getTemplateLabel = (template: string) => {
    const labels: Record<string, string> = {
      magic_link: 'Enlace de Acceso',
      case_update: 'Actualización de Caso',
      deadline_reminder: 'Recordatorio de Vencimiento',
      info_request_response: 'Respuesta a Solicitud',
      weekly_summary: 'Resumen Semanal',
      overdue_stages_alert: 'Alerta de Etapas Vencidas',
    };
    return labels[template] || template;
  };

  if (!canManage) {
    return (
      <Card>
        <CardContent className='pt-6'>
          <div className='text-center py-8'>
            <Bell className='h-12 w-12 mx-auto mb-4 text-gray-300' />
            <p className='text-gray-500'>Sin permisos para gestionar notificaciones</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Bell className='h-5 w-5' />
            Gestión de Notificaciones
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
    <div className='space-y-6'>
      {/* Estadísticas */}
      {stats && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
          <Card>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Total Enviadas</p>
                  <p className='text-3xl font-bold text-gray-900'>{stats.total}</p>
                  <p className='text-sm text-gray-500 mt-1'>
                    Últimos {selectedPeriod === 'day' ? '1 día' : selectedPeriod === 'week' ? '7 días' : '30 días'}
                  </p>
                </div>
                <div className='h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center'>
                  <Send className='h-6 w-6 text-blue-600' />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Tasa de Éxito</p>
                  <p className='text-3xl font-bold text-gray-900'>{stats.successRate}%</p>
                  <p className='text-sm text-gray-500 mt-1'>
                    {(stats.byStatus.sent || 0)} exitosas
                  </p>
                </div>
                <div className='h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center'>
                  <TrendingUp className='h-6 w-6 text-green-600' />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Emails</p>
                  <p className='text-3xl font-bold text-gray-900'>{stats.byType.email || 0}</p>
                  <p className='text-sm text-gray-500 mt-1'>
                    {stats.total > 0 ? Math.round(((stats.byType.email || 0) / stats.total) * 100) : 0}% del total
                  </p>
                </div>
                <div className='h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center'>
                  <Mail className='h-6 w-6 text-purple-600' />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Fallidas</p>
                  <p className='text-3xl font-bold text-gray-900'>{stats.byStatus.failed || 0}</p>
                  <p className='text-sm text-gray-500 mt-1'>
                    {stats.total > 0 ? Math.round(((stats.byStatus.failed || 0) / stats.total) * 100) : 0}% del total
                  </p>
                </div>
                <div className='h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center'>
                  <XCircle className='h-6 w-6 text-red-600' />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controles */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle className='flex items-center gap-2'>
              <Bell className='h-5 w-5' />
              Historial de Notificaciones ({logs.length})
            </CardTitle>
            <div className='flex items-center space-x-2'>
              <div className='flex space-x-2'>
                {(['day', 'week', 'month'] as const).map((period) => (
                  <Button
                    key={period}
                    size='sm'
                    variant={selectedPeriod === period ? 'default' : 'outline'}
                    onClick={() => setSelectedPeriod(period)}
                  >
                    {period === 'day' ? '1 día' : period === 'week' ? '7 días' : '30 días'}
                  </Button>
                ))}
              </div>
              <Button
                size='sm'
                variant='outline'
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className='h-4 w-4 mr-2' />
                Filtros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          {showFilters && (
            <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg'>
              <div>
                <label className='block text-sm font-medium mb-2'>Tipo</label>
                <select
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  className='form-input'
                >
                  <option value=''>Todos</option>
                  <option value='email'>Email</option>
                  <option value='sms'>SMS</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium mb-2'>Estado</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className='form-input'
                >
                  <option value=''>Todos</option>
                  <option value='sent'>Enviado</option>
                  <option value='failed'>Fallido</option>
                  <option value='pending'>Pendiente</option>
                  <option value='bounced'>Rebotado</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium mb-2'>Plantilla</label>
                <select
                  value={filters.template}
                  onChange={(e) => handleFilterChange('template', e.target.value)}
                  className='form-input'
                >
                  <option value=''>Todas</option>
                  <option value='magic_link'>Enlace de Acceso</option>
                  <option value='case_update'>Actualización de Caso</option>
                  <option value='deadline_reminder'>Recordatorio</option>
                  <option value='info_request_response'>Respuesta a Solicitud</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium mb-2'>Destinatario</label>
                <input
                  type='text'
                  value={filters.recipient}
                  onChange={(e) => handleFilterChange('recipient', e.target.value)}
                  placeholder='Email o teléfono'
                  className='form-input'
                />
              </div>

              <div className='md:col-span-4 flex justify-end space-x-2'>
                <Button size='sm' variant='outline' onClick={clearFilters}>
                  Limpiar Filtros
                </Button>
                <Button size='sm' onClick={loadData}>
                  Aplicar Filtros
                </Button>
              </div>
            </div>
          )}

          {/* Lista de notificaciones */}
          <div className='space-y-3'>
            {logs.map((log) => (
              <Card key={log.id} className='border-l-4 border-l-blue-500'>
                <CardContent className='pt-4'>
                  <div className='flex items-start justify-between mb-3'>
                    <div className='flex items-center gap-3'>
                      {getTypeIcon(log.type)}
                      <div>
                        <h4 className='font-medium text-gray-900'>
                          {getTemplateLabel(log.template)}
                        </h4>
                        <p className='text-sm text-gray-600'>
                          Para: {s(log.recipient)}
                        </p>
                        {s(log.subject) && (
                          <p className='text-sm text-gray-500'>
                            Asunto: {s(log.subject)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      {getStatusIcon(log.status)}
                      {getStatusBadge(log.status)}
                    </div>
                  </div>

                  <div className='flex items-center justify-between text-sm text-gray-500'>
                    <div className='flex items-center space-x-4'>
                      <span>Creado: {formatRelativeTime(log.created_at)}</span>
                      {log.sent_at && (
                        <span>Enviado: {formatRelativeTime(log.sent_at)}</span>
                      )}
                    </div>
                    <Badge variant='outline'>
                      {log.type.toUpperCase()}
                    </Badge>
                  </div>

                  {s(log.error_message) && (
                    <div className='mt-3 p-3 bg-red-50 border border-red-200 rounded-lg'>
                      <p className='text-sm text-red-700'>
                        <strong>Error:</strong> {s(log.error_message)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {logs.length === 0 && (
            <div className='text-center py-8 text-gray-500'>
              <Bell className='h-12 w-12 mx-auto mb-4 text-gray-300' />
              <p>No hay notificaciones que mostrar</p>
              <p className='text-sm mt-2'>
                Ajusta los filtros para ver más resultados
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
