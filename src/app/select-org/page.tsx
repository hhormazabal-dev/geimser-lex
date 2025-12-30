import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { SelectOrgClient } from './SelectOrgClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SelectOrgPage() {
  const supabase = (await createServerClient()) as any;

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) redirect('/login');

  const { data: isSuper } = await supabase.rpc('is_super_admin');

  const { data: meProfile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  const activeOrgId = (meProfile?.active_organization_id as string | null) ?? null;

  let organizations: any[] = [];

  if (isSuper) {
    const { data } = await supabase
      .from('organizations')
      .select('id, name, status, is_default')
      .order('created_at', { ascending: false });
    organizations = data ?? [];
  } else {
    const { data: memberships } = await supabase
      .from('org_members')
      .select('organization_id')
      .eq('user_id', authData.user.id);

    const orgIds = Array.from(new Set((memberships ?? []).map((m: any) => m.organization_id).filter(Boolean)));
    if (orgIds.length) {
      const { data } = await supabase
        .from('organizations')
        .select('id, name, status, is_default')
        .in('id', orgIds)
        .order('created_at', { ascending: false });
      organizations = data ?? [];
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-xl px-4 py-10">
        <SelectOrgClient organizations={organizations as any} activeOrgId={activeOrgId} />
      </div>
    </div>
  );
}

