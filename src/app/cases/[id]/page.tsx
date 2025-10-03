import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCurrentProfile, canAccessCase } from '@/lib/auth/roles';
import { getCaseById } from '@/lib/actions/cases';
import { CaseDetailView } from '@/components/CaseDetailView';

interface CaseDetailPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: CaseDetailPageProps): Promise<Metadata> {
  try {
    const result = await getCaseById(params.id);
    
    if (result.success && result.case) {
      return {
        title: `${result.case.caratulado} - LEXCHILE`,
        description: `Detalles del caso: ${result.case.caratulado}`,
      };
    }
  } catch {
    // Fallback metadata
  }

  return {
    title: 'Caso - LEXCHILE',
    description: 'Detalles del caso legal',
  };
}

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      redirect('/login');
    }

    // Verificar acceso al caso
    const hasAccess = await canAccessCase(params.id);
    if (!hasAccess) {
      notFound();
    }

    // Obtener datos del caso
    const result = await getCaseById(params.id);
    
    if (!result.success || !result.case) {
      notFound();
    }

    return (
      <CaseDetailView 
        case={result.case}
        profile={profile}
      />
    );
  } catch {
    notFound();
  }
}
