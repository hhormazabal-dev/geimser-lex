'use client';

import { useState } from 'react';
import type { DashboardHighlights, DashboardStats } from '@/lib/actions/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Briefcase, Users, FileText, AlertTriangle, X, Calendar, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';

interface KpiCardsProps {
  stats: DashboardStats;
  highlights: DashboardHighlights;
}

type ActiveCard = 'cases' | 'clients' | 'documents' | 'pending' | null;

export function KpiCards({ stats, highlights }: KpiCardsProps) {
  const [activeCard, setActiveCard] = useState<ActiveCard>(null);

  const items = [
    {
      key: 'cases' as const,
      title: 'Casos totales',
      value: stats.totalCases,
      description: `${stats.activeCases} activos`,
      icon: Briefcase,
      iconClass: 'text-sky-600 bg-sky-50 border border-sky-100',
      cardBorder: 'border-sky-100',
      cardGlow: 'from-sky-100 via-white to-transparent',
    },
    {
      key: 'clients' as const,
      title: 'Clientes',
      value: stats.totalClients,
      description: 'Registrados en la firma',
      icon: Users,
      iconClass: 'text-emerald-600 bg-emerald-50 border border-emerald-100',
      cardBorder: 'border-emerald-100',
      cardGlow: 'from-emerald-100 via-white to-transparent',
    },
    {
      key: 'documents' as const,
      title: 'Documentos',
      value: stats.totalDocuments,
      description: `${stats.totalNotes} notas`,
      icon: FileText,
      iconClass: 'text-violet-600 bg-violet-50 border border-violet-100',
      cardBorder: 'border-violet-100',
      cardGlow: 'from-violet-100 via-white to-transparent',
    },
    {
      key: 'pending' as const,
      title: 'Pendientes',
      value: stats.pendingRequests,
      description: `${stats.overdueStages} vencidos`,
      icon: AlertTriangle,
      iconClass: 'text-amber-600 bg-amber-50 border border-amber-100',
      cardBorder: 'border-amber-100',
      cardGlow: 'from-amber-100 via-white to-transparent',
    },
  ];

  const renderModalContent = (card: Exclude<ActiveCard, null>) => {
    switch (card) {
      case 'cases':
        return (
          <div className='space-y-4'>
            <header className='flex items-center justify-between'>
              <h3 className='text-xl font-semibold text-slate-900'>Resumen de casos</h3>
              <Badge variant='outline' className='border-slate-200 text-slate-600'>
                {stats.totalCases} casos • {stats.completedCases} completados
              </Badge>
            </header>
            <div className='grid gap-3'>
              {highlights.recentCases.length === 0 && (
                <p className='text-sm text-slate-500'>No hay casos registrados todavía.</p>
              )}
              {highlights.recentCases.map((caseItem) => (
                <Link
                  key={caseItem.id}
                  href={`/cases/${caseItem.id}`}
                  className='group flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 transition-colors hover:border-sky-200/60 hover:bg-sky-50/70'
                >
                  <div>
                    <p className='text-sm font-medium text-slate-900'>{caseItem.caratulado}</p>
                    <p className='text-xs text-slate-500'>
                      {caseItem.estado ? `Estado: ${caseItem.estado}` : 'Sin estado'} • {caseItem.prioridad ? `Prioridad: ${caseItem.prioridad}` : 'Sin prioridad'}
                    </p>
                    <p className='text-xs text-slate-400'>
                      {caseItem.fecha_inicio ? `Desde ${formatDate(caseItem.fecha_inicio)}` : 'Fecha no registrada'}
                    </p>
                  </div>
                  <div className='flex items-center gap-2 text-sm text-sky-600'>
                    {caseItem.valor_estimado ? formatCurrency(caseItem.valor_estimado) : 'Sin valor estimado'}
                    <ArrowUpRight className='h-4 w-4 text-sky-400 opacity-60 group-hover:opacity-100' />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      case 'clients':
        return (
          <div className='space-y-4'>
            <header className='flex items-center justify-between'>
              <h3 className='text-xl font-semibold text-slate-900'>Clientes recientes</h3>
              <Badge variant='outline' className='border-slate-200 text-slate-600'>
                {stats.totalClients} clientes registrados
              </Badge>
            </header>
            <div className='grid gap-3'>
              {highlights.clients.length === 0 && (
                <p className='text-sm text-slate-500'>Todavía no se han agregado clientes.</p>
              )}
              {highlights.clients.map((client) => (
                <div key={client.id} className='rounded-2xl border border-slate-100 bg-white/80 px-4 py-3'>
                  <p className='text-sm font-medium text-slate-900'>{client.nombre ?? 'Sin nombre'}</p>
                  <p className='text-xs text-slate-500'>{client.email ?? 'Sin correo'}</p>
                  <p className='text-xs text-slate-400'>
                    {client.telefono ?? 'Sin teléfono'} • {client.created_at ? `Alta: ${formatDate(client.created_at)}` : 'Fecha sin registrar'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'documents':
        return (
          <div className='space-y-4'>
            <header className='flex items-center justify-between'>
              <h3 className='text-xl font-semibold text-slate-900'>Actividad documental</h3>
              <Badge variant='outline' className='border-slate-200 text-slate-600'>
                {stats.totalDocuments} documentos • {stats.totalNotes} notas
              </Badge>
            </header>
            <div className='grid gap-3'>
              {highlights.documents.length === 0 && (
                <p className='text-sm text-slate-500'>No hay documentos cargados todavía.</p>
              )}
              {highlights.documents.map((doc) => (
                <div key={doc.id} className='flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-4 py-3'>
                  <div>
                    <p className='text-sm font-medium text-slate-900'>{doc.nombre}</p>
                    <p className='text-xs text-slate-500'>
                      {doc.created_at ? formatDate(doc.created_at) : 'Fecha no disponible'}
                    </p>
                  </div>
                  {doc.case_id && (
                    <Link
                      href={`/cases/${doc.case_id}`}
                      className='flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800'
                    >
                      Ver caso
                      <ArrowUpRight className='h-3 w-3 text-sky-400' />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      case 'pending':
        return (
          <div className='space-y-4'>
            <header className='flex items-center justify-between'>
              <h3 className='text-xl font-semibold text-slate-900'>Alertas y pendientes</h3>
              <Badge variant='outline' className='border-slate-200 text-slate-600'>
                {stats.pendingRequests} solicitudes • {stats.overdueStages} etapas vencidas
              </Badge>
            </header>
            <div className='grid gap-3'>
              {highlights.pending.length === 0 && (
                <p className='text-sm text-slate-500'>Sin pendientes. ¡Excelente trabajo!</p>
              )}
              {highlights.pending.map((item) => (
                <div key={item.id} className='flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-4 py-3'>
                  <div>
                    <p className='text-sm font-medium text-slate-900'>{item.titulo}</p>
                    <p className='text-xs text-slate-500'>
                      {item.tipo === 'solicitud' ? 'Solicitud de información' : 'Etapa del caso'}
                      {item.estado ? ` • ${item.estado}` : ''}
                    </p>
                    <p className='text-xs text-slate-400'>
                      {item.fecha ? `Fecha límite: ${formatDate(item.fecha)}` : 'Sin fecha definida'}
                    </p>
                  </div>
                  {item.case_id && (
                    <Link href={`/cases/${item.case_id}`} className='flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800'>
                      Ir al caso
                      <ArrowUpRight className='h-3 w-3 text-sky-400' />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <div className='grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4'>
        {items.map(({ key, title, value, description, icon: Icon, iconClass, cardBorder, cardGlow }) => (
          <Card
            key={key}
            onClick={() => setActiveCard(key)}
            className={`group relative cursor-pointer overflow-hidden border ${cardBorder} bg-white/80 backdrop-blur-xl shadow-md transition-all hover:-translate-y-1 hover:shadow-lg`}
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${cardGlow} opacity-0 transition-opacity group-hover:opacity-100`} />
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-slate-600'>{title}</CardTitle>
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${iconClass}`}>
                <Icon className='h-4 w-4' />
              </span>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-semibold text-slate-900'>{value}</div>
              <p className='text-[11px] text-slate-500'>{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeCard && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4 py-10'
          onClick={() => setActiveCard(null)}
        >
          <div
            className='relative w-full max-w-3xl rounded-3xl border border-slate-100 bg-white p-6 text-slate-900 shadow-2xl sm:p-8'
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              size='icon'
              variant='ghost'
              className='absolute right-4 top-4 h-9 w-9 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100'
              onClick={() => setActiveCard(null)}
            >
              <X className='h-4 w-4' />
              <span className='sr-only'>Cerrar</span>
            </Button>

            <div className='mb-6 flex items-center gap-2 text-sm text-slate-500'>
              <Calendar className='h-4 w-4 text-slate-400' />
              Resumen actualizado en tiempo real
            </div>

            {renderModalContent(activeCard)}
          </div>
        </div>
      )}
    </>
  );
}
