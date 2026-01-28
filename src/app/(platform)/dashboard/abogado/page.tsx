export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LawyerDashboardBI } from '@/components/LawyerDashboardBI';
import { getCurrentProfile } from '@/lib/auth/roles';
import {
  getPersonalStats,
  getWorkloadGauge,
  getTimeDistribution,
  getUpcomingDeadlines48h,
} from '@/lib/actions/analytics-personal';
import { getUpcomingCaseStages } from '@/lib/actions/cases-kanban';

export const metadata: Metadata = {
  title: 'Dashboard 360° - Xel Chile',
  description: 'Dashboard personal de desempeño y gestión de casos',
};

export default async function AbogadoDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/login');
  }

  // En este tablero aceptamos 'abogado' y 'admin_firma'
  if (profile.role === 'analista') {
    redirect('/dashboard/analista');
  }
  if (profile.role === 'cliente') {
    redirect('/dashboard/cliente');
  }
  if (profile.role !== 'abogado' && profile.role !== 'admin_firma') {
    redirect('/login');
  }

  const [
    personalStatsResult,
    workloadGaugeResult,
    timeDistributionResult,
    upcomingDeadlinesResult,
    casesResult,
  ] = await Promise.all([
    getPersonalStats(),
    getWorkloadGauge(),
    getTimeDistribution(),
    getUpcomingDeadlines48h(),
    getUpcomingCaseStages(),
  ]);

  return (
    <LawyerDashboardBI
      personalStats={personalStatsResult.success ? personalStatsResult.data ?? null : null}
      workloadGauge={workloadGaugeResult.success ? workloadGaugeResult.data ?? null : null}
      timeDistribution={timeDistributionResult.success ? timeDistributionResult.data ?? [] : []}
      upcomingDeadlines={upcomingDeadlinesResult.success ? upcomingDeadlinesResult.data ?? [] : []}
      cases={casesResult.success ? casesResult.data ?? [] : []}
      lawyerName={profile.nombre ?? 'Abogado'}
    />
  );
}
