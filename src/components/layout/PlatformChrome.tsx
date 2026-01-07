'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppSidebar, type SidebarItem } from '@/components/layout/AppSidebar';
import { AppTopbar } from '@/components/layout/AppTopbar';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { SupportFab } from '@/components/layout/SupportFab';

type OrgOption = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
};

function resolveTitle(pathname: string, items: SidebarItem[]): string {
  const candidates = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length);
  return candidates[0]?.label ?? 'Plataforma';
}

export function PlatformChrome({
  children,
  items,
  profile,
  footer,
  organizations,
  activeOrgId,
}: {
  children: ReactNode;
  items: SidebarItem[];
  profile: { nombre: string; role: string; email: string | null };
  footer?: ReactNode;
  organizations: OrgOption[];
  activeOrgId: string | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem('xel.sidebarCollapsed');
    if (raw === 'true') setCollapsed(true);
  }, []);

  const title = useMemo(() => resolveTitle(pathname, items), [pathname, items]);

  const canCreateCase = profile.role !== 'cliente';

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem('xel.sidebarCollapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      <AppSidebar
        items={items}
        profile={profile}
        organizations={organizations}
        activeOrgId={activeOrgId}
        footer={footer}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />

      <div className="min-w-0 flex-1">
        <AppTopbar
          title={title}
          profile={{ nombre: profile.nombre, role: profile.role }}
          onOpenSidebar={() => setMobileOpen(true)}
          onOpenCommandPalette={() => setPaletteOpen(true)}
          canCreateCase={canCreateCase}
          organizations={organizations}
          activeOrgId={activeOrgId}
        />

        <main className="pb-12 pt-6">
          <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
            <div key={activeOrgId ?? 'no-org'}>{children}</div>
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={items}
        canCreateCase={canCreateCase}
        role={profile.role}
      />

      <SupportFab />
    </div>
  );
}
