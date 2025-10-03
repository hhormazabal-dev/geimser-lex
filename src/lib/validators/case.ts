import { z } from 'zod';

// Validador para RUT chileno
const rutSchema = z
  .string()
  .optional()
  .refine(
    (rut) => {
      if (!rut) return true; // RUT es opcional
      
      // Limpiar el RUT
      const cleanRUT = rut.replace(/[^0-9kK]/g, '');
      
      if (cleanRUT.length < 8 || cleanRUT.length > 9) {
        return false;
      }

      const body = cleanRUT.slice(0, -1);
      const dv = cleanRUT.slice(-1).toUpperCase();

      // Calcular dígito verificador
      let sum = 0;
      let multiplier = 2;

      for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
      }

      const remainder = sum % 11;
      const calculatedDV = remainder < 2 ? remainder.toString() : 'K';

      return dv === calculatedDV;
    },
    {
      message: 'RUT inválido',
    }
  );

// Schema para crear un caso
export const createCaseSchema = z.object({
  numero_causa: z.string().optional(),
  caratulado: z
    .string()
    .min(1, 'El caratulado es requerido')
    .max(500, 'El caratulado no puede exceder 500 caracteres'),
  materia: z.string().optional(),
  tribunal: z.string().optional(),
  region: z.string().optional(),
  comuna: z.string().optional(),
  rut_cliente: rutSchema,
  nombre_cliente: z
    .string()
    .min(1, 'El nombre del cliente es requerido')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
  contraparte: z.string().optional(),
  etapa_actual: z.string().default('Ingreso Demanda'),
  estado: z.enum(['activo', 'suspendido', 'archivado', 'terminado']).default('activo'),
  fecha_inicio: z.string().optional(),
  abogado_responsable: z.string().uuid('ID de abogado inválido').optional(),
  prioridad: z.enum(['baja', 'media', 'alta', 'urgente']).default('media'),
  valor_estimado: z.number().positive('El valor debe ser positivo').optional(),
  observaciones: z.string().optional(),
});

// Schema para actualizar un caso
export const updateCaseSchema = createCaseSchema.partial();

// Schema para crear un caso desde un brief
export const createCaseFromBriefSchema = z.object({
  brief: z
    .string()
    .min(10, 'El brief debe tener al menos 10 caracteres')
    .max(2000, 'El brief no puede exceder 2000 caracteres'),
  overrides: createCaseSchema.partial().optional(),
});

// Schema para asignar abogado
export const assignLawyerSchema = z.object({
  case_id: z.string().uuid('ID de caso inválido'),
  abogado_id: z.string().uuid('ID de abogado inválido'),
});

// Schema para filtros de casos
export const caseFiltersSchema = z.object({
  estado: z.enum(['activo', 'suspendido', 'archivado', 'terminado']).optional(),
  prioridad: z.enum(['baja', 'media', 'alta', 'urgente']).optional(),
  abogado_responsable: z.string().uuid().optional(),
  materia: z.string().optional(),
  fecha_inicio_desde: z.string().optional(),
  fecha_inicio_hasta: z.string().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

// Schema para estadísticas de casos
export const caseStatsSchema = z.object({
  abogado_id: z.string().uuid().optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
});

// Tipos derivados
export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type CreateCaseFromBriefInput = z.infer<typeof createCaseFromBriefSchema>;
export type AssignLawyerInput = z.infer<typeof assignLawyerSchema>;
export type CaseFiltersInput = z.infer<typeof caseFiltersSchema>;
export type CaseStatsInput = z.infer<typeof caseStatsSchema>;

// Constantes para opciones
export const CASE_STATUSES = [
  { value: 'activo', label: 'Activo' },
  { value: 'suspendido', label: 'Suspendido' },
  { value: 'archivado', label: 'Archivado' },
  { value: 'terminado', label: 'Terminado' },
] as const;

export const CASE_PRIORITIES = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
] as const;

export const CASE_MATERIAS = [
  'Laboral',
  'Civil',
  'Comercial',
  'Penal',
  'Familia',
  'Tributario',
  'Administrativo',
  'Constitucional',
  'Ambiental',
  'Propiedad Intelectual',
] as const;

export const REGIONES_CHILE = [
  'Arica y Parinacota',
  'Tarapacá',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaíso',
  'Metropolitana',
  'O\'Higgins',
  'Maule',
  'Ñuble',
  'Biobío',
  'La Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén',
  'Magallanes',
] as const;

export const ETAPAS_PROCESALES = [
  'Ingreso Demanda',
  'Notificación',
  'Contestación',
  'Audiencia Preparación',
  'Audiencia Juicio',
  'Sentencia',
  'Recurso',
  'Cumplimiento',
] as const;
