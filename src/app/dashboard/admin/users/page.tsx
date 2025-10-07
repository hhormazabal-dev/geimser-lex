export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { fetchManagedUsers } from '@/lib/actions/admin-users';
import { AdminUserManager } from '@/components/AdminUserManager';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Gestión de usuarios - LEXSER',
  description: 'Administra las cuentas y permisos del equipo.',
};

export default async function AdminUsersPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/login');
  }

  if (profile.role !== 'admin_firma') {
    redirect(profile.role === 'analista' ? '/dashboard/analista' : '/dashboard/abogado');
  }

  const usersResult = await fetchManagedUsers();

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
    <div className='bg-gray-50 py-10'>
      <div className='mx-auto max-w-6xl px-4 sm:px-6 lg:px-8'>
        <AdminUserManager initialUsers={usersResult.users ?? []} />
      </div>
    </div>
  );
}