'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import type { UpcomingDeadline } from '@/lib/actions/analytics-personal';

interface UpcomingTimelineProps {
    data: UpcomingDeadline[];
}

export function UpcomingTimeline({ data }: UpcomingTimelineProps) {
    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Próximas 48 horas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Clock className="h-12 w-12 text-muted-foreground/30" />
                        <p className="mt-3 text-sm text-muted-foreground">
                            No hay plazos en las próximas 48 horas
                        </p>
                        <p className="text-xs text-muted-foreground">¡Tiempo para planificar!</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const getPriorityColor = (prioridad: string) => {
        switch (prioridad) {
            case 'urgente':
                return 'destructive';
            case 'alta':
                return 'warning';
            case 'media':
                return 'secondary';
            default:
                return 'outline';
        }
    };

    const getUrgencyColor = (horas: number) => {
        if (horas <= 6) return 'border-red-200 bg-red-50';
        if (horas <= 24) return 'border-amber-200 bg-amber-50';
        return 'border-blue-200 bg-blue-50';
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4" />
                    Próximas 48 horas
                </CardTitle>
                <p className="text-xs text-muted-foreground">{data.length} plazos activos</p>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {data.map((deadline, index) => (
                        <Link
                            key={`${deadline.caseId}-${index}`}
                            href={`/cases/${deadline.caseId}`}
                            className="block"
                        >
                            <div
                                className={cn(
                                    'rounded-lg border-2 p-3 transition-all hover:shadow-md',
                                    getUrgencyColor(deadline.horasRestantes)
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-semibold line-clamp-1">
                                            {deadline.caratulado}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{deadline.etapa}</p>
                                    </div>
                                    <Badge variant={getPriorityColor(deadline.prioridad)} className="shrink-0">
                                        {deadline.prioridad}
                                    </Badge>
                                </div>

                                <div className="mt-2 flex items-center gap-2 text-xs">
                                    {deadline.horasRestantes <= 6 && (
                                        <AlertCircle className="h-3 w-3 text-red-600" />
                                    )}
                                    <span className={cn(
                                        'font-medium',
                                        deadline.horasRestantes <= 6 ? 'text-red-600' :
                                            deadline.horasRestantes <= 24 ? 'text-amber-600' :
                                                'text-blue-600'
                                    )}>
                                        En {deadline.horasRestantes}h
                                    </span>
                                    <span className="text-muted-foreground">
                                        · {new Date(deadline.fechaProgramada).toLocaleString('es-CL', {
                                            weekday: 'short',
                                            day: 'numeric',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
