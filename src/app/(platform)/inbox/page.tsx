export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { getWorkQueue } from '@/lib/actions/work-queue';
import { InboxConsole } from '@/components/InboxConsole';

function resolveInboxCopy(role: string) {
  if (role === 'admin_firma') {
    return {
      title: 'Inbox de la firma',
      description:
        'Prioriza vencimientos legales (sentencia, notificación, acciones) y solicitudes pendientes de clientes.',
    };
  }
  if (role === 'analista') {
    return {
      title: 'Inbox de validación',
      description:
        'Prioriza vencimientos legales y solicitudes por resolver.',
    };
  }
  if (role === 'abogado') {
    return {
      title: 'Mi Inbox',
      description:
        'Tu cola de trabajo: vencimientos legales y solicitudes pendientes.',
    };
  }
  return {
    title: 'Inbox',
    description: 'Seguimiento de pendientes asociados a tus expedientes.',
  };
}

export default async function InboxPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login?redirectTo=/inbox');

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

  const { title, description } = resolveInboxCopy(profile.role);

  return <InboxConsole role={profile.role} title={title} description={description} data={data} />;
}
