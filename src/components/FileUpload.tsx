'use client';

import { useRef, useState, useTransition } from 'react';
import { uploadDocument } from '@/lib/actions/documents';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  caseId: string;
  defaultVisibility?: 'privado' | 'cliente';
  onUploaded?: () => void;
}

export function FileUpload({ caseId, defaultVisibility = 'privado', onUploaded }: FileUploadProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [fileName, setFileName] = useState('');

  return (
    <form
      ref={formRef}
      className='space-y-4'
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await uploadDocument(formData);
          if (result.success) {
            toast({
              title: 'Documento cargado',
              description: 'El archivo quedó disponible en el caso.',
            });
            setFileName('');
            formRef.current?.reset();
            onUploaded?.();
          } else {
            toast({
              title: 'Error al subir',
              description: result.error || 'No se pudo subir el archivo.',
              variant: 'destructive',
            });
          }
        });
      }}
      encType='multipart/form-data'
    >
      <input type='hidden' name='case_id' value={caseId} />
      <div className='space-y-2'>
        <Label htmlFor='file'>Archivo</Label>
        <Input
          id='file'
          name='file'
          type='file'
          required
          disabled={isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setFileName(file ? file.name : '');
          }}
        />
        {fileName && (
          <p className='text-xs text-muted-foreground'>Seleccionado: {fileName}</p>
        )}
      </div>

      <div className='space-y-2'>
        <Label htmlFor='nombre'>Nombre del documento</Label>
        <Input id='nombre' name='nombre' placeholder='Ej. Contestación Demanda.pdf' disabled={isPending} />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='visibilidad'>Visibilidad</Label>
        <select
          id='visibilidad'
          name='visibilidad'
          defaultValue={defaultVisibility}
          className='w-full rounded-md border border-input bg-background p-2 text-sm'
          disabled={isPending}
        >
          <option value='privado'>Solo equipo interno</option>
          <option value='cliente'>Compartir con cliente</option>
        </select>
        <p className='text-xs text-muted-foreground'>
          Cambia la visibilidad para compartir automáticamente con el portal cliente.
        </p>
      </div>

      <Button type='submit' disabled={isPending} className='w-full'>
        {isPending ? 'Subiendo…' : 'Subir documento'}
      </Button>
    </form>
  );
}

export function FileUploadHint() {
  return (
    <div className='rounded-md border border-dashed border-muted-foreground/40 p-4 text-sm text-muted-foreground'>
      Solo se aceptan archivos PDF, DOCX, imágenes y formatos autorizados. Tamaño máximo 20 MB.
      <div className='mt-2 flex flex-wrap gap-2'>
        {['PDF', 'DOCX', 'JPG', 'PNG'].map((label) => (
          <Badge key={label} variant='outline'>
            {label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
