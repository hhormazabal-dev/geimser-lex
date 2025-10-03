import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { getCases } from '@/lib/actions/cases';
import { ClientDashboard } from '@/components/ClientDashboard';

export const metadata: Metadata = {
  title: 'Portal Cliente - LEXCHILE',
  description: 'Portal de acceso para clientes de LEXCHILE',
};

export default async function ClientPortalPage() {
  // Verificar que el usuario sea cliente
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      redirect('/login');
    }

    if (profile.role !== 'cliente') {
      redirect('/dashboard');
    }

    // Obtener casos del cliente
    const casesResult = await getCases({ limit: 50 });
    const cases = casesResult.success ? casesResult.cases : [];

    return (
      <div className='min-h-screen bg-gray-50'>
        <ClientDashboard 
          profile={profile}
          cases={cases}
        />
      </div>
    );
  } catch {
    redirect('/login');
  }
}
