export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentProfile } from '@/lib/auth/roles';
import { getClientPortfolioWithLawyers } from '@/lib/actions/analytics';
import { ClientsPortfolioCRM } from '@/components/admin/ClientsPortfolioCRM';

export default async function AdminClientsPortfolioPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login?redirectTo=/dashboard/admin/clients');
  if (profile.role !== 'admin_firma') redirect('/dashboard/admin');

  const result = await getClientPortfolioWithLawyers(250);
  const portfolio = result.success ? result.data ?? [] : [];

  return (
    <div className='min-h-screen bg-transparent text-slate-900'>
      <div className='mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8'>
        {!result.success && (
          <Card className='rounded-3xl border border-red-200 bg-white/80 backdrop-blur-xl shadow-sm'>
            <CardHeader>
              <CardTitle className='text-red-700'>No se pudo cargar la cartera</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-sm text-red-600/80'>{result.error ?? 'Intenta nuevamente en unos minutos.'}</p>
            </CardContent>
          </Card>
        )}

        <ClientsPortfolioCRM portfolio={portfolio as any} />
      </div>
    </div>
  );
}

