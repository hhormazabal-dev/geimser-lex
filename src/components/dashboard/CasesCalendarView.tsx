'use client';

import { Calendar, Clock, MapPin, User, AlertCircle, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useState } from 'react';
import { cn, formatDate } from '@/lib/utils';

interface CaseStage {
    id: string;
    case_id: string;
    caratulado: string;
    materia: string;
    prioridad: string;
    etapa: string;
    fecha_programada: string | null;
    tipo_actuacion: string | null;
    ubicacion: string | null;
    estado: string;
}

interface CasesCalendarViewProps {
    stages: CaseStage[];
}

/**
 * Calendario/Timeline de todos los casos y sus etapas
 * Vista de gestión para abogados - actionable
 */
export function CasesCalendarView({ stages }: CasesCalendarViewProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPriority, setFilterPriority] = useState<string>('all');
    const [filterMateria, setFilterMateria] = useState<string>('all');

    // Filtrar stages
    const filteredStages = stages.filter((stage) => {
        const matchesSearch = stage.caratulado.toLowerCase().includes(searchTerm.toLowerCase()) ||
            stage.etapa.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPriority = filterPriority === 'all' || stage.prioridad === filterPriority;
        const matchesMateria = filterMateria === 'all' || stage.materia === filterMateria;

        return matchesSearch && matchesPriority && matchesMateria;
    });

    // Agrupar por fecha
    const groupedByDate = filteredStages.reduce((groups, stage) => {
        if (!stage.fecha_programada) return groups;

        const date = new Date(stage.fecha_programada).toLocaleDateString('es-CL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(stage);
        return groups;
    }, {} as Record<string, CaseStage[]>);

    const materias = [...new Set(stages.map(s => s.materia))];

    const getPriorityColor = (prioridad: string) => {
        switch (prioridad) {
            case 'urgente': return 'destructive';
            case 'alta': return 'warning';
            case 'media': return 'secondary';
            default: return 'outline';
        }
    };

    const getEtapaIcon = (tipo: string | null) => {
        if (!tipo) return Clock;
        if (tipo.toLowerCase().includes('audiencia')) return User;
        if (tipo.toLowerCase().includes('juicio')) return AlertCircle;
        return Clock;
    };

    return (
        <div className="space-y-6">
            {/* Filtros */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Filter className="h-4 w-4" />
                        Filtros de gestión
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Input
                            placeholder="Buscar caso o etapa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />

                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2"
                            value={filterPriority}
                            onChange={(e) => setFilterPriority(e.target.value)}
                        >
                            <option value="all">Todas las prioridades</option>
                            <option value="urgente">Urgente</option>
                            <option value="alta">Alta</option>
                            <option value="media">Media</option>
                            <option value="baja">Baja</option>
                        </select>

                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2"
                            value={filterMateria}
                            onChange={(e) => setFilterMateria(e.target.value)}
                        >
                            <option value="all">Todas las materias</option>
                            {materias.map((materia) => (
                                <option key={materia} value={materia}>
                                    {materia}
                                </option>
                            ))}
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Calendario/Timeline */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Calendario de actuaciones
                        </CardTitle>
                        <Badge variant="outline">
                            {filteredStages.length} actuaciones programadas
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {Object.keys(groupedByDate).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Calendar className="h-16 w-16 text-muted-foreground/30" />
                            <p className="mt-4 text-sm text-muted-foreground">
                                No hay actuaciones programadas con los filtros seleccionados
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {Object.entries(groupedByDate)
                                .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
                                .map(([date, dayStages]) => (
                                    <div key={date} className="space-y-3">
                                        {/* Fecha Header */}
                                        <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background pb-2">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white">
                                                {dayStages[0]?.fecha_programada
                                                    ? new Date(dayStages[0].fecha_programada).getDate()
                                                    : '?'}
                                            </div>
                                            <div>
                                                <p className="font-semibold capitalize">{date}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {dayStages.length} actuación{dayStages.length > 1 ? 'es' : ''}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actuaciones del día */}
                                        <div className="space-y-2 pl-4">
                                            {dayStages.map((stage) => {
                                                const Icon = getEtapaIcon(stage.tipo_actuacion);
                                                return (
                                                    <Link
                                                        key={stage.id}
                                                        href={`/cases/${stage.case_id}`}
                                                        className="block"
                                                    >
                                                        <div className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary hover:shadow-md">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex items-start gap-3">
                                                                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                                        <Icon className="h-4 w-4" />
                                                                    </div>

                                                                    <div className="flex-1 space-y-1">
                                                                        <p className="font-semibold group-hover:text-primary">
                                                                            {stage.caratulado}
                                                                        </p>
                                                                        <p className="text-sm text-muted-foreground">
                                                                            {stage.etapa}
                                                                            {stage.tipo_actuacion && ` · ${stage.tipo_actuacion}`}
                                                                        </p>

                                                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                                                            <Badge variant="outline" className="gap-1">
                                                                                {stage.materia}
                                                                            </Badge>

                                                                            {stage.ubicacion && (
                                                                                <span className="flex items-center gap-1 text-muted-foreground">
                                                                                    <MapPin className="h-3 w-3" />
                                                                                    {stage.ubicacion}
                                                                                </span>
                                                                            )}

                                                                            <span className="flex items-center gap-1 text-muted-foreground">
                                                                                <Clock className="h-3 w-3" />
                                                                                {new Date(stage.fecha_programada!).toLocaleTimeString('es-CL', {
                                                                                    hour: '2-digit',
                                                                                    minute: '2-digit',
                                                                                })}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <Badge variant={getPriorityColor(stage.prioridad)}>
                                                                    {stage.prioridad}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
