'use client';

import { useRef, useTransition, useState } from 'react';
import type { LegalTemplate } from '@/lib/supabase/types';
import { createLegalTemplate, listLegalTemplates } from '@/lib/actions/resources';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Copy, Loader2 } from 'lucide-react';

interface TemplateLibraryProps {
  templates: LegalTemplate[];
}

export function TemplateLibrary({ templates }: TemplateLibraryProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const [isSubmitting, startSubmit] = useTransition();
  const [items, setItems] = useState(templates);

  const handleSubmit = (formData: FormData) => {
    startSubmit(async () => {
      try {
        await createLegalTemplate(formData);
        toast({ title: 'Plantilla guardada', description: 'Disponible para el equipo.' });
        formRef.current?.reset();
        const refreshed = await listLegalTemplates().catch(() => items);
        setItems(refreshed);
      } catch (error: any) {
        toast({
          title: 'No se pudo guardar',
          description: error?.message ?? 'Intenta nuevamente más tarde.',
          variant: 'destructive',
        });
      }
    });
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast({ title: 'Plantilla copiada' });
    });
  };

  return (
    <Card className='border-lexser-gray-100'>
      <CardHeader>
        <CardTitle className='flex items-center justify-between text-base'>
          Plantillas de gestión
          {isSubmitting && <Loader2 className='h-4 w-4 animate-spin text-lexser-blue-600' />}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-6'>
        <form ref={formRef} action={handleSubmit} className='space-y-3'>
          <div className='grid gap-3 md:grid-cols-3'>
            <Input name='title' placeholder='Título' required disabled={isSubmitting} />
            <Input name='category' placeholder='Categoría (opcional)' disabled={isSubmitting} />
            <Button type='submit' disabled={isSubmitting}>
              Guardar plantilla
            </Button>
          </div>
          <Textarea
            name='content'
            placeholder='Cuerpo de la plantilla (compatible con copiar/pegar)'
            required
            disabled={isSubmitting}
            className='min-h-[160px]'
          />
        </form>

        <div className='space-y-3'>
          {items.length === 0 && <p className='text-sm text-muted-foreground'>Aún no hay plantillas guardadas.</p>}
          {items.map((template) => (
            <div key={template.id} className='rounded-lg border border-lexser-gray-100 p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='font-medium text-lexser-gray-900'>{template.title}</p>
                  {template.category && <p className='text-xs text-muted-foreground'>{template.category}</p>}
                </div>
                <Button variant='ghost' size='icon' onClick={() => copyToClipboard(template.content)}>
                  <Copy className='h-4 w-4 text-lexser-blue-600' />
                </Button>
              </div>
              <pre className='mt-3 whitespace-pre-wrap rounded-md bg-lexser-gray-50 p-3 text-xs text-lexser-gray-700'>
                {template.content}
              </pre>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
