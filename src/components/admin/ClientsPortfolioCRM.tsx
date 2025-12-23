'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Client360Drawer } from '@/components/admin/Client360Drawer';
import { cn, formatDateTime, formatRelativeTime, getInitials, stringToColor } from '@/lib/utils';
import { ArrowUpRight, Filter, Search, Users, Wallet } from 'lucide-react';

type PortfolioCase = {
  id: string;
  caratulado: string;
  estado: string | null;
  prioridad: string | null;
  etapa_actual: string | null;
  fecha_inicio: string | null;
  workflow_state: string | null;
  next_action_at?: string | null;
  next_action_title?: string | null;
};

type PortfolioLawyer = {
  id: string;
  nombre: string | null;
  totalCases: number;
  activeCases: number;
  urgentCases: number;
  inReviewCases: number;
};

type PortfolioItem = {
  client: {
    id: string;
    nombre: string | null;
    rut: string | null;
    email: string | null;
    telefono: string | null;
  };
  totalCases: number;
  activeCases: number;
  urgentCases: number;
  inReviewCases: number;
  cases: PortfolioCase[];
  lawyers?: PortfolioLawyer[];
};

type ViewId = 'all' | 'no-next-action' | 'urgent' | 'in-review' | 'no-lawyer' | 'inactive';

const VIEW_STORAGE_KEY = 'portfolio.clients.view';

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function classifyClientType(name?: string | null) {
  const value = (name ?? '').toUpperCase();
  if (/\b(S\.?A\.?|SPA|LTDA|E\.?I\.?R\.?L\.?|S\.?P\.?A\.?|FUNDACION|CORPORACION)\b/.test(value)) {
    return 'Empresa';
  }
  return 'Persona';
}

function getNextAction(cases: PortfolioCase[]) {
  const candidates = cases
    .map((c) => ({
      caseId: c.id,
      caratulado: c.caratulado,
      at: c.next_action_at ?? null,
      title: c.next_action_title ?? null,
    }))
    .filter((row) => Boolean(row.at))
    .sort((a, b) => new Date(a.at as string).getTime() - new Date(b.at as string).getTime());
  return candidates[0] ?? null;
}

export function ClientsPortfolioCRM({ portfolio }: { portfolio: PortfolioItem[] }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewId>('all');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (!raw) return;
      const parsed = raw as ViewId;
      setView(parsed);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // ignore
    }
  }, [view]);

  const enriched = useMemo(() => {
    return portfolio.map((item) => {
      const type = classifyClientType(item.client.nombre);
      const next = getNextAction(item.cases);
      const hasNextAction = Boolean(next?.at);
      const hasLawyer = (item.lawyers?.length ?? 0) > 0;
      return {
        ...item,
        _type: type,
        _next: next,
        _hasNextAction: hasNextAction,
        _hasLawyer: hasLawyer,
      };
    });
  }, [portfolio]);

  const counts = useMemo(() => {
    const totalClients = enriched.length;
    const activeClients = enriched.filter((c) => c.activeCases > 0).length;
    const urgentClients = enriched.filter((c) => c.urgentCases > 0).length;
    const inReviewClients = enriched.filter((c) => c.inReviewCases > 0).length;
    const missingNextAction = enriched.filter((c) => c.activeCases > 0 && !c._hasNextAction).length;
    const missingLawyer = enriched.filter((c) => c.activeCases > 0 && !c._hasLawyer).length;
    return {
      totalClients,
      activeClients,
      urgentClients,
      inReviewClients,
      missingNextAction,
      missingLawyer,
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = normalizeText(search);

    const matchesSearch = (item: (typeof enriched)[number]) => {
      if (!q) return true;
      const clientText = [
        item.client.nombre,
        item.client.rut,
        item.client.email,
        item.client.telefono,
        item._type,
        ...item.cases.map((c) => c.caratulado),
      ]
        .filter(Boolean)
        .map((v) => normalizeText(String(v)))
        .join(' · ');
      return clientText.includes(q);
    };

    const matchesView = (item: (typeof enriched)[number]) => {
      switch (view) {
        case 'no-next-action':
          return item.activeCases > 0 && !item._hasNextAction;
        case 'urgent':
          return item.urgentCases > 0;
        case 'in-review':
          return item.inReviewCases > 0;
        case 'no-lawyer':
          return item.activeCases > 0 && !item._hasLawyer;
        case 'inactive':
          return item.activeCases === 0;
        case 'all':
        default:
          return true;
      }
    };

    return enriched.filter((item) => matchesSearch(item) && matchesView(item));
  }, [enriched, search, view]);

  const openClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setDrawerOpen(true);
  };

  const viewChips: Array<{ id: ViewId; label: string; count?: number; tone?: string }> = [
    { id: 'all', label: 'Todos', count: counts.totalClients },
    { id: 'urgent', label: 'Urgentes', count: counts.urgentClients, tone: 'bg-rose-50 text-rose-700 border-rose-200' },
    { id: 'in-review', label: 'En revisión', count: counts.inReviewClients, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
    {
      id: 'no-next-action',
      label: 'Sin próxima acción',
      count: counts.missingNextAction,
      tone: 'bg-sky-50 text-sky-700 border-sky-200',
    },
    { id: 'no-lawyer', label: 'Sin abogado', count: counts.missingLawyer, tone: 'bg-slate-100 text-slate-700 border-slate-200' },
    { id: 'inactive', label: 'Inactivos', count: enriched.length - counts.activeClients, tone: 'bg-slate-50 text-slate-600 border-slate-200' },
  ];

  return (
    <div className='space-y-6'>
      <Card className='rounded-3xl border border-slate-200 bg-white/85 shadow-sm backdrop-blur-xl'>
        <CardContent className='p-6'>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
            <div className='space-y-2'>
              <p className='text-[11px] uppercase tracking-[0.25em] text-slate-400'>Control administrativo</p>
              <h1 className='text-2xl font-semibold tracking-tight text-slate-900'>Cartera (CRM)</h1>
              <p className='max-w-3xl text-sm leading-relaxed text-slate-600'>
                Priorización por urgencia y seguimiento: identifica clientes sin próxima acción y abre su ficha 360°.
              </p>
            </div>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
              <div className='flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:w-[360px]'>
                <Search className='h-4 w-4 text-slate-400' />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder='Buscar clientes, casos, RUT, email...'
                  className='border-0 bg-transparent p-0 text-sm focus-visible:ring-0'
                />
              </div>
              <Button asChild className='rounded-full bg-slate-900 text-white hover:bg-slate-800'>
                <Link href='/cases'>
                  Ir a casos <ArrowUpRight className='ml-2 h-4 w-4' />
                </Link>
              </Button>
            </div>
          </div>

          <div className='mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
            <div className='rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3'>
              <p className='text-[11px] uppercase tracking-[0.18em] text-slate-500'>Clientes activos</p>
              <p className='mt-2 text-2xl font-semibold text-slate-900'>{counts.activeClients}</p>
            </div>
            <div className='rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3'>
              <p className='text-[11px] uppercase tracking-[0.18em] text-slate-500'>Urgentes</p>
              <p className='mt-2 text-2xl font-semibold text-slate-900'>{counts.urgentClients}</p>
            </div>
            <div className='rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3'>
              <p className='text-[11px] uppercase tracking-[0.18em] text-slate-500'>En revisión</p>
              <p className='mt-2 text-2xl font-semibold text-slate-900'>{counts.inReviewClients}</p>
            </div>
            <div className='rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3'>
              <p className='text-[11px] uppercase tracking-[0.18em] text-slate-500'>Sin próxima acción</p>
              <p className='mt-2 text-2xl font-semibold text-slate-900'>{counts.missingNextAction}</p>
            </div>
            <div className='rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3'>
              <p className='text-[11px] uppercase tracking-[0.18em] text-slate-500'>Sin abogado</p>
              <p className='mt-2 text-2xl font-semibold text-slate-900'>{counts.missingLawyer}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className='rounded-3xl border border-slate-200 bg-white/85 shadow-sm backdrop-blur-xl'>
        <CardHeader className='flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between'>
          <div className='space-y-1'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Users className='h-5 w-5 text-slate-600' />
              Clientes ({filtered.length})
            </CardTitle>
            <p className='text-sm text-slate-500'>Usa las vistas para priorizar y abre el drawer para actuar.</p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600'>
              <Filter className='h-3.5 w-3.5' />
              Vistas
            </span>
            {viewChips.map((chip) => {
              const selected = chip.id === view;
              return (
                <button
                  key={chip.id}
                  onClick={() => setView(chip.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition',
                    selected ? 'border-slate-900 bg-slate-900 text-white' : `border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${chip.tone ?? ''}`,
                  )}
                >
                  {chip.label}
                  {typeof chip.count === 'number' && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px]',
                        selected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700',
                      )}
                    >
                      {chip.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className='px-6 pb-6 pt-0'>
          <div className='overflow-hidden rounded-2xl border border-slate-200 bg-white'>
            <div className='grid grid-cols-[minmax(240px,1.4fr)_120px_220px_260px_160px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500'>
              <div>Cliente</div>
              <div>Tipo</div>
              <div>Casos</div>
              <div>Próxima acción</div>
              <div className='text-right'>Acción</div>
            </div>
            <div className='divide-y divide-slate-100'>
              {filtered.length === 0 ? (
                <div className='p-8 text-center text-sm text-slate-500'>No hay resultados con estos filtros.</div>
              ) : (
                filtered.map((item) => {
                  const clientName = item.client.nombre ?? 'Cliente sin nombre';
                  const next = item._next;
                  const nextAt = next?.at ?? null;
                  const nextTitle = next?.title ?? null;
                  const missingNext = item.activeCases > 0 && !nextAt;
                  const lawyerNames = (item.lawyers ?? [])
                    .slice(0, 2)
                    .map((l) => l.nombre ?? 'Abogado')
                    .filter(Boolean);
                  const moreLawyers = Math.max((item.lawyers?.length ?? 0) - lawyerNames.length, 0);

                  return (
                    <div
                      key={item.client.id}
                      className='grid cursor-pointer grid-cols-[minmax(240px,1.4fr)_120px_220px_260px_160px] items-center gap-3 px-4 py-4 hover:bg-slate-50/70'
                      onClick={() => openClient(item.client.id)}
                      role='button'
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') openClient(item.client.id);
                      }}
                    >
                      <div className='flex items-center gap-3'>
                        <div
                          className='flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold'
                          style={{ backgroundColor: stringToColor(clientName) }}
                        >
                          {getInitials(clientName)}
                        </div>
                        <div className='min-w-0'>
                          <p className='truncate text-sm font-semibold text-slate-900'>{clientName}</p>
                          <p className='truncate text-xs text-slate-500'>
                            {item.client.rut ? item.client.rut : item.client.email ? item.client.email : '—'}
                            {lawyerNames.length > 0 ? ` · ${lawyerNames.join(', ')}${moreLawyers ? ` +${moreLawyers}` : ''}` : ''}
                          </p>
                        </div>
                      </div>

                      <div>
                        <Badge variant='outline' className='border-slate-200 text-slate-600'>
                          {item._type}
                        </Badge>
                      </div>

                      <div className='flex flex-wrap gap-2 text-xs'>
                        <Badge variant='outline' className='border-slate-200 text-slate-700'>
                          {item.activeCases} activos
                        </Badge>
                        {item.urgentCases > 0 && (
                          <Badge variant='outline' className='border-rose-200 bg-rose-50 text-rose-700'>
                            {item.urgentCases} urgentes
                          </Badge>
                        )}
                        {item.inReviewCases > 0 && (
                          <Badge variant='outline' className='border-amber-200 bg-amber-50 text-amber-700'>
                            {item.inReviewCases} en revisión
                          </Badge>
                        )}
                      </div>

                      <div className='min-w-0'>
                        {nextAt ? (
                          <div className='space-y-1'>
                            <p className='truncate text-sm font-medium text-slate-900'>
                              {nextTitle ? nextTitle : 'Próxima acción'}
                            </p>
                            <p className='text-xs text-slate-500'>
                              {formatDateTime(nextAt)} · {formatRelativeTime(nextAt)}
                            </p>
                          </div>
                        ) : (
                          <div className={cn('rounded-2xl border px-3 py-2 text-xs', missingNext ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-50 text-slate-600')}>
                            {missingNext ? 'Sin próxima acción (priorizar)' : 'Sin próxima acción'}
                          </div>
                        )}
                      </div>

                      <div className='flex items-center justify-end gap-2'>
                        <Button
                          size='sm'
                          variant='outline'
                          className='rounded-full border-slate-200 bg-white/80 text-slate-700 hover:bg-white'
                          onClick={(e) => {
                            e.stopPropagation();
                            openClient(item.client.id);
                          }}
                        >
                          Abrir 360°
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          className='rounded-full px-3 text-slate-600 hover:bg-slate-100'
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link href={`/dashboard/admin/clients/${item.client.id}`}>
                            <Wallet className='h-4 w-4' />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Client360Drawer
        open={drawerOpen}
        onOpenChange={(open) => setDrawerOpen(open)}
        clientId={selectedClientId}
        onNavigateToClient={(clientId) => {
          setDrawerOpen(false);
          setSelectedClientId(null);
          setSearch('');
          setView('all');
          openClient(clientId);
        }}
      />
    </div>
  );
}

