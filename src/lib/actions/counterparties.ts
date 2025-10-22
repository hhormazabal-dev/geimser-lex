'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';
import type { CaseCounterparty } from '@/lib/supabase/types';
import { isValidRut } from '@/lib/validators/case';

const createCounterpartySchema = z.object({
  caseId: z.string().uuid('ID de caso inválido'),
  nombre: z
    .string()
    .min(2, 'El nombre es requerido')
    .max(1000, 'El nombre no puede exceder 1000 caracteres')
    .transform((value) => value.trim()),
  rut: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined)
    .refine((value) => (value ? isValidRut(value) : true), { message: 'RUT inválido' }),
  tipo: z.enum(['demandado', 'demandante', 'tercero']).default('demandado'),
});

const deleteCounterpartySchema = z.object({
  id: z.string().uuid('ID de contraparte inválido'),
});

type CreateCounterpartyResult =
  | { success: true; counterparty: CaseCounterparty }
  | { success: false; error: string };

type DeleteCounterpartyResult = { success: true } | { success: false; error: string };

export async function createCaseCounterparty(
  input: z.infer<typeof createCounterpartySchema>,
): Promise<CreateCounterpartyResult> {
  const profile = await requireAuth(['admin_firma', 'analista', 'abogado']);
  const payload = createCounterpartySchema.parse(input);

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('case_counterparties')
    .insert({
      case_id: payload.caseId,
      nombre: payload.nombre,
      rut: payload.rut ?? null,
      tipo: payload.tipo,
    })
    .select()
    .single<CaseCounterparty>();

  if (error || !data) {
    console.error('[createCaseCounterparty] error inserting counterparty', error);
    return {
      success: false as const,
      error:
        error?.message ?? 'No se pudo agregar la contraparte. Revisa los datos e inténtalo nuevamente.',
    };
  }

  revalidatePath(`/cases/${payload.caseId}`);
  revalidatePath('/cases');

  return {
    success: true as const,
    counterparty: data,
  };
}

export async function deleteCaseCounterparty(
  input: z.infer<typeof deleteCounterpartySchema>,
): Promise<DeleteCounterpartyResult> {
  await requireAuth(['admin_firma', 'analista', 'abogado']);
  const payload = deleteCounterpartySchema.parse(input);

  const supabase = await createServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from('case_counterparties')
    .select('id, case_id')
    .eq('id', payload.id)
    .maybeSingle<{ id: string; case_id: string }>();

  if (fetchError) {
    console.error('[deleteCaseCounterparty] error fetching counterparty', fetchError);
    return { success: false as const, error: 'No encontramos la contraparte seleccionada.' };
  }

  if (!existing) {
    return { success: false as const, error: 'La contraparte ya fue eliminada.' };
  }

  const { error } = await supabase
    .from('case_counterparties')
    .delete()
    .eq('id', payload.id);

  if (error) {
    console.error('[deleteCaseCounterparty] error deleting counterparty', error);
    return {
      success: false as const,
      error: error.message ?? 'No se pudo eliminar la contraparte.',
    };
  }

  revalidatePath(`/cases/${existing.case_id}`);
  revalidatePath('/cases');

  return { success: true as const };
}
