import { z } from 'zod';

// Schema para generar un magic link
export const generateMagicLinkSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .min(1, 'El email es requerido'),
  case_id: z.string().uuid('ID de caso inválido'),
  expires_in_hours: z.number().min(1).max(168).default(24), // Máximo 7 días
  permissions: z.array(z.enum(['view_case', 'view_documents', 'create_requests', 'view_timeline'])).default(['view_case']),
});

// Schema para validar un magic link
export const validateMagicLinkSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
});

// Schema para crear un cliente desde magic link
export const createClientFromMagicLinkSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
  telefono: z.string().optional(),
  rut: z.string().optional(),
});

// Schema para filtros de magic links
export const magicLinkFiltersSchema = z.object({
  case_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  is_used: z.boolean().optional(),
  is_expired: z.boolean().optional(),
  created_by: z.string().uuid().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// Tipos derivados
export type GenerateMagicLinkInput = z.infer<typeof generateMagicLinkSchema>;
export type ValidateMagicLinkInput = z.infer<typeof validateMagicLinkSchema>;
export type CreateClientFromMagicLinkInput = z.infer<typeof createClientFromMagicLinkSchema>;
export type MagicLinkFiltersInput = z.infer<typeof magicLinkFiltersSchema>;

// Constantes
export const MAGIC_LINK_PERMISSIONS = [
  { value: 'view_case', label: 'Ver información del caso', description: 'Permite ver detalles básicos del caso' },
  { value: 'view_documents', label: 'Ver documentos', description: 'Permite descargar documentos compartidos' },
  { value: 'create_requests', label: 'Crear solicitudes', description: 'Permite crear solicitudes de información' },
  { value: 'view_timeline', label: 'Ver timeline', description: 'Permite ver el progreso del caso' },
] as const;

export const DEFAULT_EXPIRATION_HOURS = 24;
export const MAX_EXPIRATION_HOURS = 168; // 7 días
