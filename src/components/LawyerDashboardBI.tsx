'use client';

import { User, TrendingUp, Briefcase } from 'lucide-react';
import { PersonalPerformanceCards } from '@/components/dashboard/PersonalPerformanceCards';
import { WorkloadGaugeChart } from '@/components/dashboard/WorkloadGaugeChart';
import { TimeDistributionChart } from '@/components/dashboard/TimeDistributionChart';
import { UpcomingTimeline } from '@/components/dashboard/UpcomingTimeline';
import { CasesKanbanBoard } from '@/components/dashboard/CasesKanbanBoard';
import type {
    PersonalStats,
    WorkloadGauge,
    TimeDistribution,
    UpcomingDeadline,
} from '@/lib/actions/analytics-personal';

interface CaseForAgenda {
    case_id: string;
    caratulado: string;
    materia: string;
    prioridad: string;
    etapa_actual: string;
    nombre_cliente: string;
    updated_at: string;
    fecha_proxima: string | null;
}

interface LawyerDashboardBIProps {
    personalStats: PersonalStats | null;
    workloadGauge: WorkloadGauge | null;
    timeDistribution: TimeDistribution[];
    upcomingDeadlines: UpcomingDeadline[];
    cases: CaseForAgenda[];
    lawyerName: string;
    view?: string; // kept for backward compat
}

/**
 * Unified Lawyer Dashboard 360° 
 * Performance metrics + Case management in one view
 */
export function LawyerDashboardBI({
    personalStats,
    workloadGauge,
    timeDistribution,
    upcomingDeadlines,
    cases,
    lawyerName,
}: LawyerDashboardBIProps) {
    if (!personalStats || !workloadGauge) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <p className="text-muted-foreground">Cargando datos...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6">
            {/* Header */}
            <header className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                    <Briefcase className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard 360°</h1>
                    <p className="text-sm text-muted-foreground">{lawyerName}</p>
                </div>
            </header>

            {/* Performance Section - Compact */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider">Performance</h2>
                </div>

                <PersonalPerformanceCards data={personalStats} />

                <div className="grid gap-4 lg:grid-cols-3">
                    <WorkloadGaugeChart data={workloadGauge} />
                    <TimeDistributionChart data={timeDistribution} />
                    <UpcomingTimeline data={upcomingDeadlines} />
                </div>
            </section>

            {/* Divider */}
            <hr className="border-border" />

            {/* Case Management Section */}
            <section>
                <CasesKanbanBoard cases={cases} />
            </section>
        </div>
    );
}
