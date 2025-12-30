import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminGlobalTransfersPage() {
  const supabase = (await createServerClient()) as any;

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) redirect('/login');

  const { data: isSuper } = await supabase.rpc('is_super_admin');
  if (!isSuper) redirect('/dashboard');

  const { data: logs, error } = await supabase
    .from('org_transfer_log')
    .select(
      `
        id,
        created_at,
        moved_by,
        moved_user_id,
        from_organization_id,
        to_organization_id,
        mode,
        moved_cases_count,
        moved_clients_count,
        skipped_cases_count,
        conflict_case_ids,
        conflict_client_ids,
        details,
        from_org:organizations!org_transfer_log_from_organization_id_fkey(id, name),
        to_org:organizations!org_transfer_log_to_organization_id_fkey(id, name)
      `,
    )
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Transferencias</h1>
            <p className="mt-1 text-sm text-muted-foreground">Últimos traslados ejecutados por el RPC.</p>
          </div>
          <Link href="/admin-global/organizations" className="text-sm text-primary hover:text-primary/80">
            Volver a empresas
          </Link>
        </div>
      </div>

      <section className="rounded-xl border bg-white p-5">
        {error ? (
          <p className="text-sm text-red-600">Error: {error.message}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Destino</th>
                  <th className="py-2 pr-4">Origen</th>
                  <th className="py-2 pr-4">Modo</th>
                  <th className="py-2 pr-4">Casos</th>
                  <th className="py-2 pr-4">Clientes</th>
                  <th className="py-2 pr-4">Conflictos</th>
                </tr>
              </thead>
              <tbody>
                {(logs ?? []).map((row: any) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : '-'}
                    </td>
                    <td className="py-2 pr-4">
                      <Link
                        href={`/admin-global/organizations/${row.to_organization_id}`}
                        className="text-primary hover:text-primary/80"
                      >
                        {row.to_org?.name ?? row.to_organization_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{row.from_org?.name ?? row.from_organization_id ?? '-'}</td>
                    <td className="py-2 pr-4">{row.mode}</td>
                    <td className="py-2 pr-4">
                      {row.moved_cases_count}
                      {row.skipped_cases_count ? ` (+${row.skipped_cases_count} omitidos)` : ''}
                    </td>
                    <td className="py-2 pr-4">{row.moved_clients_count}</td>
                    <td className="py-2 pr-4">
                      {(row.conflict_case_ids?.length ?? 0) + (row.conflict_client_ids?.length ?? 0)}
                    </td>
                  </tr>
                ))}
                {(logs ?? []).length === 0 ? (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={7}>
                      Sin transferencias registradas.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
