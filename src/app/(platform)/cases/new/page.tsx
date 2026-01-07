import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CaseForm } from '@/components/CaseForm';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { requireAuth } from '@/lib/auth/roles';
import { getAssignableLawyers, getActiveClientsDirectory } from '@/lib/actions/profiles';
import Link from 'next/link';
import { ArrowUpRight, FolderOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Nuevo Caso - Xel Chile',
  description: 'Crear un nuevo caso jurídico',
};

export default async function NewCasePage() {
  // Verificar permisos para crear casos (super_admin también pasa).
  try {
    const profile = await requireAuth(['abogado', 'admin_firma', 'analista']);

    const [lawyers, clients] = await Promise.all([
      getAssignableLawyers(),
      getActiveClientsDirectory(),
    ]);

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Casos"
          title="Nuevo caso"
          description="Carga lo esencial primero (partes, carátula y antecedentes) y revisa el timeline por etapas antes de crear."
          actions={
            <Button asChild variant="outline">
              <Link href="/cases" className="inline-flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Volver a casos <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
        <CaseForm
          lawyers={lawyers}
          clients={clients}
          currentProfile={profile}
          variant="wizard"
        />
      </div>
    );
  } catch {
    redirect('/login');
  }
}
