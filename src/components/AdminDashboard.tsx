'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ResponsiveContainer, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Flame,
  FolderOpen,
  Gauge,
  Inbox,
  ListChecks,
  Timer,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatCurrency, formatDate, formatRelativeTime, getInitials, stringToColor } from '@/lib/utils';

import type { WorkQueueData } from '@/lib/actions/work-queue';
import type {
  AbogadoWorkload,
  CasesByMateria,
  CasesByPriority,
  CasesByStatus,
  CasesByWorkflowState,
  ClientPortfolioItem,
  DashboardHighlights,
  DashboardStats,
  MonthlyStats,
} from '@/lib/actions/analytics';
import type { Profile } from '@/lib/supabase/types';

interface AdminDashboardProps {
  profile: Profile;
  data: {
    stats: DashboardStats | null;
    casesByStatus: CasesByStatus[];
    casesByMateria: CasesByMateria[];
    casesByPriority: CasesByPriority[];
    casesByWorkflowState: CasesByWorkflowState[];
    monthlyStats: MonthlyStats[];
    abogadoWorkload: AbogadoWorkload[];
    upcomingDeadlines: any[];
    clientPortfolio: ClientPortfolioItem[];
    workQueue: WorkQueueData;
    highlights: DashboardHighlights;
  };
}

type PeriodKey = '30d' | '90d' | '12m';

const PERIODS: Array<{ key: PeriodKey; label: string; months: number }> = [
  { key: '30d', label: '30 días', months: 1 },
  { key: '90d', label: '90 días', months: 3 },
  { key: '12m', label: '12 meses', months: 12 },
];

function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function formatWfLabel(value: string) {
  const key = (value ?? '').trim().toLowerCase();
  if (key === 'preparacion') return 'Preparación';
  if (key === 'en_revision') return 'En revisión';
  if (key === 'activo') return 'Activo';
  if (key === 'cerrado') return 'Cerrado';
  return value?.replace(/_/g, ' ') || '—';
}

function severityVariant(severity: 'info' | 'warning' | 'critical'): BadgeProps['variant'] {
  if (severity === 'critical') return 'destructive';
  if (severity === 'warning') return 'warning';
  return 'info';
}

export function AdminDashboard({ profile, data }: AdminDashboardProps) {
  const stats = data.stats;
  const [period, setPeriod] = useState<PeriodKey>('90d');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  const totalCases = stats?.totalCases ?? 0;
  const periodMonths = PERIODS.find((p) => p.key === period)?.months ?? 3;
  const trendData = useMemo(
    () => data.monthlyStats.slice(-Math.max(3, periodMonths)),
    [data.monthlyStats, periodMonths],
  );

  const wfMap = useMemo(() => {
    const map = new Map<string, number>();
    data.casesByWorkflowState.forEach((row) => map.set(row.workflow_state, row.count));
    return map;
  }, [data.casesByWorkflowState]);

  const urgentCases = useMemo(() => {
    const row = data.casesByPriority.find((p) => p.priority === 'urgente');
    return row?.count ?? 0;
  }, [data.casesByPriority]);

  const reviewCases = wfMap.get('en_revision') ?? 0;
  const prepCases = wfMap.get('preparacion') ?? 0;

  const insights = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      description: string;
      severity: 'info' | 'warning' | 'critical';
      href: string;
      cta: string;
      icon: LucideIcon;
    }> = [];

    if (data.workQueue.stats.overdueStages > 0) {
      items.push({
        id: 'overdue-stages',
        title: 'Riesgo operativo: etapas vencidas',
        description: `${data.workQueue.stats.overdueStages} etapa(s) superaron su fecha. Prioriza para evitar quiebres en el servicio.`,
        severity: 'critical',
        href: '/inbox',
        cta: 'Ir a Inbox',
        icon: Timer,
      });
    }

    if (data.workQueue.stats.paymentBlocks > 0) {
      items.push({
        id: 'payment-blocks',
        title: 'Bloqueos por pago',
        description: `${data.workQueue.stats.paymentBlocks} etapa(s) requieren pago para avanzar. Esto impacta tiempos de respuesta.`,
        severity: 'warning',
        href: '/inbox',
        cta: 'Ver bloqueos',
        icon: CreditCard,
      });
    }

    if (urgentCases > 0) {
      items.push({
        id: 'urgent',
        title: 'Casos urgentes',
        description: `${urgentCases} caso(s) con prioridad urgente. Revisa asignación y próximos hitos.`,
        severity: 'warning',
        href: `/cases?prioridad=urgente`,
        cta: 'Ver casos',
        icon: Flame,
      });
    }

    if (reviewCases > 0) {
      items.push({
        id: 'review',
        title: 'Casos en revisión',
        description: `${reviewCases} caso(s) esperando validación. Reducir cola mejora tiempos de ciclo.`,
        severity: 'info',
        href: `/cases?workflow_state=en_revision`,
        cta: 'Abrir lista',
        icon: ListChecks,
      });
    }

    if (prepCases > Math.max(10, Math.round(totalCases * 0.25))) {
      items.push({
        id: 'prep-backlog',
        title: 'Backlog en preparación',
        description: `${prepCases} caso(s) en preparación. Considera redistribuir tareas o automatizar intake.`,
        severity: 'info',
        href: `/cases?workflow_state=preparacion`,
        cta: 'Revisar backlog',
        icon: ClipboardList,
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'all-good',
        title: 'Operación en verde',
        description: 'No hay señales críticas. Mantén el ritmo y revisa tendencias para anticiparte.',
        severity: 'info',
        href: '/inbox',
        cta: 'Abrir Inbox',
        icon: CheckCircle2,
      });
    }

    return items.slice(0, 6);
  }, [data.workQueue.stats.overdueStages, data.workQueue.stats.paymentBlocks, prepCases, reviewCases, totalCases, urgentCases]);

  if (!stats) {
    return (
      <Card className="border-red-200/60 bg-white/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Timer className="h-5 w-5" />
            No se pudieron cargar los datos
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-foreground/60">Intenta nuevamente en unos minutos.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Panel ejecutivo"
        title="Visión consolidada"
        description="Acción primero (Inbox + Insights), luego tendencias y pipeline. Drill‑down directo a listas operables."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/inbox" className="inline-flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                Inbox
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/cases" className="inline-flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Casos
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/admin/clients" className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" />
                Cartera
              </Link>
            </Button>
          </>
        }
      />

      {/* Global controls */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold text-white"
              style={{ backgroundColor: stringToColor(profile.nombre ?? 'Usuario') }}
              aria-hidden
            >
              {getInitials(profile.nombre ?? 'U')}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">{profile.nombre}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">admin firma</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45">Periodo</p>
            <div className="flex items-center gap-1 rounded-2xl border border-white/20 bg-white/50 p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    'rounded-2xl px-3 py-2 text-sm font-medium transition',
                    period === p.key
                      ? 'bg-foreground text-white shadow-sm'
                      : 'text-foreground/65 hover:bg-white/70 hover:text-foreground',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <div className="min-w-0 space-y-8">
          {/* Focus: what to do now */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Hoy · Focus</h2>
              <Badge variant="outline" className="text-foreground/60">
                {data.workQueue.stats.overdueStages +
                  data.workQueue.stats.paymentBlocks +
                  data.workQueue.stats.pendingRequests}{' '}
                señal(es)
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: 'Etapas vencidas',
                  value: data.workQueue.stats.overdueStages,
                  icon: Timer,
                  tone: 'text-red-600',
                  href: '/inbox',
                },
                {
                  label: 'Próximos 7 días',
                  value: data.workQueue.stats.dueNext7Days,
                  icon: Calendar,
                  tone: 'text-sky-600',
                  href: '/inbox',
                },
                {
                  label: 'Bloqueos de pago',
                  value: data.workQueue.stats.paymentBlocks,
                  icon: CreditCard,
                  tone: 'text-amber-700',
                  href: '/inbox',
                },
                {
                  label: 'Solicitudes',
                  value: data.workQueue.stats.pendingRequests,
                  icon: ClipboardList,
                  tone: 'text-violet-600',
                  href: '/inbox',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.label} className="hover:bg-white/80">
                    <CardContent className="p-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/50">
                        {item.label}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-3xl font-semibold text-foreground">{item.value}</p>
                        <div className={cn('rounded-2xl border border-white/20 bg-white/60 p-2', item.tone)}>
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button asChild variant="outline" size="sm" className="w-full justify-between">
                          <Link href={item.href}>
                            Abrir
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Insights + analytics */}
          <section className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-primary" />
                    Insights
                  </span>
                  <Badge variant="outline" className="text-foreground/60">
                    {insights.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.map((insight) => {
                  const Icon = insight.icon;
                  return (
                    <div
                      key={insight.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/20 bg-white/55 p-4 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/60 text-foreground/70">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                            <Badge variant={severityVariant(insight.severity)}>
                              {insight.severity === 'critical'
                                ? 'Crítico'
                                : insight.severity === 'warning'
                                  ? 'Atención'
                                  : 'Info'}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-foreground/60">{insight.description}</p>
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline" className="shrink-0">
                        <Link href={insight.href} className="inline-flex items-center gap-2">
                          {insight.cta}
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3 text-base">
                    <span className="flex items-center gap-2">
                      <ListChecks className="h-5 w-5 text-primary" />
                      Tendencia
                    </span>
                    <Badge variant="outline" className="text-foreground/60">
                      nuevos vs cerrados
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="rgba(15,23,42,0.35)" />
                      <YAxis tick={{ fontSize: 12 }} stroke="rgba(15,23,42,0.35)" />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(255,255,255,0.9)',
                          border: '1px solid rgba(148,163,184,0.25)',
                          borderRadius: 16,
                        }}
                      />
                      <Line type="monotone" dataKey="newCases" stroke="#2563eb" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="completedCases" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3 text-base">
                    <span className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-primary" />
                      Pipeline
                    </span>
                    <Badge variant="outline" className="text-foreground/60">
                      {stats.totalCases} casos
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(['preparacion', 'en_revision', 'activo', 'cerrado'] as const).map((wf) => {
                    const count = wfMap.get(wf) ?? 0;
                    const percent = pct(count, stats.totalCases);
                    return (
                      <Link
                        key={wf}
                        href={`/cases?workflow_state=${wf}`}
                        className="group flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/55 px-4 py-3 transition hover:bg-white/80"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{formatWfLabel(wf)}</p>
                          <div className="mt-2 h-2 w-full rounded-full bg-slate-900/10">
                            <div
                              className="h-2 rounded-full bg-primary/60"
                              style={{ width: `${Math.max(2, percent)}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-foreground/55">
                            {count} · {percent}%
                          </p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-foreground/40 transition group-hover:text-foreground/70" />
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Portfolio + team */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Clientes (top)
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/admin/clients" className="inline-flex items-center gap-2">
                      Ver cartera <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.clientPortfolio.slice(0, 10).map((item) => {
                  const isOpen = expandedClientId === item.client.id;
                  return (
                    <div key={item.client.id} className="rounded-2xl border border-white/20 bg-white/55 px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-2xl text-white font-semibold"
                            style={{ backgroundColor: stringToColor(item.client.nombre ?? 'Cliente') }}
                            aria-hidden
                          >
                            {getInitials(item.client.nombre ?? 'CL')}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {item.client.nombre ?? 'Cliente'}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground/55">
                              {item.client.rut && <span>{item.client.rut}</span>}
                              {item.urgentCases > 0 && <Badge variant="warning">{item.urgentCases} urgentes</Badge>}
                              {item.inReviewCases > 0 && <Badge variant="info">{item.inReviewCases} en revisión</Badge>}
                              <Badge variant="outline">{item.activeCases} activos</Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setExpandedClientId(isOpen ? null : item.client.id)}
                          >
                            {isOpen ? 'Ocultar' : 'Ver'} casos
                          </Button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="mt-4 space-y-2">
                          {item.cases.slice(0, 6).map((caseItem) => (
                            <Link
                              key={caseItem.id}
                              href={`/cases/${caseItem.id}`}
                              className="flex items-start justify-between gap-3 rounded-2xl border border-white/20 bg-white px-4 py-3 transition hover:bg-white/70"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{caseItem.caratulado}</p>
                                <p className="mt-1 text-xs text-foreground/55">
                                  {caseItem.etapa_actual ?? 'Etapa sin definir'}
                                  {caseItem.fecha_inicio ? ` · Inicio ${formatDate(caseItem.fecha_inicio)}` : ''}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                {caseItem.prioridad && <Badge variant="outline">{caseItem.prioridad}</Badge>}
                                {caseItem.workflow_state && (
                                  <Badge variant="outline">{formatWfLabel(caseItem.workflow_state)}</Badge>
                                )}
                              </div>
                            </Link>
                          ))}
                          {item.cases.length > 6 && (
                            <p className="text-xs text-foreground/55">Mostrando 6 de {item.cases.length} casos.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {data.clientPortfolio.length === 0 && (
                  <p className="text-sm text-foreground/60">No hay cartera disponible.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Equipo (capacidad)
                  </span>
                  <Badge variant="outline" className="text-foreground/60">
                    {data.abogadoWorkload.length} abogados
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.abogadoWorkload.length === 0 && (
                  <p className="text-sm text-foreground/60">No hay abogados registrados.</p>
                )}

                {(() => {
                  const maxActive = Math.max(1, ...data.abogadoWorkload.map((w) => w.activeCases));
                  return data.abogadoWorkload.slice(0, 10).map((abogado) => {
                    const width = Math.round((abogado.activeCases / maxActive) * 100);
                    return (
                      <Link
                        key={abogado.abogado_id}
                        href={`/dashboard/admin/lawyers/${abogado.abogado_id}`}
                        className="group flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/55 px-4 py-3 transition hover:bg-white/80"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-2xl text-white font-semibold"
                            style={{ backgroundColor: stringToColor(abogado.nombre) }}
                            aria-hidden
                          >
                            {getInitials(abogado.nombre)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{abogado.nombre}</p>
                            <p className="mt-1 text-xs text-foreground/55">
                              {abogado.activeCases} activos · {abogado.completedCases} completados
                            </p>
                            <div className="mt-2 h-2 w-40 rounded-full bg-slate-900/10">
                              <div
                                className="h-2 rounded-full bg-primary/60"
                                style={{ width: `${Math.max(6, width)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">{formatCurrency(abogado.totalValue)}</p>
                          <p className="text-xs text-foreground/55">Promedio: {formatCurrency(abogado.avgCaseValue)}</p>
                          <ArrowUpRight className="ml-auto mt-1 h-4 w-4 text-foreground/35 transition group-hover:text-foreground/70" />
                        </div>
                      </Link>
                    );
                  });
                })()}
              </CardContent>
            </Card>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prioridades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.casesByPriority
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((row) => (
                  <Link
                    key={row.priority}
                    href={`/cases?prioridad=${encodeURIComponent(row.priority)}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/55 px-4 py-2.5 transition hover:bg-white/80"
                  >
                    <span className="text-sm font-semibold text-foreground capitalize">{row.priority}</span>
                    <span className="text-sm text-foreground/60">
                      {row.count} · {row.percentage}%
                    </span>
                  </Link>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.casesByStatus
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((row) => (
                  <Link
                    key={row.status}
                    href={`/cases?estado=${encodeURIComponent(row.status)}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/55 px-4 py-2.5 transition hover:bg-white/80"
                  >
                    <span className="text-sm font-semibold text-foreground capitalize">{row.status}</span>
                    <span className="text-sm text-foreground/60">
                      {row.count} · {row.percentage}%
                    </span>
                  </Link>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inbox · Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.workQueue.overdueStages.slice(0, 3).map((item) => (
                <Link
                  key={item.stage_id}
                  href={`/cases/${item.case_id}`}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-white/20 bg-white/55 px-4 py-3 transition hover:bg-white/80"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{item.caratulado}</p>
                    <p className="mt-1 truncate text-xs text-foreground/55">
                      <span className="font-semibold text-red-600">Vencida</span> · {item.etapa}
                      {item.fecha_programada ? ` · ${formatDate(item.fecha_programada)}` : ''}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-foreground/35" />
                </Link>
              ))}

              {data.workQueue.dueNext7Days.slice(0, 2).map((item) => (
                <Link
                  key={item.stage_id}
                  href={`/cases/${item.case_id}`}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-white/20 bg-white/55 px-4 py-3 transition hover:bg-white/80"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{item.caratulado}</p>
                    <p className="mt-1 truncate text-xs text-foreground/55">
                      <span className="font-semibold text-sky-600">Próxima</span> · {item.etapa}
                      {item.fecha_programada ? ` · ${formatDate(item.fecha_programada)}` : ''}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-foreground/35" />
                </Link>
              ))}

              {data.workQueue.pendingRequests.slice(0, 2).map((req) => (
                <Link
                  key={req.request_id}
                  href={`/cases/${req.case_id}#requests`}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-white/20 bg-white/55 px-4 py-3 transition hover:bg-white/80"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{req.titulo}</p>
                    <p className="mt-1 truncate text-xs text-foreground/55">
                      <span className="font-semibold text-violet-600">Solicitud</span> · {req.caratulado}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-foreground/35" />
                </Link>
              ))}

              <Button asChild size="sm" variant="outline" className="w-full justify-between">
                <Link href="/inbox">
                  Abrir Inbox
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actividad reciente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.highlights.documents.slice(0, 4).map((doc) => (
                <div key={doc.id} className="rounded-2xl border border-white/20 bg-white/55 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{doc.nombre}</p>
                  <p className="mt-1 text-xs text-foreground/55">
                    {doc.created_at ? formatRelativeTime(doc.created_at) : 'Fecha no disponible'}
                  </p>
                  {doc.case_id && (
                    <Link
                      href={`/cases/${doc.case_id}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Ver caso <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ))}
              {data.highlights.documents.length === 0 && (
                <p className="text-sm text-foreground/60">No hay documentos recientes.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
