import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { AdminGlobalClient } from '../AdminGlobalClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface AdminGlobalOrganizationsPageProps {
  searchParams?: Promise<Record<string, string>>;
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return Math.max(min, Math.min(max, i));
}

export default async function AdminGlobalOrganizationsPage({ searchParams }: AdminGlobalOrganizationsPageProps) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? '').trim();
  const status = (sp.status ?? 'all').trim() as 'all' | 'active' | 'inactive';
  const page = clampInt(sp.page ?? '1', 1, 1, 10_000);
  const pageSize = clampInt(sp.limit ?? '50', 50, 10, 200);

  const supabase = (await createServerClient()) as any;

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) redirect('/login');

  const { data: isSuper } = await supabase.rpc('is_super_admin');
  if (!isSuper) redirect('/dashboard');

  let baseQuery = supabase
    .from('organizations')
    .select(
      'id, name, status, is_default, created_at, billing_currency, billing_price_per_user, billing_user_seats, billing_monthly_base_fee, billing_setup_fee',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  if (status === 'active' || status === 'inactive') {
    baseQuery = baseQuery.eq('status', status);
  }
  if (q) {
    baseQuery = baseQuery.ilike('name', `%${q}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: organizations, count: totalCount } = await baseQuery.range(from, to);

  const { data: orgOptions } = await supabase
    .from('organizations')
    .select('id, name, status, is_default')
    .order('name', { ascending: true })
    .limit(5000);

  const { data: internalUsers } = await supabase
    .from('profiles')
    .select('id, user_id, nombre, email, role')
    .in('role', ['admin_firma', 'abogado', 'analista'])
    .eq('activo', true)
    .order('nombre', { ascending: true });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Empresas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Administración de empresas (onboarding + setup + pricing). Para métricas globales vuelve al dashboard.
            </p>
          </div>
          <Link href="/admin-global" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
            Volver al dashboard
          </Link>
        </div>
      </div>

      <AdminGlobalClient
        organizations={(organizations ?? []) as any}
        organizationOptions={(orgOptions ?? []) as any}
        internalUsers={(internalUsers ?? []) as any}
        pagination={{
          q,
          status,
          page,
          pageSize,
          totalCount: totalCount ?? 0,
        }}
      />
    </div>
  );
}
