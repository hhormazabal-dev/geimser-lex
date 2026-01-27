'use client';

import { useState } from 'react';
import { Download, Calendar, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
}

interface CalendarSyncPanelProps {
    events: CalendarEvent[];
    userEmail?: string;
}

export function CalendarSyncPanel({ events, userEmail }: CalendarSyncPanelProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const { toast } = useToast();

    const generateICS = (): string => {
        const icsEvents = events.map((event) => {
            const startDate = new Date(event.start).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            const endDate = new Date(event.end).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

            return `BEGIN:VEVENT
UID:${event.id}@geimser-lex.cl
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${event.title}
DESCRIPTION:${event.description || ''}
LOCATION:${event.location || ''}
STATUS:CONFIRMED
END:VEVENT`;
        }).join('\n');

        return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Geimser Lex//Calendario de Audiencias//ES
CALSCALE:GREGORIAN
${icsEvents}
END:VCALENDAR`;
    };

    const handleDownloadICS = () => {
        setIsGenerating(true);

        try {
            const icsContent = generateICS();
            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `geimser-lex-calendar-${new Date().toISOString().split('T')[0]}.ics`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast({
                title: 'Calendario exportado',
                description: 'Archivo .ics descargado. Impórtalo en tu calendario preferido.',
            });
        } catch (error) {
            console.error('Error generating ICS:', error);
            toast({
                title: 'Error al exportar',
                description: 'No se pudo generar el archivo de calendario.',
                variant: 'destructive',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-lg font-semibold text-slate-900">
                            Sincronización de Calendario
                        </CardTitle>
                        <p className="mt-1 text-sm text-slate-500">
                            Exporta tus audiencias y eventos a calendarios externos
                        </p>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {events.length} eventos
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                    <div className="flex gap-3">
                        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-blue-900">
                                ¿Cómo sincronizar tu calendario?
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
                                <li>Haz clic en "Exportar calendario (.ics)"</li>
                                <li>Guarda el archivo en tu dispositivo</li>
                                <li>Abre tu aplicación de calendario (Google Calendar, Outlook, Apple Calendar)</li>
                                <li>Importa el archivo descargado</li>
                            </ol>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                        onClick={handleDownloadICS}
                        disabled={isGenerating || events.length === 0}
                        className="flex items-center gap-2"
                    >
                        <Download className="h-4 w-4" />
                        {isGenerating ? 'Generando...' : 'Exportar calendario (.ics)'}
                    </Button>

                    {/* Future: Add OAuth integration buttons */}
                    <Button variant="outline" disabled className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Sincronizar con Google Calendar
                        <Badge variant="secondary" className="ml-2">Próximamente</Badge>
                    </Button>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-600">
                        <strong>Nota:</strong> La sincronización automática con Google Calendar y Outlook estará disponible próximamente. Mientras tanto, puedes exportar e importar manualmente.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
