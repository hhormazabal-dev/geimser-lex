'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TimeDistribution } from '@/lib/actions/analytics-personal';

interface TimeDistributionChartProps {
    data: TimeDistribution[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export function TimeDistributionChart({ data }: TimeDistributionChartProps) {
    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Distribución de Tiempo</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
                </CardContent>
            </Card>
        );
    }

    const chartData = data.map((item) => ({
        name: item.materia,
        value: item.horas,
        percentage: item.porcentaje,
        casos: item.casosActivos,
    }));

    const totalHoras = data.reduce((sum, item) => sum + item.horas, 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Distribución de Tiempo</CardTitle>
                <p className="text-xs text-muted-foreground">
                    Total estimado: {totalHoras}hrs · Por materia
                </p>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percentage }) => `${name} ${percentage}%`}
                            outerRadius={85}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number, name: string, props: any) => [
                                `${value}hrs (${props.payload.casos} casos)`,
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
                            <span className="text-muted-foreground">{item.horas}hrs</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
