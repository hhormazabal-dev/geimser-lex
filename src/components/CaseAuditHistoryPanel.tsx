'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/utils';
import { getCaseAuditHistory } from '@/lib/audit/log';
import { Loader2, RefreshCcw, ShieldCheck } from 'lucide-react';

const caseAuditCache = new Map<string, AuditRow[]>();

type AuditRow = {
  id: string;
  action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  diff_json: any;
  actor?: { nombre?: string | null; role?: string | null } | null;
};

function summarizeDiff(diff: any): string | null {
  if (!diff || typeof diff !== 'object') return null;
  if (diff.created && typeof diff.created === 'object') {
    const name = diff.created.etapa ?? diff.created.nombre ?? null;
    return name ? `Creado: ${String(name)}` : 'Creado';
  }
  if (diff.deleted && typeof diff.deleted === 'object') {
    const name = diff.deleted.etapa ?? diff.deleted.nombre ?? null;
    return name ? `Eliminado: ${String(name)}` : 'Eliminado';
  }
  if (diff.completed && typeof diff.completed === 'object') {
    const date = diff.completed.fecha_cumplida ?? diff.completed.fecha_completada ?? null;
    return date ? `Completado (${String(date)})` : 'Completado';
  }
  if (diff.from && diff.to && typeof diff.from === 'object' && typeof diff.to === 'object') {
    const keys = new Set([...Object.keys(diff.from), ...Object.keys(diff.to)]);
    const changed: string[] = [];
    for (const key of keys) {
      if (key === 'updated_at') continue;
      const a = (diff.from as any)[key];
      const b = (diff.to as any)[key];
      if (a === b) continue;
      changed.push(key);
      if (changed.length >= 6) break;
    }
    return changed.length ? `Cambios: ${changed.join(', ')}` : null;
  }
  return null;
}

function labelEntity(entityType?: string | null): string {
  switch (entityType) {
    case 'case':
      return 'Caso';
    case 'case_stage':
      return 'Etapa';
    case 'document':
      return 'Documento';
    case 'note':
      return 'Nota';
    case 'info_request':
      return 'Solicitud';
    default:
      return entityType ?? 'Entidad';
  }
}

export function CaseAuditHistoryPanel({ caseId }: { caseId: string }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditRow[]>(caseAuditCache.get(caseId) ?? []);
  const [isLoading, setIsLoading] = useState(!caseAuditCache.has(caseId));
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = async () => {
    try {
      const result = await getCaseAuditHistory(caseId, { limit: 200 });
      if (!result.success) {
        throw new Error(result.error ?? 'No se pudo cargar auditoría');
      }
      const next = (result.logs ?? []) as AuditRow[];
      setLogs(next);
      caseAuditCache.set(caseId, next);
    } catch (error) {
      console.error('[CaseAuditHistoryPanel] load error', error);
      toast({
        title: 'No se pudo cargar auditoría',
        description: error instanceof Error ? error.message : 'Error inesperado',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    let canceled = false;
    if (caseAuditCache.has(caseId)) {
      setIsLoading(false);
      return () => {
        canceled = true;
      };
    }

    setIsLoading(true);
    load()
      .catch(() => null)
      .finally(() => {
        if (canceled) return;
        setIsLoading(false);
      });
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const rendered = useMemo(() => {
    return logs.map((row) => {
      const actor = row.actor?.nombre ?? 'Sistema';
      const entity = labelEntity(row.entity_type);
      const summary = summarizeDiff(row.diff_json);
      return {
        id: row.id,
        when: row.created_at,
        actor,
        action: row.action ?? 'EVENT',
        entity,
        summary,
      };
    });
  }, [logs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Registro de cambios
          <Badge variant="outline" className="ml-2">
            {logs.length}
          </Badge>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing || isLoading}>
          {isRefreshing || isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando auditoría...
          </div>
        ) : rendered.length === 0 ? (
          <p className="text-sm text-foreground/60">Aún no hay cambios registrados.</p>
        ) : (
          <div className="space-y-2">
            {rendered.slice(0, 50).map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/20 bg-white/55 px-4 py-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {row.entity} · {row.action}
                    </p>
                    <p className="text-xs text-foreground/60">
                      {row.actor} · {formatDateTime(row.when)}
                    </p>
                    {row.summary && <p className="mt-1 text-xs text-foreground/55">{row.summary}</p>}
                  </div>
                </div>
              </div>
            ))}
            {rendered.length > 50 && (
              <p className="text-xs text-foreground/55">Mostrando 50 de {rendered.length} cambios.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
