'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, formatRelativeTime, getInitials, stringToColor } from '@/lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { 
  Scale, 
  FileText, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Activity,
  Target,
  User,
  Briefcase
} from 'lucide-react';
import type { Profile } from '@/lib/supabase/types';
import type { 
  DashboardStats,
  CasesByStatus,
  CasesByMateria,
  CasesByPriority,
  MonthlyStats,
  AbogadoWorkload
} from '@/lib/actions/analytics';

interface AdminDashboardProps {
  profile: Profile;
  data: {
    stats: DashboardStats | null;
    casesByStatus: CasesByStatus[];
    casesByMateria: CasesByMateria[];
    casesByPriority: CasesByPriority[];
    monthlyStats: MonthlyStats[];
    abogadoWorkload: AbogadoWorkload[];
    upcomingDeadlines: any[];
  };
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export function AdminDashboard({ profile, data }: AdminDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m'>('6m');

  const stats = data.stats;
  
  if (!stats) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <AlertTriangle className='h-12 w-12 mx-auto mb-4 text-red-500' />
          <h2 className='text-xl font-semibold text-gray-900 mb-2'>Error al cargar datos</h2>
          <p className='text-gray-600'>No se pudieron cargar las estadísticas del dashboard</p>
        </div>
      </div>
    );
  }

  const getFilteredMonthlyStats = () => {
    const months = selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12;
    return data.monthlyStats.slice(-months);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      activo: '#10B981',
      suspendido: '#F59E0B',
      archivado: '#6B7280',
      terminado: '#3B82F6',
    };
    return colors[status] || '#6B7280';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      baja: '#10B981',
      media: '#3B82F6',
      alta: '#F59E0B',
      urgente: '#EF4444',
    };
    return colors[priority] || '#6B7280';
  };

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <div className='bg-white shadow-sm border-b'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center justify-between h-16'>
            <div className='flex items-center space-x-4'>
              <Scale className='h-8 w-8 text-blue-600' />
              <div>
                <h1 className='text-xl font-semibold text-gray-900'>Dashboard Administrativo</h1>
                <p className='text-sm text-gray-500'>LEXCHILE</p>
              </div>
            </div>
            
            <div className='flex items-center space-x-4'>
              <div className='text-right'>
                <p className='text-sm font-medium text-gray-900'>{profile.nombre}</p>
                <p className='text-xs text-gray-500 capitalize'>{profile.role.replace('_', ' ')}</p>
              </div>
              <div 
                className='h-10 w-10 rounded-full flex items-center justify-center text-white font-medium'
                style={{ backgroundColor: stringToColor(profile.nombre) }}
              >
                {getInitials(profile.nombre)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* KPIs principales */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'>
          <Card>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Total Casos</p>
                  <p className='text-3xl font-bold text-gray-900'>{stats.totalCases}</p>
                  <p className='text-sm text-gray-500 mt-1'>
                    {stats.activeCases} activos
                  </p>
                </div>
                <div className='h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center'>
                  <Briefcase className='h-6 w-6 text-blue-600' />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Clientes</p>
                  <p className='text-3xl font-bold text-gray-900'>{stats.totalClients}</p>
                  <p className='text-sm text-gray-500 mt-1'>
                    Total registrados
                  </p>
                </div>
                <div className='h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center'>
                  <Users className='h-6 w-6 text-green-600' />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Documentos</p>
                  <p className='text-3xl font-bold text-gray-900'>{stats.totalDocuments}</p>
                  <p className='text-sm text-gray-500 mt-1'>
                    {stats.totalNotes} notas
                  </p>
                </div>
                <div className='h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center'>
                  <FileText className='h-6 w-6 text-purple-600' />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Pendientes</p>
                  <p className='text-3xl font-bold text-gray-900'>{stats.pendingRequests}</p>
                  <p className='text-sm text-gray-500 mt-1'>
                    {stats.overdueStages} vencidas
                  </p>
                </div>
                <div className='h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center'>
                  <Clock className='h-6 w-6 text-orange-600' />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alertas y próximos vencimientos */}
        {(stats.overdueStages > 0 || data.upcomingDeadlines.length > 0) && (
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8'>
            {stats.overdueStages > 0 && (
              <Card className='border-red-200'>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2 text-red-700'>
                    <AlertTriangle className='h-5 w-5' />
                    Etapas Vencidas ({stats.overdueStages})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-sm text-red-600'>
                    Hay {stats.overdueStages} etapas que han pasado su fecha programada y requieren atención inmediata.
                  </p>
                  <Button size='sm' className='mt-3' variant='outline'>
                    Ver Etapas Vencidas
                  </Button>
                </CardContent>
              </Card>
            )}

            {data.upcomingDeadlines.length > 0 && (
              <Card className='border-yellow-200'>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2 text-yellow-700'>
                    <Calendar className='h-5 w-5' />
                    Próximos Vencimientos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    {data.upcomingDeadlines.slice(0, 3).map((deadline, index) => (
                      <div key={index} className='flex items-center justify-between text-sm'>
                        <span className='truncate'>{deadline.etapa}</span>
                        <span className='text-gray-500'>
                          {formatDate(deadline.fecha_programada)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {data.upcomingDeadlines.length > 3 && (
                    <Button size='sm' className='mt-3' variant='outline'>
                      Ver Todos ({data.upcomingDeadlines.length})
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Gráficos principales */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8'>
          {/* Casos por estado */}
          <Card>
            <CardHeader>
              <CardTitle>Distribución de Casos por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width='100%' height={300}>
                <PieChart>
                  <Pie
                    data={data.casesByStatus}
                    cx='50%'
                    cy='50%'
                    labelLine={false}
                    label={({ status, percentage }) => `${status} (${percentage}%)`}
                    outerRadius={80}
                    fill='#8884d8'
                    dataKey='count'
                  >
                    {data.casesByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Casos por materia */}
          <Card>
            <CardHeader>
              <CardTitle>Casos por Materia Legal</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width='100%' height={300}>
                <BarChart data={data.casesByMateria}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis dataKey='materia' />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey='count' fill='#3B82F6' />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Estadísticas temporales */}
        <Card className='mb-8'>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle>Tendencias Mensuales</CardTitle>
              <div className='flex space-x-2'>
                {(['3m', '6m', '12m'] as const).map((period) => (
                  <Button
                    key={period}
                    size='sm'
                    variant={selectedPeriod === period ? 'default' : 'outline'}
                    onClick={() => setSelectedPeriod(period)}
                  >
                    {period === '3m' ? '3 meses' : period === '6m' ? '6 meses' : '12 meses'}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={400}>
              <LineChart data={getFilteredMonthlyStats()}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis dataKey='month' />
                <YAxis yAxisId='left' />
                <YAxis yAxisId='right' orientation='right' />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'revenue' ? formatCurrency(value as number) : value,
                    name === 'newCases' ? 'Casos Nuevos' : 
                    name === 'completedCases' ? 'Casos Completados' : 'Ingresos'
                  ]}
                />
                <Legend />
                <Bar yAxisId='left' dataKey='newCases' fill='#3B82F6' name='Casos Nuevos' />
                <Bar yAxisId='left' dataKey='completedCases' fill='#10B981' name='Casos Completados' />
                <Line yAxisId='right' type='monotone' dataKey='revenue' stroke='#F59E0B' strokeWidth={2} name='Ingresos' />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Carga de trabajo por abogado (solo para admin) */}
        {profile.role === 'admin_firma' && data.abogadoWorkload.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Carga de Trabajo por Abogado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {data.abogadoWorkload.map((abogado) => (
                  <div key={abogado.abogado_id} className='flex items-center justify-between p-4 bg-gray-50 rounded-lg'>
                    <div className='flex items-center space-x-3'>
                      <div 
                        className='h-10 w-10 rounded-full flex items-center justify-center text-white font-medium'
                        style={{ backgroundColor: stringToColor(abogado.nombre) }}
                      >
                        {getInitials(abogado.nombre)}
                      </div>
                      <div>
                        <h4 className='font-medium text-gray-900'>{abogado.nombre}</h4>
                        <p className='text-sm text-gray-500'>
                          {abogado.activeCases} casos activos • {abogado.completedCases} completados
                        </p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <p className='font-medium text-gray-900'>
                        {formatCurrency(abogado.totalValue)}
                      </p>
                      <p className='text-sm text-gray-500'>
                        Promedio: {formatCurrency(abogado.avgCaseValue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
