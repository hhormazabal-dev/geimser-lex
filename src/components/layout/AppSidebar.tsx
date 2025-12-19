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
  footer?: ReactNode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

function groupItems(items: SidebarItem[]) {
  const groups = new Map<string, SidebarItem[]>();
  for (const item of items) {
    const key = item.group ?? 'General';
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }
  return Array.from(groups.entries());
}

export function AppSidebar({
  items,
  profile,
  footer,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileOpenChange,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');

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
    return groupItems(filtered);
  }, [items, query]);

  const initials = getInitials(profile.nombre);
  const avatarBg = stringToColor(profile.nombre);

  const renderLink = (item: SidebarItem) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => onMobileOpenChange(false)}
        title={collapsed ? item.label : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group relative flex items-start gap-3 rounded-2xl border border-white/10 bg-white/20 px-3 py-2.5 transition-all hover:border-primary/30 hover:bg-primary/10',
          isActive && 'border-primary/40 bg-primary/15 shadow-sm',
          collapsed && 'justify-center px-2',
        )}
      >
        <span
          className={cn(
            'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/50 text-foreground/70 transition-colors group-hover:text-foreground',
            isActive && 'bg-primary/10 text-primary',
          )}
        >
          {item.icon}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1 text-sm leading-snug">
            <span className="flex items-center gap-2">
              <span className={cn('truncate font-medium', isActive && 'text-primary')}>
                {item.label}
              </span>
              {item.badge && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {item.badge}
                </span>
              )}
            </span>
            {item.description && (
              <span className="mt-0.5 block truncate text-xs text-foreground/60">
                {item.description}
              </span>
            )}
          </span>
        )}
      </Link>
    );
  };

  const SidebarContent = (
    <div className={cn('flex h-full min-h-screen flex-col', collapsed ? 'px-3' : 'px-5')}>
      <div className={cn('flex items-center justify-between', collapsed ? 'py-4' : 'py-5')}>
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 via-white/50 to-white/20 text-primary shadow-sm">
            <span className="text-sm font-semibold tracking-tight">X</span>
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-foreground">Xel Chile</p>
              <p className="text-xs text-foreground/55">Legal CRM</p>
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
        <div className="pb-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en navegación…"
              className="h-11 w-full rounded-2xl border border-white/20 bg-white/50 pl-10 pr-3 text-sm text-foreground shadow-inner outline-none transition focus:border-primary/40 focus:bg-white/80 focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto pb-4">
        <div className={cn('space-y-6', collapsed && 'space-y-4')}>
          {filteredGroups.map(([group, groupItems]) => (
            <section key={group} className="space-y-2">
              {!collapsed && (
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/45">
                  {group}
                </p>
              )}
              <div className="space-y-2">{groupItems.map(renderLink)}</div>
            </section>
          ))}
        </div>
      </nav>

      <div className="pb-5">
        <div
          className={cn(
            'rounded-2xl border border-white/20 bg-white/40 shadow-sm',
            collapsed ? 'p-2' : 'px-4 py-3',
          )}
        >
          <div className={cn('flex items-start gap-3', collapsed && 'justify-center')}>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-white"
              style={{ backgroundColor: avatarBg }}
              aria-hidden
            >
              {initials || 'U'}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{profile.nombre}</p>
                <p className="text-xs uppercase tracking-wide text-foreground/50">
                  {formatRoleLabel(profile.role)}
                </p>
                {profile.email && <p className="mt-1 truncate text-xs text-foreground/50">{profile.email}</p>}
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
