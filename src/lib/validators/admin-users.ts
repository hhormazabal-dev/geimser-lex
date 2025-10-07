import { z } from 'zod';

export const managedUserRoles = ['admin_firma', 'abogado', 'analista', 'cliente'] as const;

/**
 * Campo de texto opcional:
 * - primero validamos longitud máxima en el ZodString puro
 * - luego trim
 * - luego regla de "vacío o >= 2"
 * - finalmente convertimos vacío a undefined
 */
const optionalTextField = z
  .string()
  .max(255, { message: 'Máximo 255 caracteres' })
  .transform((value: string) => value.trim())
  .refine((value) => value.length === 0 || value.length >= 2, {
    message: 'Debe tener al menos 2 caracteres o quedar vacío',
  })
  .transform((value: string) => (value.length === 0 ? undefined : value));

/**
 * Teléfono opcional:
 * - validamos máximo en el ZodString
 * - trim
 * - regla "vacío o >= 6"
 * - vacío a undefined
 */
const telefonoField = z
  .string()
  .max(30, { message: 'Máximo 30 caracteres' })
  .transform((value: string) => value.trim())
  .refine((value) => value.length === 0 || value.length >= 6, {
    message: 'Debe tener al menos 6 dígitos o quedar vacío',
  })
  .transform((value: string) => (value.length === 0 ? undefined : value));

const baseUserSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Email inválido' }).max(255),
  nombre: z
    .string()
    .trim()
    .min(2, { message: 'Debe tener al menos 2 caracteres' })
    .max(255, { message: 'Máximo 255 caracteres' }),
  role: z.enum(managedUserRoles, {
    errorMap: () => ({ message: 'Rol inválido' }),
  }),
  rut: optionalTextField.optional(),
  telefono: telefonoField.optional(),
  activo: z.boolean().optional().default(true),
});

export const createManagedUserSchema = baseUserSchema.extend({
  password: z
    .string()
    .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    .max(72, { message: 'La contraseña no puede exceder los 72 caracteres' }),
});

export const updateManagedUserSchema = baseUserSchema.extend({
  password: z
    .string()
    .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    .max(72, { message: 'La contraseña no puede exceder los 72 caracteres' })
    .optional(),
});

export type CreateManagedUserInput = z.infer<typeof createManagedUserSchema>;
export type UpdateManagedUserInput = z.infer<typeof updateManagedUserSchema>;
export type ManagedUserRole = (typeof managedUserRoles)[number];
