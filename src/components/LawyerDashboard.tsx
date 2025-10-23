'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Briefcase, Calendar, Clock, FileText, Target } from 'lucide-react';

import LogoutButton from '@/components/LogoutButton';
import { QuickLinksPanel } from '@/components/QuickLinksPanel';
import { TemplateLibrary } from '@/components/TemplateLibrary';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CasesByPriority, CasesByStatus, DashboardStats } from '@/lib/actions/analytics';
import type { Case, CaseStage, LegalTemplate, Profile, QuickLink } from '@/lib/supabase/types';
import { formatCurrency, formatDate, formatRelativeTime, getInitials, stringToColor } from '@/lib/utils';

interface LawyerDashboardProps {
  profile: Profile;
  data: {
    stats: DashboardStats | null;
    casesByStatus: CasesByStatus[];
    casesByPriority: CasesByPriority[];
    upcomingDeadlines: any[];
  };
  cases: (Case & { case_stages?: Pick<CaseStage, 'id' | 'etapa' | 'estado' | 'fecha_programada'>[] })[];
  quickLinks: QuickLink[];
  templates: LegalTemplate[];
}

const STATUS_CHIPS: Record<string, string> = {
  activo: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  suspendido: 'bg-amber-50 text-amber-700 border border-amber-100',
  archivado: 'bg-slate-100 text-slate-600 border border-slate-200',
  terminado: 'bg-sky-50 text-sky-700 border border-sky-100',
};

const PRIORITY_CHIPS: Record<string, string> = {
  baja: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  media: 'bg-sky-50 text-sky-700 border border-sky-100',
  alta: 'bg-amber-50 text-amber-700 border border-amber-100',
  urgente: 'bg-red-50 text-red-600 border border-red-100',
};

export function LawyerDashboard({ profile, data, cases, quickLinks, templates }: LawyerDashboardProps) {
  const stats = data.stats;

  if (!stats) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-900'>
        <div className='space-y-3 text-center'>
          <AlertTriangle className='mx-auto h-12 w-12 text-red-400' />
          <h2 className='text-xl font-semibold'>No pudimos cargar tu panel</h2>
          <p className='text-sm text-slate-500'>Refresca la página o inténtalo más tarde.</p>
        </div>
      </div>
    );
  }

  const activeCases = cases.filter((c) => c.estado === 'activo');
  const recentCases = [...cases]
    .sort((a, b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || ''))
    .slice(0, 6);
  const deadlines = (data.upcomingDeadlines || []).slice(0, 5);
  const totalStatus = data.casesByStatus.reduce((acc, item) => acc + item.count, 0);
  const nextDeadline = deadlines.length > 0 ? deadlines[0] : null;

  const heroDescription =
    activeCases.length > 0
      ? `Gestiona ${activeCases.length} caso${activeCases.length === 1 ? '' : 's'} activo${
          activeCases.length === 1 ? '' : 's'
        } y mantén tus próximos compromisos bajo control.`
      : 'Activa tus primeros casos y configura recordatorios para no perder hitos clave.';

  const metricCards = [
    {
      label: 'Casos activos',
      value: stats.activeCases,
      icon: Briefcase,
      caption: `De ${stats.totalCases} casos totales`,
    },
    {
      label: 'Solicitudes pendientes',
      value: stats.pendingRequests,
      icon: Target,
      caption: 'Revisa mensajes en tu bandeja',
    },
    {
      label: 'Próximas etapas',
      value: deadlines.length,
      icon: Calendar,
      caption: 'Dentro de los próximos 30 días',
    },
    {
      label: 'Notas y documentos',
      value: stats.totalDocuments,
      icon: FileText,
      caption: `${stats.totalNotes} notas recientes`,
    },
  ];

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-900'>
      <main className='mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8'>
        <section className='grid gap-4 lg:grid-cols-[2fr_1.1fr]'>
          <Card className='rounded-2xl border border-slate-200 bg-white shadow-sm'>
            <CardContent className='flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex-1 space-y-3'>
                <p className='text-[11px] uppercase tracking-[0.25em] text-slate-400'>Panel de gestión</p>
                <h1 className='text-2xl font-semibold tracking-tight'>Hola, {profile.nombre.split(' ')[0]}.</h1>
                <p className='max-w-xl text-sm leading-relaxed text-slate-600'>{heroDescription}</p>
              </div>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
                <div className='flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3'>
                  <div
                    className='flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-700 shadow-inner'
                    style={{
                      background: `linear-gradient(135deg, ${stringToColor(profile.nombre)} 0%, rgba(255,255,255,0.92) 100%)`,
                    }}
                  >
                    {getInitials(profile.nombre)}
                  </div>
                  <div>
                    <p className='text-sm font-medium text-slate-900'>{profile.nombre}</p>
                    <p className='text-xs capitalize text-slate-500'>{profile.role.replace('_', ' ')}</p>
                  </div>
                </div>
                <LogoutButton />
              </div>
            </CardContent>
          </Card>

          <Card className='rounded-2xl border border-slate-200 bg-white shadow-sm'>
            <CardHeader className='p-6 pb-3'>
              <CardTitle className='flex items-center gap-2 text-sm font-semibold text-slate-800'>
                <Calendar className='h-4 w-4 text-sky-500' />
                Próxima acción
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4 px-6 pb-6 pt-0'>
              {nextDeadline ? (
                <div className='space-y-3'>
                  <div>
                    <p className='text-sm font-semibold text-slate-900'>{nextDeadline.case?.caratulado || 'Caso sin título'}</p>
                    <p className='text-xs text-slate-500'>
                      {nextDeadline.case?.nombre_cliente || 'Cliente sin registro'}
                    </p>
                  </div>
                  <div className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600'>
                    <span className='font-medium text-slate-900'>{nextDeadline.etapa}</span>
                    {nextDeadline.fecha_programada && (
                      <>
                        <span className='mx-2 text-slate-400'>•</span>
                        <span>{formatDate(nextDeadline.fecha_programada)}</span>
                        <span className='ml-2 inline-flex items-center gap-1 text-xs text-sky-600'>
                          <Clock className='h-3.5 w-3.5' />
                          {formatRelativeTime(nextDeadline.fecha_programada)}
                        </span>
                      </>
                    )}
                  </div>
                  <Link href={`/cases/${nextDeadline.case?.id ?? ''}`} className='inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700'>
                    Revisar caso
                    <ArrowRight className='h-4 w-4' />
                  </Link>
                </div>
              ) : (
                <p className='text-sm text-slate-500'>Aún no tienes etapas programadas. Revisa tu cartera y agenda los próximos hitos.</p>
              )}

              <div className='grid grid-cols-2 gap-3 text-xs text-slate-500'>
                <div className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
                  <p className='text-[11px] uppercase tracking-[0.18em]'>Solicitudes pendientes</p>
                  <p className='mt-2 text-xl font-semibold text-slate-900'>{stats.pendingRequests}</p>
                </div>
                <div className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
                  <p className='text-[11px] uppercase tracking-[0.18em]'>Etapas vencidas</p>
                  <p className='mt-2 text-xl font-semibold text-slate-900'>{stats.overdueStages}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {metricCards.map((item) => (
            <Card key={item.label} className='rounded-2xl border border-slate-200 bg-white shadow-sm'>
              <CardContent className='space-y-3 p-5'>
                <div className='flex items-center justify-between'>
                  <p className='text-xs uppercase tracking-[0.18em] text-slate-400'>{item.label}</p>
                  <item.icon className='h-4 w-4 text-slate-400' />
                </div>
                <p className='text-3xl font-semibold text-slate-900'>{item.value}</p>
                <p className='text-xs text-slate-500'>{item.caption}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className='grid gap-6 lg:grid-cols-[2fr_1fr]'>
          <Card className='rounded-2xl border border-slate-200 bg-white shadow-sm'>
            <CardHeader className='flex flex-col gap-2 p-6 pb-4 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <CardTitle className='text-lg font-semibold text-slate-900'>Casos bajo tu responsabilidad</CardTitle>
                <p className='text-sm text-slate-500'>Mantenlos al día para asegurar continuidad con tus clientes.</p>
              </div>
              <Link href='/cases' className='text-sm font-medium text-sky-600 hover:text-sky-700'>
                Ver todos
              </Link>
            </CardHeader>
            <CardContent className='p-0'>
              {recentCases.length === 0 ? (
                <div className='px-6 py-12 text-sm text-slate-500'>
                  Aún no tienes casos asignados. El administrador debe derivarte un expediente.
                </div>
              ) : (
                <div className='overflow-x-auto'>
                  <table className='min-w-full divide-y divide-slate-100 text-sm'>
                    <thead className='bg-slate-50/80 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'>
                      <tr>
                        <th scope='col' className='px-6 py-3 text-left'>Caso</th>
                        <th scope='col' className='px-6 py-3 text-left'>Cliente</th>
                        <th scope='col' className='px-6 py-3 text-left'>Estado</th>
                        <th scope='col' className='px-6 py-3 text-left'>Próxima etapa</th>
                        <th scope='col' className='px-6 py-3 text-left'>Valor</th>
                        <th scope='col' className='px-6 py-3 text-right'>Acciones</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100 text-slate-700'>
                      {recentCases.map((caseItem) => {
                        const nextStage = caseItem.case_stages?.find((stage) => (stage.estado ?? '') === 'pendiente');

                        return (
                          <tr key={caseItem.id} className='transition hover:bg-slate-50/70'>
                            <td className='px-6 py-4 align-top'>
                              <div className='space-y-1'>
                                <p className='font-semibold text-slate-900'>{caseItem.caratulado}</p>
                                {caseItem.numero_causa && (
                                  <p className='text-xs font-medium uppercase tracking-[0.18em] text-slate-400'>
                                    {caseItem.numero_causa}
                                  </p>
                                )}
                                {caseItem.materia && (
                                  <Badge variant='outline' className='border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-600'>
                                    {caseItem.materia}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className='px-6 py-4 align-top'>
                              <div className='space-y-1'>
                                <p className='font-medium text-slate-800'>{caseItem.nombre_cliente}</p>
                                {caseItem.rut_cliente && <p className='text-xs text-slate-500'>{caseItem.rut_cliente}</p>}
                              </div>
                            </td>
                            <td className='px-6 py-4 align-top'>
                              <div className='space-y-2'>
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                                    STATUS_CHIPS[caseItem.estado || ''] ?? 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  {caseItem.estado || 'sin estado'}
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                                    PRIORITY_CHIPS[caseItem.prioridad || 'media'] ??
                                    'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  {caseItem.prioridad || 'media'}
                                </span>
                              </div>
                            </td>
                            <td className='px-6 py-4 align-top'>
                              {nextStage ? (
                                <div className='space-y-1'>
                                  <p className='text-sm font-medium text-slate-900'>{nextStage.etapa}</p>
                                  {nextStage.fecha_programada ? (
                                    <p className='text-xs text-slate-500'>{formatDate(nextStage.fecha_programada)}</p>
                                  ) : (
                                    <p className='text-xs text-slate-400'>Sin fecha</p>
                                  )}
                                </div>
                              ) : (
                                <span className='text-xs text-slate-400'>Sin etapa pendiente</span>
                              )}
                            </td>
                            <td className='px-6 py-4 align-top font-semibold text-slate-900'>
                              {caseItem.valor_estimado ? formatCurrency(caseItem.valor_estimado) : <span className='font-normal text-slate-400'>-</span>}
                            </td>
                            <td className='px-6 py-4 align-top'>
                              <div className='flex items-center justify-end'>
                                <Link
                                  href={`/cases/${caseItem.id}`}
                                  className='inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700'
                                >
                                  Ver detalle
                                  <ArrowRight className='h-4 w-4' />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className='space-y-6'>
            <Card className='rounded-2xl border border-slate-200 bg-white shadow-sm'>
              <CardHeader className='p-6 pb-4'>
                <CardTitle className='text-sm font-semibold text-slate-800'>Panorama de tus casos</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4 px-6 pb-6 pt-0'>
                {data.casesByStatus.length === 0 ? (
                  <p className='text-sm text-slate-500'>Aún no hay suficientes datos para mostrar tu distribución.</p>
                ) : (
                  data.casesByStatus.map((item) => (
                    <div key={item.status}>
                      <div className='flex items-center justify-between text-xs uppercase tracking-wide text-slate-500'>
                        <span>{item.status.replace('_', ' ')}</span>
                        <span className='font-medium text-slate-700'>{item.count}</span>
                      </div>
                      <div className='mt-2 h-2 rounded-full bg-slate-100'>
                        <div
                          className='h-2 rounded-full bg-sky-400'
                          style={{ width: totalStatus === 0 ? '0%' : `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}

                {data.casesByPriority.length > 0 && (
                  <div className='mt-5 border-t border-slate-100 pt-4'>
                    <p className='text-xs uppercase tracking-wide text-slate-500'>Prioridad</p>
                    <div className='mt-3 grid grid-cols-2 gap-3'>
                      {data.casesByPriority.map((item: CasesByPriority) => (
                        <div key={item.priority} className='rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs'>
                          <p className='uppercase tracking-wide text-slate-500'>{item.priority}</p>
                          <p className='mt-1 text-lg font-semibold text-slate-900'>{item.count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className='rounded-2xl border border-slate-200 bg-white shadow-sm'>
              <CardHeader className='flex flex-row items-center justify-between p-6 pb-4'>
                <CardTitle className='flex items-center gap-2 text-sm font-semibold text-slate-800'>
                  <Calendar className='h-4 w-4 text-sky-500' />
                  Próximas etapas
                </CardTitle>
                {deadlines.length > 0 && (
                  <p className='text-xs text-slate-400'>{deadlines.length} registro{deadlines.length === 1 ? '' : 's'}</p>
                )}
              </CardHeader>
              <CardContent className='space-y-3 px-6 pb-6 pt-0'>
                {deadlines.length === 0 ? (
                  <p className='text-sm text-slate-500'>No hay etapas agendadas en los próximos 30 días.</p>
                ) : (
                  deadlines.map((deadline: any) => (
                    <div key={deadline.id} className='rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm'>
                      <p className='font-medium text-slate-900'>{deadline.case?.caratulado || 'Caso sin título'}</p>
                      <p className='text-xs text-slate-500'>Etapa: {deadline.etapa}</p>
                      <div className='mt-2 flex items-center justify-between text-xs text-slate-500'>
                        <span>{deadline.fecha_programada ? formatDate(deadline.fecha_programada) : 'Sin fecha'}</span>
                        {deadline.fecha_programada && (
                          <span className='inline-flex items-center gap-1 text-sky-600'>
                            <Clock className='h-3.5 w-3.5' />
                            {formatRelativeTime(deadline.fecha_programada)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {stats.overdueStages > 0 && (
              <Card className='rounded-2xl border border-red-200 bg-red-50/90 p-5 text-red-700 shadow-sm'>
                <CardHeader className='p-0 pb-3'>
                  <CardTitle className='flex items-center gap-2 text-sm font-semibold'>
                    <AlertTriangle className='h-4 w-4' />
                    Etapas vencidas
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-2 p-0 text-sm'>
                  <p>Tienes {stats.overdueStages} etapa{stats.overdueStages === 1 ? '' : 's'} que requieren acción inmediata.</p>
                  <p className='text-xs text-red-600/80'>
                    Prioriza la reprogramación o actualización del estado para evitar retrasos.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section className='space-y-5'>
          <h2 className='text-base font-semibold text-slate-800'>Herramientas rápidas</h2>
          <div className='grid gap-6 lg:grid-cols-2'>
            <QuickLinksPanel links={quickLinks} />
            <TemplateLibrary templates={templates} />
          </div>
        </section>
      </main>
    </div>
  );
}
