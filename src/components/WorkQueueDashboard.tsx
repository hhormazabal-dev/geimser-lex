'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WorkQueueData } from '@/lib/actions/work-queue';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatDate } from '@/lib/utils';
import { AlertTriangle, Calendar, FileText } from 'lucide-react';

function StageList({
  title,
  icon,
  items,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  items: WorkQueueData['overdueStages'];
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          <Badge variant="outline">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-foreground/60">{emptyText}</p>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 12).map((item) => (
              <Link
                key={item.stage_id}
                href={`/cases/${item.case_id}`}
                className="flex flex-col gap-1 rounded-2xl border border-white/20 bg-white/55 px-4 py-3 transition hover:bg-white/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.caratulado}</p>
                    <p className="text-xs text-foreground/55">
                      {item.etapa} · {formatDate(item.fecha_programada)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.prioridad && (
                      <Badge variant="outline">{item.prioridad}</Badge>
                    )}
                    {item.workflow_state && (
                      <Badge variant="outline">{item.workflow_state.replace('_', ' ')}</Badge>
                    )}
                  </div>
                </div>
                {item.requiere_pago && item.estado_pago !== 'pagado' && (
                  <p className="text-xs text-amber-700">
                    Bloqueado por pago ({item.estado_pago})
                    {item.enlace_pago ? ' · link disponible' : ''}
                  </p>
                )}
              </Link>
            ))}
            {items.length > 12 && (
              <p className="text-xs text-foreground/55">Mostrando 12 de {items.length} elementos.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RequestList({ items }: { items: WorkQueueData['pendingRequests'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-foreground/60" />
            Solicitudes pendientes
          </span>
          <Badge variant="outline">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-foreground/60">No hay solicitudes pendientes.</p>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 12).map((item) => (
              <Link
                key={item.request_id}
                href={`/cases/${item.case_id}#requests`}
                className="flex flex-col gap-1 rounded-2xl border border-white/20 bg-white/55 px-4 py-3 transition hover:bg-white/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.titulo}</p>
                    <p className="text-xs text-foreground/55">{item.caratulado}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{item.estado}</Badge>
                    {item.fecha_limite && (
                      <Badge variant="outline">{formatDate(item.fecha_limite)}</Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            {items.length > 12 && (
              <p className="text-xs text-foreground/55">Mostrando 12 de {items.length} elementos.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function WorkQueueDashboard({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: WorkQueueData;
}) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Bandeja de trabajo" title={title} description={description} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            { label: 'Etapas vencidas', value: data.stats.overdueStages, icon: <AlertTriangle className='h-4 w-4' /> },
            { label: 'Próximos 7 días', value: data.stats.dueNext7Days, icon: <Calendar className='h-4 w-4' /> },
            { label: 'Solicitudes', value: data.stats.pendingRequests, icon: <FileText className='h-4 w-4' /> },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/50">
                  {item.label}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-3xl font-semibold text-foreground">{item.value}</p>
                  <div className="rounded-2xl border border-white/20 bg-white/60 p-2 text-foreground/70">
                    {item.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <StageList
            title='Etapas vencidas'
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            items={data.overdueStages}
            emptyText='No hay etapas vencidas. Buen trabajo.'
          />
          <StageList
            title='Próximos 7 días'
            icon={<Calendar className="h-5 w-5 text-sky-600" />}
            items={data.dueNext7Days}
            emptyText='No hay etapas programadas para los próximos 7 días.'
          />
          <RequestList items={data.pendingRequests} />
      </section>
    </div>
  );
}
