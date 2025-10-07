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
  getMonthlyStats,
  getAbogadoWorkload,
  getUpcomingDeadlines,
} from '@/lib/actions/analytics';

export const metadata: Metadata = {
  title: 'Dashboard Administrativo - LEXSER',
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
    monthlyResult,
    workloadResult,
    deadlinesResult,
  ] = await Promise.all([
    getDashboardStats(),
    getCasesByStatus(),
    getCasesByMateria(),
    getCasesByPriority(),
    getMonthlyStats(),
    getAbogadoWorkload(),
    getUpcomingDeadlines(),
  ]);

  const dashboardData = {
    stats: statsResult.success ? statsResult.stats ?? null : null,
    casesByStatus: statusResult.success ? statusResult.data ?? [] : [],
    casesByMateria: materiaResult.success ? materiaResult.data ?? [] : [],
    casesByPriority: priorityResult.success ? priorityResult.data ?? [] : [],
    monthlyStats: monthlyResult.success ? monthlyResult.data ?? [] : [],
    abogadoWorkload: workloadResult.success ? workloadResult.data ?? [] : [],
    upcomingDeadlines: deadlinesResult.success ? deadlinesResult.data ?? [] : [],
  };

  return <AdminDashboard profile={profile} data={dashboardData} />;
}
