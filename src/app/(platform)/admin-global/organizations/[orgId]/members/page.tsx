import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminGlobalOrganizationMembersPage(props: { params: Promise<{ orgId: string }> }) {
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

  if (!org) redirect('/admin-global');

  const { data: members } = await supabase
    .from('org_members')
    .select('user_id, role, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });

  const userIds = Array.from(new Set((members ?? []).map((m: any) => m.user_id).filter(Boolean)));
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('user_id, email, nombre, role').in('user_id', userIds)
    : { data: [] as any[] };

  const profileByUserId = new Map<string, any>((profiles ?? []).map((p: any) => [p.user_id, p]));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Miembros</h1>
            <p className="mt-1 text-sm text-muted-foreground">{org.name}</p>
          </div>
          <Link
            href={`/admin-global/organizations/${orgId}`}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            Volver
          </Link>
        </div>
      </div>

      <section className="rounded-xl border bg-white p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Rol empresa</th>
                <th className="py-2 pr-4">Rol perfil</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m: any) => {
                const p = profileByUserId.get(m.user_id);
                return (
                  <tr key={m.user_id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">{p?.nombre ?? '-'}</td>
                    <td className="py-2 pr-4">{p?.email ?? '-'}</td>
                    <td className="py-2 pr-4">{m.role}</td>
                    <td className="py-2 pr-4">{p?.role ?? '-'}</td>
                  </tr>
                );
              })}
              {(members ?? []).length === 0 ? (
                <tr>
                  <td className="py-3 text-muted-foreground" colSpan={4}>
                    Sin miembros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

