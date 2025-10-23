'use client';

import { useRef, useState, useTransition } from 'react';
import { createQuickLink, deleteQuickLink, listQuickLinks } from '@/lib/actions/resources';
import type { QuickLink } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, Loader2, Trash } from 'lucide-react';

interface QuickLinksPanelProps {
  links: QuickLink[];
}

export function QuickLinksPanel({ links }: QuickLinksPanelProps) {
  const { toast } = useToast();
  const [isSubmitting, startSubmit] = useTransition();
  const [items, setItems] = useState(links);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (formData: FormData) => {
    startSubmit(async () => {
      try {
        await createQuickLink(formData);
        toast({ title: 'Enlace guardado', description: 'Se agregó a tus accesos rápidos.' });
        formRef.current?.reset();
        const refreshed = await list();
        setItems(refreshed);
      } catch (error: any) {
        toast({
          title: 'No se pudo guardar',
          description: error?.message ?? 'Revisa la URL e intenta nuevamente.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleDelete = (id: string) => {
    startSubmit(async () => {
      try {
        await deleteQuickLink(id);
        toast({ title: 'Enlace eliminado' });
        setItems((prev) => prev.filter((item) => item.id !== id));
      } catch (error: any) {
        toast({
          title: 'No se pudo eliminar',
          description: error?.message ?? 'Intenta nuevamente en unos minutos.',
          variant: 'destructive',
        });
      }
    });
  };

  const list = async () => {
    try {
      return await listQuickLinks();
    } catch (error) {
      return items;
    }
  };

  return (
    <Card className='rounded-2xl border border-slate-200 bg-white shadow-sm'>
      <CardHeader className='p-6 pb-4'>
        <CardTitle className='flex items-center justify-between text-sm font-semibold text-slate-800'>
          Accesos rápidos
          {isSubmitting && <Loader2 className='h-4 w-4 animate-spin text-sky-500' />}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-6 px-6 pb-6 pt-0'>
        <form ref={formRef} action={handleSubmit} className='grid gap-3 md:grid-cols-3'>
          <Input
            name='title'
            placeholder='Nombre (Ej. Poder Judicial)'
            required
            disabled={isSubmitting}
            className='rounded-xl border-slate-200'
          />
          <Input
            name='url'
            placeholder='https://...'
            type='url'
            required
            disabled={isSubmitting}
            className='rounded-xl border-slate-200'
          />
          <div className='flex items-center gap-2'>
            <Input name='category' placeholder='Categoría (opcional)' disabled={isSubmitting} className='rounded-xl border-slate-200' />
            <Button type='submit' disabled={isSubmitting}>
              Agregar
            </Button>
          </div>
        </form>

        <div className='space-y-2'>
          {items.length === 0 && <p className='text-sm text-slate-500'>Sin enlaces guardados aún.</p>}
          {items.map((link) => (
            <div key={link.id} className='flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm'>
              <div>
                <p className='font-medium text-slate-900'>{link.title}</p>
                <a
                  href={link.url}
                  className='inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <ExternalLink className='h-3 w-3' />
                  {link.url}
                </a>
                {link.category && <p className='text-xs text-slate-500'>Categoría: {link.category}</p>}
              </div>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => handleDelete(link.id)}
                disabled={isSubmitting}
              >
                <Trash className='h-4 w-4 text-slate-400 hover:text-slate-600' />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
