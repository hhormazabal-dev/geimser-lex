export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { getLawyerDetail } from '@/lib/actions/analytics';
import { AdminLawyerDetail } from '@/components/AdminLawyerDetail';

export const metadata: Metadata = {
  title: 'Detalle de abogado - Xel Chile',
  description: 'Seguimiento de gestión individual para el equipo jurídico',
};

export default async function AdminLawyerDetailPage({
  params,
}: {
  params: Promise<{ lawyerId: string }>;
}) {
  const { lawyerId } = await params;
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/login?redirectTo=/dashboard/admin');
  }

  if (profile.role !== 'admin_firma') {
    redirect('/dashboard');
  }

  const detailResult = await getLawyerDetail(lawyerId);

  if (!detailResult.success || !detailResult.data) {
    notFound();
  }

  return <AdminLawyerDetail data={detailResult.data} />;
}
