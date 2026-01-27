'use client';

import { use, useState, useEffect } from 'react';
import { getDeletedCases, restoreCase } from '@/lib/actions/cases';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { RotateCcw, Trash2, Search, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TrashPage() {
    const router = useRouter();
    const [cases, setCases] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [restoringId, setRestoringId] = useState<string | null>(null);

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

    async function handleRestore(id: string) {
        if (!confirm('¿Estás seguro de querer restaurar este caso? Volverá al listado principal.')) return;
        setRestoringId(id);
        const res = await restoreCase(id);
        if (res.success) {
            setCases((prev) => prev.filter((c) => c.id !== id));
            router.refresh();
        } else {
            alert('Error al restaurar: ' + res.error);
        }
        setRestoringId(null);
    }

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">Cargando papelera...</div>;
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/cases">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Papelera de Reciclaje</h1>
                    <p className="text-sm text-slate-500">
                        Los casos eliminados permanecen aquí por 10 días antes de su eliminación "definitiva" (de esta vista).
                    </p>
                </div>
            </div>

            <Card className="border border-slate-200 bg-white shadow-sm">
                {cases.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="rounded-full bg-slate-100 p-4">
                            <Trash2 className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="mt-4 text-lg font-medium text-slate-900">Papelera vacía</h3>
                        <p className="mt-2 text-sm text-slate-500">No hay casos eliminados recientemente.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Caso</th>
                                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Eliminado el</th>
                                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Cliente</th>
                                    <th className="px-6 py-3 text-right font-semibold text-slate-900">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {cases.map((c) => (
                                    <tr key={c.id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{c.caratulado}</div>
                                            {c.numero_causa && <div className="text-xs text-slate-500">{c.numero_causa}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {formatDate(c.deleted_at)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {c.cliente_principal?.nombre || c.nombre_cliente || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                                                onClick={() => handleRestore(c.id)}
                                                disabled={restoringId === c.id}
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                                {restoringId === c.id ? 'Restaurando...' : 'Restaurar'}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
