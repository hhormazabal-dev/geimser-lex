import Link from 'next/link';
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  Clock,
  AlertTriangle,
  BarChart3,
  UserCircle2,
  Target,
  FolderOpen,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LawyerDetailData } from '@/lib/actions/analytics';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';

interface AdminLawyerDetailProps {
  data: LawyerDetailData;
}

const STATUS_LABELS: Record<string, string> = {
  activo: 'Activo',
  suspendido: 'Suspendido',
  archivado: 'Archivado',
  terminado: 'Terminado',
};

const PRIORITY_LABELS: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

const GLASS_CARD = 'rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-2xl text-white';

export function AdminLawyerDetail({ data }: AdminLawyerDetailProps) {
  const { lawyer, stats, cases } = data;

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white'>
      <header className='border-b border-white/10 bg-white/10 backdrop-blur-md'>
        <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <Link href='/dashboard/admin'>
              <Button
                variant='secondary'
                size='sm'
                className='bg-white/10 border-white/20 text-white hover:bg-white/20'
              >
                <ArrowLeft className='h-4 w-4 mr-2' />
                Volver al dashboard
              </Button>
            </Link>
            <div>
              <div className='flex items-center gap-2'>
                <h1 className='text-xl font-semibold tracking-tight'>{lawyer.nombre}</h1>
                <Badge variant='outline' className='border-white/30 text-white/70 uppercase text-[10px] tracking-wide'>
                  {lawyer.role === 'admin_firma' ? 'Administrador' : 'Abogado'}
                </Badge>
              </div>
              <p className='text-xs text-white/60'>
                {lawyer.email ?? 'Sin correo'} {lawyer.telefono ? `• ${lawyer.telefono}` : ''}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10'>
        <section className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {[
            {
              label: 'Casos activos',
              value: stats.activeCases,
              gradient: 'from-sky-500/30 via-sky-600/20 to-transparent',
            },
            {
              label: 'Casos completados',
              value: stats.completedCases,
              gradient: 'from-emerald-500/30 via-emerald-600/20 to-transparent',
            },
            {
              label: 'Total administrado',
              value: formatCurrency(stats.totalValue),
              gradient: 'from-violet-500/30 via-violet-600/20 to-transparent',
            },
            {
              label: 'Promedio por caso',
              value: formatCurrency(stats.avgCaseValue),
              gradient: 'from-amber-500/30 via-amber-600/20 to-transparent',
            },
          ].map((item) => (
            <Card key={item.label} className={`${GLASS_CARD} overflow-hidden`}> 
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.gradient}`} />
              <CardContent className='relative pt-6 pb-5'>
                <p className='text-xs uppercase tracking-wide text-white/60'>{item.label}</p>
                <p className='mt-3 text-3xl font-semibold text-white'>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section>
          <Card className={`${GLASS_CARD} overflow-hidden`}> 
            <div className='pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-white/0 to-transparent' />
            <CardContent className='relative p-6 space-y-4'>
              <div className='flex items-center justify-between'>
                <h2 className='text-lg font-semibold flex items-center gap-2'>
                  <Briefcase className='h-5 w-5 text-sky-200' />
                  Casos asignados ({stats.totalCases})
                </h2>
                {stats.overdueStages > 0 && (
                  <span className='inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-sm text-red-200'>
                    <AlertTriangle className='h-4 w-4' />
                    {stats.overdueStages} etapas atrasadas
                  </span>
                )}
              </div>

              {cases.length === 0 ? (
                <div className='text-center py-16 text-white/60'>
                  <BarChart3 className='h-12 w-12 mx-auto mb-4 text-white/30' />
                  <p>No hay casos asignados a este abogado.</p>
                </div>
              ) : (
                <div className='space-y-5'>
                  {cases.map((caseItem) => (
                    <Link
                      key={caseItem.id}
                      href={`/cases/${caseItem.id}`}
                      className='block rounded-2xl border border-white/10 bg-white/10 px-5 py-5 transition-all hover:border-sky-300/40 hover:bg-white/20'
                    >
                      <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
                        <div className='flex-1 space-y-3'>
                          <div className='flex flex-wrap items-center gap-3'>
                            <h3 className='text-xl font-semibold text-white'>{caseItem.caratulado}</h3>
                            {caseItem.prioridad && (
                              <Badge variant='secondary' className='capitalize bg-white/15 text-white/80 border-white/40'>
                                {PRIORITY_LABELS[caseItem.prioridad] ?? caseItem.prioridad}
                              </Badge>
                            )}
                          </div>
                          <div className='grid grid-cols-1 gap-2 text-sm text-white/70 sm:grid-cols-2 xl:grid-cols-3'>
                            <span>
                              Estado:{' '}
                              <strong className='text-white'>
                                {caseItem.estado ? STATUS_LABELS[caseItem.estado] ?? caseItem.estado : 'Sin estado'}
                              </strong>
                            </span>
                            {caseItem.nombre_cliente && <span>Cliente: {caseItem.nombre_cliente}</span>}
                            {caseItem.valor_estimado && <span>Monto estimado: {formatCurrency(caseItem.valor_estimado)}</span>}
                            {caseItem.fecha_inicio && <span>Inicio: {formatDate(caseItem.fecha_inicio)}</span>}
                          </div>
                          <div className='flex flex-wrap items-center gap-4 text-xs text-white/50'>
                            <span>
                              Etapa actual:{' '}
                              <strong className='text-white/80'>{caseItem.etapa_actual ?? 'Sin definir'}</strong>
                            </span>
                            <span>
                              Progreso: {caseItem.completedStages}/{caseItem.totalStages} etapas completadas
                            </span>
                            {caseItem.nextStage ? (
                              <span className={caseItem.nextStage.isOverdue ? 'text-red-200 font-medium' : 'text-white/70'}>
                                Próxima etapa: {caseItem.nextStage.etapa}
                                {caseItem.nextStage.fecha_programada && (
                                  <> • {formatDate(caseItem.nextStage.fecha_programada)}</>
                                )}
                                {caseItem.nextStage.isOverdue && ' (atrasada)'}
                              </span>
                            ) : (
                              <span className='text-emerald-200'>No hay etapas pendientes</span>
                            )}
                          </div>
                        </div>
                        <div className='flex flex-col gap-2 text-sm text-white/70'>
                          <div className='inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1'>
                            <Clock className='h-4 w-4 text-sky-200' />
                            {caseItem.pendingStages} etapa(s) pendiente(s)
                          </div>
                          <div className='inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1'>
                            <Calendar className='h-4 w-4 text-amber-200' />
                            {caseItem.overdueStages} etapa(s) atrasada(s)
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          <Card className={GLASS_CARD}>
            <CardContent className='p-6 space-y-3'>
              <h3 className='text-sm uppercase tracking-wide text-white/60'>Resumen</h3>
              <div className='space-y-2 text-sm text-white/70'>
                <p>
                  Casos activos:{' '}
                  <strong className='text-white'>{stats.activeCases}</strong>
                </p>
                <p>
                  Casos completados:{' '}
                  <strong className='text-white'>{stats.completedCases}</strong>
                </p>
                <p>
                  Última actualización:{' '}
                  <strong className='text-white'>{formatRelativeTime(new Date().toISOString())}</strong>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={`${GLASS_CARD} lg:col-span-2`}>
            <CardContent className='p-6'>
              <div className='flex items-center gap-2 text-sm text-white/70 mb-4'>
                <UserCircle2 className='h-5 w-5 text-fuchsia-200' />
                {cases.length} caso(s) asignado(s) actualmente
              </div>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm text-white/70'>
                <div className='rounded-2xl border border-white/10 bg-white/5 px-4 py-3'>
                  <p className='text-xs uppercase tracking-wide text-white/50'>Total gestionado en cartera</p>
                  <p className='mt-2 text-lg font-semibold text-white'>{formatCurrency(stats.totalValue)}</p>
                </div>
                <div className='rounded-2xl border border-white/10 bg-white/5 px-4 py-3'>
                  <p className='text-xs uppercase tracking-wide text-white/50'>Promedio por caso</p>
                  <p className='mt-2 text-lg font-semibold text-white'>{formatCurrency(stats.avgCaseValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
