export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { PlatformChrome } from '@/components/layout/PlatformChrome';
import { getCurrentProfile, type Role } from '@/lib/auth/roles';
import { buildSidebarItems } from '@/lib/navigation/platform-nav';

interface PlatformLayoutProps {
  children: ReactNode;
}

export default async function PlatformLayout({ children }: PlatformLayoutProps) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/login');
  }

  const role = ((profile as any)._role_override as Role | null) ?? profile.role;
  const sidebarItems = buildSidebarItems(role);

  const footerHint = (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">¿Necesitas soporte?</p>
      <p className="text-xs leading-relaxed text-foreground/70">
        Escríbenos a <span className="font-medium text-primary">soporte@altiusignite.com</span> o agenda una asesoría
        onboarding desde tu dashboard.
      </p>
    </div>
  );

  const sidebarProfile = {
    nombre: profile.nombre,
    role,
    email: (profile as any)?.email ?? null,
  };

  return (
    <div className="relative isolate min-h-screen bg-transparent">
      {/* Fondo difuminado */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.14),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.12),_transparent_50%)]" />
      <div className="absolute inset-x-0 top-0 -z-10 mx-auto h-32 w-full max-w-[1600px] rounded-full bg-white/50 blur-3xl opacity-70" />

      <PlatformChrome items={sidebarItems} profile={sidebarProfile} footer={footerHint}>
        {children}
      </PlatformChrome>
    </div>
  );
}
