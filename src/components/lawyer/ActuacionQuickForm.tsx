'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, MapPin } from 'lucide-react';

interface ActuacionFormData {
    etapa: string;
    estado: string;
    descripcion: string;
    fecha_programada: string;
    hora: string;
    ubicacion: string;
}

interface ActuacionQuickFormProps {
    caseId: string;
    caseName: string;
    type: 'audiencia' | 'juicio' | 'gestion';
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const TYPE_LABELS = {
    audiencia: 'Audiencia',
    juicio: 'Juicio',
    gestion: 'Gestión',
};

const STAGE_OPTIONS = {
    audiencia: ['Preparatoria', 'Conciliación', 'Prueba', 'Alegatos'],
    juicio: ['Primera Instancia', 'Apelación', 'Casación', 'Ejecutivo'],
    gestion: ['Presentación escrito', 'Respuesta', 'Réplica', 'Seguimiento'],
};

const STATUS_OPTIONS = ['Programada', 'Realizada', 'Suspendida', 'Reprogramada'];

export function ActuacionQuickForm({
    caseId,
    caseName,
    type,
    isOpen,
    onClose,
    onSuccess,
}: ActuacionQuickFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<ActuacionFormData>({
        etapa: '',
        estado: 'Programada',
        descripcion: '',
        fecha_programada: '',
        hora: '',
        ubicacion: '',
    });
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Combine date and time
            const dateTime = formData.fecha_programada && formData.hora
                ? `${formData.fecha_programada}T${formData.hora}`
                : formData.fecha_programada;

            const payload = {
                case_id: caseId,
                etapa: formData.etapa,
                estado: formData.estado,
                descripcion: formData.descripcion.trim() || undefined,
                fecha_programada: dateTime,
                ubicacion: formData.ubicacion.trim() || undefined,
            };

            const response = await fetch('/api/case-stages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error('No se pudo registrar la actuación');
            }

            toast({
                title: 'Actuación registrada',
                description: `${TYPE_LABELS[type]} agregada exitosamente al caso.`,
            });

            // Reset form
            setFormData({
                etapa: '',
                estado: 'Programada',
                descripcion: '',
                fecha_programada: '',
                hora: '',
                ubicacion: '',
            });

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error creating actuación:', error);
            toast({
                title: 'Error',
                description: (error as Error).message || 'No se pudo registrar la actuación',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Registrar {TYPE_LABELS[type]}</DialogTitle>
                    <DialogDescription>
                        Agrega una nueva actuación para el caso: <strong>{caseName}</strong>
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Etapa */}
                    <div className="space-y-2">
                        <Label htmlFor="etapa">Etapa *</Label>
                        <select
                            id="etapa"
                            value={formData.etapa}
                            onChange={(e) => setFormData({ ...formData, etapa: e.target.value })}
                            className="form-input w-full"
                            required
                        >
                            <option value="">Seleccionar etapa...</option>
                            {STAGE_OPTIONS[type].map((stage) => (
                                <option key={stage} value={stage}>
                                    {stage}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Estado */}
                    <div className="space-y-2">
                        <Label htmlFor="estado">Estado *</Label>
                        <select
                            id="estado"
                            value={formData.estado}
                            onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                            className="form-input w-full"
                            required
                        >
                            {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Fecha y Hora */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fecha" className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Fecha *
                            </Label>
                            <Input
                                id="fecha"
                                type="date"
                                value={formData.fecha_programada}
                                onChange={(e) => setFormData({ ...formData, fecha_programada: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="hora" className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Hora
                            </Label>
                            <Input
                                id="hora"
                                type="time"
                                value={formData.hora}
                                onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Ubicación */}
                    <div className="space-y-2">
                        <Label htmlFor="ubicacion" className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Ubicación
                        </Label>
                        <Input
                            id="ubicacion"
                            value={formData.ubicacion}
                            onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                            placeholder="Ej: Tribunal Civil de Santiago, Sala 3"
                        />
                    </div>

                    {/* Descripción */}
                    <div className="space-y-2">
                        <Label htmlFor="descripcion">Descripción</Label>
                        <Textarea
                            id="descripcion"
                            value={formData.descripcion}
                            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                            rows={3}
                            placeholder="Detalles adicionales sobre la actuación..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Guardando...' : 'Guardar actuación'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
