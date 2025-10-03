import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { AdminDashboard } from '@/components/AdminDashboard';
import { 
  getDashboardStats,
  getCasesByStatus,
  getCasesByMateria,
  getCasesByPriority,
  getMonthlyStats,
  getAbogadoWorkload,
  getUpcomingDeadlines
} from '@/lib/actions/analytics';

export const metadata: Metadata = {
  title: 'Dashboard - LEXCHILE',
  description: 'Panel de control administrativo de LEXCHILE',
};

export default async function DashboardPage() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      redirect('/login');
    }

    // Solo admin y abogados pueden acceder al dashboard
    if (profile.role === 'cliente') {
      redirect('/client-portal');
    }

    // Cargar datos del dashboard en paralelo
    const [
      statsResult,
      statusResult,
      materiaResult,
      priorityResult,
      monthlyResult,
      workloadResult,
      deadlinesResult
    ] = await Promise.all([
      getDashboardStats(),
      getCasesByStatus(),
      getCasesByMateria(),
      getCasesByPriority(),
      getMonthlyStats(),
      profile.role === 'admin_firma' ? getAbogadoWorkload() : Promise.resolve({ success: true, data: [] }),
      getUpcomingDeadlines()
    ]);

    const dashboardData = {
      stats: statsResult.success ? statsResult.stats : null,
      casesByStatus: statusResult.success ? statusResult.data : [],
      casesByMateria: materiaResult.success ? materiaResult.data : [],
      casesByPriority: priorityResult.success ? priorityResult.data : [],
      monthlyStats: monthlyResult.success ? monthlyResult.data : [],
      abogadoWorkload: workloadResult.success ? workloadResult.data : [],
      upcomingDeadlines: deadlinesResult.success ? deadlinesResult.data : [],
    };

    return (
      <AdminDashboard 
        profile={profile}
        data={dashboardData}
      />
    );
  } catch {
    redirect('/login');
  }
}
