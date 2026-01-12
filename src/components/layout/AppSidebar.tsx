'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import LogoutButton from '@/components/LogoutButton';
import { getInitials, stringToColor } from '@/lib/utils';
import { formatRoleLabel } from '@/lib/navigation/role-label';
import {
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Star,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

export interface SidebarItem {
  href: string;
  label: string;
  description?: string;
  icon: ReactNode;
  badge?: string;
  group?: string;
  keywords?: string[];
}

interface AppSidebarProps {
  items: SidebarItem[];
  profile: {
    nombre: string;
    role: string;
    email: string | null;
  };
  organizations: Array<{ id: string; name: string; status: 'active' | 'inactive' }>;
  activeOrgId: string | null;
  footer?: ReactNode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

function normalizeSectionName(group?: string | null) {
  const g = String(group ?? '').trim();
  if (!g) return 'General';
  if (g === 'Principal') return 'Hoy';
  if (['Operación', 'CRM', 'Finanzas', 'Comunicación', 'Herramientas'].includes(g)) return 'Trabajo';
  return g;
}

function groupItems(items: SidebarItem[]) {
  const groups = new Map<string, SidebarItem[]>();
  for (const item of items) {
    const key = normalizeSectionName(item.group);
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }
  const order = ['Favoritos', 'Hoy', 'Trabajo', 'Administración', 'Super Admin', 'General'];
  return Array.from(groups.entries()).sort((a, b) => {
    const ia = order.indexOf(a[0]);
    const ib = order.indexOf(b[0]);
    if (ia === -1 && ib === -1) return a[0].localeCompare(b[0], 'es');
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function AppSidebar({
  items,
  profile,
  organizations,
  activeOrgId,
  footer,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileOpenChange,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem('xel.sidebarPinned');
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  });

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = items;
    const filtered = !q
      ? base
      : base.filter((item) => {
          const haystack = [
            item.label,
            item.description ?? '',
            (item.keywords ?? []).join(' '),
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(q);
        });
    const pinnedSet = new Set(pinned);
    const pinnedItems = q ? [] : filtered.filter((i) => pinnedSet.has(i.href));
    const rest = q ? filtered : filtered.filter((i) => !pinnedSet.has(i.href));
    const grouped = groupItems(rest);
    return pinnedItems.length ? [['Favoritos', pinnedItems] as const, ...grouped] : grouped;
  }, [items, query, pinned]);

  const pinnedSet = useMemo(() => new Set(pinned), [pinned]);
  const savePinned = (next: string[]) => {
    setPinned(next);
    try {
      window.localStorage.setItem('xel.sidebarPinned', JSON.stringify(next));
    } catch {
      // ignore
    }
  };
  const togglePin = (href: string) => {
    const next = pinnedSet.has(href) ? pinned.filter((h) => h !== href) : [href, ...pinned].slice(0, 6);
    savePinned(next);
  };

  const initials = getInitials(profile.nombre);
  const avatarBg = stringToColor(profile.nombre);
  const activeOrg = useMemo(
    () => (activeOrgId ? organizations.find((o) => o.id === activeOrgId) ?? null : null),
    [organizations, activeOrgId]
  );

  const renderLink = (item: SidebarItem) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const isPinned = pinnedSet.has(item.href);
    return (
      <div key={item.href} className={cn('group flex items-stretch gap-2', collapsed && 'justify-center')}>
        <Link
          href={item.href}
          onClick={() => onMobileOpenChange(false)}
          title={collapsed ? item.label : undefined}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'relative flex flex-1 items-center gap-2.5 rounded-xl border border-white/10 bg-white/20 px-2.5 py-2 transition-all hover:border-primary/30 hover:bg-primary/10',
            isActive && 'border-primary/40 bg-primary/15 shadow-sm',
            collapsed && 'flex-none justify-center px-2',
          )}
        >
          <span
            className={cn(
              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/50 text-foreground/70 transition-colors group-hover:text-foreground',
              isActive && 'bg-primary/10 text-primary',
            )}
          >
            {item.icon}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 text-[12px] leading-tight">
              <span className="flex items-center gap-2">
                <span className={cn('truncate font-medium', isActive && 'text-primary')}>{item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                    {item.badge}
                  </span>
                )}
              </span>
            </span>
          )}
        </Link>

        {!collapsed ? (
          <button
            type="button"
            onClick={() => togglePin(item.href)}
            className={cn(
              'hidden w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/20 text-foreground/55 transition hover:bg-white/50 hover:text-foreground group-hover:inline-flex',
              isPinned && 'inline-flex text-primary'
            )}
            aria-label={isPinned ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            title={isPinned ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          >
            <Star className={cn('h-4 w-4', isPinned && 'fill-primary')} />
          </button>
        ) : null}
      </div>
    );
  };

  const SidebarContent = (
      <div className={cn('flex h-full min-h-screen flex-col overflow-x-hidden', collapsed ? 'px-3' : 'px-4')}>
      <div className={cn('flex items-center justify-between', collapsed ? 'py-3' : 'py-4')}>
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 via-white/50 to-white/20 text-primary shadow-sm">
            <span className="text-[12px] font-semibold tracking-tight">X</span>
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-[13px] font-semibold tracking-tight text-foreground">Xel Chile</p>
              <p className="text-[11px] text-foreground/55">Legal CRM</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            'hidden h-10 w-10 items-center justify-center rounded-2xl border border-white/25 bg-white/50 text-foreground/70 shadow-sm transition hover:bg-white/70 hover:text-foreground lg:inline-flex',
            collapsed && 'rotate-0',
          )}
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="pb-3">
          <div className="mb-3 rounded-xl border border-white/20 bg-white/45 px-3 py-2 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/45">Contexto</p>
            <div className="mt-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-foreground">
                  {activeOrg?.name ?? 'Sin empresa activa'}
                </p>
                <p className="text-[11px] text-foreground/55">
                  {formatRoleLabel(profile.role)}
                  {activeOrg?.status === 'inactive' ? ' · inactiva' : ''}
                </p>
              </div>
              <Link
                href="/select-org"
                className="rounded-lg border border-white/20 bg-white/60 px-2.5 py-1.5 text-[11px] font-semibold text-foreground/70 shadow-sm transition hover:bg-white hover:text-foreground"
              >
                Cambiar
              </Link>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/45" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="h-9 w-full rounded-xl border border-white/20 bg-white/50 pl-9 pr-3 text-[13px] text-foreground shadow-inner outline-none transition focus:border-primary/40 focus:bg-white/80 focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto pb-4">
        <div className={cn('space-y-5', collapsed && 'space-y-4')}>
          {filteredGroups.map(([group, groupItems]) => (
            <section key={group} className="space-y-2">
              {!collapsed && (
                <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/45">{group}</p>
              )}
              <div className="space-y-2">{groupItems.map(renderLink)}</div>
            </section>
          ))}
        </div>
      </nav>

      <div className="pb-5">
        <div
          className={cn(
            'rounded-xl border border-white/20 bg-white/40 shadow-sm',
            collapsed ? 'p-2' : 'px-3 py-2',
          )}
        >
          <div className={cn('flex items-start gap-3', collapsed && 'justify-center')}>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-semibold text-white"
              style={{ backgroundColor: avatarBg }}
              aria-hidden
            >
              {initials || 'U'}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">{profile.nombre}</p>
                <p className="text-[11px] uppercase tracking-wide text-foreground/50">
                  {formatRoleLabel(profile.role)}
                </p>
                {profile.email && <p className="mt-1 truncate text-[11px] text-foreground/50">{profile.email}</p>}
              </div>
            )}
          </div>

          {!collapsed && (
            <div className="mt-3">
              <LogoutButton />
            </div>
          )}
        </div>

        {collapsed && (
          <div className="mt-2 flex items-center justify-center">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/25 bg-white/40 text-foreground/70 shadow-sm transition hover:bg-white/70 hover:text-foreground"
              aria-label="Expandir sidebar"
              title="Expandir sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {footer && !collapsed && (
          <div className="mt-4 rounded-2xl border border-dashed border-white/30 bg-white/20 px-4 py-4 text-xs text-foreground/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          'hidden h-full min-h-screen shrink-0 flex-col border-r border-white/15 bg-white/55 shadow-xl backdrop-blur-2xl lg:flex',
          collapsed ? 'w-[92px]' : 'w-[280px]',
        )}
      >
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            'absolute inset-0 bg-slate-950/20 backdrop-blur-[2px] transition-opacity duration-200',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => onMobileOpenChange(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          className={cn(
            'absolute left-0 top-0 h-full w-[320px] border-r border-white/15 bg-white/80 shadow-2xl backdrop-blur-2xl transition-transform duration-200',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="absolute right-4 top-4">
            <button
              type="button"
              onClick={() => onMobileOpenChange(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/25 bg-white/60 text-foreground/70 shadow-sm transition hover:bg-white hover:text-foreground"
              aria-label="Cerrar menú"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {SidebarContent}
        </aside>
      </div>
    </>
  );
}
