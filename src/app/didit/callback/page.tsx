import Link from 'next/link';
import { syncDiditVerification, syncLatestDiditVerificationForCurrentUser } from '@/lib/actions/didit-verification';

export const dynamic = 'force-dynamic';

type CallbackPageProps = {
  searchParams?: Promise<Record<string, string>>;
};

export default async function DiditCallbackPage({ searchParams }: CallbackPageProps) {
  const sp = (await searchParams) ?? {};
  const sessionId = (sp.session_id ?? sp.sessionId ?? sp.sid ?? '').trim() || null;

  const result = sessionId ? await syncDiditVerification(sessionId) : await syncLatestDiditVerificationForCurrentUser();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Validación de identidad</h1>
      {result.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Sesión sincronizada. Estado: <strong>{result.status}</strong>.
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No fue posible sincronizar automáticamente: <strong>{result.error}</strong>.
        </div>
      )}

      <p className="text-sm text-slate-600">
        Puedes cerrar esta ventana y volver a la plataforma.
      </p>
      <Link href="/dashboard" className="inline-flex w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
        Volver al dashboard
      </Link>
    </main>
  );
}
