export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';
import { fetchManagedOrganizations, fetchManagedUsers } from '@/lib/actions/admin-users';
import { AdminUserManager } from '@/components/AdminUserManager';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Gestión de usuarios - Xel Chile',
  description: 'Administra las cuentas y permisos del equipo.',
};

export default async function AdminUsersPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/login');
  }

  const supabase = (await createServerClient()) as any;
  const { data: isSuperAdmin } = await supabase.rpc('is_super_admin');

  // Este mantenedor es GLOBAL (riesgo alto): solo super_admin.
  if (!isSuperAdmin) {
    redirect(profile.role === 'analista' ? '/dashboard/analista' : profile.role === 'admin_firma' ? '/dashboard/admin' : '/dashboard/abogado');
  }

  const usersResult = await fetchManagedUsers();
  const orgsResult = await fetchManagedOrganizations();

  if (!usersResult.success) {
    return (
      <div className='min-h-[60vh] bg-gray-50'>
        <div className='mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 px-4 py-24 text-center'>
          <h1 className='text-2xl font-semibold text-gray-900'>No se pudieron cargar los usuarios</h1>
          <p className='text-sm text-muted-foreground'>
            {usersResult.error}.
          </p>
          <Button asChild variant='outline'>
            <Link href='/dashboard/admin'>Volver al dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='relative min-h-screen px-4 py-10 sm:px-6 lg:px-10'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(191,219,254,0.28),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(148,163,184,0.25),_transparent_45%)]' />
      <div className='absolute inset-x-0 top-0 mx-auto h-40 w-full max-w-4xl rounded-full bg-white/45 blur-3xl opacity-70' />
      <div className='relative z-10 mx-auto max-w-6xl'>
        <AdminUserManager
          initialUsers={usersResult.users ?? []}
          organizations={orgsResult.success ? orgsResult.organizations ?? [] : []}
        />
      </div>
    </div>
  );
}
