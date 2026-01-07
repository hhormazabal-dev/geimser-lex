import { z } from 'zod';

export const reassignAcrossOrganizationsSchema = z.object({
  case_id: z.string().uuid('ID de caso inválido'),
  abogado_id: z.string().uuid('ID de abogado inválido'),
  target_org_id: z.string().uuid('ID de empresa inválido'),
});

export type ReassignAcrossOrganizationsInput = z.infer<typeof reassignAcrossOrganizationsSchema>;

