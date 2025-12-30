import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { AdminGlobalClient } from './AdminGlobalClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminGlobalPage() {
  const supabase = (await createServerClient()) as any;

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) redirect('/login');

  const { data: isSuper } = await supabase.rpc('is_super_admin');
  if (!isSuper) redirect('/dashboard');

  const { data: organizations } = await supabase
    .from('organizations')
    .select('id, name, status, is_default, created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5">
        <h1 className="text-xl font-semibold">Admin Global</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestión de empresas y transferencias de abogados (SUPER ADMIN).
        </p>
      </div>
      <AdminGlobalClient organizations={(organizations ?? []) as any} />
    </div>
  );
}
