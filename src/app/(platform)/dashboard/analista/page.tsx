export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { getCases } from '@/lib/actions/cases';
import { getWorkQueue } from '@/lib/actions/work-queue';
import { AnalystDashboard } from '@/components/AnalystDashboard';

export const metadata: Metadata = {
  title: 'Panel de Analista - Xel Chile',
  description: 'Centraliza la información inicial de los casos y su asignación.',
};

export default async function AnalystDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/login?redirectTo=/dashboard/analista');
  }

  if (profile.role === 'admin_firma') {
    redirect('/dashboard/admin');
  }
  if (profile.role !== 'analista') {
    redirect('/dashboard/abogado');
  }

  const [workQueueResult, prepCasesResult] = await Promise.all([
    getWorkQueue(),
    getCases({ workflow_state: 'preparacion', limit: 12, page: 1 }),
  ]);

  const workQueue =
    workQueueResult.success && workQueueResult.data
      ? workQueueResult.data
      : {
          overdueStages: [],
          dueNext7Days: [],
          paymentBlocks: [],
          pendingRequests: [],
          stats: { overdueStages: 0, dueNext7Days: 0, paymentBlocks: 0, pendingRequests: 0 },
        };

  const preparationCases =
    prepCasesResult && 'success' in prepCasesResult && prepCasesResult.success ? prepCasesResult.cases ?? [] : [];

  return <AnalystDashboard workQueue={workQueue} preparationCases={preparationCases} />;
}
