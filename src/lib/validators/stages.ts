import { z } from 'zod';

// Schema para crear una etapa procesal
export const createStageSchema = z.object({
  case_id: z.string().uuid('ID de caso inválido'),
  etapa: z
    .string()
    .min(1, 'El nombre de la etapa es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  descripcion: z.string().optional(),
  fecha_programada: z.string().optional(),
  fecha_completada: z.string().optional(),
  estado: z.enum(['pendiente', 'en_progreso', 'completada', 'cancelada']).default('pendiente'),
  es_publica: z.boolean().default(true),
  orden: z.number().int().positive('El orden debe ser un número positivo'),
  responsable_id: z.string().uuid('ID de responsable inválido').optional(),
});

// Schema para actualizar una etapa procesal
export const updateStageSchema = createStageSchema.partial().omit(['case_id']);

// Schema para completar una etapa
export const completeStageSchema = z.object({
  fecha_completada: z.string().optional(),
  observaciones: z.string().optional(),
});

// Schema para filtros de etapas
export const stageFiltersSchema = z.object({
  case_id: z.string().uuid().optional(),
  estado: z.enum(['pendiente', 'en_progreso', 'completada', 'cancelada']).optional(),
  responsable_id: z.string().uuid().optional(),
  es_publica: z.boolean().optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// Tipos derivados
export type CreateStageInput = z.infer<typeof createStageSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
export type CompleteStageInput = z.infer<typeof completeStageSchema>;
export type StageFiltersInput = z.infer<typeof stageFiltersSchema>;

// Constantes para etapas procesales chilenas
export const ETAPAS_PROCESALES_CHILE = [
  // Proceso Civil
  { categoria: 'Civil', etapas: [
    'Ingreso Demanda',
    'Notificación Demandado',
    'Contestación Demanda',
    'Dúplica',
    'Audiencia Preparatoria',
    'Audiencia de Juicio',
    'Sentencia',
    'Recurso de Apelación',
    'Cumplimiento Sentencia',
  ]},
  
  // Proceso Laboral
  { categoria: 'Laboral', etapas: [
    'Ingreso Demanda',
    'Notificación Empleador',
    'Contestación',
    'Audiencia Preparatoria',
    'Audiencia de Juicio',
    'Sentencia',
    'Recurso de Nulidad',
    'Cumplimiento',
  ]},
  
  // Proceso Penal
  { categoria: 'Penal', etapas: [
    'Denuncia/Querella',
    'Formalización',
    'Investigación',
    'Audiencia Preparatoria',
    'Juicio Oral',
    'Sentencia',
    'Recurso de Apelación',
    'Cumplimiento',
  ]},
  
  // Proceso Familia
  { categoria: 'Familia', etapas: [
    'Ingreso Demanda',
    'Notificación',
    'Contestación',
    'Audiencia Preparatoria',
    'Audiencia de Juicio',
    'Sentencia',
    'Cumplimiento',
  ]},
] as const;

export const STAGE_STATUSES = [
  { value: 'pendiente', label: 'Pendiente', color: 'gray' },
  { value: 'en_progreso', label: 'En Progreso', color: 'blue' },
  { value: 'completada', label: 'Completada', color: 'green' },
  { value: 'cancelada', label: 'Cancelada', color: 'red' },
] as const;

// Función para obtener etapas por materia
export function getStagesByMateria(materia: string): string[] {
  const categoria = ETAPAS_PROCESALES_CHILE.find(cat => 
    cat.categoria.toLowerCase() === materia.toLowerCase()
  );
  
  return categoria ? categoria.etapas : ETAPAS_PROCESALES_CHILE[0].etapas;
}
