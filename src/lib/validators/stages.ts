import { z } from 'zod';

// Schema para crear una etapa procesal
export const createStageSchema = z.object({
  case_id: z.string().uuid('ID de caso inválido'),
  etapa: z
    .string()
    .min(1, 'El nombre de la etapa es requerido')
    .max(1000, 'El nombre no puede exceder 1000 caracteres'),
  descripcion: z.string().optional(),
  fecha_programada: z.string().optional(),
  fecha_completada: z.string().optional(),
  estado: z.enum(['pendiente', 'en_proceso', 'completado']).default('pendiente'),
  es_publica: z.boolean().default(true),
  orden: z.number().int().positive('El orden debe ser un número positivo'),
  responsable_id: z.string().uuid('ID de responsable inválido').optional(),
  audiencia_tipo: z.enum(['preparatoria', 'juicio']).optional(),
  requiere_testigos: z.boolean().default(false),
  requiere_pago: z.boolean().default(false),
  costo_uf: z.number().min(0, 'El costo debe ser positivo').optional(),
  porcentaje_variable: z.number().min(0, 'El porcentaje debe ser positivo').max(100, 'El porcentaje no puede exceder 100').optional(),
  estado_pago: z
    .enum(['pendiente', 'en_proceso', 'parcial', 'pagado', 'vencido'])
    .default('pendiente'),
  enlace_pago: z.string().url('Debe ser una URL válida').optional(),
  notas_pago: z.string().max(1000, 'Las notas no pueden exceder 1000 caracteres').optional(),
  monto_variable_base: z.string().optional(),
  monto_pagado_uf: z.number().min(0, 'El monto pagado debe ser positivo').optional(),
});

// ✅ FIX 1: usar shape en omit, no un array
export const updateStageSchema = createStageSchema.partial().omit({ case_id: true });

// Schema para completar una etapa
export const completeStageSchema = z.object({
  fecha_completada: z.string().optional(),
  observaciones: z.string().optional(),
});

// Schema para filtros de etapas
export const stageFiltersSchema = z.object({
  case_id: z.string().uuid().optional(),
  estado: z.enum(['pendiente', 'en_proceso', 'completado']).optional(),
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
export interface StageTemplate {
  etapa: string;
  descripcion: string;
  diasEstimados: number;
  esPublica?: boolean;
  requierePago?: boolean;
  costoUF?: number;
  porcentajeVariable?: number;
  porcentajeHonorario?: number;
  notasPago?: string;
}

const STAGE_PRICING_DISTRIBUTION: Partial<Record<'Civil' | 'Comercial' | 'Laboral' | 'Familia', number[]>> = {
  Civil: [0.15, 0.1, 0.1, 0.1, 0.15, 0.2, 0.1, 0.05, 0.05],
  Comercial: [0.2, 0.15, 0.15, 0.2, 0.15, 0.1, 0.05],
  Laboral: [0.2, 0.2, 0.2, 0.2, 0.1, 0.1],
  Familia: [0.2, 0.15, 0.15, 0.15, 0.2, 0.15],
};

// ✅ Tipamos el Record con claves literales conocidas
const PROCEDURE_STAGE_TEMPLATES: Record<
  'Civil' | 'Comercial' | 'Laboral' | 'Familia',
  StageTemplate[]
> = {
  Civil: [
    { etapa: 'Ingreso Demanda', descripcion: 'Presentación de la demanda con antecedentes y revisión formal del tribunal.', diasEstimados: 0 },
    { etapa: 'Notificación a la contraparte', descripcion: 'Gestiones de notificación personal o por cédula al demandado.', diasEstimados: 30 },
    { etapa: 'Contestación de la demanda', descripcion: 'Plazo legal para que la contraparte conteste y proponga excepciones.', diasEstimados: 20 },
    { etapa: 'Réplicas y dúplicas', descripcion: 'Intercambio de escritos aclarando puntos controvertidos.', diasEstimados: 15 },
    { etapa: 'Audiencia preparatoria', descripcion: 'Fijación de puntos de prueba y acuerdos probatorios.', diasEstimados: 30 },
    { etapa: 'Periodo probatorio', descripcion: 'Recepción de declaraciones, oficios, peritajes y documental.', diasEstimados: 45 },
    { etapa: 'Alegatos y vista de la causa', descripcion: 'Audiencia de cierre donde las partes exponen sus argumentos finales.', diasEstimados: 20 },
    { etapa: 'Sentencia de primera instancia', descripcion: 'Redacción y publicación del fallo por el tribunal.', diasEstimados: 60 },
    { etapa: 'Recursos y cumplimiento', descripcion: 'Interposición de recursos o cumplimiento voluntario/forzado.', diasEstimados: 30 },
  ],
  Comercial: [
    { etapa: 'Ingreso Demanda', descripcion: 'Presentación de la demanda y verificación formal.', diasEstimados: 0 },
    { etapa: 'Notificación demandado', descripcion: 'Gestión de notificación a la contraparte y acreditación en autos.', diasEstimados: 20 },
    { etapa: 'Contestación y reconvención', descripcion: 'Respuesta del demandado y eventuales reconvenciones.', diasEstimados: 20 },
    { etapa: 'Audiencia preparatoria', descripcion: 'Determinación de hechos a probar y medios de prueba.', diasEstimados: 25 },
    { etapa: 'Prueba y alegatos', descripcion: 'Producción de prueba documental, testimonial y alegatos finales.', diasEstimados: 40 },
    { etapa: 'Sentencia', descripcion: 'Decisión del tribunal y notificación a las partes.', diasEstimados: 45 },
    { etapa: 'Ejecución o recursos', descripcion: 'Cumplimiento del fallo o tramitación de recursos.', diasEstimados: 30 },
  ],
  Laboral: [
    { etapa: 'Ingreso tutela o demanda laboral', descripcion: 'Ingreso del escrito y asignación de audiencia preliminar.', diasEstimados: 0 },
    { etapa: 'Citaciones y notificación empleador', descripcion: 'Notificación de la demanda y citación a audiencia preparatoria.', diasEstimados: 10 },
    { etapa: 'Audiencia preparatoria', descripcion: 'Intento de conciliación y fijación de puntos controvertidos.', diasEstimados: 15 },
    { etapa: 'Audiencia de juicio', descripcion: 'Producción de prueba y alegatos finales.', diasEstimados: 20 },
    { etapa: 'Sentencia laboral', descripcion: 'Pronunciamiento del tribunal y notificación a las partes.', diasEstimados: 15 },
    { etapa: 'Cumplimiento / Recurso de nulidad', descripcion: 'Tramitación de recursos o ejecución de la sentencia.', diasEstimados: 20 },
  ],
  Familia: [
    { etapa: 'Ingreso demanda o escrito inicial', descripcion: 'Ingreso de medida de protección o demanda ante tribunal de familia.', diasEstimados: 0 },
    { etapa: 'Notificación y citación a audiencia', descripcion: 'Notificación a la contraparte y citación a audiencia preparatoria.', diasEstimados: 10 },
    { etapa: 'Audiencia preparatoria', descripcion: 'Determinación de puntos controvertidos y acumulación de prueba.', diasEstimados: 15 },
    { etapa: 'Audiencia de juicio', descripcion: 'Presentación de prueba, declaraciones y alegatos.', diasEstimados: 20 },
    { etapa: 'Sentencia', descripcion: 'Redacción y comunicación del fallo.', diasEstimados: 20 },
    { etapa: 'Cumplimiento y seguimiento', descripcion: 'Ejecución de medidas decretadas y seguimiento del cumplimiento.', diasEstimados: 25 },
  ],
};

// ✅ FIX 2 y 3: siempre devolver StageTemplate[] (sin undefined)
export function getStageTemplatesByMateria(materia: string): StageTemplate[] {
  if (!materia) return PROCEDURE_STAGE_TEMPLATES.Civil;

  const lower = materia.toLowerCase();
  const keys = Object.keys(PROCEDURE_STAGE_TEMPLATES) as Array<
    keyof typeof PROCEDURE_STAGE_TEMPLATES
  >;

  const key = keys.find(k => k.toLowerCase() === lower);
  const templates = key ? PROCEDURE_STAGE_TEMPLATES[key] : PROCEDURE_STAGE_TEMPLATES.Civil;
  const distribution =
    key && STAGE_PRICING_DISTRIBUTION[key]
      ? STAGE_PRICING_DISTRIBUTION[key]!
      : STAGE_PRICING_DISTRIBUTION.Civil ?? [];

  return templates.map((template, index) => ({
    ...template,
    porcentajeHonorario: (distribution[index] ?? 0) as number,
  }));
}

export const STAGE_AUDIENCE_TYPES = [
  { value: 'preparatoria', label: 'Audiencia preparatoria' },
  { value: 'juicio', label: 'Audiencia de juicio' },
] as const;

export const STAGE_STATUSES = [
  { value: 'pendiente', label: 'Pendiente', color: 'gray' },
  { value: 'en_proceso', label: 'En Proceso', color: 'blue' },
  { value: 'completado', label: 'Completado', color: 'green' },
] as const;

export const STAGE_PAYMENT_STATUSES = [
  { value: 'pendiente', label: 'Pendiente', color: 'gray' },
  { value: 'solicitado', label: 'Solicitado por cliente', color: 'blue' },
  { value: 'en_proceso', label: 'En proceso', color: 'amber' },
  { value: 'parcial', label: 'Pago parcial', color: 'blue' },
  { value: 'pagado', label: 'Pagado', color: 'green' },
  { value: 'vencido', label: 'Vencido', color: 'red' },
] as const;
