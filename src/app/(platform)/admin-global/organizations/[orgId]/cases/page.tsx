import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminGlobalOrganizationCasesPage(props: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await props.params;
  const supabase = (await createServerClient()) as any;

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) redirect('/login');

  const { data: isSuper } = await supabase.rpc('is_super_admin');
  if (!isSuper) redirect('/dashboard');

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, status')
    .eq('id', orgId)
    .maybeSingle();

  if (!org) redirect('/admin-global/organizations');

  const { data: cases, error } = await supabase
    .from('cases')
    .select(
      `
        id,
        numero_causa,
        caratulado,
        estado,
        created_at,
        abogado_responsable,
        abogado:profiles!cases_abogado_responsable_fkey(id, nombre, email)
      `,
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Casos</h1>
            <p className="mt-1 text-sm text-muted-foreground">{org.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin-global/organizations/${orgId}`}
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              Volver
            </Link>
            <Link href="/cases" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              Ir a casos (app)
            </Link>
          </div>
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
                  <th className="py-2 pr-4">N°</th>
                  <th className="py-2 pr-4">Caratulado</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4">Abogado</th>
                  <th className="py-2 pr-4">Acción</th>
                </tr>
              </thead>
              <tbody>
                {(cases ?? []).map((c: any) => (
                  <tr key={c.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">{c.numero_causa ?? '-'}</td>
                    <td className="py-2 pr-4">{c.caratulado}</td>
                    <td className="py-2 pr-4">{c.estado ?? '-'}</td>
                    <td className="py-2 pr-4">{c.abogado?.nombre ?? '-'}</td>
                    <td className="py-2 pr-4">
                      <Link href={`/cases/${c.id}`} className="text-primary hover:text-primary/80">
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
                {(cases ?? []).length === 0 ? (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={5}>
                      No hay casos en esta empresa.
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
