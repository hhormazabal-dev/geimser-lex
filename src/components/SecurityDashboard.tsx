'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  getAuditLogs,
  getSecurityAlerts,
  getUserSessions,
  getLoginAttempts,
  getAuditStats,
  endUserSession,
  cleanupOldLogs,
} from '@/lib/actions/audit';
import { formatRelativeTime, formatDateTime, getInitials, stringToColor } from '@/lib/utils';
import {
  Shield,
  AlertTriangle,
  Activity,
  Users,
  Monitor,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  Loader2,
  BarChart3,
  Globe,
  Smartphone,
  Laptop,
  Tablet,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import type { AuditLog, SecurityAlert, UserSession, LoginAttempt } from '@/lib/actions/audit';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

type Period = 'day' | 'week' | 'month';
type TabId = 'overview' | 'audit' | 'sessions' | 'alerts' | 'logins';

type AuditStats = {
  total_events: number;
  by_action: Record<string, number>;
  by_user: Array<{ user_email: string | null; count: number }>;
  timeline: Array<{ date: string; count: number }>;
};

interface SecurityDashboardProps {
  canManage?: boolean;
}

export function SecurityDashboard({ canManage = false }: SecurityDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [auditStats, setAuditStatsState] = useState<AuditStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('week');
  const [filters] = useState({
    table_name: '',
    action: '',
    severity: '',
    start_date: '',
    end_date: '',
  });
  const { toast } = useToast();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [auditResult, alertsResult, sessionsResult, loginsResult, statsResult] = await Promise.all([
        getAuditLogs({ ...filters, limit: 50 }),
        getSecurityAlerts(),
        getUserSessions(),
        getLoginAttempts({ limit: 50 }),
        getAuditStats(selectedPeriod),
      ]);

      if (auditResult?.success) setAuditLogs(auditResult.logs ?? []);
      if (alertsResult?.success) setSecurityAlerts(alertsResult.alerts ?? []);
      if (sessionsResult?.success) setUserSessions(sessionsResult.sessions ?? []);
      if (loginsResult?.success) setLoginAttempts(loginsResult.attempts ?? []);
      if (statsResult?.success) setAuditStatsState(statsResult.stats as AuditStats);
    } catch (error) {
      console.error('Error loading security data:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar datos de seguridad',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) {
      // no dependemos de filters porque no hay UI para cambiarlos aquí;
      // si después agregas inputs, agrégalos al deps array
      // eslint-disable-next-line react-hooks/exhaustive-deps
      loadData();
    }
  }, [canManage, selectedPeriod]);

  const handleEndSession = async (sessionId: string) => {
    if (!confirm('¿Estás seguro de que quieres terminar esta sesión?')) return;

    try {
      const result = await endUserSession(sessionId);
      if (result.success) {
        toast({
          title: 'Sesión terminada',
          description: 'La sesión ha sido terminada exitosamente',
        });
        await loadData();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al terminar sesión',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Error inesperado al terminar sesión',
        variant: 'destructive',
      });
    }
  };

  const handleCleanupLogs = async () => {
    if (!confirm('¿Estás seguro de que quieres limpiar los logs antiguos? Esta acción no se puede deshacer.')) return;

    try {
      const result = await cleanupOldLogs();
      if (result.success) {
        toast({
          title: 'Limpieza completada',
          description: 'Los logs antiguos han sido eliminados',
        });
        await loadData();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al limpiar logs',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Error inesperado al limpiar logs',
        variant: 'destructive',
      });
    }
  };

  const getSeverityBadge = (severity: string | null | undefined) => {
    const key = (severity ?? 'info').toLowerCase();
    const variants: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          variants[key] || variants.info
        }`}
      >
        {label}
      </span>
    );
  };

  const getDeviceIcon = (deviceType: string | null | undefined) => {
    switch ((deviceType ?? 'desktop').toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      default:
        return <Laptop className="h-4 w-4" />;
    }
  };

  const getActionIcon = (action: string | null | undefined) => {
    switch ((action ?? '').toUpperCase()) {
      case 'INSERT':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'UPDATE':
        return <Activity className="h-4 w-4 text-blue-600" />;
      case 'DELETE':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'SELECT':
        return <Eye className="h-4 w-4 text-gray-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (!canManage) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">Sin permisos para acceder al panel de seguridad</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Panel de Seguridad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const tabs: Array<{ id: TabId; label: string; icon: any }> = [
    { id: 'overview', label: 'Resumen', icon: BarChart3 },
    { id: 'audit', label: 'Auditoría', icon: Activity },
    { id: 'sessions', label: 'Sesiones', icon: Monitor },
    { id: 'alerts', label: 'Alertas', icon: AlertTriangle },
    { id: 'logins', label: 'Accesos', icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Panel de Seguridad
          </h1>
          <p className="text-gray-600">Monitoreo y auditoría del sistema</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button size="sm" variant="outline" onClick={handleCleanupLogs}>
            <Trash2 className="h-4 w-4 mr-2" />
            Limpiar Logs
          </Button>
        </div>
      </div>

      {/* Alertas críticas */}
      {securityAlerts.filter((a) => a.severity === 'critical' || a.severity === 'high').length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Alertas de Seguridad Críticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {securityAlerts
                .filter((a) => a.severity === 'critical' || a.severity === 'high')
                .slice(0, 3)
                .map((alert, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200"
                  >
                    <div>
                      <h4 className="font-medium text-red-900">{alert.description}</h4>
                      <p className="text-sm text-red-700">
                        {alert.user_email ? `Usuario: ${alert.user_email} • ` : ''}
                        Eventos: {alert.event_count} • Último: {formatRelativeTime(alert.last_seen)}
                      </p>
                    </div>
                    {getSeverityBadge(alert.severity)}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs de navegación */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
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
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenido de las tabs */}
      <div>
        {activeTab === 'overview' && auditStats && (
          <div className="space-y-6">
            {/* KPIs principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Eventos de Auditoría</p>
                      <p className="text-3xl font-bold text-gray-900">{auditStats.total_events}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Últimos {selectedPeriod === 'day' ? '1 día' : selectedPeriod === 'week' ? '7 días' : '30 días'}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Activity className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Sesiones Activas</p>
                      <p className="text-3xl font-bold text-gray-900">{userSessions.length}</p>
                      <p className="text-sm text-gray-500 mt-1">Usuarios conectados</p>
                    </div>
                    <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <Monitor className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Alertas de Seguridad</p>
                      <p className="text-3xl font-bold text-gray-900">{securityAlerts.length}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {securityAlerts.filter((a) => a.severity === 'high' || a.severity === 'critical').length}{' '}
                        críticas
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Intentos de Login</p>
                      <p className="text-3xl font-bold text-gray-900">{loginAttempts.length}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {loginAttempts.filter((a) => !a.success).length} fallidos
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Eventos por acción */}
              <Card>
                <CardHeader>
                  <CardTitle>Eventos por Acción</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.entries(auditStats.by_action).map(([action, count]) => ({
                          action,
                          count,
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ action, count }) => `${action} (${count})`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {Object.entries(auditStats.by_action).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Timeline de actividad */}
              <Card>
                <CardHeader>
                  <CardTitle>Timeline de Actividad</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={auditStats.timeline}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Usuarios más activos */}
            <Card>
              <CardHeader>
                <CardTitle>Usuarios Más Activos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditStats.by_user.slice(0, 5).map((user, index) => {
                    const email = user.user_email ?? '';
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className="h-8 w-8 rounded-full flex items-center justify-center text-white font-medium text-sm"
                            style={{ backgroundColor: stringToColor(email) }}
                          >
                            {getInitials(email || 'Usuario')}
                          </div>
                          <span className="font-medium">{email || 'Usuario'}</span>
                        </div>
                        <Badge variant="outline">{user.count} eventos</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'audit' && (
          <Card>
            <CardHeader>
              <CardTitle>Logs de Auditoría</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <Card key={log.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getActionIcon(log.action)}
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {(log.action ?? '').toUpperCase()} en {log.table_name ?? '—'}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {log.description || `Registro ${log.record_id ?? '—'}`}
                            </p>
                            {log.user_email && (
                              <p className="text-sm text-gray-500">Por: {log.user_email}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(log.severity)}
                          <Badge variant="outline">{(log.action ?? '').toUpperCase()}</Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center space-x-4">
                          <span>{formatRelativeTime(log.created_at)}</span>
                          {log.ip_address && (
                            <span className="flex items-center">
                              <Globe className="h-3 w-3 mr-1" />
                              {log.ip_address}
                            </span>
                          )}
                        </div>
                        <span>{log.category ?? '—'}</span>
                      </div>

                      {Array.isArray(log.changed_fields) && log.changed_fields.length > 0 && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 mb-1">Campos modificados:</p>
                          <div className="flex flex-wrap gap-1">
                            {log.changed_fields.map((field, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {field}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'sessions' && (
          <Card>
            <CardHeader>
              <CardTitle>Sesiones Activas ({userSessions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userSessions.map((session) => (
                  <Card key={session.id} className="border-l-4 border-l-green-500">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getDeviceIcon(session.device_type)}
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {session.browser ?? 'Navegador desconocido'} en {session.os ?? 'SO desconocido'}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {(session.device_type ?? 'desktop')} • {(session.ip_address ?? '—')}
                            </p>
                            {session.location_city && session.location_country ? (
                              <p className="text-sm text-gray-500">
                                {session.location_city}, {session.location_country}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-800">Activa</Badge>
                          <Button size="sm" variant="outline" onClick={() => handleEndSession(session.id)}>
                            Terminar
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center space-x-4">
                          <span>Iniciada: {formatRelativeTime(session.created_at)}</span>
                          <span>Última actividad: {formatRelativeTime(session.last_activity)}</span>
                        </div>
                        <span>Expira: {formatDateTime(session.expires_at)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {userSessions.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Monitor className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No hay sesiones activas</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'alerts' && (
          <Card>
            <CardHeader>
              <CardTitle>Alertas de Seguridad ({securityAlerts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {securityAlerts.map((alert, index) => (
                  <Card
                    key={index}
                    className={`border-l-4 ${
                      alert.severity === 'critical'
                        ? 'border-l-red-500'
                        : alert.severity === 'high'
                        ? 'border-l-orange-500'
                        : alert.severity === 'warning'
                        ? 'border-l-yellow-500'
                        : 'border-l-blue-500'
                    }`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{alert.description}</h4>
                          <p className="text-sm text-gray-600">
                            {alert.user_email ? `Usuario: ${alert.user_email}` : ''}
                            {alert.user_email && alert.ip_address ? ' • ' : ''}
                            {alert.ip_address ? `IP: ${alert.ip_address}` : ''}
                          </p>
                        </div>
                        {getSeverityBadge(alert.severity)}
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center space-x-4">
                          <span>Eventos: {alert.event_count}</span>
                          <span>Primer evento: {formatRelativeTime(alert.first_seen)}</span>
                        </div>
                        <span>Último: {formatRelativeTime(alert.last_seen)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {securityAlerts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" />
                    <p>No hay alertas de seguridad</p>
                    <p className="text-sm mt-2">El sistema está funcionando normalmente</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'logins' && (
          <Card>
            <CardHeader>
              <CardTitle>Intentos de Login Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loginAttempts.map((attempt) => (
                  <Card
                    key={attempt.id}
                    className={`border-l-4 ${attempt.success ? 'border-l-green-500' : 'border-l-red-500'}`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {attempt.success ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          <div>
                            <h4 className="font-medium text-gray-900">{attempt.email}</h4>
                            <p className="text-sm text-gray-600">IP: {attempt.ip_address}</p>
                            {!attempt.success && attempt.failure_reason && (
                              <p className="text-sm text-red-600">Razón: {attempt.failure_reason}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant={attempt.success ? 'default' : 'destructive'}>
                          {attempt.success ? 'Exitoso' : 'Fallido'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>{formatRelativeTime(attempt.created_at)}</span>
                        {attempt.user_agent && <span className="truncate max-w-md">{attempt.user_agent}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {loginAttempts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No hay intentos de login recientes</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
