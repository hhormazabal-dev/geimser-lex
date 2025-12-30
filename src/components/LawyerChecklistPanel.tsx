'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  createLawyerChecklistItem,
  deleteLawyerChecklistItem,
  listLawyerChecklist,
  toggleLawyerChecklistItem,
  type LawyerChecklistItemDTO,
} from '@/lib/actions/lawyer-checklist';
import { Loader2, Plus, Trash2 } from 'lucide-react';

export function LawyerChecklistPanel({ caseId, canEdit }: { caseId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = useState<LawyerChecklistItemDTO[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const completedCount = useMemo(() => items.filter((i) => i.is_done).length, [items]);

  useEffect(() => {
    let canceled = false;
    setIsLoading(true);
    listLawyerChecklist(caseId)
      .then((res) => {
        if (canceled) return;
        if (res.success) {
          setItems(res.items);
        } else {
          toast({ title: 'No se pudo cargar el checklist', description: res.error, variant: 'destructive' });
        }
      })
      .catch((error) => {
        console.error('[LawyerChecklistPanel] load error', error);
        toast({ title: 'Error inesperado', description: 'No fue posible cargar el checklist.', variant: 'destructive' });
      })
      .finally(() => {
        if (canceled) return;
        setIsLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [caseId, toast]);

  const handleAdd = () => {
    const title = draft.trim();
    if (title.length < 2) return;

    startTransition(async () => {
      const res = await createLawyerChecklistItem({ case_id: caseId, title });
      if (res.success && res.item) {
        setItems((prev) => [...prev, res.item].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
        setDraft('');
      } else {
        toast({ title: 'No se pudo crear', description: res.error, variant: 'destructive' });
      }
    });
  };

  const handleToggle = (id: string, next: boolean) => {
    startTransition(async () => {
      const res = await toggleLawyerChecklistItem({ id, is_done: next });
      if (res.success) {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_done: next } : item)));
      } else {
        toast({ title: 'No se pudo actualizar', description: res.error, variant: 'destructive' });
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteLawyerChecklistItem({ id });
      if (res.success) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        toast({ title: 'No se pudo eliminar', description: res.error, variant: 'destructive' });
      }
    });
  };

  return (
    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Checklist interno</CardTitle>
          <p className="text-sm text-slate-500">
            Control profesional (solo staff). {completedCount}/{items.length} completados.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Añadir un ítem…"
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button type="button" onClick={handleAdd} disabled={isPending || draft.trim().length < 2}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-2">Agregar</span>
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="h-24 rounded-xl bg-slate-100/60" />
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay ítems en el checklist.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3"
              >
                <label className="flex flex-1 items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={item.is_done}
                    onChange={(e) => handleToggle(item.id, e.target.checked)}
                    disabled={isPending || !canEdit}
                  />
                  <span className={`text-sm ${item.is_done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {item.title}
                  </span>
                </label>

                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item.id)}
                    disabled={isPending}
                    aria-label="Eliminar ítem"
                  >
                    <Trash2 className="h-4 w-4 text-slate-500" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

