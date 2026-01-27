'use client';

import { useState, useEffect } from 'react';
import { getDeletedCases, restoreCase } from '@/lib/actions/cases';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { RotateCcw, Archive, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function GlobalDeletedPage() {
    const [cases, setCases] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadDeleted();
    }, []);

    async function loadDeleted() {
        setIsLoading(true);
        const res = await getDeletedCases();
        if (res.success && res.data) {
            setCases(res.data);
        }
        setIsLoading(false);
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin-global">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Historial de Eliminaciones (Backup)</h1>
                    <p className="text-sm text-slate-500">
                        Registro histórico de todos los casos eliminados en la plataforma. Permanente.
                    </p>
                </div>
            </div>

            <Card className="border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left font-semibold text-slate-900">Caso</th>
                                <th className="px-6 py-3 text-left font-semibold text-slate-900">Eliminado</th>
                                <th className="px-6 py-3 text-left font-semibold text-slate-900">ID Original</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {cases.map((c) => (
                                <tr key={c.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{c.caratulado}</div>
                                        <div className="text-xs text-slate-500">{c.numero_causa}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        {formatDate(c.deleted_at)}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                                        {c.id}
                                    </td>
                                </tr>
                            ))}
                            {cases.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                                        No hay registros históricos de eliminación.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
