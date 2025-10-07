'use server';

import { createServerClient } from '@/lib/supabase/server';
import { getCurrentProfile, requireAuth } from '@/lib/auth/roles';
import type {
  CaseMessage,
  CaseMessageInsert,
  UserRole,
} from '@/lib/supabase/types';

/**
 * DTO que usa el UI (incluye join del sender y created_at explícito)
 */
export type CaseMessageDTO = {
  id: string;
  case_id: string;
  sender_profile_id: string;
  contenido: string;
  created_at: string;            // <- requerido por tu UI
  attachment_url: string | null;
  audience: string | null;
  sender?: {
    id: string;
    nombre: string;
    role: UserRole;
  } | null;
};

/**
 * Mapea una fila de DB + join a DTO estable
 */
function toDTO(row: any): CaseMessageDTO {
  return {
    id: row.id,
    case_id: row.case_id,
    sender_profile_id: row.sender_profile_id,
    contenido: row.contenido,
    created_at: row.created_at, // string ISO
    attachment_url: row.attachment_url ?? null,
    audience: row.audience ?? null,
    sender: row.sender
      ? {
          id: row.sender.id,
          nombre: row.sender.nombre,
          role: row.sender.role,
        }
      : null,
  };
}

/**
 * Lista mensajes de un caso (ordenados por fecha ascendente)
 */
export async function listCaseMessages(
  caseId: string,
  opts?: { limit?: number }
): Promise<CaseMessageDTO[]> {
  await requireAuth(); // asegura sesión
  const supabase = await createServerClient();

  const limit = opts?.limit ?? 100;

  const { data, error } = await supabase
    .from('case_messages')
    .select('*, sender:profiles(id, nombre, role)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('listCaseMessages error:', error);
    throw new Error('No fue posible obtener los mensajes');
  }

  return (data ?? []).map(toDTO);
}

/**
 * Envía un mensaje al hilo del caso
 */
export async function sendCaseMessage(input: {
  caseId: string;
  contenido: string;
  audience?: string | null;
  attachment_url?: string | null;
}): Promise<CaseMessageDTO> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('No autenticado');

  const supabase = await createServerClient();

  // Construimos el insert sin undefined (respetando exactOptionalPropertyTypes)
  const payload: CaseMessageInsert = {
    case_id: input.caseId,
    sender_profile_id: profile.id,
    contenido: input.contenido,
    audience: input.audience ?? null,
    attachment_url: input.attachment_url ?? null,
    // created_at lo setea la DB por default; no lo pasamos para no romper exactOptionalPropertyTypes
  };

  const { data, error } = await supabase
    .from('case_messages')
    .insert(payload)
    .select('*, sender:profiles(id, nombre, role)')
    .single();

  if (error) {
    console.error('sendCaseMessage error:', error);
    throw new Error('No se pudo enviar el mensaje');
  }

  return toDTO(data);
}
