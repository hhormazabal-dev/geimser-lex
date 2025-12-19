'use server';

import { requireAuth } from '@/lib/auth/roles';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

export type PjudLinkPayload = {
  rit?: string | null;
  ruc?: string | null;
  tribunal?: string | null;
  comunaCode?: string | null;
  tribunalId?: string | null;
  tipoJuzgado?: string | null;
};

export type CaseExternalRefRow = {
  id: string;
  case_id: string;
  provider: string;
  external_id: string | null;
  payload: PjudLinkPayload;
  status: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseEventRow = {
  id: string;
  case_id: string;
  provider: string;
  external_event_id: string | null;
  kind: string;
  title: string;
  occurred_at: string;
  data: Record<string, unknown> | null;
  created_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

export async function getCasePjudLink(caseId: string): Promise<{ success: boolean; link?: CaseExternalRefRow | null; error?: string }> {
  try {
    await requireAuth();
    const supabase = (await createServerClient()) as any;

    const { data, error } = await supabase
      .from('case_external_refs')
      .select('*')
      .eq('case_id', caseId)
      .eq('provider', 'pjud')
      .maybeSingle();

    if (error) throw error;
    return { success: true, link: (data as CaseExternalRefRow | null) ?? null };
  } catch (error) {
    console.error('Error in getCasePjudLink:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

export async function upsertCasePjudLink(input: {
  caseId: string;
  externalId?: string | null;
  payload: PjudLinkPayload;
}): Promise<{ success: boolean; link?: CaseExternalRefRow; error?: string }> {
  try {
    await requireAuth(['admin_firma', 'abogado', 'analista']);
    const supabase = (await createServiceClient()) as any;
    const upsertPayload = {
      case_id: input.caseId,
      provider: 'pjud',
      external_id: input.externalId ?? null,
      payload: input.payload ?? {},
      status: 'linked',
      updated_at: nowIso(),
    };

    const { data, error } = await supabase
      .from('case_external_refs')
      .upsert(upsertPayload, { onConflict: 'case_id,provider' })
      .select('*')
      .single();

    if (error) throw error;
    return { success: true, link: data as CaseExternalRefRow };
  } catch (error) {
    console.error('Error in upsertCasePjudLink:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

export async function listCaseEvents(caseId: string, limit = 50): Promise<{ success: boolean; events?: CaseEventRow[]; error?: string }> {
  try {
    await requireAuth();
    const supabase = (await createServerClient()) as any;
    const { data, error } = await supabase
      .from('case_events')
      .select('*')
      .eq('case_id', caseId)
      .order('occurred_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { success: true, events: (data as CaseEventRow[]) ?? [] };
  } catch (error) {
    console.error('Error in listCaseEvents:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

export async function createManualCaseEvent(input: {
  caseId: string;
  kind: 'movement' | 'resolution' | 'deadline' | 'note';
  title: string;
  occurredAt?: string;
  data?: Record<string, unknown>;
}): Promise<{ success: boolean; event?: CaseEventRow; error?: string }> {
  try {
    await requireAuth(['admin_firma', 'abogado', 'analista']);
    const supabase = (await createServerClient()) as any;
    const payload = {
      case_id: input.caseId,
      provider: 'manual',
      external_event_id: null,
      kind: input.kind,
      title: input.title.trim(),
      occurred_at: input.occurredAt ?? nowIso(),
      data: input.data ?? {},
    };

    const { data, error } = await supabase.from('case_events').insert(payload).select('*').single();
    if (error) throw error;
    return { success: true, event: data as CaseEventRow };
  } catch (error) {
    console.error('Error in createManualCaseEvent:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}
