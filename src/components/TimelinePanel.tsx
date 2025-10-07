'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  createStage, 
  updateStage, 
  completeStage, 
  deleteStage, 
  getStages 
} from '@/lib/actions/stages';
import { formatDate, formatRelativeTime, isDateInPast } from '@/lib/utils';
import { 
  Clock, 
  CheckCircle, 
  Circle, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar,
  User,
  Loader2
} from 'lucide-react';
import type { CaseStage } from '@/lib/supabase/types';
import type { CreateStageInput } from '@/lib/validators/stages';
import { STAGE_STATUSES, getStageTemplatesByMateria } from '@/lib/validators/stages';

interface TimelinePanelProps {
  caseId: string;
  caseMateria?: string;
  canManageStages?: boolean;
  showPrivateStages?: boolean;
}

export function TimelinePanel({ 
  caseId, 
  caseMateria = 'Civil',
  canManageStages = false,
  showPrivateStages = true 
}: TimelinePanelProps) {
  const [stages, setStages] = useState<CaseStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStage, setNewStage] = useState({
    etapa: '',
    descripcion: '',
    fecha_programada: '',
    es_publica: true,
    isCustom: false,
  });
  const { toast } = useToast();

  const loadStages = async () => {
    setIsLoading(true);
    try {
      const result = await getStages({ case_id: caseId, page: 1, limit: 50 });
      
      if (result.success) {
        setStages(result.stages);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al cargar etapas',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading stages:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al cargar etapas',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStages();
  }, [caseId]);

  const handleCreateStage = async () => {
    if (!newStage.etapa.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre de la etapa es requerido',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const maxOrden = Math.max(...stages.map(s => s.orden || 0), 0);
      
      const stageData: CreateStageInput = {
        case_id: caseId,
        etapa: newStage.etapa.trim(),
        descripcion: newStage.descripcion.trim() || undefined,
        fecha_programada: newStage.fecha_programada || undefined,
        es_publica: newStage.es_publica,
        estado: 'pendiente',
        orden: maxOrden + 1,
      };

      const result = await createStage(stageData);
      
      if (result.success) {
        toast({
          title: 'Etapa creada',
          description: 'La etapa ha sido creada exitosamente',
        });
        setNewStage({ etapa: '', descripcion: '', fecha_programada: '', es_publica: true, isCustom: false });
        setShowAddForm(false);
        await loadStages();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al crear la etapa',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating stage:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al crear la etapa',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCompleteStage = async (stageId: string) => {
    try {
      const result = await completeStage(stageId);
      
      if (result.success) {
        toast({
          title: 'Etapa completada',
          description: 'La etapa ha sido marcada como completada',
        });
        await loadStages();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al completar la etapa',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error completing stage:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al completar la etapa',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta etapa?')) {
      return;
    }

    try {
      const result = await deleteStage(stageId);
      
      if (result.success) {
        toast({
          title: 'Etapa eliminada',
          description: 'La etapa ha sido eliminada exitosamente',
        });
        await loadStages();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al eliminar la etapa',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting stage:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al eliminar la etapa',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'completado':
        return <CheckCircle className='h-5 w-5 text-green-600' />;
      case 'en_proceso':
        return <Clock className='h-5 w-5 text-blue-600' />;
      default:
        return <Circle className='h-5 w-5 text-gray-400' />;
    }
  };

  const getStatusBadge = (estado: string) => {
    const status = STAGE_STATUSES.find(s => s.value === estado);
    if (!status) return null;

    const colorClasses = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[status.color as keyof typeof colorClasses]}`}>
        {status.label}
      </span>
    );
  };

  const filteredStages = showPrivateStages 
    ? stages 
    : stages.filter(stage => stage.es_publica);

  const stageTemplates = getStageTemplatesByMateria(caseMateria);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Clock className='h-5 w-5' />
            Timeline Procesal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-6 w-6 animate-spin' />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='flex items-center gap-2'>
            <Clock className='h-5 w-5' />
            Timeline Procesal ({filteredStages.length})
          </CardTitle>
          {canManageStages && (
            <Button
              size='sm'
              onClick={() => setShowAddForm(!showAddForm)}
              disabled={isCreating}
            >
              <Plus className='h-4 w-4 mr-2' />
              Nueva Etapa
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Formulario para nueva etapa */}
        {showAddForm && canManageStages && (
          <Card className='border-dashed'>
            <CardContent className='pt-6'>
              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Etapa
                  </label>
                  <select
                    value={newStage.isCustom ? 'custom' : newStage.etapa}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'custom') {
                        setNewStage({ ...newStage, etapa: '', descripcion: '', isCustom: true });
                        return;
                      }

                      const template = stageTemplates.find(stage => stage.etapa === value);
                      setNewStage({
                        ...newStage,
                        etapa: value,
                        descripcion: template?.descripcion || newStage.descripcion,
                        isCustom: false,
                      });
                    }}
                    className='form-input'
                  >
                    <option value=''>Seleccionar etapa</option>
                    {stageTemplates.map(stage => (
                      <option key={stage.etapa} value={stage.etapa}>
                        {stage.etapa} {stage.diasEstimados ? `(≈ ${stage.diasEstimados} días)` : ''}
                      </option>
                    ))}
                    <option value='custom'>Etapa personalizada...</option>
                  </select>
                  {newStage.isCustom && (
                    <input
                      type='text'
                      placeholder='Nombre de la etapa personalizada'
                      value={newStage.etapa}
                      onChange={(e) => setNewStage({ ...newStage, etapa: e.target.value })}
                      className='form-input mt-2'
                    />
                  )}
                </div>
                
                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={newStage.descripcion}
                    onChange={(e) => setNewStage({ ...newStage, descripcion: e.target.value })}
                    placeholder='Descripción de la etapa...'
                    rows={3}
                    className='form-input'
                  />
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium mb-2'>
                      Fecha programada (opcional)
                    </label>
                    <input
                      type='date'
                      value={newStage.fecha_programada}
                      onChange={(e) => setNewStage({ ...newStage, fecha_programada: e.target.value })}
                      className='form-input'
                    />
                  </div>

                  <div>
                    <label className='block text-sm font-medium mb-2'>
                      Visibilidad
                    </label>
                    <select
                      value={newStage.es_publica ? 'publica' : 'privada'}
                      onChange={(e) => setNewStage({ ...newStage, es_publica: e.target.value === 'publica' })}
                      className='form-input'
                    >
                      <option value='publica'>Pública (visible para cliente)</option>
                      <option value='privada'>Privada (solo abogados)</option>
                    </select>
                  </div>
                </div>

                <div className='flex justify-end space-x-2'>
                  <Button
                    variant='outline'
                    onClick={() => {
                      setShowAddForm(false);
                      setNewStage({ etapa: '', descripcion: '', fecha_programada: '', es_publica: true, isCustom: false });
                    }}
                    disabled={isCreating}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateStage} disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                        Creando...
                      </>
                    ) : (
                      'Crear Etapa'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline de etapas */}
        <div className='relative'>
          {filteredStages.map((stage, index) => {
            const stageResponsable = (stage as { responsable?: { nombre?: string | null } | null }).responsable;

            return (
              <div key={stage.id} className='relative flex items-start space-x-4 pb-8'>
              {/* Línea vertical */}
              {index < filteredStages.length - 1 && (
                <div className='absolute left-2.5 top-8 w-0.5 h-full bg-gray-200' />
              )}
              
              {/* Icono de estado */}
              <div className='relative z-10 flex-shrink-0'>
                {getStatusIcon(stage.estado || 'pendiente')}
              </div>

              {/* Contenido de la etapa */}
              <div className='flex-1 min-w-0'>
                <Card className={`${stage.estado === 'completado' ? 'bg-green-50' : ''}`}>
                  <CardContent className='pt-4'>
                    <div className='flex items-start justify-between mb-3'>
                      <div className='flex-1'>
                        <h4 className='font-medium text-gray-900'>
                          {stage.etapa}
                        </h4>
                        {stage.descripcion && (
                          <p className='text-sm text-gray-600 mt-1'>
                            {stage.descripcion}
                          </p>
                        )}
                      </div>
                      
                      <div className='flex items-center gap-2 ml-4'>
                        {getStatusBadge(stage.estado || 'pendiente')}
                        {!stage.es_publica && (
                          <Badge variant='outline'>Privada</Badge>
                        )}
                      </div>
                    </div>

                    <div className='flex items-center gap-4 text-sm text-gray-500 mb-3'>
                      {stage.fecha_programada && (
                        <div className='flex items-center gap-1'>
                          <Calendar className='h-4 w-4' />
                          <span className={isDateInPast(stage.fecha_programada) && stage.estado !== 'completado' ? 'text-red-600 font-medium' : ''}>
                            {formatDate(stage.fecha_programada)}
                          </span>
                        </div>
                      )}
                      
                      {stageResponsable?.nombre && (
                        <div className='flex items-center gap-1'>
                          <User className='h-4 w-4' />
                          <span>{stageResponsable.nombre}</span>
                        </div>
                      )}

                      {stage.fecha_cumplida && (
                        <div className='text-green-600'>
                          Completado {formatRelativeTime(stage.fecha_cumplida)}
                        </div>
                      )}
                    </div>

                    {canManageStages && (
                      <div className='flex items-center gap-2'>
                        {stage.estado !== 'completado' && (
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => handleCompleteStage(stage.id)}
                          >
                            <CheckCircle className='h-4 w-4 mr-1' />
                            Completar
                          </Button>
                        )}
                        
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() => setEditingStage(stage.id)}
                        >
                          <Edit className='h-4 w-4' />
                        </Button>
                        
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() => handleDeleteStage(stage.id)}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
            );
          })}
        </div>

        {filteredStages.length === 0 && (
          <div className='text-center py-8 text-gray-500'>
            <Clock className='h-12 w-12 mx-auto mb-4 text-gray-300' />
            <p>No hay etapas definidas para este caso</p>
            {canManageStages && (
              <p className='text-sm mt-2'>
                Haz clic en "Nueva Etapa" para agregar la primera etapa
              </p>
            )}
          </div>
        )}

        {stageTemplates.length > 0 && (
          <div className='border-t pt-4 mt-2'>
            <h3 className='text-sm font-semibold text-gray-700'>Plan estimado de referencia para materia {caseMateria || 'Civil'}</h3>
            <p className='text-xs text-gray-500 mt-1'>Duraciones aproximadas en días a partir del inicio del caso.</p>
            <ul className='mt-3 space-y-2 text-sm text-gray-600'>
              {stageTemplates.map((template, idx) => (
                <li key={`${template.etapa}-${idx}`} className='flex items-start gap-2'>
                  <span className='mt-1 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0' />
                  <span>
                    <span className='font-medium text-gray-800'>{template.etapa}</span>
                    <span className='block text-gray-500'>
                      {template.descripcion}
                      {template.diasEstimados ? ` · ≈ ${template.diasEstimados} días` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
