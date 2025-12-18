export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { getWorkQueue } from '@/lib/actions/work-queue';
import { WorkQueueDashboard } from '@/components/WorkQueueDashboard';

export default async function AnalystInboxPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login?redirectTo=/dashboard/analista/inbox');
  if (profile.role !== 'analista') redirect('/dashboard');

  const result = await getWorkQueue();
  const data =
    result.success && result.data
      ? result.data
      : {
          overdueStages: [],
          dueNext7Days: [],
          paymentBlocks: [],
          pendingRequests: [],
          stats: { overdueStages: 0, dueNext7Days: 0, paymentBlocks: 0, pendingRequests: 0 },
        };

  return (
    <WorkQueueDashboard
      title='Bandeja de validación'
      description='Prioriza casos en preparación/revisión: vencimientos, bloqueos y solicitudes por resolver.'
      data={data}
    />
  );
}

