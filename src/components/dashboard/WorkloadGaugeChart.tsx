'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { WorkloadGauge } from '@/lib/actions/analytics-personal';

interface WorkloadGaugeChartProps {
    data: WorkloadGauge;
}

export function WorkloadGaugeChart({ data }: WorkloadGaugeChartProps) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'low':
                return 'text-blue-600 bg-blue-50';
            case 'optimal':
                return 'text-emerald-600 bg-emerald-50';
            case 'high':
                return 'text-amber-600 bg-amber-50';
            case 'overload':
                return 'text-red-600 bg-red-50';
            default:
                return 'text-slate-600 bg-slate-50';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'low':
                return '📉 Baja carga';
            case 'optimal':
                return '✅ Carga óptima';
            case 'high':
                return '⚠️ Alta carga';
            case 'overload':
                return '🔴 Sobrecarga';
            default:
                return 'Normal';
        }
    };

    const getGaugeColor = (status: string) => {
        switch (status) {
            case 'low':
                return 'from-blue-400 to-blue-600';
            case 'optimal':
                return 'from-emerald-400 to-emerald-600';
            case 'high':
                return 'from-amber-400 to-amber-600';
            case 'overload':
                return 'from-red-400 to-red-600';
            default:
                return 'from-slate-400 to-slate-600';
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Carga de Trabajo</CardTitle>
                <p className="text-xs text-muted-foreground">Casos activos vs capacidad</p>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Gauge Visual */}
                <div className="relative">
                    <div className="flex items-center justify-center">
                        <div className="relative h-40 w-40">
                            {/* Background circle */}
                            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="42"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    className="text-slate-100"
                                />
                                {/* Progress circle */}
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="42"
                                    fill="none"
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeDasharray={`${Math.min(data.porcentaje, 100) * 2.64} 264`}
                                    className={cn('bg-gradient-to-r transition-all', getGaugeColor(data.status))}
                                    style={{
                                        stroke: `url(#gradient-${data.status})`,
                                    }}
                                />
                                <defs>
                                    <linearGradient id={`gradient-${data.status}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                        {data.status === 'low' && (
                                            <>
                                                <stop offset="0%" stopColor="#60a5fa" />
                                                <stop offset="100%" stopColor="#2563eb" />
                                            </>
                                        )}
                                        {data.status === 'optimal' && (
                                            <>
                                                <stop offset="0%" stopColor="#34d399" />
                                                <stop offset="100%" stopColor="#10b981" />
                                            </>
                                        )}
                                        {data.status === 'high' && (
                                            <>
                                                <stop offset="0%" stopColor="#fbbf24" />
                                                <stop offset="100%" stopColor="#f59e0b" />
                                            </>
                                        )}
                                        {data.status === 'overload' && (
                                            <>
                                                <stop offset="0%" stopColor="#f87171" />
                                                <stop offset="100%" stopColor="#ef4444" />
                                            </>
                                        )}
                                    </linearGradient>
                                </defs>
                            </svg>
                            {/* Center text */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold">{data.casosActivos}</span>
                                <span className="text-xs text-muted-foreground">de {data.capacidadMaxima}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center justify-center">
                    <div className={cn('rounded-full px-4 py-2 text-sm font-semibold', getStatusColor(data.status))}>
                        {getStatusLabel(data.status)} · {data.porcentaje}%
                    </div>
                </div>

                {/* Info */}
                <p className="text-center text-xs text-muted-foreground">
                    {data.porcentaje > 100
                        ? 'Considera redistribuir casos o solicitar apoyo'
                        : data.porcentaje >= 80
                            ? 'Cerca del límite de capacidad'
                            : data.porcentaje >= 50
                                ? 'Carga de trabajo equilibrada'
                                : 'Capacidad disponible para nuevos casos'}
                </p>
            </CardContent>
        </Card>
    );
}
