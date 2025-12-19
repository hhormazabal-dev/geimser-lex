'use client';

import { Command } from 'cmdk';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { SidebarItem } from '@/components/layout/AppSidebar';
import { FilePlus2, Inbox, Search, UserPlus, Users } from 'lucide-react';

type CommandPaletteItem =
  | { kind: 'nav'; href: string; label: string; group?: string; keywords?: string[] }
  | { kind: 'action'; id: string; label: string; group?: string; icon?: ReactNode; onSelect: () => void };

function groupBy<T extends { group?: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.group ?? 'General';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return Array.from(groups.entries());
}

export function CommandPalette({
  open,
  onOpenChange,
  items,
  canCreateCase,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SidebarItem[];
  canCreateCase: boolean;
  role: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteCases, setRemoteCases] = useState<
    Array<{
      id: string;
      caratulado: string;
      numero_causa: string | null;
      materia: string | null;
    }>
  >([]);
  const [remoteClients, setRemoteClients] = useState<
    Array<{ id: string; nombre: string; email: string; rut: string | null }>
  >([]);

  const commandItems: CommandPaletteItem[] = useMemo(() => {
    const base: CommandPaletteItem[] = items.map((item) => ({
      kind: 'nav',
      href: item.href,
      label: item.label,
      group: item.group ?? 'Navegación',
      ...(item.keywords ? { keywords: item.keywords } : {}),
    }));

    const actions: CommandPaletteItem[] = [];
    if (canCreateCase) {
      actions.push({
        kind: 'action',
        id: 'create-case',
        label: 'Nuevo caso',
        group: 'Acciones',
        icon: <FilePlus2 className="h-4 w-4" />,
        onSelect: () => router.push('/cases/new'),
      });
    }

    if (role === 'admin_firma' || role === 'analista') {
      actions.push({
        kind: 'action',
        id: 'create-client',
        label: 'Crear cliente',
        group: 'Acciones',
        icon: <UserPlus className="h-4 w-4" />,
        onSelect: () => router.push('/clients'),
      });
    }

    actions.push({
      kind: 'action',
      id: 'open-inbox',
      label: 'Abrir Inbox',
      group: 'Acciones',
      icon: <Inbox className="h-4 w-4" />,
      onSelect: () => router.push('/inbox'),
    });

    return [...actions, ...base];
  }, [items, canCreateCase, role, router]);

  const grouped = useMemo(() => groupBy(commandItems), [commandItems]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const q = search.trim();
    if (q.length < 2) {
      setRemoteCases([]);
      setRemoteClients([]);
      setRemoteLoading(false);
      return;
    }

    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setRemoteLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!res.ok) throw new Error('Search failed');
        const json = (await res.json()) as {
          cases: Array<{ id: string; caratulado: string; numero_causa: string | null; materia: string | null }>;
          clients: Array<{ id: string; nombre: string; email: string; rut: string | null }>;
        };
        setRemoteCases(json.cases ?? []);
        setRemoteClients(json.clients ?? []);
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return;
        setRemoteCases([]);
        setRemoteClients([]);
      } finally {
        setRemoteLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [open, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />
      <div className="absolute left-1/2 top-16 w-[min(720px,calc(100%-2rem))] -translate-x-1/2">
        <div className="rounded-3xl border border-white/20 bg-white/85 shadow-2xl backdrop-blur-2xl">
          <Command
            className="flex max-h-[min(70vh,560px)] w-full flex-col overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-white/20 px-5 py-4">
              <Search className="h-4 w-4 text-foreground/50" />
              <Command.Input
                autoFocus
                placeholder="Buscar casos, clientes o acciones…"
                value={search}
                onValueChange={setSearch}
                className="h-7 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/45"
              />
              <kbd className="hidden rounded-xl border border-white/25 bg-white/50 px-2 py-1 text-[11px] font-semibold text-foreground/55 sm:inline-flex">
                ESC
              </kbd>
            </div>

            <Command.List className="overflow-y-auto p-3">
              <Command.Empty className="px-3 py-10 text-center text-sm text-foreground/55">
                No encontramos resultados.
              </Command.Empty>

              {remoteLoading && (
                <div className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-foreground/45">
                  Buscando…
                </div>
              )}

              {!remoteLoading && (remoteCases.length > 0 || remoteClients.length > 0) && (
                <Command.Group
                  heading="Resultados"
                  className={cn(
                    'mb-3',
                    '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.22em] [&_[cmdk-group-heading]]:text-foreground/45',
                  )}
                >
                  {remoteCases.map((c) => (
                    <Command.Item
                      key={c.id}
                      value={[c.caratulado, c.numero_causa ?? '', c.materia ?? '', c.id].join(' ')}
                      onSelect={() => {
                        router.push(`/cases/${c.id}`);
                        onOpenChange(false);
                      }}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm text-foreground outline-none transition data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.caratulado}</span>
                        <span className="block truncate text-xs text-foreground/55">
                          {c.numero_causa ? `Causa ${c.numero_causa}` : 'Caso'}{c.materia ? ` · ${c.materia}` : ''}
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-foreground/40">Caso</span>
                    </Command.Item>
                  ))}

                  {(role === 'admin_firma' || role === 'analista') &&
                    remoteClients.map((c) => (
                      <Command.Item
                        key={c.id}
                        value={[c.nombre, c.email, c.rut ?? '', c.id].join(' ')}
                        onSelect={() => {
                          router.push(`/clients?clientId=${encodeURIComponent(c.id)}&q=${encodeURIComponent(search.trim())}`);
                          onOpenChange(false);
                        }}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm text-foreground outline-none transition data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/20 bg-white/60 text-foreground/70">
                            <Users className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{c.nombre}</span>
                            <span className="block truncate text-xs text-foreground/55">
                              {c.email}
                              {c.rut ? ` · ${c.rut}` : ''}
                            </span>
                          </span>
                        </span>
                        <span className="text-xs font-semibold text-foreground/40">Cliente</span>
                      </Command.Item>
                    ))}
                </Command.Group>
              )}

              {grouped.map(([group, groupItems]) => (
                <Command.Group
                  key={group}
                  heading={group}
                  className={cn(
                    'mb-3 last:mb-0',
                    '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.22em] [&_[cmdk-group-heading]]:text-foreground/45',
                  )}
                >
                  {groupItems.map((item) => {
                    if (item.kind === 'action') {
                      return (
                        <Command.Item
                          key={item.id}
                          onSelect={() => {
                            item.onSelect();
                            onOpenChange(false);
                          }}
                          className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-sm text-foreground outline-none transition data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/20 bg-white/60 text-foreground/70">
                            {item.icon ?? <FilePlus2 className="h-4 w-4" />}
                          </span>
                          <span className="font-medium">{item.label}</span>
                        </Command.Item>
                      );
                    }

                    return (
                      <Command.Item
                        key={item.href}
                        value={[item.label, ...(item.keywords ?? []), item.href].join(' ')}
                        onSelect={() => {
                          router.push(item.href);
                          onOpenChange(false);
                        }}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm text-foreground outline-none transition data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{item.label}</span>
                          <span className="block truncate text-xs text-foreground/55">{item.href}</span>
                        </span>
                        <span className="text-xs font-semibold text-foreground/40">↵</span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </div>
      </div>
    </div>
  );
}
