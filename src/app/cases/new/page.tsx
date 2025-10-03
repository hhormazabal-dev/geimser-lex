import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CaseForm } from '@/components/CaseForm';
import { requireAuth } from '@/lib/auth/roles';

export const metadata: Metadata = {
  title: 'Nuevo Caso - LEXCHILE',
  description: 'Crear un nuevo caso jurídico',
};

export default async function NewCasePage() {
  // Verificar que el usuario sea abogado o admin
  try {
    const profile = await requireAuth();
    if (profile.role !== 'abogado' && profile.role !== 'admin_firma') {
      redirect('/dashboard');
    }
  } catch {
    redirect('/login');
  }

  return (
    <div className='container mx-auto py-8'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900'>Nuevo Caso</h1>
        <p className='text-gray-600 mt-2'>
          Crea un nuevo caso jurídico en el sistema
        </p>
      </div>

      <CaseForm />
    </div>
  );
}
