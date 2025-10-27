// src/app/(platform)/cases/[id]/edit/page.tsx
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CaseForm } from '@/components/CaseForm';
import { requireAuth } from '@/lib/auth/roles';
import { getCaseById } from '@/lib/actions/cases';
import { getAssignableLawyers, getActiveClientsDirectory } from '@/lib/actions/profiles';

// 👇 Aquí está el tipo correcto según Next 15
interface EditCasePageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string>>;
}

export async function generateMetadata(
  { params }: EditCasePageProps
): Promise<Metadata> {
  const { id } = await params; // 👈 ahora se resuelve asíncronamente
  return {
    title: 'Editar Caso - Xel Chile',
    description: `Editar expediente ${id}`,
  };
}

export default async function EditCasePage({ params }: EditCasePageProps) {
  const { id } = await params; // 👈 igual aquí

  try {
    const profile = await requireAuth();
    if (!['abogado', 'admin_firma', 'analista'].includes(profile.role)) {
      redirect('/dashboard');
    }

    const [caseResult, lawyers, clients] = await Promise.all([
      getCaseById(id),
      getAssignableLawyers(),
      getActiveClientsDirectory(),
    ]);

    if (!caseResult.success || !caseResult.case) {
      notFound();
    }

    return (
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Editar Caso</h1>
          <p className="text-gray-600 mt-2">
            Actualiza la información del expediente y sincroniza al equipo.
          </p>
        </div>

        <CaseForm
          case={caseResult.case}
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