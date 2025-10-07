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

interface DocumentsPanelProps {
  caseId: string;
  canUpload?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  showPrivateDocuments?: boolean;
}

export function DocumentsPanel({ 
  caseId, 
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
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='flex items-center gap-2'>
            <FileText className='h-5 w-5' />
            Documentos ({filteredDocuments.length})
          </CardTitle>
          {canUpload && (
            <Button
              size='sm'
              onClick={() => setShowUploadForm(!showUploadForm)}
              disabled={isUploading}
            >
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
                  <label className='block text-sm font-medium mb-2'>
                    Seleccionar archivo
                  </label>
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
                  <Button
                    variant='outline'
                    onClick={() => setShowUploadForm(false)}
                    disabled={isUploading}
                  >
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
              <p className='text-sm mt-2'>
                Haz clic en "Subir Documento" para agregar el primer documento
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
