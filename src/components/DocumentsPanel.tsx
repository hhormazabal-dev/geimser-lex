'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
 uploadDocument, 
 updateDocument, 
 deleteDocument, 
 getDocuments,
 getDocumentDownloadUrl 
} from '@/lib/actions/documents';
import { createInfoRequest } from '@/lib/actions/info-requests';
import { updateCase } from '@/lib/actions/cases';
import { formatFileSize, formatRelativeTime } from '@/lib/utils';
import { 
  Upload, 
  Download, 
  Edit, 
  Trash2, 
  FileText, 
  Eye, 
  EyeOff, 
  Loader2,
  Plus,
  File
} from 'lucide-react';
import type { Document } from '@/lib/supabase/types';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '@/lib/validators/documents';
import { DOCUMENT_CHECKLISTS, type ChecklistMateria } from '@/lib/legal/documentChecklists';

interface DocumentsPanelProps {
  caseId: string;
  caseMateria?: string | null;
  initialDocumentationReceived?: string | null;
  canRequestDocuments?: boolean;
  canUpload?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  showPrivateDocuments?: boolean;
}

export function DocumentsPanel({ 
  caseId, 
  caseMateria = null,
  initialDocumentationReceived = null,
  canRequestDocuments = false,
  canUpload = false, 
  canEdit = false,
  canDelete = false,
  showPrivateDocuments = true 
}: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [editingDocument, setEditingDocument] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [documentationReceived, setDocumentationReceived] = useState<string>(initialDocumentationReceived ?? '');
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);
  const [isRequestingItem, setIsRequestingItem] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const result = await getDocuments({ case_id: caseId, page: 1, limit: 50 });
      
      if (result.success) {
        setDocuments(result.documents);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al cargar documentos',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al cargar documentos',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [caseId]);

  useEffect(() => {
    setDocumentationReceived(initialDocumentationReceived ?? '');
  }, [initialDocumentationReceived]);

  const normalizedMateria = (caseMateria ?? '').trim();
  const checklistMateria: ChecklistMateria | null =
    normalizedMateria === 'Laboral' || normalizedMateria === 'Civil' || normalizedMateria === 'Penal'
      ? (normalizedMateria as ChecklistMateria)
      : null;

  const checklist = checklistMateria ? DOCUMENT_CHECKLISTS[checklistMateria] : null;

  const receivedSet = new Set(
    (documentationReceived ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );

  const docNameSet = new Set(
    documents.map((doc) => (doc.nombre ?? '').trim().toLowerCase()).filter(Boolean),
  );

  const isItemSatisfied = (label: string) => {
    if (receivedSet.has(label)) return true;
    const lower = label.toLowerCase();
    for (const docName of docNameSet) {
      if (!docName) continue;
      if (docName.includes(lower) || lower.includes(docName)) return true;
    }
    return false;
  };

  const saveChecklist = async (next: string) => {
    setIsSavingChecklist(true);
    try {
      const result = await updateCase(caseId, { documentacion_recibida: next });
      if (result.success) {
        setDocumentationReceived(next);
        toast({ title: 'Checklist actualizado' });
      } else {
        toast({
          title: 'No se pudo guardar',
          description: result.error ?? 'Error al actualizar la documentación recibida.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[DocumentsPanel] saveChecklist error', error);
      toast({
        title: 'Error inesperado',
        description: 'No se pudo guardar el checklist.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingChecklist(false);
    }
  };

  const toggleChecklistItem = async (label: string) => {
    const nextSet = new Set(receivedSet);
    if (nextSet.has(label)) nextSet.delete(label);
    else nextSet.add(label);
    const next = Array.from(nextSet).sort((a, b) => a.localeCompare(b, 'es')).join('\n');
    await saveChecklist(next);
  };

  const requestChecklistItem = async (label: string) => {
    if (!canRequestDocuments) return;
    setIsRequestingItem(label);
    try {
      const result = await createInfoRequest({
        case_id: caseId,
        titulo: `Enviar documento: ${label}`,
        descripcion: `Por favor enviar: ${label}.`,
        tipo: 'documento',
        prioridad: 'media',
        es_publica: true,
      });
      if (result.success) {
        toast({ title: 'Solicitud creada', description: 'Se registró la solicitud en el portal del cliente.' });
      } else {
        toast({ title: 'No se pudo crear la solicitud', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      console.error('[DocumentsPanel] requestChecklistItem error', error);
      toast({ title: 'Error inesperado', description: 'No se pudo crear la solicitud.', variant: 'destructive' });
    } finally {
      setIsRequestingItem(null);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validaciones del lado cliente
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Archivo demasiado grande',
        description: `El archivo debe ser menor a ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        variant: 'destructive',
      });
      return;
    }

    if (!Object.keys(ALLOWED_FILE_TYPES).includes(file.type)) {
      toast({
        title: 'Tipo de archivo no permitido',
        description: 'Solo se permiten archivos PDF, Word, imágenes y texto',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('case_id', caseId);
      formData.append('nombre', file.name);
      formData.append('visibilidad', 'privado');

      const result = await uploadDocument(formData);
      
      if (result.success) {
        toast({
          title: 'Documento subido',
          description: 'El documento ha sido subido exitosamente',
        });
        setShowUploadForm(false);
        await loadDocuments();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al subir el documento',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al subir el documento',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUpdateDocument = async (documentId: string, updates: { nombre?: string; visibilidad?: 'privado' | 'cliente' }) => {
    try {
      const result = await updateDocument(documentId, updates);
      
      if (result.success) {
        toast({
          title: 'Documento actualizado',
          description: 'El documento ha sido actualizado exitosamente',
        });
        setEditingDocument(null);
        await loadDocuments();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al actualizar el documento',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al actualizar el documento',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este documento?')) {
      return;
    }

    try {
      const result = await deleteDocument(documentId);
      
      if (result.success) {
        toast({
          title: 'Documento eliminado',
          description: 'El documento ha sido eliminado exitosamente',
        });
        await loadDocuments();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al eliminar el documento',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al eliminar el documento',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadDocument = async (documentId: string, nombre: string) => {
    try {
      const result = await getDocumentDownloadUrl(documentId);
      
      if (result.success && result.url) {
        // Crear un enlace temporal para descargar
        const link = document.createElement('a');
        link.href = result.url;
        link.download = nombre;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: 'Descarga iniciada',
          description: 'El documento se está descargando',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al generar enlace de descarga',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al descargar el documento',
        variant: 'destructive',
      });
    }
  };

  const getFileIcon = (tipoMime: string) => {
    const fileInfo = ALLOWED_FILE_TYPES[tipoMime as keyof typeof ALLOWED_FILE_TYPES];
    return fileInfo ? fileInfo.icon : '📄';
  };

  const getVisibilityIcon = (visibilidad: string) => {
    return visibilidad === 'cliente' ? (
      <Eye className='h-4 w-4 text-blue-600' />
    ) : (
      <EyeOff className='h-4 w-4 text-gray-600' />
    );
  };

  const getVisibilityBadge = (visibilidad: string) => {
    return visibilidad === 'cliente' ? (
      <Badge variant='default'>Cliente</Badge>
    ) : (
      <Badge variant='secondary'>Privado</Badge>
    );
  };

  const filteredDocuments = showPrivateDocuments 
    ? documents 
    : documents.filter(doc => doc.visibilidad === 'cliente');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <FileText className='h-5 w-5' />
            Documentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-6 w-6 animate-spin' />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      {checklist && (
        <Card>
          <CardHeader className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <CardTitle className='flex items-center gap-2'>
              <FileText className='h-5 w-5' />
              Checklist documental ({checklistMateria})
            </CardTitle>
            <Badge variant='outline'>
              {checklist.filter((item) => isItemSatisfied(item.label)).length}/{checklist.length}
            </Badge>
          </CardHeader>
          <CardContent className='space-y-4'>
            <p className='text-sm text-gray-500'>
              Marca lo recibido y/o genera solicitudes al cliente para los faltantes. También se considera “recibido” si
              el nombre del archivo coincide razonablemente.
            </p>
            <div className='grid gap-2'>
              {checklist.map((item) => {
                const satisfied = isItemSatisfied(item.label);
                return (
                  <div
                    key={item.key}
                    className='flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between'
                  >
                    <label className='flex items-start gap-3'>
                      <input
                        type='checkbox'
                        className='mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                        checked={satisfied}
                        onChange={() => toggleChecklistItem(item.label)}
                        disabled={isSavingChecklist}
                      />
                      <span>
                        <span className='text-sm font-medium text-gray-900'>{item.label}</span>
                        {item.hint && <p className='text-xs text-gray-500 mt-0.5'>{item.hint}</p>}
                      </span>
                    </label>
                    <div className='flex items-center gap-2'>
                      {!satisfied && canRequestDocuments && (
                        <Button
                          type='button'
                          size='sm'
                          variant='outline'
                          onClick={() => requestChecklistItem(item.label)}
                          disabled={Boolean(isRequestingItem) || isSavingChecklist}
                        >
                          {isRequestingItem === item.label ? (
                            <>
                              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                              Solicitando...
                            </>
                          ) : (
                            'Solicitar'
                          )}
                        </Button>
                      )}
                      {satisfied && <Badge variant='secondary'>Recibido</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className='space-y-2'>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-gray-500'>
                Documentación recibida (manual)
              </p>
              <textarea
                className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100'
                rows={3}
                value={documentationReceived}
                onChange={(event) => setDocumentationReceived(event.target.value)}
                placeholder='Agrega líneas adicionales (una por fila)'
                disabled={isSavingChecklist}
              />
              <div className='flex justify-end'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => saveChecklist(documentationReceived)}
                  disabled={isSavingChecklist}
                >
                  {isSavingChecklist ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Guardando...
                    </>
                  ) : (
                    'Guardar checklist'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle className='flex items-center gap-2'>
              <FileText className='h-5 w-5' />
              Documentos ({filteredDocuments.length})
            </CardTitle>
            {canUpload && (
              <Button size='sm' onClick={() => setShowUploadForm(!showUploadForm)} disabled={isUploading}>
                <Plus className='h-4 w-4 mr-2' />
                Subir Documento
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Formulario de subida */}
          {showUploadForm && canUpload && (
            <Card className='border-dashed'>
              <CardContent className='pt-6'>
                <div className='space-y-4'>
                  <div>
                    <label className='block text-sm font-medium mb-2'>Seleccionar archivo</label>
                    <input
                      ref={fileInputRef}
                      type='file'
                      onChange={handleFileUpload}
                      accept={Object.keys(ALLOWED_FILE_TYPES).join(',')}
                      className='form-input'
                      disabled={isUploading}
                    />
                    <p className='text-xs text-gray-500 mt-1'>
                      Máximo {MAX_FILE_SIZE / 1024 / 1024}MB. Formatos: PDF, Word, imágenes, texto
                    </p>
                  </div>
                  {isUploading && (
                    <div className='flex items-center gap-2 text-sm text-gray-600'>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      Subiendo archivo...
                    </div>
                  )}
                  <div className='flex justify-end space-x-2'>
                    <Button variant='outline' onClick={() => setShowUploadForm(false)} disabled={isUploading}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de documentos */}
          <div className='space-y-3'>
            {filteredDocuments.map((document) => (
              <DocumentItem
                key={document.id}
                document={document}
                canEdit={canEdit}
                canDelete={canDelete}
                isEditing={editingDocument === document.id}
                onEdit={() => setEditingDocument(document.id)}
                onCancelEdit={() => setEditingDocument(null)}
                onSave={(updates) => handleUpdateDocument(document.id, updates)}
                onDelete={() => handleDeleteDocument(document.id)}
                onDownload={() => handleDownloadDocument(document.id, document.nombre)}
                getFileIcon={getFileIcon}
                getVisibilityIcon={getVisibilityIcon}
                getVisibilityBadge={getVisibilityBadge}
              />
            ))}
          </div>

          {filteredDocuments.length === 0 && (
            <div className='text-center py-8 text-gray-500'>
              <File className='h-12 w-12 mx-auto mb-4 text-gray-300' />
              <p>No hay documentos para este caso</p>
              {canUpload && (
                <p className='text-sm mt-2'>Haz clic en "Subir Documento" para agregar el primer documento</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface DocumentItemProps {
  document: Document & { uploader?: { nombre: string } };
  canEdit: boolean;
  canDelete: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (updates: { nombre?: string; visibilidad?: 'privado' | 'cliente' }) => void;
  onDelete: () => void;
  onDownload: () => void;
  getFileIcon: (tipoMime: string) => string;
  getVisibilityIcon: (visibilidad: string) => React.ReactNode;
  getVisibilityBadge: (visibilidad: string) => React.ReactNode;
}

function DocumentItem({
  document,
  canEdit,
  canDelete,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onDownload,
  getFileIcon,
  getVisibilityIcon,
  getVisibilityBadge,
}: DocumentItemProps) {
  const [editData, setEditData] = useState({
    nombre: document.nombre,
    visibilidad: document.visibilidad as 'privado' | 'cliente',
  });

  const handleSave = () => {
    if (editData.nombre.trim()) {
      onSave(editData);
    }
  };

  return (
    <Card className='border-l-4 border-l-green-500'>
      <CardContent className='pt-4'>
        <div className='flex items-start justify-between mb-3'>
          <div className='flex items-center gap-3'>
            <span className='text-2xl'>
              {getFileIcon(document.tipo_mime || '')}
            </span>
            <div>
              {isEditing ? (
                <input
                  type='text'
                  value={editData.nombre}
                  onChange={(e) => setEditData({ ...editData, nombre: e.target.value })}
                  className='form-input text-sm'
                />
              ) : (
                <h4 className='font-medium text-gray-900'>{document.nombre}</h4>
              )}
              <div className='flex items-center gap-2 mt-1'>
                {getVisibilityIcon(document.visibilidad || 'privado')}
                {isEditing ? (
                  <select
                    value={editData.visibilidad}
                    onChange={(e) => setEditData({ ...editData, visibilidad: e.target.value as 'privado' | 'cliente' })}
                    className='form-input text-xs'
                  >
                    <option value='privado'>Privado</option>
                    <option value='cliente'>Cliente</option>
                  </select>
                ) : (
                  getVisibilityBadge(document.visibilidad || 'privado')
                )}
                <span className='text-xs text-gray-500'>
                  {formatFileSize(document.size_bytes || 0)}
                </span>
              </div>
              <div className='text-xs text-gray-400 mt-1'>
                Subido por {document.uploader?.nombre || 'Usuario'} • {formatRelativeTime(document.created_at)}
              </div>
            </div>
          </div>
          
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='sm'
              onClick={onDownload}
            >
              <Download className='h-4 w-4' />
            </Button>
            {canEdit && (
              <>
                {!isEditing ? (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={onEdit}
                  >
                    <Edit className='h-4 w-4' />
                  </Button>
                ) : (
                  <>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={onCancelEdit}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size='sm'
                      onClick={handleSave}
                    >
                      Guardar
                    </Button>
                  </>
                )}
              </>
            )}
            {canDelete && !isEditing && (
              <Button
                variant='ghost'
                size='sm'
                onClick={onDelete}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
