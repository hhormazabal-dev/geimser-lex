'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, formatRelativeTime, getInitials, stringToColor } from '@/lib/utils';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  Scale,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Activity,
  Target,
  User,
  FileText,
  ArrowUpRight,
} from 'lucide-react';
import { KpiCards } from '@/components/KpiCards';
import type { Profile } from '@/lib/supabase/types';
import type {
  DashboardStats,
  CasesByStatus,
  CasesByMateria,
  CasesByPriority,
  MonthlyStats,
  AbogadoWorkload,
  DashboardHighlights,
} from '@/lib/actions/analytics';
import LogoutButton from '@/components/LogoutButton';

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
    highlights: DashboardHighlights;
  };
}

const STATUS_COLORS: Record<string, string> = {
  activo: '#10B981',
  suspendido: '#F59E0B',
  archivado: '#6B7280',
  terminado: '#3B82F6',
};

const PRIORITY_COLORS: Record<string, string> = {
  baja: '#10B981',
  media: '#3B82F6',
  alta: '#F59E0B',
  urgente: '#EF4444',
};

const GLASS_CARD =
  'rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm text-slate-900';

export function AdminDashboard({ profile, data }: AdminDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m'>('6m');
  const stats = data.stats;

  if (!stats) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-50 flex items-center justify-center text-slate-900'>
        <div className='text-center space-y-3'>
          <AlertTriangle className='h-12 w-12 mx-auto text-red-400' />
          <h2 className='text-xl font-semibold'>No se pudieron cargar los datos</h2>
          <p className='text-slate-500'>Intenta nuevamente en unos minutos.</p>
        </div>
      </div>
    );
  }

  const getFilteredMonthlyStats = () => {
    const months = selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12;
    return data.monthlyStats.slice(-months);
  };

  const getStatusColor = (status: string) => STATUS_COLORS[status] || '#6B7280';
  const getPriorityColor = (priority: string) => PRIORITY_COLORS[priority] || '#6B7280';

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-900'>
      <main>
        <div className='mx-auto flex max-w-5xl flex-col gap-8 px-4 pb-12 pt-3 sm:px-5 sm:pt-5 lg:px-6 lg:pt-0'>
          <section className='rounded-2xl border border-slate-100 bg-white/90 p-5 shadow-sm backdrop-blur-lg sm:p-6'>
            <div className='flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
              <div className='flex items-start gap-3'>
                <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-600'>
                  <Scale className='h-5 w-5' />
                </div>
                <div>
                  <p className='text-[11px] uppercase tracking-[0.25em] text-slate-400'>Panel ejecutivo</p>
                  <h1 className='mt-1 text-xl font-semibold tracking-tight text-slate-900'>Xel Chile · visión consolidada</h1>
                  <p className='mt-2 max-w-xl text-xs leading-relaxed text-slate-500'>
                    Supervisa indicadores clave, vencimientos y rendimiento del equipo desde una experiencia compacta alineada al nuevo sidebar.
                  </p>
                </div>
              </div>
              <div className='flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5'>
                <div className='flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5'>
                  <div
                    className='flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white font-medium text-slate-700 shadow-inner'
                    style={{
                      background: `linear-gradient(135deg, ${stringToColor(profile.nombre)} 0%, rgba(255,255,255,0.92) 100%)`,
                    }}
                  >
                    {getInitials(profile.nombre)}
                  </div>
                  <div>
                    <p className='text-sm font-medium text-slate-900 leading-none'>{profile.nombre}</p>
                    <p className='mt-1 text-[11px] text-slate-500 capitalize'>{profile.role.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className='flex items-center gap-2.5'>
                  <Button
                    asChild
                    size='sm'
                    className='rounded-full border border-slate-200 bg-slate-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-slate-800'
                  >
                    <Link href='/dashboard/admin/users'>Gestionar usuarios</Link>
                  </Button>
                  <LogoutButton />
                </div>
              </div>
            </div>
          </section>

          <section className='space-y-5'>
            <h2 className='text-base font-semibold text-slate-800'>Indicadores destacados</h2>
            <KpiCards stats={stats} highlights={data.highlights} />
          </section>

          {(stats.overdueStages > 0 || data.upcomingDeadlines.length > 0) && (
            <section className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
              {stats.overdueStages > 0 && (
                <Card className={`${GLASS_CARD} border-red-200`}>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2 text-red-600'>
                      <AlertTriangle className='h-5 w-5' />
                      Etapas vencidas ({stats.overdueStages})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className='text-sm text-red-600/80'>
                      Hay {stats.overdueStages} etapas que superaron su fecha programada. Prioriza su revisión para mantener la continuidad del caso.
                    </p>
                  </CardContent>
                </Card>
              )}
              {data.upcomingDeadlines.length > 0 && (
                <Card className={GLASS_CARD}>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Calendar className='h-5 w-5 text-sky-500' />
                      Próximos vencimientos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='space-y-3'>
                      {data.upcomingDeadlines.map((deadline, index) => (
                        <div
                          key={index}
                          className='flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-4 py-3'
                        >
                          <div>
                            <p className='text-sm font-medium text-slate-900'>{deadline.caratulado}</p>
                            <p className='text-xs text-slate-500'>Próxima etapa: {deadline.proxima_etapa}</p>
                          </div>
                          <p className='text-xs text-slate-500'>{formatDate(deadline.fecha)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          <section className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            <Card className={GLASS_CARD}>
              <CardHeader>
                <div className='flex items-center justify-between'>
                  <CardTitle className='flex items-center gap-2'>
                    <Activity className='h-5 w-5 text-emerald-500' />
                    Distribución por estado
                  </CardTitle>
                  <Badge variant='outline' className='border-slate-200 text-slate-600'>
                    {stats.totalCases} casos totales
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width='100%' height={320}>
                  <PieChart>
                    <Pie
                      data={data.casesByStatus}
                      cx='50%'
                      cy='50%'
                      labelLine={false}
                      label={({ status, percentage }) => `${status} (${percentage}%)`}
                      outerRadius={90}
                      dataKey='count'
                    >
                      {data.casesByStatus.map((entry, index) => (
                        <Cell key={`cell-status-${index}`} fill={getStatusColor(entry.status)} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#ffffff',
                        borderRadius: 12,
                        border: '1px solid rgba(148,163,184,0.2)',
                        color: '#0f172a',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className={GLASS_CARD}>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Target className='h-5 w-5 text-indigo-600' />
                  Casos por materia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width='100%' height={320}>
                  <BarChart data={data.casesByMateria}>
                    <CartesianGrid strokeDasharray='3 3' stroke='rgba(148,163,184,0.2)' />
                    <XAxis
                      dataKey='materia'
                      stroke='rgba(71,85,105,0.6)'
                      tick={{ fill: 'rgba(71,85,105,0.8)', fontSize: 12 }}
                    />
                    <YAxis stroke='rgba(71,85,105,0.6)' tick={{ fill: 'rgba(71,85,105,0.8)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: '#ffffff',
                        borderRadius: 12,
                        border: '1px solid rgba(148,163,184,0.2)',
                        color: '#0f172a',
                      }}
                    />
                    <Bar dataKey='count' fill='url(#materiaGradient)' radius={[9, 9, 0, 0]} />
                    <defs>
                      <linearGradient id='materiaGradient' x1='0' x2='0' y1='0' y2='1'>
                        <stop offset='0%' stopColor='#6366F1' stopOpacity={0.9} />
                        <stop offset='100%' stopColor='#14B8A6' stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          <section>
            <Card className={`${GLASS_CARD} mb-2`}>
              <CardHeader>
                <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
                  <CardTitle className='flex items-center gap-2'>
                    <TrendingUp className='h-5 w-5 text-amber-500' />
                    Evolución mensual
                  </CardTitle>
                  <div className='flex gap-2'>
                    {(['3m', '6m', '12m'] as const).map((period) => (
                      <Button
                        key={period}
                        size='sm'
                        variant={selectedPeriod === period ? 'default' : 'outline'}
                        className={
                          selectedPeriod === period
                            ? 'border border-slate-200 bg-slate-900 text-white hover:bg-slate-800'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }
                        onClick={() => setSelectedPeriod(period)}
                      >
                        {period === '3m' ? '3 meses' : period === '6m' ? '6 meses' : '12 meses'}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width='100%' height={380}>
                  <LineChart data={getFilteredMonthlyStats()}>
                    <CartesianGrid strokeDasharray='3 3' stroke='rgba(148,163,184,0.2)' />
                    <XAxis dataKey='month' stroke='rgba(71,85,105,0.6)' tick={{ fill: 'rgba(71,85,105,0.8)' }} />
                    <YAxis yAxisId='left' stroke='rgba(71,85,105,0.6)' tick={{ fill: 'rgba(71,85,105,0.8)' }} />
                    <YAxis yAxisId='right' orientation='right' stroke='rgba(71,85,105,0.6)' tick={{ fill: 'rgba(71,85,105,0.8)' }} />
                    <Tooltip
                      contentStyle={{
                        background: '#ffffff',
                        borderRadius: 12,
                        border: '1px solid rgba(148,163,184,0.2)',
                        color: '#0f172a',
                      }}
                      formatter={(value, name) => [
                        name === 'revenue' ? formatCurrency(value as number) : value,
                        name === 'newCases' ? 'Casos nuevos' : name === 'completedCases' ? 'Casos completados' : 'Ingresos',
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ color: 'rgba(15,23,42,0.7)' }}
                      payload={[
                        { value: 'Casos nuevos', type: 'square', color: '#38BDF8' },
                        { value: 'Casos completados', type: 'square', color: '#22C55E' },
                        { value: 'Ingresos', type: 'line', color: '#FACC15' },
                      ]}
                    />
                    <Bar yAxisId='left' dataKey='newCases' fill='#38BDF8' name='Casos nuevos' radius={[8, 8, 0, 0]} />
                    <Bar yAxisId='left' dataKey='completedCases' fill='#22C55E' name='Casos completados' radius={[8, 8, 0, 0]} />
                    <Line yAxisId='right' type='monotone' dataKey='revenue' stroke='#FACC15' strokeWidth={2} name='Ingresos' />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          {profile.role === 'admin_firma' && data.abogadoWorkload.length > 0 && (
            <section>
              <Card className={GLASS_CARD}>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <User className='h-5 w-5 text-fuchsia-500' />
                    Carga de trabajo por abogado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-4'>
                    {data.abogadoWorkload.map((abogado) => (
                      <Link
                        key={abogado.abogado_id}
                        href={`/dashboard/admin/lawyers/${abogado.abogado_id}`}
                        className='flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 transition-colors hover:border-sky-200/60 hover:bg-sky-50/70'
                      >
                        <div className='flex items-center gap-3'>
                          <div
                            className='flex h-10 w-10 items-center justify-center rounded-full font-medium text-white shadow-inner'
                            style={{ background: stringToColor(abogado.nombre) }}
                          >
                            {getInitials(abogado.nombre)}
                          </div>
                          <div>
                            <p className='font-medium text-slate-900'>{abogado.nombre}</p>
                            <p className='text-xs text-slate-500'>
                              {abogado.activeCases} casos activos • {abogado.completedCases} completados
                            </p>
                          </div>
                        </div>
                        <div className='text-right'>
                          <p className='font-semibold text-slate-900'>{formatCurrency(abogado.totalValue)}</p>
                          <p className='text-xs text-slate-500'>Promedio: {formatCurrency(abogado.avgCaseValue)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          <section className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            <Card className={GLASS_CARD}>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <TrendingDown className='h-5 w-5 text-rose-500' />
                  Prioridad de los casos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {data.casesByPriority.map((priority) => (
                    <div
                      key={priority.priority}
                      className='flex items-center justify-between rounded-xl border border-slate-100 bg-white/80 px-4 py-2'
                    >
                      <div className='flex items-center gap-3'>
                        <span
                          className='h-3 w-3 rounded-full'
                          style={{ backgroundColor: getPriorityColor(priority.priority) }}
                        />
                        <p className='text-sm font-medium text-slate-900 capitalize'>{priority.priority}</p>
                      </div>
                      <p className='text-sm text-slate-600'>
                        {priority.count} ({priority.percentage}%)
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className={GLASS_CARD}>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <DocumentIcon />
                  Últimas notas y documentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {data.highlights.documents.slice(0, 4).map((doc) => (
                    <div key={doc.id} className='rounded-xl border border-slate-100 bg-white/80 px-4 py-3'>
                      <p className='text-sm font-medium text-slate-900'>{doc.nombre}</p>
                      <p className='text-xs text-slate-500'>{doc.created_at ? formatRelativeTime(doc.created_at) : 'Fecha no disponible'}</p>
                      {doc.case_id && (
                        <Link
                          href={`/cases/${doc.case_id}`}
                          className='mt-1 inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800'
                        >
                          Ver caso
                          <ArrowIcon />
                        </Link>
                      )}
                    </div>
                  ))}
                  {data.highlights.documents.length === 0 && (
                    <p className='text-sm text-slate-500'>No se han cargado documentos recientemente.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}

/* Icon helpers */
const DocumentIcon = () => <FileText className='h-5 w-5 text-indigo-500' />;
const ArrowIcon = () => <ArrowUpRight className='h-3 w-3 text-sky-600' />;
