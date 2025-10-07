import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { SecurityDashboard } from '@/components/SecurityDashboard';

export const metadata: Metadata = {
  title: 'Seguridad - LEXSER',
  description: 'Panel de administración de seguridad y auditoría',
};

export default async function SecurityPage() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      redirect('/login');
    }

    // Solo admin puede acceder al panel de seguridad
    if (profile.role !== 'admin_firma') {
      redirect('/dashboard');
    }

    return (
      <div className='min-h-screen bg-gray-50'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
          <SecurityDashboard canManage={true} />
        </div>
      </div>
    );
  } catch {
    redirect('/login');
  }
}
