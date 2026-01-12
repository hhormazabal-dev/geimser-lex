'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, Briefcase, Calendar, Clock, FileText, Target } from 'lucide-react';

import { QuickLinksPanel } from '@/components/QuickLinksPanel';
import { TemplateLibrary } from '@/components/TemplateLibrary';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CasesByPriority, CasesByStatus, DashboardStats } from '@/lib/actions/analytics';
import type { Case, CaseStage, LegalTemplate, Profile, QuickLink } from '@/lib/supabase/types';
import { formatRoleLabel } from '@/lib/navigation/role-label';
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
  terminado_apelacion: 'bg-violet-50 text-violet-700 border border-violet-100',
  terminado: 'bg-sky-50 text-sky-700 border border-sky-100',
  terminado_desistido_demandante: 'bg-sky-50 text-sky-700 border border-sky-100',
};

const STATUS_LABELS: Record<string, string> = {
  activo: 'Activo',
  suspendido: 'Suspendido',
  archivado: 'Archivado',
  terminado_apelacion: 'Terminado – Apelación',
  terminado: 'Terminado',
  terminado_desistido_demandante: 'Terminada (Desistida)',
};

const PRIORITY_CHIPS: Record<string, string> = {
  baja: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  media: 'bg-sky-50 text-sky-700 border border-sky-100',
  alta: 'bg-amber-50 text-amber-700 border border-amber-100',
  urgente: 'bg-red-50 text-red-600 border border-red-100',
};

const CALENDAR_COLUMNS = [
  { key: 'audiencias', label: 'Audiencias', helper: 'Salas y citaciones' },
  { key: 'juicios', label: 'Juicios', helper: 'Hitos críticos' },
  { key: 'preparatorias', label: 'Preparatorias', helper: 'Previas a juicio' },
  { key: 'gestiones', label: 'Gestiones', helper: 'Escritos y otros' },
] as const;

type CalendarKey = (typeof CALENDAR_COLUMNS)[number]['key'];

const normalizeStageLabel = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const classifyStage = (label?: string | null): CalendarKey => {
  const normalized = normalizeStageLabel(label ?? '');
  if (normalized.includes('preparator')) return 'preparatorias';
  if (normalized.includes('juicio') || normalized.includes('vista') || normalized.includes('alegato')) return 'juicios';
  if (normalized.includes('audiencia')) return 'audiencias';
  return 'gestiones';
};

export function LawyerDashboard({ profile, data, cases, quickLinks, templates }: LawyerDashboardProps) {
  const router = useRouter();
  const stats = data.stats;
  const [selectedDeadline, setSelectedDeadline] = useState<any | null>(null);

  const effectiveCaseStatus = (caseRow: any) => {
    const sentenciaEstado = (caseRow?.sentencia_estado as string | null | undefined) ?? null;
    if (sentenciaEstado === 'dictada') return 'terminado';
    return (caseRow?.estado as string | null | undefined) ?? null;
  };

  useEffect(() => {
    // Evita que el dashboard quede "pegado" al volver atrás desde /cases/... (BFCache / client cache).
    router.refresh();

    const onFocus = () => router.refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router]);

  if (!stats) {
    return (
      <Card className="border-red-200/60 bg-white/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            No se pudieron cargar los datos
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-foreground/60">Intenta nuevamente en unos minutos.</CardContent>
      </Card>
    );
  }

  const activeCases = cases.filter((c: any) => {
    const status = effectiveCaseStatus(c);
    return status === 'activo' || status === 'terminado_apelacion';
  });
  const recentCases = [...cases]
    .sort((a, b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || ''))
    .slice(0, 6);
  const allDeadlines = (data.upcomingDeadlines || []) as any[];
  const deadlines = allDeadlines.slice(0, 5);
  const totalStatus = data.casesByStatus.reduce((acc, item) => acc + item.count, 0);
  const nextDeadline = deadlines.length > 0 ? deadlines[0] : null;
  const caseById = useMemo(() => new Map(cases.map((caseItem) => [caseItem.id, caseItem])), [cases]);
  const calendarBuckets = useMemo<Record<CalendarKey, any[]>>(() => {
    const buckets = CALENDAR_COLUMNS.reduce((acc, column) => {
      acc[column.key] = [];
      return acc;
    }, {} as Record<CalendarKey, any[]>);

    allDeadlines.forEach((deadline) => {
      const key = classifyStage(deadline?.etapa);
      buckets[key].push(deadline);
    });

    Object.values(buckets).forEach((items) => {
      items.sort((a, b) => String(a?.fecha_programada ?? '').localeCompare(String(b?.fecha_programada ?? '')));
    });

    return buckets;
  }, [allDeadlines]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();

  const bucketCounts = allDeadlines.reduce(
    (acc, deadline) => {
      const raw = deadline?.fecha_programada as string | null | undefined;
      if (!raw) return acc;
      const date = new Date(`${raw}T00:00:00`);
      if (Number.isNaN(date.getTime())) return acc;

      if (raw === todayIso) {
        acc.today += 1;
        return acc;
      }

      const m = date.getMonth();
      const y = date.getFullYear();
      if (y === thisYear && m === thisMonth) acc.thisMonth += 1;
      else if (y === thisYear && m === thisMonth + 1) acc.nextMonth += 1;
      else if (y === thisYear && m === thisMonth + 2) acc.plusTwoMonths += 1;
      return acc;
    },
    { today: 0, thisMonth: 0, nextMonth: 0, plusTwoMonths: 0 },
  );

  const heroDescription =
    stats.activeCases > 0
      ? `Gestiona ${stats.activeCases} caso${stats.activeCases === 1 ? '' : 's'} activo${
          stats.activeCases === 1 ? '' : 's'
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
      value: allDeadlines.length,
      icon: Calendar,
      caption: 'Dentro de los próximos 90 días',
    },
    {
      label: 'Notas y documentos',
      value: stats.totalDocuments,
      icon: FileText,
      caption: `${stats.totalNotes} notas recientes`,
    },
  ];

  const resolveCaseTitle = (deadline: any) => {
    const caseId = deadline?.case?.id ?? null;
    const caseRow = caseId ? caseById.get(caseId) : null;
    return caseRow?.caratulado || deadline?.case?.caratulado || 'Caso sin título';
  };

  const resolveCaseClient = (deadline: any) => {
    const caseId = deadline?.case?.id ?? null;
    const caseRow = caseId ? caseById.get(caseId) : null;
    return caseRow?.nombre_cliente || 'Cliente sin registro';
  };

  const previewCase = selectedDeadline?.case?.id ? caseById.get(selectedDeadline.case.id) : null;
  const previewStatus = previewCase ? effectiveCaseStatus(previewCase) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Mi tablero"
        title={`Hola, ${profile.nombre.split(' ')[0]}.`}
        description={heroDescription}
        actions={
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link href="/inbox">Abrir Inbox</Link>
          </Button>
        }
      />

        <section className='grid gap-4 lg:grid-cols-[2fr_1.1fr]'>
          <Card className='rounded-2xl border border-slate-200 bg-white shadow-sm'>
            <CardContent className='space-y-6 p-6'>
              <div className='flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between'>
                <div className='flex-1 space-y-3'>
                  <p className='text-[11px] uppercase tracking-[0.25em] text-slate-400'>Panel de gestión</p>
                  <h2 className='text-2xl font-semibold tracking-tight'>Estado de tu cartera</h2>
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
                      <p className='text-xs text-slate-500'>{formatRoleLabel(profile.role)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className='rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div>
                    <p className='text-[11px] uppercase tracking-[0.22em] text-slate-400'>Agenda por actuación</p>
                    <p className='text-sm text-slate-600'>Próximas fechas ordenadas por tipo de gestión.</p>
                  </div>
                  <span className='text-xs text-slate-500'>
                    {allDeadlines.length} actuación{allDeadlines.length === 1 ? '' : 'es'} en 90 días
                  </span>
                </div>

                <div className='mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                  {CALENDAR_COLUMNS.map((column) => {
                    const items = calendarBuckets[column.key] ?? [];
                    const previewItems = items.slice(0, 3);

                    return (
                      <div key={column.key} className='rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm'>
                        <div className='flex items-start justify-between gap-2'>
                          <div>
                            <p className='text-[11px] uppercase tracking-[0.18em] text-slate-400'>{column.label}</p>
                            <p className='text-xs text-slate-500'>{column.helper}</p>
                          </div>
                          <span className='text-xs font-semibold text-slate-700'>{items.length}</span>
                        </div>

                        <div className='mt-3 space-y-2'>
                          {previewItems.length === 0 ? (
                            <div className='rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-xs text-slate-400'>
                              Sin actuaciones registradas
                            </div>
                          ) : (
                            previewItems.map((deadline: any) => (
                              <button
                                key={deadline.id}
                                type='button'
                                onClick={() => setSelectedDeadline(deadline)}
                                className='group w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm'
                              >
                                <div className='flex items-start justify-between gap-3'>
                                  <div className='space-y-1'>
                                    <p className='text-sm font-semibold text-slate-900'>
                                      {deadline.etapa || 'Actuación pendiente'}
                                    </p>
                                    <p className='text-xs text-slate-500'>{resolveCaseTitle(deadline)}</p>
                                  </div>
                                  <span className='rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500'>
                                    {deadline.fecha_programada ? formatDate(deadline.fecha_programada) : 'Sin fecha'}
                                  </span>
                                </div>
                                <div className='mt-1 flex items-center justify-between text-[11px] text-slate-500'>
                                  <span>{resolveCaseClient(deadline)}</span>
                                  {deadline.fecha_programada && (
                                    <span className='inline-flex items-center gap-1 text-sky-600'>
                                      <Clock className='h-3 w-3' />
                                      {formatRelativeTime(deadline.fecha_programada)}
                                    </span>
                                  )}
                                </div>
                              </button>
                            ))
                          )}
                        </div>

                        {items.length > previewItems.length && (
                          <p className='mt-2 text-[11px] text-slate-500'>+{items.length - previewItems.length} más</p>
                        )}
                      </div>
                    );
                  })}
                </div>
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
                  <p className='text-[11px] uppercase tracking-[0.18em]'>Casos cerrados</p>
                  <p className='mt-2 text-xl font-semibold text-slate-900'>{stats.completedCases}</p>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-3 text-xs text-slate-500'>
                <div className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
                  <p className='text-[11px] uppercase tracking-[0.18em]'>Hoy</p>
                  <p className='mt-2 text-xl font-semibold text-slate-900'>{bucketCounts.today}</p>
                </div>
                <div className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
                  <p className='text-[11px] uppercase tracking-[0.18em]'>Este mes</p>
                  <p className='mt-2 text-xl font-semibold text-slate-900'>{bucketCounts.thisMonth}</p>
                </div>
                <div className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
                  <p className='text-[11px] uppercase tracking-[0.18em]'>Próximo mes</p>
                  <p className='mt-2 text-xl font-semibold text-slate-900'>{bucketCounts.nextMonth}</p>
                </div>
                <div className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
                  <p className='text-[11px] uppercase tracking-[0.18em]'>En 2 meses</p>
                  <p className='mt-2 text-xl font-semibold text-slate-900'>{bucketCounts.plusTwoMonths}</p>
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
                {data.casesByStatus.length > 0 && (
                  <div className='mt-3 flex flex-wrap gap-2'>
                    {[
                      { key: 'activo', label: 'Activos' },
                      { key: 'terminado', label: 'Terminados' },
                      { key: 'terminado_apelacion', label: 'Terminado apelación' },
                      { key: 'suspendido', label: 'Suspendidos' },
                      { key: 'archivado', label: 'Archivados' },
                    ].map((item) => {
                      const match = data.casesByStatus.find((row) => row.status === item.key);
                      const count = match?.count ?? 0;
                      return (
                        <span
                          key={item.key}
                          className='inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700'
                        >
                          <span className='text-slate-500'>{item.label}</span>
                          <span className='font-semibold text-slate-900'>{count}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
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
                        const effectiveStatus = effectiveCaseStatus(caseItem) ?? caseItem.estado ?? '';
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
                                    STATUS_CHIPS[effectiveStatus] ?? 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  {STATUS_LABELS[effectiveStatus] ?? (effectiveStatus || 'Sin estado')}
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
                  <p className='text-sm text-slate-500'>No hay etapas agendadas en los próximos 90 días.</p>
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

          </div>
        </section>

        <section className='space-y-5'>
          <h2 className='text-base font-semibold text-slate-800'>Herramientas rápidas</h2>
          <div className='grid gap-6 lg:grid-cols-2'>
            <QuickLinksPanel links={quickLinks} />
            <TemplateLibrary templates={templates} />
          </div>
        </section>

        <Dialog
          open={Boolean(selectedDeadline)}
          onOpenChange={(open) => {
            if (!open) setSelectedDeadline(null);
          }}
        >
          <DialogContent className='max-w-2xl'>
            <DialogHeader className='space-y-2'>
              <p className='text-[11px] uppercase tracking-[0.22em] text-slate-400'>Vista previa</p>
              <DialogTitle className='text-2xl'>
                {selectedDeadline ? resolveCaseTitle(selectedDeadline) : 'Caso sin título'}
              </DialogTitle>
              <DialogDescription>
                {selectedDeadline ? resolveCaseClient(selectedDeadline) : 'Cliente sin registro'}
              </DialogDescription>
            </DialogHeader>

            <div className='grid gap-4'>
              <div className='rounded-2xl border border-slate-200 bg-slate-50 p-4'>
                <div className='flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-500'>
                  <span>Próxima actuación</span>
                  <span className='text-slate-400'>
                    {selectedDeadline?.fecha_programada ? formatDate(selectedDeadline.fecha_programada) : 'Sin fecha'}
                  </span>
                </div>
                <p className='mt-2 text-lg font-semibold text-slate-900'>
                  {selectedDeadline?.etapa || 'Actuación pendiente'}
                </p>
                {selectedDeadline?.fecha_programada && (
                  <p className='mt-1 inline-flex items-center gap-2 text-sm text-sky-600'>
                    <Clock className='h-4 w-4' />
                    {formatRelativeTime(selectedDeadline.fecha_programada)}
                  </p>
                )}
              </div>

              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='rounded-xl border border-slate-200 bg-white p-3 text-xs'>
                  <p className='uppercase tracking-[0.18em] text-slate-400'>Estado</p>
                  <p className='mt-2 text-sm font-semibold text-slate-900'>
                    {previewStatus ? STATUS_LABELS[previewStatus] ?? previewStatus : 'Sin estado'}
                  </p>
                </div>
                <div className='rounded-xl border border-slate-200 bg-white p-3 text-xs'>
                  <p className='uppercase tracking-[0.18em] text-slate-400'>Prioridad</p>
                  <p className='mt-2 text-sm font-semibold text-slate-900'>
                    {previewCase?.prioridad ?? 'media'}
                  </p>
                </div>
                <div className='rounded-xl border border-slate-200 bg-white p-3 text-xs'>
                  <p className='uppercase tracking-[0.18em] text-slate-400'>Materia</p>
                  <p className='mt-2 text-sm font-semibold text-slate-900'>
                    {previewCase?.materia ?? 'Sin materia'}
                  </p>
                </div>
                <div className='rounded-xl border border-slate-200 bg-white p-3 text-xs'>
                  <p className='uppercase tracking-[0.18em] text-slate-400'>Valor estimado</p>
                  <p className='mt-2 text-sm font-semibold text-slate-900'>
                    {previewCase?.valor_estimado ? formatCurrency(previewCase.valor_estimado) : '-'}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className='gap-2'>
              <DialogClose asChild>
                <Button variant='outline'>Cerrar</Button>
              </DialogClose>
              {selectedDeadline?.case?.id && (
                <Button asChild>
                  <Link href={`/cases/${selectedDeadline.case.id}`}>Ver caso completo</Link>
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
