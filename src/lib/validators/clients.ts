import { z } from 'zod';
import { rutSchema } from '@/lib/validators/case';

export const createClientSchema = z.object({
  nombre: z
    .string()
    .min(2, 'El nombre es requerido')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
  email: z
    .string()
    .min(1, 'El correo es requerido')
    .email('Correo inválido')
    .max(255, 'El correo no puede exceder 255 caracteres'),
  rut: rutSchema,
  telefono: z
    .string()
    .max(50, 'El teléfono no puede exceder 50 caracteres')
    .optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
