'use client';

import { BarChart3, TrendingUp, DollarSign } from 'lucide-react';
import { FinancialKPICards } from '@/components/dashboard/FinancialKPICards';
import { ConversionFunnelChart } from '@/components/dashboard/ConversionFunnelChart';
import { RevenueByMateriaChart } from '@/components/dashboard/RevenueByMateriaChart';
import { LawyerPerformanceHeatmap } from '@/components/dashboard/LawyerPerformanceHeatmap';
import type { FinancialKPIs, ConversionFunnelStage, RevenueByMateria, LawyerPerformanceGrid } from '@/lib/actions/analytics-bi';

interface AdminDashboardBIProps {
    financialKPIs: FinancialKPIs | null;
    conversionFunnel: ConversionFunnelStage[];
    revenueByMateria: RevenueByMateria[];
    lawyerPerformance: LawyerPerformanceGrid[];
}

/**
 * Clean Power BI-style Executive Dashboard
 * ONLY business insights - no operational clutter
 */
export function AdminDashboardBI({ financialKPIs, conversionFunnel, revenueByMateria, lawyerPerformance }: AdminDashboardBIProps) {
    if (!financialKPIs) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <p className="text-muted-foreground">Cargando datos ejecutivos...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-8">
            {/* Clean Executive Header */}
            <header className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600">
                        <BarChart3 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Dashboard Ejecutivo</h1>
                        <p className="text-muted-foreground">Insights de negocio en tiempo real</p>
                    </div>
                </div>
            </header>

            {/* Financial KPIs */}
            <FinancialKPICards data={financialKPIs} />

            {/* Charts Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
                <ConversionFunnelChart data={conversionFunnel} />
                <RevenueByMateriaChart data={revenueByMateria} />
            </div>

            {/* Lawyer Performance Heatmap */}
            <LawyerPerformanceHeatmap data={lawyerPerformance} />
        </div>
    );
}
