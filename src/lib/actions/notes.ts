'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getCurrentProfile, requireAuth, canAccessCase } from '@/lib/auth/roles';
import { logAuditAction } from '@/lib/audit/log';
import {
  createNoteSchema,
  updateNoteSchema,
  noteFiltersSchema,
  type CreateNoteInput,
  type UpdateNoteInput,
  type NoteFiltersInput,
} from '@/lib/validators/notes';
import type { Note, NoteInsert } from '@/lib/supabase/types';

/**
 * Crea una nueva nota
 */
export async function createNote(input: CreateNoteInput) {
  try {
    const profile = await requireAuth();
    const validatedInput = createNoteSchema.parse(input);

    // Verificar acceso al caso
    const hasAccess = await canAccessCase(validatedInput.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para acceder a este caso');
    }

    // Solo abogados y admin pueden crear notas
    if (profile.role === 'cliente') {
      throw new Error('Sin permisos para crear notas');
    }

    const supabase = await createServerClient();

    const noteData: NoteInsert = {
      ...validatedInput,
      author_id: profile.id,
    };

    const { data: newNote, error } = await supabase
      .from('notes')
      .insert(noteData)
      .select(
        `
        *,
        author:profiles(nombre),
        case:cases(caratulado)
      `
      )
      .single();

    if (error) {
      console.error('Error creating note:', error);
      throw new Error('Error al crear la nota');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'CREATE',
      entity_type: 'note',
      entity_id: newNote.id,
      diff_json: { created: noteData },
    });

    // Si es una nota pública, podríamos enviar notificación al cliente
    if (validatedInput.tipo === 'publica') {
      // TODO: Implementar notificación por email
    }

    revalidatePath(`/cases/${validatedInput.case_id}`);

    return { success: true, note: newNote };
  } catch (error) {
    console.error('Error in createNote:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Actualiza una nota existente
 */
export async function updateNote(noteId: string, input: UpdateNoteInput) {
  try {
    const profile = await requireAuth();
    const validatedInput = updateNoteSchema.parse(input);
    const supabase = await createServerClient();

    // Obtener la nota existente
    const { data: existingNote, error: fetchError } = await supabase
      .from('notes')
      .select('*, case:cases(id)')
      .eq('id', noteId)
      .single();

    if (fetchError || !existingNote) {
      throw new Error('Nota no encontrada');
    }

    // Verificar permisos
    if (profile.role !== 'admin_firma' && existingNote.author_id !== profile.id) {
      throw new Error('Sin permisos para editar esta nota');
    }

    // Verificar acceso al caso
    const hasAccess = await canAccessCase(existingNote.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para acceder a este caso');
    }

    // Construir payload sin propiedades undefined (exactOptionalPropertyTypes)
    const updatePayload: Partial<Pick<Note, 'contenido' | 'tipo'>> = {};
    if (validatedInput.contenido !== undefined) updatePayload.contenido = validatedInput.contenido;
    if (validatedInput.tipo !== undefined) updatePayload.tipo = validatedInput.tipo;

    const { data: updatedNote, error } = await supabase
      .from('notes')
      .update(updatePayload)
      .eq('id', noteId)
      .select(
        `
        *,
        author:profiles(nombre),
        case:cases(caratulado)
      `
      )
      .single();

    if (error) {
      console.error('Error updating note:', error);
      throw new Error('Error al actualizar la nota');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'UPDATE',
      entity_type: 'note',
      entity_id: noteId,
      diff_json: {
        from: existingNote,
        to: updatedNote,
      },
    });

    revalidatePath(`/cases/${existingNote.case_id}`);

    return { success: true, note: updatedNote };
  } catch (error) {
    console.error('Error in updateNote:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Elimina una nota
 */
export async function deleteNote(noteId: string) {
  try {
    const profile = await requireAuth();
    const supabase = await createServerClient();

    // Obtener la nota existente
    const { data: existingNote, error: fetchError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (fetchError || !existingNote) {
      throw new Error('Nota no encontrada');
    }

    // Verificar permisos
    if (profile.role !== 'admin_firma' && existingNote.author_id !== profile.id) {
      throw new Error('Sin permisos para eliminar esta nota');
    }

    // Verificar acceso al caso
    const hasAccess = await canAccessCase(existingNote.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para acceder a este caso');
    }

    const { error } = await supabase.from('notes').delete().eq('id', noteId);

    if (error) {
      console.error('Error deleting note:', error);
      throw new Error('Error al eliminar la nota');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'DELETE',
      entity_type: 'note',
      entity_id: noteId,
      diff_json: { deleted: existingNote },
    });

    revalidatePath(`/cases/${existingNote.case_id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in deleteNote:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Obtiene notas con filtros
 */
export async function getNotes(filters?: Partial<NoteFiltersInput>) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new Error('No autenticado');
    }

    // Defaults sólidos para evitar TS2739
    const input = {
      page: 1,
      limit: 20,
      ...(filters ?? {}),
    };

    const validatedFilters = noteFiltersSchema.parse(input);
    const supabase = await createServerClient();

    let query = supabase
      .from('notes')
      .select(
        `
        *,
        author:profiles(id, nombre),
        case:cases(id, caratulado)
      `,
        { count: 'exact' }
      );

    // Aplicar filtros de acceso según rol
    if (profile.role === 'cliente') {
      // Los clientes solo ven notas públicas de sus casos
      query = query.eq('tipo', 'publica');

      // Obtener casos del cliente
      const { data: clientCases } = await supabase
        .from('case_clients')
        .select('case_id')
        .eq('client_profile_id', profile.id);

      const caseIds = clientCases?.map((cc: { case_id: string }) => cc.case_id) || [];
      if (caseIds.length === 0) {
        return { success: true, notes: [], total: 0, page: validatedFilters.page, limit: validatedFilters.limit };
      }

      query = query.in('case_id', caseIds);
    } else if (profile.role === 'abogado') {
      // Los abogados ven notas de sus casos
      const { data: abogadoCases } = await supabase
        .from('cases')
        .select('id')
        .eq('abogado_responsable', profile.id);

      const caseIds = abogadoCases?.map((c: { id: string }) => c.id) || [];
      if (caseIds.length === 0) {
        return { success: true, notes: [], total: 0, page: validatedFilters.page, limit: validatedFilters.limit };
      }

      query = query.in('case_id', caseIds);
    }

    // Aplicar filtros adicionales
    if (validatedFilters.case_id) {
      // Verificar acceso al caso específico
      const hasAccess = await canAccessCase(validatedFilters.case_id);
      if (!hasAccess) {
        throw new Error('Sin permisos para acceder a este caso');
      }
      query = query.eq('case_id', validatedFilters.case_id);
    }

    if (validatedFilters.tipo) {
      query = query.eq('tipo', validatedFilters.tipo);
    }

    if (validatedFilters.author_id) {
      query = query.eq('author_id', validatedFilters.author_id);
    }

    if (validatedFilters.search) {
      query = query.ilike('contenido', `%${validatedFilters.search}%`);
    }

    // Paginación
    const from = (validatedFilters.page - 1) * validatedFilters.limit;
    const to = from + validatedFilters.limit - 1;

    const { data: notes, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notes:', error);
      throw new Error('Error al obtener notas');
    }

    return {
      success: true,
      notes: notes || [],
      total: count || 0,
      page: validatedFilters.page,
      limit: validatedFilters.limit,
    };
  } catch (error) {
    console.error('Error in getNotes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      notes: [],
      total: 0,
    };
  }
}

/**
 * Obtiene una nota por ID
 */
export async function getNoteById(noteId: string) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new Error('No autenticado');
    }

    const supabase = await createServerClient();

    const { data: note, error } = await supabase
      .from('notes')
      .select(
        `
        *,
        author:profiles(id, nombre),
        case:cases(id, caratulado)
      `
      )
      .eq('id', noteId)
      .single();

    if (error || !note) {
      throw new Error('Nota no encontrada');
    }

    // Verificar acceso
    const hasAccess = await canAccessCase(note.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para ver esta nota');
    }

    // Los clientes solo pueden ver notas públicas
    if (profile.role === 'cliente' && note.tipo === 'privada') {
      throw new Error('Sin permisos para ver esta nota');
    }

    return { success: true, note };
  } catch (error) {
    console.error('Error in getNoteById:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}
