export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LawyerDashboard } from '@/components/LawyerDashboard';
import { getCurrentProfile } from '@/lib/auth/roles';
import { getCases } from '@/lib/actions/cases';
import {
  getDashboardStats,
  getCasesByStatus,
  getCasesByPriority,
  getUpcomingDeadlines,
} from '@/lib/actions/analytics';
import { listQuickLinks, listLegalTemplates } from '@/lib/actions/resources';

export const metadata: Metadata = {
  title: 'Panel del Abogado - LEXSER',
  description: 'Gestión diaria de casos para abogados',
};

export default async function AbogadoDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/login');
  }

  // En este tablero aceptamos 'abogado' y 'cliente'
  if (profile.role === 'admin_firma') {
    redirect('/dashboard/admin');
  }
  if (profile.role === 'analista') {
    redirect('/dashboard/analista');
  }
  if (profile.role !== 'abogado' && profile.role !== 'cliente') {
    redirect('/login');
  }

  const [
    statsResult,
    statusResult,
    priorityResult,
    deadlinesResult,
    casesResult,
    quickLinks,
    templates,
  ] = await Promise.all([
    getDashboardStats(),
    getCasesByStatus(),
    getCasesByPriority(),
    getUpcomingDeadlines(),
    getCases({ page: 1, limit: 25 }),
    listQuickLinks().catch(() => []),
    listLegalTemplates().catch(() => []),
  ]);

  const baseData = {
    stats: statsResult.success ? statsResult.stats ?? null : null,
    casesByStatus: statusResult.success ? statusResult.data ?? [] : [],
    casesByPriority: priorityResult.success ? priorityResult.data ?? [] : [],
    upcomingDeadlines: deadlinesResult.success ? deadlinesResult.data ?? [] : [],
  };

  const cases =
    casesResult && 'success' in casesResult && casesResult.success
      ? casesResult.cases
      : [];

  return (
    <LawyerDashboard
      profile={profile}
      data={baseData}
      cases={cases}
      quickLinks={quickLinks}
      templates={templates}
    />
  );
}