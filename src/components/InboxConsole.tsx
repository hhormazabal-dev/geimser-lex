'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, Calendar, ClipboardList, FilePlus2, Inbox, Search, Timer, UserPlus } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { WorkQueueData } from '@/lib/actions/work-queue';
import { cn, formatDate, formatRelativeTime } from '@/lib/utils';

type ViewKey = 'all' | 'overdue' | 'due' | 'requests';
type SavedView = { id: string; name: string; view: ViewKey; q: string };

type NormalizedItem =
  | {
      type: 'deadline';
      bucket: 'overdue' | 'due';
      id: string;
      key: string;
      case_id: string;
      title: string;
      subtitle: string;
      dateLabel: string;
      dateIso: string | null;
      chips: Array<{ label: string; variant?: 'outline' | 'warning' | 'info' | 'destructive' }>;
      hint?: { label: string; tone: 'danger' | 'warning' | 'info' } | undefined;
      href: string;
    }
  | {
      type: 'request';
      bucket: 'requests';
      id: string;
      key: string;
      case_id: string;
      title: string;
      subtitle: string;
      dateLabel: string;
      dateIso: string | null;
      chips: Array<{ label: string; variant?: 'outline' | 'warning' | 'info' | 'destructive' }>;
      hint?: { label: string; tone: 'danger' | 'warning' | 'info' } | undefined;
      href: string;
    };

function safeISO(value: string | null | undefined) {
  const raw = value?.trim() ?? '';
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function compareIsoAsc(a: string | null, b: string | null) {
  if (a && b) return a.localeCompare(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function bucketPriority(bucket: NormalizedItem['bucket']): number {
  if (bucket === 'overdue') return 0;
  if (bucket === 'requests') return 1;
  return 2;
}

function normalizeWorkQueue(data: WorkQueueData): NormalizedItem[] {
  const deadlines: NormalizedItem[] = [
    ...data.overdueStages.map((s) => ({
      type: 'deadline' as const,
      bucket: 'overdue' as const,
      id: s.stage_id,
      key: `overdue:${s.stage_id}`,
      case_id: s.case_id,
      title: s.caratulado,
      subtitle: s.etapa,
      dateLabel: `Vencida · ${formatDate(s.fecha_programada)}`,
      dateIso: safeISO(s.fecha_programada),
      chips: [
        ...(s.prioridad ? [{ label: s.prioridad, variant: 'outline' as const }] : []),
        ...(s.workflow_state ? [{ label: s.workflow_state.replace(/_/g, ' '), variant: 'outline' as const }] : []),
        ...(s.materia ? [{ label: s.materia, variant: 'outline' as const }] : []),
      ],
      hint: { label: 'Atención inmediata', tone: 'danger' as const },
      href: `/cases/${s.case_id}`,
    })),
    ...data.dueNext7Days.map((s) => ({
      type: 'deadline' as const,
      bucket: 'due' as const,
      id: s.stage_id,
      key: `due:${s.stage_id}`,
      case_id: s.case_id,
      title: s.caratulado,
      subtitle: s.etapa,
      dateLabel: `Próxima · ${formatDate(s.fecha_programada)}`,
      dateIso: safeISO(s.fecha_programada),
      chips: [
        ...(s.prioridad ? [{ label: s.prioridad, variant: 'outline' as const }] : []),
        ...(s.workflow_state ? [{ label: s.workflow_state.replace(/_/g, ' '), variant: 'outline' as const }] : []),
      ],
      hint: { label: formatRelativeTime(s.fecha_programada), tone: 'info' as const },
      href: `/cases/${s.case_id}`,
    })),
  ];

  const requests: NormalizedItem[] = data.pendingRequests.map((r) => {
    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = Boolean(r.fecha_limite && r.fecha_limite < today);
    return {
      type: 'request' as const,
      bucket: 'requests' as const,
      id: r.request_id,
      key: `request:${r.request_id}`,
      case_id: r.case_id,
      title: r.titulo,
      subtitle: r.caratulado,
      dateLabel: r.fecha_limite ? `Límite · ${formatDate(r.fecha_limite)}` : 'Sin fecha límite',
      dateIso: safeISO(r.fecha_limite),
      chips: [
        { label: r.estado, variant: isOverdue ? ('destructive' as const) : ('outline' as const) },
        ...(r.prioridad ? [{ label: r.prioridad, variant: 'outline' as const }] : []),
        ...(r.tipo ? [{ label: r.tipo, variant: 'outline' as const }] : []),
      ],
      hint: isOverdue ? { label: 'Solicitud vencida', tone: 'danger' as const } : undefined,
      href: `/cases/${r.case_id}#requests`,
    };
  });

  const all = [...deadlines, ...requests];
  all.sort((a, b) => {
    const p = bucketPriority(a.bucket) - bucketPriority(b.bucket);
    if (p !== 0) return p;
    return compareIsoAsc(a.dateIso, b.dateIso);
  });
  return all;
}

function viewLabel(view: ViewKey) {
  if (view === 'all') return 'Todo';
  if (view === 'overdue') return 'Vencidos';
  if (view === 'due') return 'Próximos 7 días';
  return 'Solicitudes';
}

export function InboxConsole({
  role,
  title,
  description,
  data,
}: {
  role: string;
  title: string;
  description: string;
  data: WorkQueueData;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const selectedView = (searchParams.get('view') as ViewKey | null) ?? 'all';
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [bulkMode, setBulkMode] = useState<
    'closeRequests' | 'setCasePriority' | 'setCaseWorkflow' | 'none'
  >('none');
  const [bulkPriority, setBulkPriority] = useState<'baja' | 'media' | 'alta' | 'urgente'>('media');
  const [bulkWorkflow, setBulkWorkflow] = useState<'preparacion' | 'en_revision' | 'activo' | 'cerrado'>('en_revision');
  const [bulkPending, setBulkPending] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  const savedViewsKey = useMemo(() => `xel.inbox.savedViews.${role}`, [role]);

  useEffect(() => {
    setSearch(searchParams.get('q') ?? '');
  }, [searchParams]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      const q = search.trim();
      if (q) next.set('q', q);
      else next.delete('q');
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 220);
    return () => clearTimeout(handle);
  }, [pathname, router, search, searchParams]);

  const views = useMemo(() => {
    const focus = data.stats.overdueStages + data.stats.pendingRequests;
    return [
      {
        key: 'all' as const,
        label: 'Todo',
        description: 'Vista priorizada',
        count: focus + data.stats.dueNext7Days,
        icon: <Inbox className="h-4 w-4" />,
      },
      {
        key: 'overdue' as const,
        label: 'Vencidos',
        description: 'Vencimientos vencidos',
        count: data.stats.overdueStages,
        icon: <Timer className="h-4 w-4" />,
      },
      {
        key: 'due' as const,
        label: 'Próximos 7 días',
        description: 'Vencimientos próximos',
        count: data.stats.dueNext7Days,
        icon: <Calendar className="h-4 w-4" />,
      },
      {
        key: 'requests' as const,
        label: 'Solicitudes',
        description: 'Pendientes del cliente',
        count: data.stats.pendingRequests,
        icon: <ClipboardList className="h-4 w-4" />,
      },
    ];
  }, [data.stats.dueNext7Days, data.stats.overdueStages, data.stats.pendingRequests]);

  const items = useMemo(() => normalizeWorkQueue(data), [data]);
  const itemByKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const view = selectedView;
    return items.filter((item) => {
      const matchesView =
        view === 'all' ||
        (view === 'requests' ? item.bucket === 'requests' : item.bucket === view);
      if (!matchesView) return false;
      if (!q) return true;
      const haystack = [item.title, item.subtitle, item.chips.map((c) => c.label).join(' ')].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search, selectedView]);

  const canCreateCase = role !== 'cliente';
  const canCreateClient = role === 'admin_firma' || role === 'analista';
  const canBulk = role === 'admin_firma' || role === 'abogado' || role === 'analista';

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(savedViewsKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedView[];
      if (Array.isArray(parsed)) setSavedViews(parsed.slice(0, 12));
    } catch {
      // ignore
    }
  }, [savedViewsKey]);

  const persistSavedViews = (next: SavedView[]) => {
    setSavedViews(next);
    try {
      window.localStorage.setItem(savedViewsKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const applySavedView = (sv: SavedView) => {
    const next = new URLSearchParams(searchParams.toString());
    if (sv.view === 'all') next.delete('view');
    else next.set('view', sv.view);
    if (sv.q.trim()) next.set('q', sv.q.trim());
    else next.delete('q');
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const saveCurrentView = () => {
    const name = window.prompt('Nombre de la vista (ej: "Mis vencidos")')?.trim();
    if (!name) return;
    const view = selectedView;
    const q = search.trim();
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next = [{ id, name, view, q }, ...savedViews].slice(0, 12);
    persistSavedViews(next);
    toast({ title: 'Vista guardada', description: name });
  };

  const deleteSavedView = (id: string) => {
    const next = savedViews.filter((v) => v.id !== id);
    persistSavedViews(next);
  };

  const selectedItems = useMemo(() => {
    const out: NormalizedItem[] = [];
    selectedKeys.forEach((key) => {
      const item = itemByKey.get(key);
      if (item) out.push(item);
    });
    return out;
  }, [itemByKey, selectedKeys]);

  const selectedStageIds = useMemo(
    () => [],
    [selectedItems],
  );
  const selectedRequestIds = useMemo(
    () => selectedItems.filter((i) => i.type === 'request').map((i) => i.id),
    [selectedItems],
  );
  const selectedCaseIds = useMemo(() => Array.from(new Set(selectedItems.map((i) => i.case_id))), [selectedItems]);

  const clearSelection = () => {
    setSelectedKeys(new Set());
    setBulkMode('none');
  };

  const toggleSelected = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyBulk = async () => {
    if (!canBulk) return;
    if (bulkMode === 'none') return;

    const payload =
      bulkMode === 'closeRequests'
        ? { action: 'closeRequests' as const, requestIds: selectedRequestIds }
        : bulkMode === 'setCasePriority'
          ? { action: 'setCasePriority' as const, caseIds: selectedCaseIds, priority: bulkPriority }
          : { action: 'setCaseWorkflow' as const, caseIds: selectedCaseIds, workflow_state: bulkWorkflow };

    if ((payload as any).requestIds && (payload as any).requestIds.length === 0) {
      toast({ title: 'Selecciona solicitudes', description: 'Esta acción aplica solo a solicitudes.', variant: 'destructive' });
      return;
    }
    if ((payload as any).caseIds && (payload as any).caseIds.length === 0) {
      toast({ title: 'Selecciona casos', description: 'No hay casos asociados a la selección.', variant: 'destructive' });
      return;
    }

    setBulkPending(true);
    try {
      const res = await fetch('/api/inbox/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as any;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? 'No se pudo aplicar la acción.');
      }

      const failed = Number(json.failed ?? 0);
      const ok = Number(json.ok ?? 0);
      toast({
        title: failed > 0 ? 'Acción aplicada con alertas' : 'Acción aplicada',
        description: failed > 0 ? `${ok} ok · ${failed} con error` : `${ok} elemento(s) actualizados.`,
        variant: 'default',
      });

      clearSelection();
      router.refresh();
    } catch (e) {
      toast({
        title: 'No se pudo aplicar',
        description: e instanceof Error ? e.message : 'Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setBulkPending(false);
    }
  };

  const setView = useCallback(
    (view: ViewKey) => {
      const next = new URLSearchParams(searchParams.toString());
      if (view === 'all') next.delete('view');
      else next.set('view', view);
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        (target as any)?.isContentEditable;
      if (isTypingTarget) return;

      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (search.trim().length > 0) {
          e.preventDefault();
          setSearch('');
        }
        return;
      }

      const map: Record<string, ViewKey> = {
        '1': 'all',
        '2': 'overdue',
        '3': 'due',
        '4': 'requests',
      };
      const next = map[e.key];
      if (next) {
        e.preventDefault();
        setView(next);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [search, setView]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inbox"
        title={title}
        description={description}
        actions={
          <>
            {canCreateClient && (
              <Button asChild variant="outline" className="hidden sm:inline-flex">
                <Link href="/clients" className="inline-flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Crear cliente
                </Link>
              </Button>
            )}
            {canCreateCase && (
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/cases/new" className="inline-flex items-center gap-2">
                  <FilePlus2 className="h-4 w-4" />
                  Nuevo caso
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span>Vistas</span>
                <Button type="button" variant="outline" size="sm" onClick={saveCurrentView}>
                  Guardar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {savedViews.length > 0 && (
                <div className="space-y-2">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/45">
                    Guardadas
                  </p>
                  <div className="space-y-2">
                    {savedViews.slice(0, 6).map((sv) => (
                      <div
                        key={sv.id}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-white/20 bg-white/45 px-3 py-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => applySavedView(sv)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-semibold text-foreground">{sv.name}</p>
                          <p className="truncate text-xs text-foreground/55">
                            {viewLabel(sv.view)}
                            {sv.q ? ` · "${sv.q}"` : ''}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSavedView(sv.id)}
                          className="rounded-xl border border-white/20 bg-white/50 px-2 py-1 text-xs text-foreground/60 hover:bg-white/80"
                          aria-label="Eliminar vista"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {savedViews.length > 0 && (
                <p className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/45">
                  Predeterminadas
                </p>
              )}
              {views.map((v) => {
                const active = selectedView === v.key;
                return (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setView(v.key)}
                    className={cn(
                      'flex w-full items-start justify-between gap-3 rounded-2xl border border-white/20 bg-white/50 px-4 py-3 text-left transition hover:bg-white/80',
                      active && 'border-primary/35 bg-primary/10',
                    )}
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <span
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/60 text-foreground/70',
                          active && 'text-primary',
                        )}
                      >
                        {v.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">{v.label}</span>
                        <span className="block truncate text-xs text-foreground/55">{v.description}</span>
                      </span>
                    </span>
                    <Badge variant="outline" className="shrink-0 text-foreground/60">
                      {v.count}
                    </Badge>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="hidden lg:block">
            <CardHeader>
              <CardTitle className="text-base">Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-foreground/60">
              <p>Atajos: <span className="font-semibold text-foreground">/</span> buscar · <span className="font-semibold text-foreground">1–5</span> vistas · <span className="font-semibold text-foreground">Esc</span> limpiar.</p>
              <p>
                Empieza por <span className="font-semibold text-foreground">Vencidos</span> y{' '}
                <span className="font-semibold text-foreground">Solicitudes</span> para destrabar el flujo.
              </p>
            </CardContent>
          </Card>
        </aside>

        <div className="min-w-0 space-y-4">
          {canBulk && selectedKeys.size > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-foreground/70">
                    {selectedKeys.size} seleccionado(s)
                  </Badge>
                  <span className="text-sm text-foreground/60">
                    {selectedRequestIds.length} solicitudes · {selectedCaseIds.length} casos
                  </span>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={bulkMode}
                    onChange={(e) => setBulkMode(e.target.value as any)}
                    className="h-10 rounded-2xl border border-white/20 bg-white/60 px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    disabled={bulkPending}
                  >
                    <option value="none">Acción…</option>
                    <option value="closeRequests">Cerrar solicitudes</option>
                    <option value="setCasePriority">Cambiar prioridad del caso</option>
                    <option value="setCaseWorkflow">Cambiar workflow del caso</option>
                  </select>

                  {bulkMode === 'setCasePriority' && (
                    <select
                      value={bulkPriority}
                      onChange={(e) => setBulkPriority(e.target.value as any)}
                      className="h-10 rounded-2xl border border-white/20 bg-white/60 px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                      disabled={bulkPending}
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  )}

                  {bulkMode === 'setCaseWorkflow' && (
                    <select
                      value={bulkWorkflow}
                      onChange={(e) => setBulkWorkflow(e.target.value as any)}
                      className="h-10 rounded-2xl border border-white/20 bg-white/60 px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                      disabled={bulkPending}
                    >
                      <option value="preparacion">Preparación</option>
                      <option value="en_revision">En revisión</option>
                      <option value="activo">Activo</option>
                      <option value="cerrado">Cerrado</option>
                    </select>
                  )}

                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={clearSelection} disabled={bulkPending}>
                      Limpiar
                    </Button>
                    <Button type="button" onClick={applyBulk} disabled={bulkPending || bulkMode === 'none'}>
                      {bulkPending ? 'Aplicando…' : 'Aplicar'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Buscar en ${viewLabel(selectedView).toLowerCase()}…`}
                    className="h-11 w-full min-w-[260px] rounded-2xl border border-white/20 bg-white/50 pl-10 pr-3 text-sm text-foreground shadow-inner outline-none transition focus:border-primary/40 focus:bg-white/80 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/55">
                <span className="rounded-full border border-white/20 bg-white/50 px-3 py-2">
                  Mostrando <span className="font-semibold text-foreground">{filtered.length}</span>
                </span>
                <span className="rounded-full border border-white/20 bg-white/50 px-3 py-2">
                  Señales críticas{' '}
                  <span className="font-semibold text-foreground">
                    {data.stats.overdueStages + data.stats.paymentBlocks + data.stats.pendingRequests}
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span className="flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-primary" />
                  {viewLabel(selectedView)}
                </span>
                <Badge variant="outline" className="text-foreground/60">
                  {filtered.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/25 bg-white/35 px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-foreground">No hay elementos para esta vista.</p>
                  <p className="mt-1 text-sm text-foreground/60">Prueba cambiando de vista o ajustando la búsqueda.</p>
                </div>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item.key}
                    className="group flex items-start gap-4 rounded-2xl border border-white/20 bg-white/55 px-4 py-3 transition hover:bg-white/80"
                  >
                    {canBulk && (
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(item.key)}
                          onChange={() => toggleSelected(item.key)}
                          className="h-4 w-4 rounded border-white/30 bg-white text-primary focus:ring-primary/40"
                          aria-label="Seleccionar"
                        />
                      </div>
                    )}
                    <Link
                      href={item.href}
                      className="flex min-w-0 flex-1 items-start justify-between gap-4"
                    >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        {item.hint?.tone === 'danger' && <Badge variant="destructive">{item.hint.label}</Badge>}
                        {item.hint?.tone === 'warning' && <Badge variant="warning">{item.hint.label}</Badge>}
                        {item.hint?.tone === 'info' && <Badge variant="info">{item.hint.label}</Badge>}
                      </div>
                      <p className="mt-1 truncate text-xs text-foreground/55">
                        {item.subtitle} · {item.dateLabel}
                      </p>
                      {item.chips.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {item.chips.slice(0, 4).map((chip) => (
                            <Badge key={chip.label} variant={chip.variant ?? 'outline'}>
                              {chip.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-foreground/35 transition group-hover:text-foreground/70" />
                    </Link>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
