import { z } from 'zod';

// Schema para subir un documento
export const uploadDocumentSchema = z.object({
  case_id: z.string().uuid('ID de caso inválido'),
  nombre: z
    .string()
    .min(1, 'El nombre del archivo es requerido')
    .max(255, 'El nombre no puede exceder 255 caracteres'),
  visibilidad: z.enum(['privado', 'cliente']).default('privado'),
  file: z.any().optional(), // El archivo se valida en el servidor
});

// Schema para actualizar metadatos de documento
export const updateDocumentSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre del archivo es requerido')
    .max(255, 'El nombre no puede exceder 255 caracteres')
    .optional(),
  visibilidad: z.enum(['privado', 'cliente']).optional(),
});

// Schema para filtros de documentos
export const documentFiltersSchema = z.object({
  case_id: z.string().uuid().optional(),
  visibilidad: z.enum(['privado', 'cliente']).optional(),
  uploader_id: z.string().uuid().optional(),
  tipo_mime: z.string().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// Schema para configuración de upload
export const uploadConfigSchema = z.object({
  maxFileSize: z.number().default(20 * 1024 * 1024), // 20MB por defecto
  allowedTypes: z.array(z.string()).default([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
  ]),
});

// Tipos derivados
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type DocumentFiltersInput = z.infer<typeof documentFiltersSchema>;
export type UploadConfigInput = z.infer<typeof uploadConfigSchema>;

// Constantes
export const DOCUMENT_VISIBILITY = [
  { value: 'privado', label: 'Privado', description: 'Solo visible para abogados' },
  { value: 'cliente', label: 'Cliente', description: 'Visible para el cliente' },
] as const;

export const ALLOWED_FILE_TYPES = {
  'application/pdf': { extension: 'pdf', icon: '📄', name: 'PDF' },
  'application/msword': { extension: 'doc', icon: '📝', name: 'Word' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { 
    extension: 'docx', icon: '📝', name: 'Word' 
  },
  'image/jpeg': { extension: 'jpg', icon: '🖼️', name: 'Imagen' },
  'image/png': { extension: 'png', icon: '🖼️', name: 'Imagen' },
  'image/gif': { extension: 'gif', icon: '🖼️', name: 'Imagen' },
  'text/plain': { extension: 'txt', icon: '📄', name: 'Texto' },
} as const;

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_FILES_PER_CASE = 100;
