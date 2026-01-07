import { redirect } from 'next/navigation';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type MemberRow = {
  user_id: string;
  org_role: 'org_admin' | 'lawyer' | 'staff';
  email: string | null;
  nombre: string | null;
  profile_role: string | null;
  activo: boolean | null;
};

import { OrgUsersClient } from './usersClient';

export default async function EmpresaUsuariosPage() {
  const supabase = (await createServerClient()) as any;

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) redirect('/login');

  const { data: meProfile, error: meErr } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (meErr) redirect('/dashboard');

  const orgId = (meProfile?.active_organization_id as string | null) ?? null;
  if (!orgId) redirect('/select-org');

  const { data: isSuper } = await supabase.rpc('is_super_admin');

  if (!isSuper) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (!membership || membership.role !== 'org_admin') redirect('/dashboard');
  }

  const svc = createServiceClient() as any;

  const { data: org } = await svc
    .from('organizations')
    .select('id, name, status')
    .eq('id', orgId)
    .maybeSingle();

  const { data: members } = await svc
    .from('org_members')
    .select('user_id, role')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });

  const userIds = Array.from(new Set((members ?? []).map((m: any) => m.user_id).filter(Boolean)));
  const { data: profiles } = userIds.length
    ? await svc
        .from('profiles')
        .select('user_id, email, nombre, role, activo')
        .in('user_id', userIds)
    : { data: [] as any[] };

  const profileByUserId = new Map<string, any>((profiles ?? []).map((p: any) => [p.user_id, p]));

  const rows: MemberRow[] = (members ?? []).map((m: any) => {
    const p = profileByUserId.get(m.user_id);
    return {
      user_id: m.user_id,
      org_role: m.role,
      email: p?.email ?? null,
      nombre: p?.nombre ?? null,
      profile_role: p?.role ?? null,
      activo: p?.activo ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5">
        <h1 className="text-xl font-semibold">Usuarios (empresa)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {org?.name ?? 'Empresa'} {org?.status === 'inactive' ? '(inactiva)' : ''} · Administra tu equipo sin ver usuarios globales.
        </p>
      </div>

      <OrgUsersClient members={rows} />
    </div>
  );
}

