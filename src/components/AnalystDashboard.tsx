import Link from 'next/link';
import { ArrowUpRight, Calendar, ClipboardList, CreditCard, FilePlus2, Inbox, Timer, UserPlus } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WorkQueueData } from '@/lib/actions/work-queue';
import type { Case } from '@/lib/supabase/types';
import { cn, formatDate, formatRelativeTime } from '@/lib/utils';

export function AnalystDashboard({
  workQueue,
  preparationCases,
}: {
  workQueue: WorkQueueData;
  preparationCases: Case[];
}) {
  const focusCount =
    workQueue.stats.overdueStages + workQueue.stats.paymentBlocks + workQueue.stats.pendingRequests;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Panel analista"
        title="Intake y validación"
        description="Prioriza lo crítico, valida información y deja el expediente listo para el abogado. Drill‑down directo a Inbox y listas."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/inbox" className="inline-flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                Inbox
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/cases?workflow_state=preparacion" className="inline-flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Preparación
              </Link>
            </Button>
            <Button asChild>
              <Link href="/cases/new" className="inline-flex items-center gap-2">
                <FilePlus2 className="h-4 w-4" />
                Nuevo caso
              </Link>
            </Button>
          </>
        }
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Hoy · Triage</h2>
          <Badge variant="outline" className="text-foreground/60">
            {focusCount} señal(es)
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Etapas vencidas', value: workQueue.stats.overdueStages, icon: Timer, tone: 'text-red-600', href: '/inbox' },
            { label: 'Próximos 7 días', value: workQueue.stats.dueNext7Days, icon: Calendar, tone: 'text-sky-600', href: '/inbox' },
            { label: 'Bloqueos de pago', value: workQueue.stats.paymentBlocks, icon: CreditCard, tone: 'text-amber-700', href: '/inbox' },
            { label: 'Solicitudes', value: workQueue.stats.pendingRequests, icon: ClipboardList, tone: 'text-violet-600', href: '/inbox' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="hover:bg-white/80">
                <CardContent className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/50">{item.label}</p>
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

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Casos en preparación
                </span>
                <Badge variant="outline" className="text-foreground/60">
                  {preparationCases.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {preparationCases.length === 0 ? (
                <p className="text-sm text-foreground/60">No hay casos en preparación.</p>
              ) : (
                preparationCases.slice(0, 12).map((c) => (
                  <Link
                    key={c.id}
                    href={`/cases/${c.id}`}
                    className="group flex items-start justify-between gap-3 rounded-2xl border border-white/20 bg-white/55 px-4 py-3 transition hover:bg-white/80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{c.caratulado}</p>
                      <p className="mt-1 truncate text-xs text-foreground/55">
                        {c.nombre_cliente}
                        {c.created_at ? ` · creado ${formatRelativeTime(c.created_at)}` : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {c.prioridad && <Badge variant="outline">{c.prioridad}</Badge>}
                        {c.materia && <Badge variant="outline">{c.materia}</Badge>}
                        {c.numero_causa && <Badge variant="outline">Causa {c.numero_causa}</Badge>}
                      </div>
                    </div>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-foreground/35 transition group-hover:text-foreground/70" />
                  </Link>
                ))
              )}
              {preparationCases.length > 12 && (
                <p className="text-xs text-foreground/55">Mostrando 12 de {preparationCases.length} casos.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acciones rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-between">
                <Link href="/clients">
                  Crear cliente
                  <UserPlus className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-between">
                <Link href="/cases/new">
                  Nuevo caso
                  <FilePlus2 className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-between">
                <Link href="/inbox">
                  Abrir Inbox
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inbox · Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {workQueue.overdueStages.slice(0, 3).map((item) => (
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
              {workQueue.overdueStages.length === 0 && (
                <p className="text-sm text-foreground/60">No hay etapas vencidas.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}

