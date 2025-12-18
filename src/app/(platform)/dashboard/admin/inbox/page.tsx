export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { getWorkQueue } from '@/lib/actions/work-queue';
import { WorkQueueDashboard } from '@/components/WorkQueueDashboard';

export default async function AdminInboxPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login?redirectTo=/dashboard/admin/inbox');
  if (profile.role !== 'admin_firma') redirect('/dashboard');

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
      title='Bandeja de la firma'
      description='Prioriza etapas vencidas, próximos vencimientos, bloqueos de pago y solicitudes pendientes de clientes.'
      data={data}
    />
  );
}

