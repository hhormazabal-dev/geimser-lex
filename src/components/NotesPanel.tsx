'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createNote, updateNote, deleteNote, getNotes } from '@/lib/actions/notes';
import { formatRelativeTime } from '@/lib/utils';
import { Plus, Edit, Trash2, MessageSquare, Lock, Globe, Loader2 } from 'lucide-react';
import type { Note } from '@/lib/supabase/types';
import type { CreateNoteInput } from '@/lib/validators/notes';

interface NotesPanelProps {
  caseId: string;
  canCreateNotes?: boolean;
  canEditNotes?: boolean;
  showPrivateNotes?: boolean;
}

export function NotesPanel({ 
  caseId, 
  canCreateNotes = false, 
  canEditNotes = false,
  showPrivateNotes = true 
}: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [newNote, setNewNote] = useState({
    tipo: 'privada' as 'privada' | 'publica',
    contenido: '',
  });
  const { toast } = useToast();

  const loadNotes = async () => {
    setIsLoading(true);
    try {
      const result = await getNotes({ case_id: caseId, page: 1, limit: 50 });
      
      if (result.success) {
        setNotes(result.notes);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al cargar notas',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al cargar notas',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [caseId]);

  const handleCreateNote = async () => {
    if (!newNote.contenido.trim()) {
      toast({
        title: 'Error',
        description: 'El contenido de la nota es requerido',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const noteData: CreateNoteInput = {
        case_id: caseId,
        tipo: newNote.tipo,
        contenido: newNote.contenido.trim(),
      };

      const result = await createNote(noteData);
      
      if (result.success) {
        toast({
          title: 'Nota creada',
          description: 'La nota ha sido creada exitosamente',
        });
        setNewNote({ tipo: 'privada', contenido: '' });
        await loadNotes();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al crear la nota',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating note:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al crear la nota',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateNote = async (noteId: string, contenido: string) => {
    try {
      const result = await updateNote(noteId, { contenido: contenido.trim() });
      
      if (result.success) {
        toast({
          title: 'Nota actualizada',
          description: 'La nota ha sido actualizada exitosamente',
        });
        setEditingNote(null);
        await loadNotes();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al actualizar la nota',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating note:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al actualizar la nota',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
      return;
    }

    try {
      const result = await deleteNote(noteId);
      
      if (result.success) {
        toast({
          title: 'Nota eliminada',
          description: 'La nota ha sido eliminada exitosamente',
        });
        await loadNotes();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al eliminar la nota',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al eliminar la nota',
        variant: 'destructive',
      });
    }
  };

  const getTypeIcon = (tipo: string) => {
    return tipo === 'publica' ? (
      <Globe className='h-4 w-4 text-blue-600' />
    ) : (
      <Lock className='h-4 w-4 text-gray-600' />
    );
  };

  const getTypeBadge = (tipo: string) => {
    return tipo === 'publica' ? (
      <Badge variant='default'>Pública</Badge>
    ) : (
      <Badge variant='secondary'>Privada</Badge>
    );
  };

  const filteredNotes = showPrivateNotes 
    ? notes 
    : notes.filter(note => note.tipo === 'publica');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <MessageSquare className='h-5 w-5' />
            Notas
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
            <MessageSquare className='h-5 w-5' />
            Notas ({filteredNotes.length})
          </CardTitle>
          {canCreateNotes && (
            <Button
              size='sm'
              onClick={() => setIsCreating(!isCreating)}
              disabled={isCreating}
            >
              <Plus className='h-4 w-4 mr-2' />
              Nueva Nota
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Formulario para nueva nota */}
        {isCreating && canCreateNotes && (
          <Card className='border-dashed'>
            <CardContent className='pt-6'>
              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Tipo de nota
                  </label>
                  <select
                    value={newNote.tipo}
                    onChange={(e) => setNewNote({ ...newNote, tipo: e.target.value as 'privada' | 'publica' })}
                    className='form-input'
                  >
                    <option value='privada'>Privada (solo abogados)</option>
                    <option value='publica'>Pública (visible para cliente)</option>
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Contenido
                  </label>
                  <textarea
                    value={newNote.contenido}
                    onChange={(e) => setNewNote({ ...newNote, contenido: e.target.value })}
                    placeholder='Escribe tu nota aquí...'
                    rows={4}
                    className='form-input'
                  />
                </div>
                <div className='flex justify-end space-x-2'>
                  <Button
                    variant='outline'
                    onClick={() => {
                      setIsCreating(false);
                      setNewNote({ tipo: 'privada', contenido: '' });
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateNote}>
                    Crear Nota
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de notas */}
        <div className='space-y-3'>
          {filteredNotes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              canEdit={canEditNotes}
              isEditing={editingNote === note.id}
              onEdit={() => setEditingNote(note.id)}
              onCancelEdit={() => setEditingNote(null)}
              onSave={(contenido) => handleUpdateNote(note.id, contenido)}
              onDelete={() => handleDeleteNote(note.id)}
              getTypeIcon={getTypeIcon}
              getTypeBadge={getTypeBadge}
            />
          ))}
        </div>

        {filteredNotes.length === 0 && (
          <div className='text-center py-8 text-gray-500'>
            <MessageSquare className='h-12 w-12 mx-auto mb-4 text-gray-300' />
            <p>No hay notas para este caso</p>
            {canCreateNotes && (
              <p className='text-sm mt-2'>
                Haz clic en "Nueva Nota" para agregar la primera nota
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface NoteItemProps {
  note: Note & { author?: { nombre: string } };
  canEdit: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (contenido: string) => void;
  onDelete: () => void;
  getTypeIcon: (tipo: string) => React.ReactNode;
  getTypeBadge: (tipo: string) => React.ReactNode;
}

function NoteItem({
  note,
  canEdit,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  getTypeIcon,
  getTypeBadge,
}: NoteItemProps) {
  const [editContent, setEditContent] = useState(note.contenido);

  const handleSave = () => {
    if (editContent.trim()) {
      onSave(editContent);
    }
  };

  return (
    <Card className='border-l-4 border-l-blue-500'>
      <CardContent className='pt-4'>
        <div className='flex items-start justify-between mb-3'>
          <div className='flex items-center gap-2'>
            {getTypeIcon(note.tipo)}
            {getTypeBadge(note.tipo)}
            <span className='text-sm text-gray-500'>
              por {note.author?.nombre || 'Usuario'}
            </span>
            <span className='text-sm text-gray-400'>
              {formatRelativeTime(note.created_at)}
            </span>
          </div>
          {canEdit && (
            <div className='flex items-center gap-1'>
              {!isEditing ? (
                <>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={onEdit}
                  >
                    <Edit className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={onDelete}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </>
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
            </div>
          )}
        </div>
        
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            className='form-input w-full'
          />
        ) : (
          <div className='prose prose-sm max-w-none'>
            <p className='whitespace-pre-wrap text-gray-700'>
              {note.contenido}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
