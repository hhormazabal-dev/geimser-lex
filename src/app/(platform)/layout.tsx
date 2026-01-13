export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { PlatformChrome } from '@/components/layout/PlatformChrome';
import { getCurrentProfile, type Role } from '@/lib/auth/roles';
import { isTransitionEmail } from '@/lib/auth/transition';
import { buildSidebarItems } from '@/lib/navigation/platform-nav';
import { createServerClient } from '@/lib/supabase/server';

interface PlatformLayoutProps {
  children: ReactNode;
}

export default async function PlatformLayout({ children }: PlatformLayoutProps) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/login');
  }

  const role = profile.role as Role;
  const activeOrgId = (profile as any)?.active_organization_id ?? null;
  const userId = (profile as any)?.user_id ?? (profile as any)?.id ?? null;

  // Staff interno requiere empresa activa para aplicar RLS multi-tenant.
  const supabase = (await createServerClient()) as any;
  const { data: isSuperAdmin } = await supabase.rpc('is_super_admin');
  const canTransition = isTransitionEmail((profile as any)?.email ?? null);

  if (!isSuperAdmin && !canTransition && role !== 'cliente' && !activeOrgId) {
    redirect('/select-org');
  }
  // Org switcher: lista empresas disponibles para el usuario (para cambiar contexto sin salir).
  let organizations: Array<{ id: string; name: string; status: 'active' | 'inactive' }> = [];
  if (isSuperAdmin) {
    const { data } = await supabase
      .from('organizations')
      .select('id, name, status')
      .order('created_at', { ascending: false });
    organizations = (data ?? []) as any;
  } else if (userId) {
    const { data: memberships } = await supabase.from('org_members').select('organization_id').eq('user_id', userId);
    const orgIds = Array.from(new Set((memberships ?? []).map((m: any) => m.organization_id).filter(Boolean)));
    if (orgIds.length) {
      const { data } = await supabase
        .from('organizations')
        .select('id, name, status')
        .in('id', orgIds)
        .order('created_at', { ascending: false });
      organizations = (data ?? []) as any;
    }
  }

  let activeOrgName: string | null = null;
  if (activeOrgId) {
    activeOrgName = organizations.find((org) => org.id === activeOrgId)?.name ?? null;
    if (!activeOrgName) {
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', activeOrgId)
        .maybeSingle();
      activeOrgName = orgRow?.name ?? null;
    }
  }

  const sidebarItems = buildSidebarItems(role, {
    isSuperAdmin: Boolean(isSuperAdmin),
    canTransition,
    activeOrgName,
  });

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

      <PlatformChrome
        items={sidebarItems}
        profile={sidebarProfile}
        footer={footerHint}
        organizations={organizations}
        activeOrgId={activeOrgId}
      >
        {children}
      </PlatformChrome>
    </div>
  );
}
