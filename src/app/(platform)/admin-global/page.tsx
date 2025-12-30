import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminGlobalPage() {
  const supabase = (await createServerClient()) as any;

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) redirect('/login');

  const { data: isSuper } = await supabase.rpc('is_super_admin');
  if (!isSuper) redirect('/dashboard');

  const [
    { count: orgsTotal },
    { count: orgsActive },
    { count: activeLawyers },
    { count: activeClients },
    { data: orgBillingRows },
    { data: recentOrgs },
  ] = await Promise.all([
    supabase.from('organizations').select('id', { head: true, count: 'exact' }),
    supabase.from('organizations').select('id', { head: true, count: 'exact' }).eq('status', 'active'),
    supabase.from('profiles').select('id', { head: true, count: 'exact' }).eq('role', 'abogado').eq('activo', true),
    supabase.from('profiles').select('id', { head: true, count: 'exact' }).eq('role', 'cliente').eq('activo', true),
    supabase
      .from('organizations')
      .select('id, status, billing_user_seats, billing_price_per_user, billing_monthly_base_fee, billing_currency')
      .limit(5000),
    supabase
      .from('organizations')
      .select('id, name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const activeOrgCount = orgsActive ?? 0;
  const billing = (orgBillingRows ?? []) as Array<{
    status: 'active' | 'inactive';
    billing_user_seats: number;
    billing_price_per_user: number;
    billing_monthly_base_fee: number;
    billing_currency: string;
  }>;

  const currency = billing.find((r) => r.billing_currency)?.billing_currency ?? 'UF';

  const mrr = billing
    .filter((r) => r.status === 'active')
    .reduce((sum, r) => {
      const seats = Number(r.billing_user_seats ?? 0);
      const ppu = Number(r.billing_price_per_user ?? 0);
      const base = Number(r.billing_monthly_base_fee ?? 0);
      return sum + base + seats * ppu;
    }, 0);

  const seats = billing
    .filter((r) => r.status === 'active')
    .reduce((sum, r) => sum + Number(r.billing_user_seats ?? 0), 0);

  const arpa = activeOrgCount > 0 ? mrr / activeOrgCount : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Admin Global</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Vista de negocio (SaaS): empresas, MRR, clientes y operaciones de onboarding.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin-global/organizations"
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white"
            >
              Administrar empresas
            </Link>
            <Link
              href="/admin-global/transfers"
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              Ver transferencias
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Empresas" value={orgsTotal ?? 0} subtitle="Total" />
        <KpiCard title="Empresas activas" value={orgsActive ?? 0} subtitle="Pagando / activas" />
        <KpiCard title={`MRR (${currency})`} value={formatMoney(mrr)} subtitle="Mensualidad estimada" />
        <KpiCard title={`ARPA (${currency})`} value={formatMoney(arpa)} subtitle="MRR / empresas activas" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold">Empresas recientes</h2>
            <Link href="/admin-global/organizations" className="text-sm text-primary hover:text-primary/80">
              Ver todas
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4">Empresa</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4">Creada</th>
                </tr>
              </thead>
              <tbody>
                {(recentOrgs ?? []).map((o: any) => (
                  <tr key={o.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/admin-global/organizations/${o.id}`}
                        className="text-primary hover:text-primary/80"
                      >
                        {o.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{o.status}</td>
                    <td className="py-2 pr-4">
                      {o.created_at ? new Date(o.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
                {(recentOrgs ?? []).length === 0 ? (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={3}>
                      No hay empresas.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h2 className="text-base font-semibold">Clientes & equipo</h2>
          <div className="mt-4 space-y-3">
            <MetricRow label="Clientes activos" value={activeClients ?? 0} />
            <MetricRow label="Abogados activos" value={activeLawyers ?? 0} />
            <MetricRow label="Seats activos" value={seats} />
          </div>
          <div className="mt-4 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            Tip: la mensualidad se estima como <span className="font-medium">base + seats × precio</span>.
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard(props: { title: string; value: string | number; subtitle: string }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{props.title}</p>
      <p className="mt-2 text-2xl font-semibold">{props.value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{props.subtitle}</p>
    </div>
  );
}

function MetricRow(props: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2">
      <span className="text-sm text-muted-foreground">{props.label}</span>
      <span className="text-sm font-semibold">{props.value}</span>
    </div>
  );
}

function formatMoney(value: number) {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(value);
}
