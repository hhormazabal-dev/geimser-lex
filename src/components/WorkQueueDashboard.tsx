'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WorkQueueData } from '@/lib/actions/work-queue';
import { formatDate } from '@/lib/utils';
import { AlertTriangle, Calendar, CreditCard, FileText } from 'lucide-react';

const GLASS_CARD =
  'rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm text-slate-900';

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
    <Card className={GLASS_CARD}>
      <CardHeader>
        <CardTitle className='flex items-center justify-between gap-3'>
          <span className='flex items-center gap-2'>
            {icon}
            {title}
          </span>
          <Badge variant='outline' className='border-slate-200 text-slate-600'>
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className='text-sm text-slate-500'>{emptyText}</p>
        ) : (
          <div className='space-y-2'>
            {items.slice(0, 12).map((item) => (
              <Link
                key={item.stage_id}
                href={`/cases/${item.case_id}`}
                className='flex flex-col gap-1 rounded-2xl border border-slate-100 bg-white px-4 py-3 transition hover:bg-slate-50'
              >
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <p className='text-sm font-semibold text-slate-900'>{item.caratulado}</p>
                    <p className='text-xs text-slate-500'>
                      {item.etapa} · {formatDate(item.fecha_programada)}
                    </p>
                  </div>
                  <div className='flex flex-wrap items-center gap-2'>
                    {item.prioridad && (
                      <Badge variant='outline' className='border-slate-200 text-slate-600'>
                        {item.prioridad}
                      </Badge>
                    )}
                    {item.workflow_state && (
                      <Badge variant='outline' className='border-slate-200 text-slate-600'>
                        {item.workflow_state.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
                {item.requiere_pago && item.estado_pago !== 'pagado' && (
                  <p className='text-xs text-amber-700'>
                    Bloqueado por pago ({item.estado_pago})
                    {item.enlace_pago ? ' · link disponible' : ''}
                  </p>
                )}
              </Link>
            ))}
            {items.length > 12 && (
              <p className='text-xs text-slate-500'>Mostrando 12 de {items.length} elementos.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RequestList({ items }: { items: WorkQueueData['pendingRequests'] }) {
  return (
    <Card className={GLASS_CARD}>
      <CardHeader>
        <CardTitle className='flex items-center justify-between gap-3'>
          <span className='flex items-center gap-2'>
            <FileText className='h-5 w-5 text-slate-600' />
            Solicitudes pendientes
          </span>
          <Badge variant='outline' className='border-slate-200 text-slate-600'>
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className='text-sm text-slate-500'>No hay solicitudes pendientes.</p>
        ) : (
          <div className='space-y-2'>
            {items.slice(0, 12).map((item) => (
              <Link
                key={item.request_id}
                href={`/cases/${item.case_id}#requests`}
                className='flex flex-col gap-1 rounded-2xl border border-slate-100 bg-white px-4 py-3 transition hover:bg-slate-50'
              >
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <p className='text-sm font-semibold text-slate-900'>{item.titulo}</p>
                    <p className='text-xs text-slate-500'>{item.caratulado}</p>
                  </div>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='outline' className='border-slate-200 text-slate-600'>
                      {item.estado}
                    </Badge>
                    {item.fecha_limite && (
                      <Badge variant='outline' className='border-slate-200 text-slate-600'>
                        {formatDate(item.fecha_limite)}
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            {items.length > 12 && (
              <p className='text-xs text-slate-500'>Mostrando 12 de {items.length} elementos.</p>
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
    <div className='min-h-screen bg-transparent text-slate-900'>
      <div className='mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8'>
        <header className='space-y-2'>
          <p className='text-[11px] uppercase tracking-[0.25em] text-slate-400'>Bandeja de trabajo</p>
          <h1 className='text-2xl font-semibold tracking-tight'>{title}</h1>
          <p className='max-w-3xl text-sm leading-relaxed text-slate-600'>{description}</p>
        </header>

        <section className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {[
            { label: 'Etapas vencidas', value: data.stats.overdueStages, icon: <AlertTriangle className='h-4 w-4' /> },
            { label: 'Próximos 7 días', value: data.stats.dueNext7Days, icon: <Calendar className='h-4 w-4' /> },
            { label: 'Bloqueos de pago', value: data.stats.paymentBlocks, icon: <CreditCard className='h-4 w-4' /> },
            { label: 'Solicitudes', value: data.stats.pendingRequests, icon: <FileText className='h-4 w-4' /> },
          ].map((item) => (
            <Card key={item.label} className={GLASS_CARD}>
              <CardContent className='p-6'>
                <p className='text-xs uppercase tracking-[0.18em] text-slate-500'>{item.label}</p>
                <div className='mt-3 flex items-center justify-between'>
                  <p className='text-3xl font-semibold text-slate-900'>{item.value}</p>
                  <div className='rounded-2xl border border-slate-100 bg-slate-50 p-2 text-slate-600'>{item.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <StageList
            title='Etapas vencidas'
            icon={<AlertTriangle className='h-5 w-5 text-red-600' />}
            items={data.overdueStages}
            emptyText='No hay etapas vencidas. Buen trabajo.'
          />
          <StageList
            title='Próximos 7 días'
            icon={<Calendar className='h-5 w-5 text-sky-600' />}
            items={data.dueNext7Days}
            emptyText='No hay etapas programadas para los próximos 7 días.'
          />
          <StageList
            title='Bloqueos por pago'
            icon={<CreditCard className='h-5 w-5 text-amber-600' />}
            items={data.paymentBlocks}
            emptyText='No hay etapas bloqueadas por pago.'
          />
          <RequestList items={data.pendingRequests} />
        </section>
      </div>
    </div>
  );
}

