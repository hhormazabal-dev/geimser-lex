'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { RevenueByMateria } from '@/lib/actions/analytics-bi';

interface RevenueByMateriaChartProps {
    data: RevenueByMateria[];
}

const COLORS = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
];

export function RevenueByMateriaChart({ data }: RevenueByMateriaChartProps) {
    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Ingresos por Materia</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
                </CardContent>
            </Card>
        );
    }

    const chartData = data.map((item) => ({
        name: item.materia,
        value: item.revenue,
        percentage: item.percentage,
        cases: item.caseCount,
    }));

    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Distribución de Ingresos</CardTitle>
                <p className="text-xs text-muted-foreground">
                    Total: {formatCurrency(totalRevenue)} · Últimos 12 meses
                </p>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percentage }) => `${name} ${percentage}%`}
                            outerRadius={90}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number, name: string, props: any) => [
                                `${formatCurrency(value)} (${props.payload.cases} casos)`,
                                props.payload.name,
                            ]}
                        />
                    </PieChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                    {data.slice(0, 6).map((item, index) => (
                        <div key={item.materia} className="flex items-center gap-2 text-xs">
                            <div
                                className="h-3 w-3 rounded-sm"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="truncate font-medium">{item.materia}</span>
                            <span className="text-muted-foreground">{item.percentage}%</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
