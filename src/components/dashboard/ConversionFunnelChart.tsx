'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ConversionFunnelStage } from '@/lib/actions/analytics-bi';

interface ConversionFunnelChartProps {
    data: ConversionFunnelStage[];
}

export function ConversionFunnelChart({ data }: ConversionFunnelChartProps) {
    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Funnel de Conversión</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
                </CardContent>
            </Card>
        );
    }

    const maxValue = Math.max(...data.map(s => s.value));

    const stageColors: Record<string, string> = {
        consultas: 'bg-sky-500',
        casos_iniciados: 'bg-blue-500',
        en_litigio: 'bg-violet-500',
        terminados: 'bg-indigo-500',
        ganados: 'bg-emerald-500',
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Funnel de Conversión</CardTitle>
                <p className="text-xs text-muted-foreground">Últimos 12 meses</p>
            </CardHeader>
            <CardContent className="space-y-3">
                {data.map((stage, index) => {
                    const width = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
                    const bgColor = stageColors[stage.stage] || 'bg-slate-500';

                    return (
                        <div key={stage.stage} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{stage.label}</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold">{stage.value}</span>
                                    {index > 0 && (
                                        <Badge variant="outline" className="text-xs">
                                            {stage.percentage}%
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <div className="h-8 w-full rounded-lg bg-slate-100">
                                <div
                                    className={`h-8 rounded-lg ${bgColor} transition-all duration-500 flex items-center justify-end pr-3`}
                                    style={{ width: `${Math.max(width, 5)}%` }}
                                >
                                    <span className="text-xs font-medium text-white">
                                        {stage.value}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
