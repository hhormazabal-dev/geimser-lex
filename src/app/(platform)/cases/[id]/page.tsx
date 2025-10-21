import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentProfile, canAccessCase } from '@/lib/auth/roles';
import { getCaseById } from '@/lib/actions/cases';
import { listCaseMessages } from '@/lib/actions/messages';
import { CaseDetailView } from '@/components/CaseDetailView';

type CaseRouteParams = { id: string };
type CaseDetailPageProps = { params: Promise<CaseRouteParams> };

/* ----------------------------- generateMetadata ---------------------------- */
export async function generateMetadata({ params }: CaseDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const result = await getCaseById(id);
    if (result.success && result.case) {
      return {
        title: `${result.case.caratulado} - Xel Chile`,
        description: `Detalles del caso: ${result.case.caratulado}`,
      };
    }
  } catch {
    // ignore y usamos fallback
  }

  return {
    title: 'Caso - Xel Chile',
    description: 'Detalles del caso legal',
  };
}

/* ---------------------------------- Page ---------------------------------- */
export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const { id } = await params;

  // 1) Autenticación
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/login');
  }

  // 2) Permisos (NO 404 si no tiene acceso)
  const hasAccess = await canAccessCase(id);
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-lexser-gray-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold">Sin permisos para ver este caso</h1>
          <p className="text-lexser-gray-300 text-sm">
            Tu usuario no tiene acceso al detalle de este caso.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md bg-lexser-blue-600 px-4 py-2 text-sm font-medium hover:bg-lexser-blue-700"
            >
              Ir al dashboard
            </Link>
            <Link
              href="/cases"
              className="inline-flex items-center justify-center rounded-md border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/10"
            >
              Ver listado de casos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3) Datos del caso (si no existe -> 404 real)
  const result = await getCaseById(id);
  if (!result.success || !result.case) {
    notFound();
  }

  // 4) Mensajes (no hacemos fallar la página si esto peta)
  const messages = await listCaseMessages(id, { limit: 100 }).catch(() => []);

  return (
    <CaseDetailView
      case={result.case}
      profile={profile}
      messages={messages}
    />
  );
}
