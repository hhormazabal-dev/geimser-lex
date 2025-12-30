'use server';

import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';

export default async function DashboardIndexPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const supabase = (await createServerClient()) as any;
  const { data: isSuper } = await supabase.rpc('is_super_admin');
  if (isSuper) redirect('/admin-global');

  const role = profile.role;

  const target =
    role === 'admin_firma' ? '/dashboard/admin' :
    role === 'abogado'     ? '/dashboard/abogado' :
    role === 'analista'    ? '/dashboard/analista' :
                             '/dashboard/cliente';

  redirect(target);
}
