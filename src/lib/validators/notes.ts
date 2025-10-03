import { z } from 'zod';

// Schema para crear una nota
export const createNoteSchema = z.object({
  case_id: z.string().uuid('ID de caso inválido'),
  tipo: z.enum(['privada', 'publica']).default('privada'),
  contenido: z
    .string()
    .min(1, 'El contenido es requerido')
    .max(10000, 'El contenido no puede exceder 10,000 caracteres'),
});

// Schema para actualizar una nota
export const updateNoteSchema = z.object({
  tipo: z.enum(['privada', 'publica']).optional(),
  contenido: z
    .string()
    .min(1, 'El contenido es requerido')
    .max(10000, 'El contenido no puede exceder 10,000 caracteres')
    .optional(),
});

// Schema para filtros de notas
export const noteFiltersSchema = z.object({
  case_id: z.string().uuid().optional(),
  tipo: z.enum(['privada', 'publica']).optional(),
  author_id: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// Tipos derivados
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type NoteFiltersInput = z.infer<typeof noteFiltersSchema>;

// Constantes
export const NOTE_TYPES = [
  { value: 'privada', label: 'Privada', description: 'Solo visible para abogados' },
  { value: 'publica', label: 'Pública', description: 'Visible para el cliente' },
] as const;
