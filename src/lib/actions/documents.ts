'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentProfile, requireAuth, canAccessCase } from '@/lib/auth/roles';
import { logAuditAction } from '@/lib/audit/log';

import {
  uploadDocumentSchema,
  updateDocumentSchema,
  documentFiltersSchema,
  type UploadDocumentInput,
  type UpdateDocumentInput,
  type DocumentFiltersInput,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/validators/documents';

import type { DocumentInsert } from '@/lib/supabase/types';

/**
 * Sube un documento al storage y guarda metadatos
 */
export async function uploadDocument(formData: FormData) {
  try {
    const profile = await requireAuth();

    const caseId = formData.get('case_id') as string;
    const nombre = formData.get('nombre') as string | null;
    const visibilidad = formData.get('visibilidad') as ('privado' | 'cliente') | null;
    const file = formData.get('file') as File;

    if (!file) throw new Error('No se ha seleccionado ningún archivo');

    // Validar entrada
    const validatedInput = uploadDocumentSchema.parse({
      case_id: caseId,
      nombre: (nombre && nombre.trim()) || file.name,
      visibilidad: (visibilidad as 'privado' | 'cliente') || 'privado',
    });

    // Verificar acceso al caso
    const hasAccess = await canAccessCase(validatedInput.case_id);
    if (!hasAccess) throw new Error('Sin permisos para acceder a este caso');

    // Validar archivo
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`El archivo es demasiado grande. Máximo ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)}MB`);
    }
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_FILE_TYPES, file.type)) {
      throw new Error('Tipo de archivo no permitido');
    }

    // ⚠️ await al service client
    const supabase = await createServiceClient();

    // Generar nombre único para el archivo
    const fileExtension = file.name.includes('.') ? file.name.split('.').pop() : '';
    const rand = Math.random().toString(36).slice(2, 9);
    const fileName = `${Date.now()}-${rand}${fileExtension ? '.' + fileExtension : ''}`;
    const filePath = `cases/${validatedInput.case_id}/${fileName}`;

    // Subir archivo a Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw new Error('Error al subir el archivo');
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);

    // Guardar metadatos en la base de datos
    const documentData: DocumentInsert = {
      case_id: validatedInput.case_id,
      uploader_id: profile.id,
      nombre: validatedInput.nombre,
      tipo_mime: file.type,
      size_bytes: file.size,
      url: urlData.publicUrl,
      visibilidad: validatedInput.visibilidad,
    };

    const { data: newDocument, error: dbError } = await supabase
      .from('documents')
      .insert(documentData)
      .select(`
        *,
        uploader:profiles(nombre),
        case:cases(caratulado)
      `)
      .single();

    if (dbError) {
      console.error('Error saving document metadata:', dbError);
      // Intentar eliminar el archivo subido
      await supabase.storage.from('documents').remove([filePath]).catch(() => {});
      throw new Error('Error al guardar los metadatos del documento');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'UPLOAD',
      entity_type: 'document',
      entity_id: newDocument.id,
      diff_json: { uploaded: documentData },
    });

    revalidatePath(`/cases/${validatedInput.case_id}`);

    return { success: true, document: newDocument };
  } catch (error) {
    console.error('Error in uploadDocument:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Actualiza metadatos de un documento
 */
export async function updateDocument(documentId: string, input: UpdateDocumentInput) {
  try {
    const profile = await requireAuth();
    const validatedInput = updateDocumentSchema.parse(input);
    const supabase = await createServerClient();

    // Obtener el documento existente
    const { data: existingDocument, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError || !existingDocument) {
      throw new Error('Documento no encontrado');
    }

    // Verificar permisos
    if (profile.role !== 'admin_firma' && existingDocument.uploader_id !== profile.id) {
      if (profile.role === 'abogado') {
        const hasAccess = await canAccessCase(existingDocument.case_id);
        if (!hasAccess) throw new Error('Sin permisos para editar este documento');
      } else {
        throw new Error('Sin permisos para editar este documento');
      }
    }

    // ⚠️ Respeta exactOptionalPropertyTypes: incluir sólo si viene definido
    const payload: Partial<DocumentInsert> = {
      ...(validatedInput.nombre !== undefined && { nombre: validatedInput.nombre }),
      ...(validatedInput.visibilidad !== undefined && { visibilidad: validatedInput.visibilidad }),
    };

    const { data: updatedDocument, error } = await supabase
      .from('documents')
      .update(payload)
      .eq('id', documentId)
      .select(`
        *,
        uploader:profiles(nombre),
        case:cases(caratulado)
      `)
      .single();

    if (error) {
      console.error('Error updating document:', error);
      throw new Error('Error al actualizar el documento');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'UPDATE',
      entity_type: 'document',
      entity_id: documentId,
      diff_json: {
        from: existingDocument,
        to: updatedDocument,
      },
    });

    revalidatePath(`/cases/${existingDocument.case_id}`);

    return { success: true, document: updatedDocument };
  } catch (error) {
    console.error('Error in updateDocument:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Elimina un documento
 */
export async function deleteDocument(documentId: string) {
  try {
    const profile = await requireAuth();
    const supabase = await createServiceClient();

    // Obtener el documento existente
    const { data: existingDocument, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError || !existingDocument) {
      throw new Error('Documento no encontrado');
    }

    // Verificar permisos
    if (profile.role !== 'admin_firma' && existingDocument.uploader_id !== profile.id) {
      if (profile.role === 'abogado') {
        const hasAccess = await canAccessCase(existingDocument.case_id);
        if (!hasAccess) throw new Error('Sin permisos para eliminar este documento');
      } else {
        throw new Error('Sin permisos para eliminar este documento');
      }
    }

    // Eliminar archivo del storage
    // La URL pública es algo como: https://.../object/public/documents/cases/{case_id}/{filename}
    const urlParts = existingDocument.url.split('/');
    const filePath = urlParts.slice(-2).join('/'); // cases/{case_id}/{filename}

    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([filePath]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
      // seguimos con metadatos aunque falle storage
    }

    // Eliminar metadatos de la base de datos
    const { error: dbError } = await supabase.from('documents').delete().eq('id', documentId);
    if (dbError) {
      console.error('Error deleting document metadata:', dbError);
      throw new Error('Error al eliminar el documento');
    }

    await logAuditAction({
      action: 'DELETE',
      entity_type: 'document',
      entity_id: documentId,
      diff_json: { deleted: existingDocument },
    });

    revalidatePath(`/cases/${existingDocument.case_id}`);
    return { success: true };
  } catch (error) {
    console.error('Error in deleteDocument:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Obtiene documentos con filtros
 */
export async function getDocuments(filters: DocumentFiltersInput = {} as DocumentFiltersInput) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) throw new Error('No autenticado');

    // Normalizar defaults ANTES de validar (evita error de page/limit)
    const f: any = { ...(filters ?? {}) };
    if (f.page == null) f.page = 1;
    if (f.limit == null) f.limit = 10;

    const validatedFilters = documentFiltersSchema.parse(f);

    const supabase = await createServerClient();

    let query = supabase
      .from('documents')
      .select(
        `
        *,
        uploader:profiles(id, nombre),
        case:cases(id, caratulado)
      `,
        { count: 'exact' }
      );

    // Acceso según rol
    if (profile.role === 'cliente') {
      query = query.eq('visibilidad', 'cliente');

      const { data: clientCases } = await supabase
        .from('case_clients')
        .select('case_id')
        .eq('client_profile_id', profile.id);

      const caseIds = clientCases?.map((cc: { case_id: string }) => cc.case_id) || [];
      if (caseIds.length === 0) {
        return { success: true, documents: [], total: 0, page: validatedFilters.page, limit: validatedFilters.limit };
      }
      query = query.in('case_id', caseIds);
    } else if (profile.role === 'abogado') {
      const { data: abogadoCases } = await supabase
        .from('cases')
        .select('id')
        .eq('abogado_responsable', profile.id);

      const caseIds = abogadoCases?.map((c: { id: string }) => c.id) || [];
      if (caseIds.length === 0) {
        return { success: true, documents: [], total: 0, page: validatedFilters.page, limit: validatedFilters.limit };
      }
      query = query.in('case_id', caseIds);
    }

    // Filtros extra
    if (validatedFilters.case_id) {
      const hasAccess = await canAccessCase(validatedFilters.case_id);
      if (!hasAccess) throw new Error('Sin permisos para acceder a este caso');
      query = query.eq('case_id', validatedFilters.case_id);
    }
    if (validatedFilters.visibilidad) query = query.eq('visibilidad', validatedFilters.visibilidad);
    if (validatedFilters.uploader_id) query = query.eq('uploader_id', validatedFilters.uploader_id);
    if (validatedFilters.tipo_mime) query = query.eq('tipo_mime', validatedFilters.tipo_mime);
    if (validatedFilters.search) query = query.ilike('nombre', `%${validatedFilters.search}%`);

    // Paginación
    const from = (validatedFilters.page - 1) * validatedFilters.limit;
    const to = from + validatedFilters.limit - 1;

    const { data: documents, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      throw new Error('Error al obtener documentos');
    }

    return {
      success: true,
      documents: documents || [],
      total: count || 0,
      page: validatedFilters.page,
      limit: validatedFilters.limit,
    };
  } catch (error) {
    console.error('Error in getDocuments:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      documents: [],
      total: 0,
    };
  }
}

/**
 * Obtiene un documento por ID
 */
export async function getDocumentById(documentId: string) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) throw new Error('No autenticado');

    const supabase = await createServerClient();

    const { data: document, error } = await supabase
      .from('documents')
      .select(`
        *,
        uploader:profiles(id, nombre),
        case:cases(id, caratulado)
      `)
      .eq('id', documentId)
      .single();

    if (error || !document) throw new Error('Documento no encontrado');

    // Verificar acceso
    const hasAccess = await canAccessCase(document.case_id);
    if (!hasAccess) throw new Error('Sin permisos para ver este documento');

    if (profile.role === 'cliente' && document.visibilidad === 'privado') {
      throw new Error('Sin permisos para ver este documento');
    }

    return { success: true, document };
  } catch (error) {
    console.error('Error in getDocumentById:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Genera una URL firmada para descargar un documento
 */
export async function getDocumentDownloadUrl(documentId: string) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) throw new Error('No autenticado');

    const supabase = await createServiceClient();

    // Obtener el documento
    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error || !document) throw new Error('Documento no encontrado');

    // Verificar acceso
    const hasAccess = await canAccessCase(document.case_id);
    if (!hasAccess) throw new Error('Sin permisos para descargar este documento');

    if (profile.role === 'cliente' && document.visibilidad === 'privado') {
      throw new Error('Sin permisos para descargar este documento');
    }

    // Extraer path del archivo desde URL pública (bucket/path)
    let filePath: string | null = null;
    try {
      const url = new URL(document.url);
      const PUBLIC_PREFIX = '/storage/v1/object/public/';
      if (url.pathname.startsWith(PUBLIC_PREFIX)) {
        // Obtiene "bucket/path"
        const fullPath = decodeURIComponent(url.pathname.slice(PUBLIC_PREFIX.length));
        const [bucket, ...rest] = fullPath.split('/');
        if (bucket === 'documents' && rest.length > 0) {
          filePath = rest.join('/') || null;
        }
      }
    } catch (parseError) {
      // noop: fallback más abajo
      console.warn('[documents] No se pudo parsear URL pública', parseError);
    }

    if (!filePath) {
      // Fallback: extraer después del bucket manualmente
      const parts = document.url.split('/documents/');
      if (parts.length === 2) {
        filePath = parts[1] || null;
      }
    }

    if (!filePath) {
      console.error('No se pudo resolver la ruta del archivo', document.url);
      throw new Error('Error al preparar la descarga del documento');
    }

    // Generar URL firmada (1 hora)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600);

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError);
      throw new Error('Error al generar URL de descarga');
    }

    await logAuditAction({
      action: 'DOWNLOAD',
      entity_type: 'document',
      entity_id: documentId,
      diff_json: { downloaded: true },
    });

    return { success: true, url: signedUrlData.signedUrl };
  } catch (error) {
    console.error('Error in getDocumentDownloadUrl:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}
