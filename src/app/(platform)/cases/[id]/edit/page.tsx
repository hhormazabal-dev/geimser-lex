// src/app/(platform)/cases/[id]/edit/page.tsx
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CaseForm } from '@/components/CaseForm';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { requireAuth } from '@/lib/auth/roles';
import { getCaseById } from '@/lib/actions/cases';
import { getAssignableLawyers, getActiveClientsDirectory } from '@/lib/actions/profiles';
import Link from 'next/link';
import { ArrowUpRight, FolderOpen } from 'lucide-react';

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
      <div className="space-y-8">
        <PageHeader
          eyebrow="Casos"
          title="Editar caso"
          description="Actualiza información del expediente. Los cambios se reflejan en el timeline y en las vistas operativas."
          actions={
            <Button asChild variant="outline">
              <Link href={`/cases/${id}`} className="inline-flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Ver caso <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
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
