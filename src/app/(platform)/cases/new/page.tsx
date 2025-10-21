import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CaseForm } from '@/components/CaseForm';
import { requireAuth } from '@/lib/auth/roles';
import { getAssignableLawyers, getActiveClientsDirectory } from '@/lib/actions/profiles';

export const metadata: Metadata = {
  title: 'Nuevo Caso - Xel Chile',
  description: 'Crear un nuevo caso jurídico',
};

export default async function NewCasePage() {
  // Verificar que el usuario sea abogado o admin
  try {
    const profile = await requireAuth();
    if (!['abogado', 'admin_firma', 'analista'].includes(profile.role)) {
      redirect('/dashboard');
    }

    const [lawyers, clients] = await Promise.all([
      getAssignableLawyers(),
      getActiveClientsDirectory(),
    ]);

    return (
      <div className='container mx-auto py-8'>
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-gray-900'>Nuevo Caso</h1>
          <p className='text-gray-600 mt-2'>
            Crea un nuevo caso jurídico en el sistema
          </p>
        </div>

        <CaseForm
          lawyers={lawyers}
          clients={clients}
          currentProfile={profile}
        />
      </div>
    );
  } catch {
    redirect('/login');
  }
}
