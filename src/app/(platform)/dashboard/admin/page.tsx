// Fuerza runtime dinámico y cero caché (importante para auth basada en cookies)
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminDashboard } from '@/components/AdminDashboard';
import { getCurrentProfile } from '@/lib/auth/roles';
import {
  getDashboardStats,
  getCasesByStatus,
  getCasesByMateria,
  getCasesByPriority,
  getCasesByWorkflowState,
  getMonthlyStats,
  getAbogadoWorkload,
  getUpcomingDeadlines,
  getClientPortfolio,
} from '@/lib/actions/analytics';
import { getWorkQueue } from '@/lib/actions/work-queue';

export const metadata: Metadata = {
  title: 'Dashboard Administrativo - Xel Chile',
  description: 'Panel de control para la firma',
};

export default async function AdminDashboardPage(props: {
  searchParams: Promise<{ period?: string }>;
}) {
  const searchParams = await props.searchParams;
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/login?redirectTo=/dashboard/admin');
  }

  if (profile.role !== 'admin_firma') {
    redirect(profile.role === 'analista' ? '/dashboard/analista' : '/dashboard/abogado');
  }

  // Parse period from URL (default to 3 months/90d)
  const periodKey = (searchParams.period as '30d' | '90d' | '12m') || '90d';
  const periodMonthsMap: Record<string, number> = {
    '30d': 1,
    '90d': 3,
    '12m': 12,
  };
  const months = periodMonthsMap[periodKey] ?? 3;

  const [
    statsResult,
    statusResult,
    materiaResult,
    priorityResult,
    workflowResult,
    monthlyResult,
    workloadResult,
    deadlinesResult,
    portfolioResult,
    workQueueResult,
  ] = await Promise.all([
    getDashboardStats(months),
    getCasesByStatus(months),
    getCasesByMateria(months),
    getCasesByPriority(months),
    getCasesByWorkflowState(months),
    getMonthlyStats(months), // Trend chart needs history, but allow filter if desired? Usually Trend is always 12m. Let's pass months for consistency with user intent "Periodo".
    getAbogadoWorkload(months),
    getUpcomingDeadlines(), // Usually future-looking, ignoring filter
    getClientPortfolio(30), // Portfolio usually is snapshot, kept as is.
    getWorkQueue(), // Inbox is operational, ignoring filter
  ]);

  const dashboardData = {
    stats: statsResult.success ? statsResult.stats ?? null : null,
    casesByStatus: statusResult.success ? statusResult.data ?? [] : [],
    casesByMateria: materiaResult.success ? materiaResult.data ?? [] : [],
    casesByPriority: priorityResult.success ? priorityResult.data ?? [] : [],
    casesByWorkflowState: workflowResult.success ? workflowResult.data ?? [] : [],
    monthlyStats: monthlyResult.success ? monthlyResult.data ?? [] : [],
    abogadoWorkload: workloadResult.success ? workloadResult.data ?? [] : [],
    upcomingDeadlines: deadlinesResult.success ? deadlinesResult.data ?? [] : [],
    clientPortfolio: portfolioResult.success ? portfolioResult.data ?? [] : [],
    workQueue:
      workQueueResult.success && workQueueResult.data
        ? workQueueResult.data
        : {
          overdueStages: [],
          dueNext7Days: [],
          paymentBlocks: [],
          pendingRequests: [],
          stats: { overdueStages: 0, dueNext7Days: 0, paymentBlocks: 0, pendingRequests: 0 },
        },
    highlights:
      statsResult.success && statsResult.highlights
        ? statsResult.highlights
        : { recentCases: [], clients: [], documents: [], pending: [] },
  };

  return <AdminDashboard profile={profile} data={dashboardData} />;
}
