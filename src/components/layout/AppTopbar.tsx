'use client';

import { Button } from '@/components/ui/button';
import { cn, getInitials, stringToColor } from '@/lib/utils';
import { formatRoleLabel } from '@/lib/navigation/role-label';
import { Menu, Search, Plus } from 'lucide-react';
import Link from 'next/link';
import { IndicatorsPill } from '@/components/layout/IndicatorsPill';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

type OrgOption = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
};

export function AppTopbar({
  title,
  profile,
  onOpenSidebar,
  onOpenCommandPalette,
  canCreateCase,
  organizations,
  activeOrgId,
}: {
  title: string;
  profile: { nombre: string; role: string };
  onOpenSidebar: () => void;
  onOpenCommandPalette: () => void;
  canCreateCase: boolean;
  organizations: OrgOption[];
  activeOrgId: string | null;
}) {
  const initials = getInitials(profile.nombre);
  const avatarBg = stringToColor(profile.nombre);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedOrgId, setSelectedOrgId] = useState(activeOrgId ?? '');

  const orgs = useMemo(() => organizations ?? [], [organizations]);
  const showOrgSwitcher = orgs.length > 1;

  async function setActiveOrg(nextOrgId: string) {
    const res = await fetch('/api/set-active-org', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: nextOrgId }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? 'Error cambiando empresa');
  }

  return (
    <div className="sticky top-0 z-50 border-b border-white/20 bg-white/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/60">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/25 bg-white/60 text-foreground/70 shadow-sm transition hover:bg-white hover:text-foreground lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">{title}</p>
            <p className="truncate text-xs text-foreground/50">Legal CRM</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showOrgSwitcher ? (
            <div className="hidden items-center gap-2 rounded-2xl border border-white/20 bg-white/50 px-2 py-1.5 sm:flex">
              <span className="pl-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Empresa</span>
              <select
                className="h-9 max-w-[260px] rounded-xl border border-white/20 bg-white/70 px-3 text-sm text-foreground shadow-sm outline-none"
                value={selectedOrgId}
                onChange={(e) => {
                  const next = e.target.value;
                  setSelectedOrgId(next);
                  startTransition(() => {
                    void setActiveOrg(next)
                      .then(() => router.refresh())
                      .catch(() => {
                        // si falla, forzamos UI a recalcular desde server en refresh manual
                        router.refresh();
                      });
                  });
                }}
                disabled={isPending}
                aria-label="Cambiar empresa activa"
              >
                <option value="" disabled>
                  Selecciona…
                </option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id} disabled={o.status !== 'active'}>
                    {o.name} {o.status !== 'active' ? '(inactiva)' : ''}
                  </option>
                ))}
              </select>
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="h-9 rounded-xl border border-white/20 bg-white/60 px-3 text-xs text-foreground/70 hover:bg-white hover:text-foreground"
              >
                <Link href="/select-org">Ver todas</Link>
              </Button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onOpenCommandPalette}
            className={cn(
              'hidden h-10 w-[380px] items-center gap-2 rounded-2xl border border-white/25 bg-white/55 px-3 text-left text-sm text-foreground/60 shadow-inner transition hover:bg-white/70 sm:flex',
            )}
            aria-label="Buscar (Ctrl/⌘ + K)"
          >
            <Search className="h-4 w-4 text-foreground/45" />
            <span className="flex-1 truncate">Buscar casos, clientes o acciones…</span>
            <kbd className="rounded-xl border border-white/25 bg-white/70 px-2 py-1 text-[11px] font-semibold text-foreground/55">
              ⌘K
            </kbd>
          </button>

          <Button
            type="button"
            variant="ghost"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/25 bg-white/60 text-foreground/70 shadow-sm hover:bg-white hover:text-foreground sm:hidden"
            onClick={onOpenCommandPalette}
            aria-label="Buscar"
          >
            <Search className="h-4 w-4" />
          </Button>

          <IndicatorsPill />

          {canCreateCase && (
            <Button
              asChild
              size="sm"
              className="hidden rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-sm hover:bg-primary/15 sm:inline-flex"
            >
              <Link href="/cases/new" className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nuevo
              </Link>
            </Button>
          )}

          <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/50 px-2 py-1.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-semibold text-white"
              style={{ backgroundColor: avatarBg }}
              aria-hidden
            >
              {initials || 'U'}
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="max-w-[180px] truncate text-xs font-semibold text-foreground">
                {profile.nombre}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-foreground/45">
                {formatRoleLabel(profile.role)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
