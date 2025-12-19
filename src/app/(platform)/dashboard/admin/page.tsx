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

export default async function AdminDashboardPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/login?redirectTo=/dashboard/admin');
  }

  if (profile.role !== 'admin_firma') {
    redirect( profile.role === 'analista' ? '/dashboard/analista' : '/dashboard/abogado' );
  }

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
    getDashboardStats(),
    getCasesByStatus(),
    getCasesByMateria(),
    getCasesByPriority(),
    getCasesByWorkflowState(),
    getMonthlyStats(),
    getAbogadoWorkload(),
    getUpcomingDeadlines(),
    getClientPortfolio(30),
    getWorkQueue(),
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
