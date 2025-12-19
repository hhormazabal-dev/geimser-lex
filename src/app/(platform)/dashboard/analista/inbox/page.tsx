export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';

export default async function AnalystInboxPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login?redirectTo=/inbox');
  if (profile.role !== 'analista') redirect('/dashboard');
  redirect('/inbox');
}
