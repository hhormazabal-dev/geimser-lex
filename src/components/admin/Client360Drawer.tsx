'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getClientDetail } from '@/lib/actions/analytics';
import { updateCase } from '@/lib/actions/cases';
import { cn, formatDate, formatDateTime, formatRelativeTime, getInitials, stringToColor } from '@/lib/utils';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, Calendar, Loader2, Mail, Phone, Save, X } from 'lucide-react';

type ClientDetail = {
  client: { id: string; nombre: string | null; rut: string | null; email: string | null; telefono: string | null };
  stats: {
    totalCases: number;
    activeCases: number;
    urgentCases: number;
    inReviewCases: number;
    overdueStages: number;
    totalLawyers: number;
  };
  cases: Array<{
    id: string;
    caratulado: string;
    estado: string | null;
    prioridad: string | null;
    etapa_actual: string | null;
    fecha_inicio: string | null;
    workflow_state: string | null;
    abogado_responsable: { id: string; nombre: string | null } | null;
    nextStage: { etapa: string; fecha_programada: string | null; estado: string; orden: number | null; isOverdue: boolean } | null;
    next_action_at?: string | null;
    next_action_title?: string | null;
  }>;
};

function toDatetimeLocalValue(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function Client360Drawer({
  open,
  onOpenChange,
  clientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  onNavigateToClient?: (clientId: string) => void;
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ClientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [nextActionTitle, setNextActionTitle] = useState('');
  const [nextActionAt, setNextActionAt] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const clientName = data?.client.nombre ?? 'Cliente';
  const avatarBg = useMemo(() => stringToColor(clientName), [clientName]);

  useEffect(() => {
    if (!open || !clientId) return;
    let canceled = false;
    setIsLoading(true);
    setError(null);
    setData(null);
    setEditingCaseId(null);
    (async () => {
      try {
        const result = await getClientDetail(clientId);
        if (canceled) return;
        if (!result.success || !result.data) {
          setError(result.error ?? 'No se pudo cargar el cliente.');
          return;
        }
        setData(result.data as any);
      } catch (e) {
        if (canceled) return;
        setError(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        if (!canceled) setIsLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [clientId, open]);

  const startEdit = (caseId: string) => {
    const c = data?.cases.find((row) => row.id === caseId) ?? null;
    setEditingCaseId(caseId);
    setNextActionTitle((c?.next_action_title ?? '').toString());
    setNextActionAt(toDatetimeLocalValue(c?.next_action_at ?? null));
  };

  const cancelEdit = () => {
    setEditingCaseId(null);
    setNextActionTitle('');
    setNextActionAt('');
  };

  const saveNextAction = async (caseId: string) => {
    try {
      setIsSaving(true);
      const iso = nextActionAt ? new Date(nextActionAt).toISOString() : '';
      const result = await updateCase(caseId, {
        next_action_title: nextActionTitle,
        next_action_at: iso,
      } as any);

      if (!result.success) {
        toast({
          title: 'No se pudo guardar',
          description: result.error ?? 'Intenta nuevamente.',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Próxima acción actualizada', description: 'Quedó guardada en el caso.' });
      cancelEdit();

      if (clientId) {
        const refresh = await getClientDetail(clientId);
        if (refresh.success && refresh.data) setData(refresh.data as any);
      }
    } catch (e) {
      console.error('[Client360Drawer] saveNextAction', e);
      toast({
        title: 'Error inesperado',
        description: 'No se pudo guardar la próxima acción.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className='fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm' />
        <Dialog.Content className='fixed right-0 top-0 z-50 h-full w-full max-w-[560px] overflow-hidden border-l border-white/20 bg-white/90 shadow-2xl backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right'>
          <div className='flex h-full flex-col'>
            <header className='border-b border-slate-200/70 px-6 py-5'>
              <div className='flex items-start justify-between gap-3'>
                <div className='flex items-start gap-3'>
                  <div
                    className='flex h-12 w-12 items-center justify-center rounded-2xl text-white font-semibold shadow-sm'
                    style={{ backgroundColor: avatarBg }}
                  >
                    {getInitials(clientName)}
                  </div>
                  <div className='min-w-0'>
                    <Dialog.Title className='truncate text-lg font-semibold text-slate-900'>
                      {clientName}
                    </Dialog.Title>
                    <p className='mt-1 text-xs text-slate-500'>
                      {data?.client.rut ? data.client.rut : 'Cliente'}
                      {data?.stats ? ` · ${data.stats.activeCases} casos activos` : ''}
                    </p>
                    <div className='mt-3 flex flex-wrap gap-2'>
                      <Badge variant='outline' className='border-slate-200 text-slate-600'>
                        {data?.stats?.urgentCases ?? 0} urgentes
                      </Badge>
                      <Badge variant='outline' className='border-slate-200 text-slate-600'>
                        {data?.stats?.inReviewCases ?? 0} en revisión
                      </Badge>
                      <Badge variant='outline' className='border-slate-200 text-slate-600'>
                        {data?.stats?.overdueStages ?? 0} vencidas
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className='flex items-center gap-2'>
                  {clientId && (
                    <Button asChild size='sm' className='rounded-full bg-slate-900 text-white hover:bg-slate-800'>
                      <Link href={`/dashboard/admin/clients/${clientId}`}>
                        Ver detalle <ArrowUpRight className='ml-2 h-4 w-4' />
                      </Link>
                    </Button>
                  )}
                  <Dialog.Close asChild>
                    <Button size='sm' variant='ghost' className='rounded-full px-3'>
                      <X className='h-4 w-4' />
                    </Button>
                  </Dialog.Close>
                </div>
              </div>

              {(data?.client.email || data?.client.telefono) && (
                <div className='mt-4 grid gap-2 sm:grid-cols-2'>
                  {data.client.email && (
                    <div className='flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700'>
                      <Mail className='h-4 w-4 text-slate-400' />
                      <span className='truncate'>{data.client.email}</span>
                    </div>
                  )}
                  {data.client.telefono && (
                    <div className='flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700'>
                      <Phone className='h-4 w-4 text-slate-400' />
                      <span className='truncate'>{data.client.telefono}</span>
                    </div>
                  )}
                </div>
              )}
            </header>

            <div className='flex-1 overflow-y-auto px-6 py-6'>
              {isLoading && (
                <div className='flex items-center justify-center py-10 text-slate-500'>
                  <Loader2 className='mr-2 h-5 w-5 animate-spin' />
                  Cargando cliente…
                </div>
              )}

              {!isLoading && error && (
                <Card className='rounded-3xl border border-rose-200 bg-rose-50/70 p-5 text-rose-700'>
                  {error}
                </Card>
              )}

              {!isLoading && data && (
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <p className='text-sm font-semibold text-slate-900'>Casos</p>
                    <Button asChild variant='outline' size='sm' className='rounded-full border-slate-200 bg-white/80'>
                      <Link href='/cases/new'>Nuevo caso</Link>
                    </Button>
                  </div>

                  <div className='space-y-3'>
                    {data.cases.map((c) => {
                      const hasNext = Boolean(c.next_action_at);
                      const missingNext = c.estado === 'activo' && !hasNext;
                      const stage = c.nextStage;
                      const stageDate = stage?.fecha_programada ?? null;
                      const editing = editingCaseId === c.id;

                      return (
                        <div
                          key={c.id}
                          className={cn(
                            'rounded-3xl border bg-white/80 p-5 shadow-sm',
                            missingNext ? 'border-sky-200' : 'border-slate-200',
                          )}
                        >
                          <div className='flex items-start justify-between gap-3'>
                            <div className='min-w-0 space-y-1'>
                              <Link href={`/cases/${c.id}`} className='block truncate text-sm font-semibold text-slate-900 hover:text-sky-700'>
                                {c.caratulado}
                              </Link>
                              <div className='flex flex-wrap items-center gap-2 text-xs text-slate-500'>
                                <span>{c.etapa_actual ?? 'Etapa sin definir'}</span>
                                {c.fecha_inicio ? <span>· Inicio {formatDate(c.fecha_inicio)}</span> : null}
                                {c.abogado_responsable?.nombre ? <span>· {c.abogado_responsable.nombre}</span> : null}
                              </div>
                            </div>
                            <div className='flex flex-col items-end gap-2'>
                              {c.prioridad ? (
                                <Badge
                                  variant='outline'
                                  className={cn(
                                    'border-slate-200 text-slate-700',
                                    c.prioridad === 'urgente' && 'border-rose-200 bg-rose-50 text-rose-700',
                                    c.prioridad === 'alta' && 'border-amber-200 bg-amber-50 text-amber-700',
                                  )}
                                >
                                  {c.prioridad}
                                </Badge>
                              ) : null}
                              {c.workflow_state ? (
                                <Badge variant='outline' className='border-slate-200 text-slate-600'>
                                  {c.workflow_state}
                                </Badge>
                              ) : null}
                            </div>
                          </div>

                          {stage?.etapa && (
                            <div className={cn('mt-4 rounded-2xl border px-4 py-3 text-sm', stage.isOverdue ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-700')}>
                              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'>Próximo hito (timeline)</p>
                              <p className='mt-2 font-medium text-slate-900'>{stage.etapa}</p>
                              {stageDate && (
                                <p className='mt-1 text-xs text-slate-500'>
                                  {formatDate(stageDate)} · {formatRelativeTime(stageDate)}
                                </p>
                              )}
                            </div>
                          )}

                          <div className='mt-4 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3'>
                            <div className='flex items-start justify-between gap-3'>
                              <div className='min-w-0'>
                                <p className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'>
                                  Próxima acción (CRM)
                                </p>
                                {hasNext ? (
                                  <div className='mt-2 space-y-1'>
                                    <p className='truncate text-sm font-medium text-slate-900'>
                                      {c.next_action_title ?? 'Próxima acción'}
                                    </p>
                                    <p className='text-xs text-slate-500'>
                                      {formatDateTime(c.next_action_at)} · {formatRelativeTime(c.next_action_at)}
                                    </p>
                                  </div>
                                ) : (
                                  <p className={cn('mt-2 text-sm', missingNext ? 'text-sky-700' : 'text-slate-500')}>
                                    {missingNext ? 'Falta definir una próxima acción.' : 'Sin próxima acción.'}
                                  </p>
                                )}
                              </div>
                              <div className='flex items-center gap-2'>
                                <Button
                                  size='sm'
                                  variant='outline'
                                  className='rounded-full border-slate-200 bg-white/80'
                                  onClick={() => startEdit(c.id)}
                                >
                                  {hasNext ? 'Editar' : 'Definir'}
                                </Button>
                              </div>
                            </div>

                            {editing && (
                              <div className='mt-4 space-y-3 border-t border-slate-200 pt-4'>
                                <div className='space-y-2'>
                                  <Label className='text-xs text-slate-600'>Qué se hará</Label>
                                  <Input
                                    value={nextActionTitle}
                                    onChange={(e) => setNextActionTitle(e.target.value)}
                                    placeholder='Ej: Llamar cliente / revisar escrito / enviar docs...'
                                    className='rounded-2xl'
                                  />
                                </div>
                                <div className='space-y-2'>
                                  <Label className='text-xs text-slate-600'>Cuándo</Label>
                                  <div className='flex items-center gap-2'>
                                    <div className='flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2'>
                                      <Calendar className='h-4 w-4 text-slate-400' />
                                      <input
                                        type='datetime-local'
                                        value={nextActionAt}
                                        onChange={(e) => setNextActionAt(e.target.value)}
                                        className='w-full bg-transparent text-sm text-slate-700 outline-none'
                                      />
                                    </div>
                                    <Button
                                      size='sm'
                                      className='rounded-full bg-slate-900 text-white hover:bg-slate-800'
                                      onClick={() => saveNextAction(c.id)}
                                      disabled={isSaving}
                                    >
                                      {isSaving ? (
                                        <>
                                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                          Guardando…
                                        </>
                                      ) : (
                                        <>
                                          <Save className='mr-2 h-4 w-4' />
                                          Guardar
                                        </>
                                      )}
                                    </Button>
                                    <Button size='sm' variant='ghost' className='rounded-full' onClick={cancelEdit} disabled={isSaving}>
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                                <p className='text-xs text-slate-500'>
                                  Tip: si dejas la fecha vacía, se limpia el seguimiento.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

