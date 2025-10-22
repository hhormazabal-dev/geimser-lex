import { z } from 'zod';

// Schema para crear una solicitud de información
export const createInfoRequestSchema = z.object({
  case_id: z.string().uuid('ID de caso inválido'),
  titulo: z
    .string()
    .min(1, 'El título es requerido')
    .max(1000, 'El título no puede exceder 1000 caracteres'),
  descripcion: z
    .string()
    .min(1, 'La descripción es requerida')
    .max(2000, 'La descripción no puede exceder 2000 caracteres'),
  tipo: z.enum(['documento', 'informacion', 'reunion', 'otro']).default('informacion'),
  prioridad: z.enum(['baja', 'media', 'alta', 'urgente']).default('media'),
  fecha_limite: z.string().optional(),
  es_publica: z.boolean().default(true),
});

// Schema para actualizar una solicitud de información
export const updateInfoRequestSchema = createInfoRequestSchema
  .partial()
  .omit({ case_id: true }); // <- FIX: usar shape, no array

// Schema para responder una solicitud
export const respondInfoRequestSchema = z.object({
  respuesta: z
    .string()
    .min(1, 'La respuesta es requerida')
    .max(2000, 'La respuesta no puede exceder 2000 caracteres'),
  archivo_adjunto: z.string().optional(), // URL del archivo adjunto
});

// Schema para filtros de solicitudes
export const infoRequestFiltersSchema = z.object({
  case_id: z.string().uuid().optional(),
  estado: z.enum(['pendiente', 'en_revision', 'respondida', 'cerrada']).optional(),
  tipo: z.enum(['documento', 'informacion', 'reunion', 'otro']).optional(),
  prioridad: z.enum(['baja', 'media', 'alta', 'urgente']).optional(),
  creador_id: z.string().uuid().optional(),
  es_publica: z.boolean().optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// Tipos derivados
export type CreateInfoRequestInput = z.infer<typeof createInfoRequestSchema>;
export type UpdateInfoRequestInput = z.infer<typeof updateInfoRequestSchema>;
export type RespondInfoRequestInput = z.infer<typeof respondInfoRequestSchema>;
export type InfoRequestFiltersInput = z.infer<typeof infoRequestFiltersSchema>;

// Constantes
export const INFO_REQUEST_TYPES = [
  { value: 'documento', label: 'Documento', description: 'Solicitud de documentos específicos' },
  { value: 'informacion', label: 'Información', description: 'Solicitud de información general' },
  { value: 'reunion', label: 'Reunión', description: 'Solicitud de reunión o cita' },
  { value: 'otro', label: 'Otro', description: 'Otro tipo de solicitud' },
] as const;

export const INFO_REQUEST_STATUSES = [
  { value: 'pendiente', label: 'Pendiente', color: 'yellow' },
  { value: 'en_revision', label: 'En Revisión', color: 'blue' },
  { value: 'respondida', label: 'Respondida', color: 'green' },
  { value: 'cerrada', label: 'Cerrada', color: 'gray' },
] as const;

export const INFO_REQUEST_PRIORITIES = [
  { value: 'baja', label: 'Baja', color: 'gray' },
  { value: 'media', label: 'Media', color: 'blue' },
  { value: 'alta', label: 'Alta', color: 'orange' },
  { value: 'urgente', label: 'Urgente', color: 'red' },
] as const;
