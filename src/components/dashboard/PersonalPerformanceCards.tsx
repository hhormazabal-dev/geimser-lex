'use client';

import { TrendingUp, TrendingDown, Award, Clock, DollarSign, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { PersonalStats } from '@/lib/actions/analytics-personal';

interface PersonalPerformanceCardsProps {
    data: PersonalStats;
}

export function PersonalPerformanceCards({ data }: PersonalPerformanceCardsProps) {
    const casosTrend = data.casosCerradosMes - data.casosCerradosMesAnterior;
    const casosPct = data.casosCerradosMesAnterior > 0
        ? Math.round((casosTrend / data.casosCerradosMesAnterior) * 100)
        : 0;

    return (
        <div className="grid gap-4 md:grid-cols-3">
            {/* Performance Personal */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Casos cerrados este mes</CardTitle>
                    <Target className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{data.casosCerradosMes}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {casosTrend >= 0 ? (
                            <div className="flex items-center gap-1 text-emerald-600">
                                <TrendingUp className="h-3 w-3" />
                                <span>+{casosTrend} casos</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-amber-600">
                                <TrendingDown className="h-3 w-3" />
                                <span>{casosTrend} casos</span>
                            </div>
                        )}
                        <span>vs mes anterior</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Tiempo promedio: {data.tiempoPromedioResolucion} días
                    </p>
                </CardContent>
            </Card>

            {/* Ranking */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ranking en equipo</CardTitle>
                    <Award className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold">#{data.rankingEnEquipo}</span>
                        <span className="text-sm text-muted-foreground">de {data.totalAbogados}</span>
                    </div>
                    <div className="mt-2">
                        {data.rankingEnEquipo === 1 && (
                            <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500">
                                🏆 Top Performer
                            </Badge>
                        )}
                        {data.rankingEnEquipo <= 3 && data.rankingEnEquipo > 1 && (
                            <Badge variant="secondary">⭐ Top 3</Badge>
                        )}
                        {data.rankingEnEquipo > 3 && (
                            <Badge variant="outline">Basado en casos cerrados</Badge>
                        )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Casos activos: {data.casosActivosActuales}
                    </p>
                </CardContent>
            </Card>

            {/* Valor Gestionado */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cartera activa</CardTitle>
                    <DollarSign className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(data.valorTotalGestionado)}</div>
                    <p className="text-xs text-muted-foreground">
                        {data.casosActivosActuales} casos en gestión
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Promedio: {formatCurrency(data.casosActivosActuales > 0 ? data.valorTotalGestionado / data.casosActivosActuales : 0)} por caso
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
