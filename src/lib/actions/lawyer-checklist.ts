'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';

const createChecklistItemSchema = z.object({
  case_id: z.string().uuid('ID de caso inválido'),
  title: z.string().min(2, 'El título es requerido').max(400, 'El título no puede exceder 400 caracteres'),
});

const toggleChecklistItemSchema = z.object({
  id: z.string().uuid('ID inválido'),
  is_done: z.boolean(),
});

const deleteChecklistItemSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

export type LawyerChecklistItemDTO = {
  id: string;
  case_id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function listLawyerChecklist(caseId: string) {
  try {
    const profile = await requireAuth(['admin_firma', 'abogado', 'analista']);
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('case_lawyer_checklist_items')
      .select('id, case_id, title, is_done, sort_order, created_at, updated_at')
      .eq('case_id', caseId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return {
      success: true as const,
      items: ((data ?? []) as any[]).map((row) => ({
        id: row.id,
        case_id: row.case_id,
        title: row.title,
        is_done: Boolean(row.is_done),
        sort_order: Number(row.sort_order ?? 0),
        created_at: row.created_at,
        updated_at: row.updated_at,
      })) as LawyerChecklistItemDTO[],
      actorRole: profile.role,
    };
  } catch (error) {
    console.error('[checklist] listLawyerChecklist error', error);
    return { success: false as const, items: [] as LawyerChecklistItemDTO[], error: (error as Error).message };
  }
}

export async function createLawyerChecklistItem(input: z.infer<typeof createChecklistItemSchema>) {
  try {
    const profile = await requireAuth(['admin_firma', 'abogado', 'analista']);
    const validated = createChecklistItemSchema.parse(input);
    const supabase = await createServerClient();

    const { data: last, error: lastError } = await supabase
      .from('case_lawyer_checklist_items')
      .select('sort_order')
      .eq('case_id', validated.case_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError && lastError.code !== 'PGRST116') throw lastError;

    const nextOrder = Number((last as any)?.sort_order ?? 0) + 1;
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('case_lawyer_checklist_items')
      .insert({
        case_id: validated.case_id,
        title: validated.title.trim(),
        is_done: false,
        sort_order: nextOrder,
        created_by: profile.id,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id, case_id, title, is_done, sort_order, created_at, updated_at')
      .single();

    if (error) throw error;

    revalidatePath(`/cases/${validated.case_id}`);

    return { success: true as const, item: data as any as LawyerChecklistItemDTO };
  } catch (error) {
    console.error('[checklist] createLawyerChecklistItem error', error);
    return { success: false as const, error: (error as Error).message };
  }
}

export async function toggleLawyerChecklistItem(input: z.infer<typeof toggleChecklistItemSchema>) {
  try {
    await requireAuth(['admin_firma', 'abogado', 'analista']);
    const validated = toggleChecklistItemSchema.parse(input);
    const supabase = await createServerClient();

    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('case_lawyer_checklist_items')
      .update({ is_done: validated.is_done, updated_at: nowIso })
      .eq('id', validated.id)
      .select('id, case_id')
      .single();
    if (error) throw error;

    revalidatePath(`/cases/${(data as any).case_id}`);

    return { success: true as const };
  } catch (error) {
    console.error('[checklist] toggleLawyerChecklistItem error', error);
    return { success: false as const, error: (error as Error).message };
  }
}

export async function deleteLawyerChecklistItem(input: z.infer<typeof deleteChecklistItemSchema>) {
  try {
    await requireAuth(['admin_firma', 'abogado', 'analista']);
    const validated = deleteChecklistItemSchema.parse(input);
    const supabase = await createServerClient();

    const { data: row, error: rowError } = await supabase
      .from('case_lawyer_checklist_items')
      .select('case_id')
      .eq('id', validated.id)
      .single();
    if (rowError) throw rowError;

    const { error } = await supabase.from('case_lawyer_checklist_items').delete().eq('id', validated.id);
    if (error) throw error;

    revalidatePath(`/cases/${(row as any).case_id}`);
    return { success: true as const };
  } catch (error) {
    console.error('[checklist] deleteLawyerChecklistItem error', error);
    return { success: false as const, error: (error as Error).message };
  }
}

