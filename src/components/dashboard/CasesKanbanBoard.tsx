'use client';

import { Briefcase, Clock, ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';

// Predefined judicial stages in process order
const STAGE_ORDER = [
    'Ingreso Demanda',
    'Preparatoria',
    'Audiencia Preparatoria',
    'Audiencia de Juicio',
    'Sentencia',
    'Recurso/Apelación',
    'Ejecución',
    'Cierre',
];

const STAGE_COLORS = [
    'bg-slate-500',
    'bg-blue-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-orange-500',
    'bg-teal-500',
];

interface CaseForAgenda {
    case_id: string;
    caratulado: string;
    materia: string;
    prioridad: string;
    etapa_actual: string;
    nombre_cliente: string;
    updated_at: string;
    fecha_proxima: string | null;
}

interface CasesKanbanBoardProps {
    cases: CaseForAgenda[];
}

/**
 * Professional Case Pipeline - Single Horizontal Line
 */
export function CasesKanbanBoard({ cases }: CasesKanbanBoardProps) {
    const [search, setSearch] = useState('');
    const [stageFilter, setStageFilter] = useState<string | null>(null);

    // Get extra stages from data
    const extraStages = useMemo(() => {
        return [...new Set(cases.map(c => c.etapa_actual))].filter(s => !STAGE_ORDER.includes(s));
    }, [cases]);

    // Count by stage
    const stageCounts = useMemo(() => {
        return [...STAGE_ORDER, ...extraStages].reduce((acc, stage) => {
            acc[stage] = cases.filter(c => c.etapa_actual === stage).length;
            return acc;
        }, {} as Record<string, number>);
    }, [cases, extraStages]);

    // Filter cases
    const filteredCases = useMemo(() => {
        return cases.filter(c => {
            const matchesSearch = !search ||
                c.caratulado.toLowerCase().includes(search.toLowerCase()) ||
                c.nombre_cliente.toLowerCase().includes(search.toLowerCase());
            const matchesStage = !stageFilter || c.etapa_actual === stageFilter;
            return matchesSearch && matchesStage;
        });
    }, [cases, search, stageFilter]);

    const getPriorityBadge = (prioridad: string) => {
        switch (prioridad?.toLowerCase()) {
            case 'urgente':
                return <Badge className="bg-red-500 hover:bg-red-600 text-[10px] h-5">Urgente</Badge>;
            case 'alta':
                return <Badge className="bg-orange-500 hover:bg-orange-600 text-[10px] h-5">Alta</Badge>;
            case 'media':
                return <Badge variant="secondary" className="text-[10px] h-5">Media</Badge>;
            default:
                return <Badge variant="outline" className="text-[10px] h-5">Baja</Badge>;
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
    };

    const totalCases = cases.length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-primary" />
                        Pipeline de Casos
                    </h2>
                    <p className="text-sm text-muted-foreground">{totalCases} casos activos</p>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Buscar..."
                        className="pl-9 h-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* === SINGLE LINE PIPELINE === */}
            <div className="rounded-xl border bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 overflow-x-auto">
                <div className="flex items-center min-w-max">
                    {STAGE_ORDER.map((stage, idx) => {
                        const count = stageCounts[stage] || 0;
                        const isActive = stageFilter === stage;
                        const hasItems = count > 0;
                        const color = STAGE_COLORS[idx];
                        const isLast = idx === STAGE_ORDER.length - 1;

                        return (
                            <div key={stage} className="flex items-center">
                                {/* Stage Node */}
                                <button
                                    onClick={() => setStageFilter(isActive ? null : stage)}
                                    className={cn(
                                        'flex flex-col items-center transition-all px-2',
                                        'hover:scale-105',
                                        isActive && 'scale-105'
                                    )}
                                >
                                    {/* Circle with count */}
                                    <div className={cn(
                                        'flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold transition-all',
                                        'ring-2 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900',
                                        hasItems
                                            ? `${color} text-white ring-transparent shadow-lg`
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500 ring-slate-300 dark:ring-slate-600',
                                        isActive && 'ring-primary ring-4'
                                    )}>
                                        {count}
                                    </div>

                                    {/* Stage Name */}
                                    <span className={cn(
                                        'mt-2 text-[10px] font-medium text-center max-w-[80px] leading-tight',
                                        isActive ? 'text-primary font-bold' : hasItems ? 'text-foreground' : 'text-muted-foreground'
                                    )}>
                                        {stage}
                                    </span>
                                </button>

                                {/* Arrow Connector */}
                                {!isLast && (
                                    <div className="flex items-center mx-1">
                                        <div className="w-6 h-0.5 bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-500" />
                                        <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-slate-400 dark:border-l-slate-500" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Extra stages as pills below */}
                {extraStages.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
                        <span className="text-[10px] text-muted-foreground mr-2">Otras etapas:</span>
                        {extraStages.map(stage => {
                            const count = stageCounts[stage] || 0;
                            const isActive = stageFilter === stage;
                            return (
                                <button
                                    key={stage}
                                    onClick={() => setStageFilter(isActive ? null : stage)}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all',
                                        isActive
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-white dark:bg-slate-800 border hover:border-primary'
                                    )}
                                >
                                    <span className="font-bold">{count}</span>
                                    {stage}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Filter indicator */}
            {stageFilter && (
                <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-4 py-2">
                    <span className="text-sm">
                        Mostrando: <strong>{stageFilter}</strong> ({stageCounts[stageFilter] || 0})
                    </span>
                    <button onClick={() => setStageFilter(null)} className="text-xs text-primary hover:underline">
                        Ver todos
                    </button>
                </div>
            )}

            {/* === CASES TABLE === */}
            <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/50">
                            <th className="text-left font-semibold px-4 py-3">Caso</th>
                            <th className="text-left font-semibold px-4 py-3 hidden sm:table-cell">Cliente</th>
                            <th className="text-left font-semibold px-4 py-3 hidden md:table-cell">Materia</th>
                            <th className="text-left font-semibold px-4 py-3">Etapa</th>
                            <th className="text-center font-semibold px-4 py-3">Prioridad</th>
                            <th className="text-right font-semibold px-4 py-3 hidden lg:table-cell">Actualizado</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filteredCases.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                                    <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                    <p className="font-medium">No hay casos</p>
                                </td>
                            </tr>
                        ) : (
                            filteredCases.slice(0, 20).map((caso) => {
                                const stageIdx = STAGE_ORDER.indexOf(caso.etapa_actual);
                                const color = stageIdx >= 0 ? STAGE_COLORS[stageIdx] : 'bg-slate-400';

                                return (
                                    <tr key={caso.case_id} className="group hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <Link href={`/cases/${caso.case_id}`} className="hover:text-primary font-medium">
                                                {caso.caratulado}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                                            <span className="truncate block max-w-[140px]">{caso.nombre_cliente}</span>
                                        </td>
                                        <td className="px-4 py-3 hidden md:table-cell">
                                            <Badge variant="outline" className="text-[10px]">{caso.materia}</Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className={cn('h-2 w-2 rounded-full shrink-0', color)} />
                                                <span className="text-xs font-medium">{caso.etapa_actual}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {getPriorityBadge(caso.prioridad)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-muted-foreground text-xs hidden lg:table-cell">
                                            <div className="flex items-center justify-end gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatDate(caso.updated_at)}
                                            </div>
                                        </td>
                                        <td className="px-2 py-3">
                                            <Link href={`/cases/${caso.case_id}`}>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {filteredCases.length > 20 && (
                    <div className="border-t px-4 py-3 text-center text-sm bg-muted/30">
                        <Link href="/cases" className="text-primary hover:underline font-medium">
                            Ver los {filteredCases.length} casos →
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
