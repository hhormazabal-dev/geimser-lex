import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { requireTransitionAccess } from '@/lib/auth/transition';
import { TransitionClient } from './TransitionClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TransitionPage() {
  try {
    await requireTransitionAccess();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sin permisos';
    if (message === 'No autenticado') {
      redirect('/login');
    }
    redirect('/dashboard');
  }

  const supabase = createServiceClient() as any;

  const [{ data: organizations }, { data: orgMembers }, { data: cases }] = await Promise.all([
    supabase.from('organizations').select('id, name, status').order('name', { ascending: true }),
    supabase
      .from('org_members')
      .select('organization_id, user_id, role')
      .in('role', ['lawyer', 'org_admin']),
    supabase
      .from('cases')
      .select(
        `
        id,
        numero_causa,
        caratulado,
        nombre_cliente,
        estado,
        created_at,
        organization_id,
        abogado_responsable,
        cliente_principal_id,
        org:organizations(id, name),
        abogado:profiles!cases_abogado_responsable_fkey(id, nombre, email, active_organization_id)
      `,
      )
      .order('created_at', { ascending: false })
      .limit(5000),
  ]);

  const memberUserIds = Array.from(
    new Set((orgMembers ?? []).map((row: any) => row?.user_id).filter(Boolean)),
  ) as string[];

  const { data: memberProfiles } = memberUserIds.length
    ? await supabase
        .from('profiles')
        .select('id, user_id, nombre, email, role, activo')
        .in('user_id', memberUserIds)
    : { data: [] };

  const profileByUserId = new Map<string, any>(
    (memberProfiles ?? []).map((profile: any) => [String(profile.user_id), profile]),
  );

  const lawyers = (orgMembers ?? [])
    .map((membership: any) => {
      const profile = profileByUserId.get(String(membership.user_id));
      if (!profile) return null;
      if (!['abogado', 'admin_firma'].includes(String(profile.role))) return null;
      return {
        id: String(profile.id),
        nombre: profile.nombre ?? null,
        email: profile.email ?? null,
        activo: profile.activo ?? null,
        organization_id: String(membership.organization_id),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es'));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Transicion</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reasigna casos entre empresas con visibilidad completa de equipos y expedientes.
            </p>
          </div>
          <Link href="/dashboard" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
            Volver al dashboard
          </Link>
        </div>
      </div>

      <TransitionClient
        organizations={(organizations ?? []) as any}
        lawyers={(lawyers ?? []) as any}
        cases={(cases ?? []) as any}
      />
    </div>
  );
}
