'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type CurrencyType = 'UF' | 'UTM' | 'USD';

interface CurrencyData {
    value: number;
    change?: number;
    lastUpdated: string;
}

interface CurrencyIndicatorProps {
    type: CurrencyType;
    className?: string;
}

const CURRENCY_INFO: Record<CurrencyType, { label: string; format: (v: number) => string }> = {
    UF: {
        label: 'UF',
        format: (v) => `$${new Intl.NumberFormat('es-CL').format(v)}`,
    },
    UTM: {
        label: 'UTM',
        format: (v) => `$${new Intl.NumberFormat('es-CL').format(v)}`,
    },
    USD: {
        label: 'USD (Obs.)',
        format: (v) => `$${new Intl.NumberFormat('es-CL').format(v)}`,
    },
};

export function CurrencyIndicator({ type, className }: CurrencyIndicatorProps) {
    const [data, setData] = useState<CurrencyData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCurrency = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // Using mindicador.cl API for Chilean economic indicators
                const response = await fetch(`https://mindicador.cl/api/${type.toLowerCase()}`);

                if (!response.ok) {
                    throw new Error('No se pudo obtener el indicador');
                }

                const result = await response.json();

                // Verificar que la respuesta tenga datos
                if (!result.serie || !result.serie[0]) {
                    console.warn(`No data available for ${type}`);
                    setError('No disponible'); // Set error if no data
                    setIsLoading(false); // Stop loading
                    return;
                }

                const latest = result.serie[0];

                setData({
                    value: latest.valor,
                    lastUpdated: new Date(latest.fecha).toLocaleDateString('es-CL'),
                });
            } catch (err) {
                console.error(`Error fetching ${type}:`, err);
                setError('No disponible');
            } finally {
                setIsLoading(false);
            }
        };

        fetchCurrency();

        // Refresh every hour
        const interval = setInterval(fetchCurrency, 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [type]);

    const info = CURRENCY_INFO[type];

    if (error) {
        return (
            <Card className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm', className)}>
                <CardContent className="p-4">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-500">{info.label}</p>
                        <p className="text-sm text-slate-400">{error}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md', className)}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium text-slate-500">{info.label}</p>
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                                <p className="text-base font-semibold text-slate-400">Cargando...</p>
                            </div>
                        ) : data ? (
                            <>
                                <p className="text-2xl font-bold text-slate-900">{info.format(data.value)}</p>
                                <p className="text-xs text-slate-400">Actualizado al {data.lastUpdated}</p>
                            </>
                        ) : null}
                    </div>
                    {data?.change !== undefined && data.change !== 0 && (
                        <Badge
                            variant={data.change > 0 ? 'default' : 'destructive'}
                            className="flex items-center gap-1"
                        >
                            <TrendingUp className={cn('h-3 w-3', data.change < 0 && 'rotate-180')} />
                            {Math.abs(data.change).toFixed(2)}%
                        </Badge>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
