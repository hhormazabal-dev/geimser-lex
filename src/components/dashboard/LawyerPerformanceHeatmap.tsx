'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LawyerPerformanceGrid } from '@/lib/actions/analytics-bi';

interface LawyerPerformanceHeatmapProps {
    data: LawyerPerformanceGrid[];
}

export function LawyerPerformanceHeatmap({ data }: LawyerPerformanceHeatmapProps) {
    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Desempeño por Abogado</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
                </CardContent>
            </Card>
        );
    }

    const allMonths = data[0]?.monthData.map(m => m.month) || [];
    const monthLabels = allMonths.map(m => {
        const date = new Date(`${m}-01`);
        return date.toLocaleDateString('es-CL', { month: 'short' });
    });

    const getStatusColor = (status: 'high' | 'medium' | 'low') => {
        switch (status) {
            case 'high':
                return 'bg-emerald-500 text-white';
            case 'medium':
                return 'bg-amber-400 text-slate-900';
            case 'low':
                return 'bg-slate-300 text-slate-700';
            default:
                return 'bg-slate-200 text-slate-600';
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Heatmap de Desempeño</CardTitle>
                <p className="text-xs text-muted-foreground">
                    Casos resueltos por mes · Últimos 6 meses
                </p>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="py-2 pr-4 text-left font-medium">Abogado</th>
                                {monthLabels.map((month, idx) => (
                                    <th key={idx} className="px-2 py-2 text-center font-medium">
                                        {month}
                                    </th>
                                ))}
                                <th className="pl-4 py-2 text-center font-medium">Promedio</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((lawyer) => (
                                <tr key={lawyer.lawyerId} className="border-b last:border-0">
                                    <td className="py-2 pr-4 font-medium">{lawyer.nombre}</td>
                                    {lawyer.monthData.map((month, idx) => (
                                        <td key={idx} className="px-2 py-2">
                                            <div
                                                className={cn(
                                                    'flex h-10 w-full items-center justify-center rounded-md font-semibold transition-colors',
                                                    getStatusColor(month.status)
                                                )}
                                                title={`${month.casosResueltos} casos resueltos`}
                                            >
                                                {month.casosResueltos}
                                            </div>
                                        </td>
                                    ))}
                                    <td className="pl-4 py-2 text-center">
                                        <Badge variant="outline" className="font-semibold">
                                            {lawyer.avgCasosPorMes}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Legend */}
                <div className="mt-4 flex items-center gap-4 text-xs">
                    <span className="font-medium">Leyenda:</span>
                    <div className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded bg-emerald-500" />
                        <span className="text-muted-foreground">Alto (&gt;8)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded bg-amber-400" />
                        <span className="text-muted-foreground">Medio (5-8)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded bg-slate-300" />
                        <span className="text-muted-foreground">Bajo (&lt;5)</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
