'use client';

import { useState } from 'react';
import { Check, X, UserPlus, Mail, MessageSquare, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface BulkActionsBarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onMarkResolved?: () => Promise<void>;
    onReassign?: () => Promise<void>;
    onAddComment?: () => void;
    onExport?: () => void;
    onSendNotification?: () => void;
}

export function BulkActionsBar({
    selectedCount,
    onClearSelection,
    onMarkResolved,
    onReassign,
    onAddComment,
    onExport,
    onSendNotification,
}: BulkActionsBarProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    const handleAction = async (
        action: (() => Promise<void>) | (() => void) | undefined,
        actionName: string
    ) => {
        if (!action) return;

        setIsProcessing(true);
        try {
            await Promise.resolve(action());
            toast({
                title: 'Acción completada',
                description: `${actionName} ejecutada exitosamente en ${selectedCount} elemento(s).`,
            });
        } catch (error) {
            console.error(`Error in ${actionName}:`, error);
            toast({
                title: 'Error',
                description: `No se pudo completar la acción: ${actionName}`,
                variant: 'destructive',
            });
        } finally {
            setIsProcessing(false);
        }
    };

    if (selectedCount === 0) return null;

    return (
        <div
            className={cn(
                'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
                'animate-in slide-in-from-bottom-8 fade-in-0 duration-300'
            )}
        >
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-2xl backdrop-blur-xl">
                {/* Selection info */}
                <div className="flex items-center gap-3 border-r border-slate-200 pr-4">
                    <Badge variant="default" className="bg-blue-600">
                        {selectedCount}
                    </Badge>
                    <span className="text-sm font-medium text-slate-700">
                        {selectedCount === 1 ? 'elemento seleccionado' : 'elementos seleccionados'}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {onMarkResolved && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(onMarkResolved, 'Marcar como resuelto')}
                            disabled={isProcessing}
                            className="flex items-center gap-2"
                        >
                            <Check className="h-4 w-4" />
                            <span className="hidden sm:inline">Marcar resuelto</span>
                        </Button>
                    )}

                    {onReassign && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(onReassign, 'Reasignar')}
                            disabled={isProcessing}
                            className="flex items-center gap-2"
                        >
                            <UserPlus className="h-4 w-4" />
                            <span className="hidden sm:inline">Reasignar</span>
                        </Button>
                    )}

                    {onAddComment && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                onAddComment();
                            }}
                            disabled={isProcessing}
                            className="flex items-center gap-2"
                        >
                            <MessageSquare className="h-4 w-4" />
                            <span className="hidden sm:inline">Comentario</span>
                        </Button>
                    )}

                    {onSendNotification && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(onSendNotification, 'Enviar notificación')}
                            disabled={isProcessing}
                            className="flex items-center gap-2"
                        >
                            <Mail className="h-4 w-4" />
                            <span className="hidden sm:inline">Notificar</span>
                        </Button>
                    )}

                    {onExport && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                onExport();
                                toast({
                                    title: 'Exportando',
                                    description: `Preparando ${selectedCount} elemento(s) para exportación...`,
                                });
                            }}
                            disabled={isProcessing}
                            className="flex items-center gap-2"
                        >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">Exportar</span>
                        </Button>
                    )}
                </div>

                {/* Clear selection */}
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={onClearSelection}
                    className="ml-2 flex items-center gap-2 text-slate-600 hover:text-slate-900"
                >
                    <X className="h-4 w-4" />
                    <span className="hidden sm:inline">Cancelar</span>
                </Button>
            </div>
        </div>
    );
}
