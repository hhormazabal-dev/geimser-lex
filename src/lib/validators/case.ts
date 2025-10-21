import { z } from 'zod';

// ---------- Util: validador RUT ----------
export function isValidRut(rut?: unknown): boolean {
  // rut es opcional y debe ser string no vacío
  if (typeof rut !== 'string' || rut.trim().length === 0) return true;

  const clean = rut.replace(/[^0-9kK]/g, '');
  if (clean.length < 8 || clean.length > 9) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();

  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    // body[i] es siempre char numérico en este punto
    sum += parseInt(body[i] as string, 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }

  const mod = 11 - (sum % 11);
  const calcDV = mod === 11 ? '0' : mod === 10 ? 'K' : String(mod);
  return dv === calcDV;
}

// Validador para RUT chileno (opcional)
export const rutSchema = z.string().optional().refine(isValidRut, { message: 'RUT inválido' });

// ---------- Base schema ----------
const baseCaseSchema = z.object({
  numero_causa: z.string().optional(),
  caratulado: z
    .string()
    .min(1, 'El caratulado es requerido')
    .max(500, 'El caratulado no puede exceder 500 caracteres'),
  materia: z
    .string()
    .min(1, 'La materia es requerida')
    .max(100, 'La materia no puede exceder 100 caracteres'),
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
  analista_id: z.string().uuid('ID de analista inválido').optional(),
  cliente_principal_id: z.string().uuid('ID de cliente inválido').optional(),
  workflow_state: z
    .enum(['preparacion', 'en_revision', 'activo', 'cerrado'])
    .default('preparacion'),
  prioridad: z.enum(['baja', 'media', 'alta', 'urgente']).default('media'),
  valor_estimado: z.number().positive('El valor debe ser positivo').optional(),
  honorario_total_uf: z.number().nonnegative('El honorario total debe ser positivo').optional(),
  honorario_pagado_uf: z.number().nonnegative('El monto pagado debe ser positivo').optional(),
  honorario_variable_porcentaje: z
    .number()
    .min(0, 'El porcentaje variable debe ser positivo')
    .max(100, 'El porcentaje variable no puede superar 100%')
    .optional(),
  honorario_variable_base: z.string().max(1000, 'La base variable no puede exceder 1000 caracteres').optional(),
  honorario_moneda: z.enum(['UF', 'CLP', 'USD']).default('UF'),
  modalidad_cobro: z.enum(['prepago', 'postpago', 'mixto']).default('prepago'),
  honorario_notas: z.string().max(2000, 'Las notas no pueden exceder 2000 caracteres').optional(),
  tarifa_referencia: z.string().max(200, 'El identificador de tarifa no puede exceder 200 caracteres').optional(),
  observaciones: z.string().optional(),
  descripcion_inicial: z
    .string()
    .min(20, 'Describe el contexto del caso con al menos 20 caracteres')
    .max(2000, 'La descripción inicial no puede exceder 2000 caracteres'),
  objetivo_cliente: z.string().max(1000, 'El objetivo del cliente no puede exceder 1000 caracteres').optional(),
  documentacion_recibida: z
    .string()
    .max(2000, 'El listado de documentación no puede exceder 2000 caracteres')
    .optional(),
  validado_at: z.string().optional().nullable(),
  marcar_validado: z.boolean().optional(),
});

type BaseCaseSchema = z.infer<typeof baseCaseSchema>;

// ---------- helper de validación común ----------
function validateWorkflowCommon(data: Partial<BaseCaseSchema>, ctx: z.RefinementCtx) {
  if (data.marcar_validado) {
    if (!data.abogado_responsable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debes asignar un abogado responsable para validar el caso',
        path: ['abogado_responsable'],
      });
    }
    if (!data.cliente_principal_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debes vincular al menos un cliente principal para validar el caso',
        path: ['cliente_principal_id'],
      });
    }
  }
}

// ---------- Schemas públicos ----------
export const createCaseSchema = baseCaseSchema.superRefine((data, ctx) => {
  // aquí data es BaseCaseSchema (no-partial)
  validateWorkflowCommon(data, ctx);
  if (
    typeof data.honorario_total_uf === 'number' &&
    typeof data.honorario_pagado_uf === 'number' &&
    data.honorario_pagado_uf > data.honorario_total_uf
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El monto pagado no puede superar el honorario total.',
      path: ['honorario_pagado_uf'],
    });
  }
});

export const updateCaseSchema = baseCaseSchema.partial().superRefine((data, ctx) => {
  // aquí data es Partial<BaseCaseSchema>
  validateWorkflowCommon(data as Partial<BaseCaseSchema>, ctx);
  if (
    data.honorario_total_uf !== undefined &&
    data.honorario_pagado_uf !== undefined &&
    data.honorario_pagado_uf > (data.honorario_total_uf ?? 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El monto pagado no puede superar el honorario total.',
      path: ['honorario_pagado_uf'],
    });
  }
});

export const createCaseFromBriefSchema = z.object({
  brief: z
    .string()
    .min(10, 'El brief debe tener al menos 10 caracteres')
    .max(2000, 'El brief no puede exceder 2000 caracteres'),
  overrides: baseCaseSchema.partial().optional(),
});

export const assignLawyerSchema = z.object({
  case_id: z.string().uuid('ID de caso inválido'),
  abogado_id: z.string().uuid('ID de abogado inválido'),
});

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

export const caseStatsSchema = z.object({
  abogado_id: z.string().uuid().optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
});

// ---------- Tipos ----------
export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type CreateCaseFromBriefInput = z.infer<typeof createCaseFromBriefSchema>;
export type AssignLawyerInput = z.infer<typeof assignLawyerSchema>;
export type CaseFiltersInput = z.infer<typeof caseFiltersSchema>;
export type CaseStatsInput = z.infer<typeof caseStatsSchema>;

// ---------- Constantes ----------
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

export const CASE_WORKFLOW_STATES = [
  { value: 'preparacion', label: 'Preparación' },
  { value: 'en_revision', label: 'Revisión interna' },
  { value: 'activo', label: 'Activo' },
  { value: 'cerrado', label: 'Cerrado' },
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
  "O'Higgins",
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
