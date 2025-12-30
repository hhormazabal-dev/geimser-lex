import { z } from 'zod';

export const billingCurrencySchema = z.enum(['UF', 'CLP', 'USD']);
export const billingStatusSchema = z.enum(['pendiente', 'parcial', 'pagado', 'vencido']);

export const createBillingAccountSchema = z.object({
  title: z.string().min(2, 'El título es requerido').max(280, 'El título no puede exceder 280 caracteres'),
  description: z.string().max(4000, 'La descripción no puede exceder 4000 caracteres').optional(),
  currency: billingCurrencySchema.default('UF'),
  amount_total: z.number().nonnegative('El monto total debe ser mayor o igual a 0'),
  due_date: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD'), z.undefined()])
    .optional(),
  case_ids: z.array(z.string().uuid('ID de caso inválido')).min(1, 'Debes vincular al menos un caso'),
  allocations: z.record(z.string().uuid(), z.number().nonnegative()).optional(),
});

export const addBillingPaymentSchema = z.object({
  billing_account_id: z.string().uuid('ID de cobro inválido'),
  amount: z.number().positive('El monto del pago debe ser mayor a 0'),
  paid_at: z.string().optional(),
  method: z.string().max(255).optional(),
  notes: z.string().max(4000).optional(),
});

export type CreateBillingAccountInput = z.infer<typeof createBillingAccountSchema>;
export type AddBillingPaymentInput = z.infer<typeof addBillingPaymentSchema>;

