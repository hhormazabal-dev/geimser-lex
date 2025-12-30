import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminGlobalOrganizationPage(props: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await props.params;
  const supabase = (await createServerClient()) as any;

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) redirect('/login');

  const { data: isSuper } = await supabase.rpc('is_super_admin');
  if (!isSuper) redirect('/dashboard');

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, status, is_default, created_at')
    .eq('id', orgId)
    .maybeSingle();

  if (!org) redirect('/admin-global');

  const [{ count: casesCount }, { count: membersCount }, { count: clientsCount }] = await Promise.all([
    supabase.from('cases').select('id', { head: true, count: 'exact' }).eq('organization_id', orgId),
    supabase.from('org_members').select('id', { head: true, count: 'exact' }).eq('organization_id', orgId),
    supabase.from('profiles').select('id', { head: true, count: 'exact' }).eq('role', 'cliente').eq('organization_id', orgId),
  ]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{org.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Estado: <span className="font-medium text-foreground">{org.status}</span>
              {org.is_default ? ' (default)' : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin-global" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              Volver
            </Link>
            <Link
              href={`/admin-global/organizations/${orgId}/cases`}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white"
            >
              Ver casos
            </Link>
            <Link
              href={`/admin-global/organizations/${orgId}/members`}
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              Ver miembros
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Casos" value={casesCount ?? 0} href={`/admin-global/organizations/${orgId}/cases`} />
        <StatCard title="Miembros" value={membersCount ?? 0} href={`/admin-global/organizations/${orgId}/members`} />
        <StatCard title="Clientes" value={clientsCount ?? 0} href={`/admin-global/organizations/${orgId}/cases`} />
      </div>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-base font-semibold">Acciones rápidas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Para mover un abogado a esta empresa usa “Asignar / mover abogado” en <Link className="text-primary hover:text-primary/80" href="/admin-global">Admin Global</Link>.
        </p>
      </section>
    </div>
  );
}

function StatCard(props: { title: string; value: number; href: string }) {
  return (
    <Link href={props.href} className="rounded-xl border bg-white p-5 transition hover:bg-muted/40">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{props.title}</p>
      <p className="mt-2 text-2xl font-semibold">{props.value}</p>
      <p className="mt-2 text-sm text-primary">Ver</p>
    </Link>
  );
}

