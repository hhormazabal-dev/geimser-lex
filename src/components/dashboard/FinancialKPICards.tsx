'use client';

import { TrendingUp, TrendingDown, DollarSign, Clock, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { FinancialKPIs } from '@/lib/actions/analytics-bi';

interface FinancialKPICardsProps {
    data: FinancialKPIs;
}

export function FinancialKPICards({ data }: FinancialKPICardsProps) {
    const ingresosTrend = data.facturadoMes - data.facturadoMesAnterior;
    const ingresosPct = data.facturadoMesAnterior > 0
        ? Math.round((ingresosTrend / data.facturadoMesAnterior) * 100)
        : 0;

    const tiempoTrend = data.tiempoPromedioResolucion - data.tiempoPromedioAnterior;
    const tiempoPct = data.tiempoPromedioAnterior > 0
        ? Math.round((tiempoTrend / data.tiempoPromedioAnterior) * 100)
        : 0;

    return (
        <div className="grid gap-4 md:grid-cols-3">
            {/* Ingresos */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Facturado este mes</CardTitle>
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(data.facturadoMes)}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {ingresosTrend >= 0 ? (
                            <div className="flex items-center gap-1 text-emerald-600">
                                <TrendingUp className="h-3 w-3" />
                                <span>+{ingresosPct}%</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-red-600">
                                <TrendingDown className="h-3 w-3" />
                                <span>{ingresosPct}%</span>
                            </div>
                        )}
                        <span>vs mes anterior</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Pendiente de cobro: {formatCurrency(data.pendienteCobro)}
                    </p>
                </CardContent>
            </Card>

            {/* Eficiencia */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tiempo promedio resolución</CardTitle>
                    <Clock className="h-4 w-4 text-sky-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{data.tiempoPromedioResolucion} días</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {tiempoTrend <= 0 ? (
                            <div className="flex items-center gap-1 text-emerald-600">
                                <TrendingDown className="h-3 w-3" />
                                <span>{Math.abs(tiempoTrend)} días ↓</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-amber-600">
                                <TrendingUp className="h-3 w-3" />
                                <span>+{tiempoTrend} días ↑</span>
                            </div>
                        )}
                        <span>vs período anterior</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Casos cerrados: {data.casosCerradosMes} este mes
                    </p>
                </CardContent>
            </Card>

            {/* Cartera */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cartera de clientes</CardTitle>
                    <Users className="h-4 w-4 text-violet-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{data.clientesActivos}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1 text-emerald-600">
                            <TrendingUp className="h-3 w-3" />
                            <span>+{data.nuevosClientesMes} nuevos</span>
                        </div>
                        <span>este mes</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Retención: {data.retencionClientes}%
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
