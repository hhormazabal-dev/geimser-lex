import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentProfile, canAccessCase } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';
import { getCaseById } from '@/lib/actions/cases';
import { listCaseMessages } from '@/lib/actions/messages';
import { CaseDetailView } from '@/components/CaseDetailView';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

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

  const dashboardHref =
    profile.role === 'admin_firma'
      ? '/dashboard/admin'
      : profile.role === 'analista'
        ? '/dashboard/analista'
        : profile.role === 'abogado'
          ? '/dashboard/abogado'
          : '/dashboard/cliente';

  // 2) Si el caso está en papelera, mandamos a la vista correcta (evita el "sin permisos" al abrir desde búsquedas).
  if (profile.role === 'admin_firma' || profile.role === 'analista') {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from('cases')
      .select('id, deleted_at')
      .eq('id', id)
      .maybeSingle();

    if (data?.deleted_at) {
      redirect(`/admin/trash?caseId=${encodeURIComponent(id)}`);
    }
  }

  // 2) Permisos (NO 404 si no tiene acceso)
  const hasAccess = await canAccessCase(id);
  if (!hasAccess) {
    return (
      <div className="py-14">
        <div className="soft-section mx-auto max-w-xl p-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Sin permisos para ver este caso
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground/60">
            Tu usuario no tiene acceso al detalle de este expediente. Si crees que es un error,
            contacta al administrador de la firma.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button asChild>
              <Link href="/cases">Volver a casos</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={dashboardHref}>Ir al dashboard</Link>
            </Button>
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
