'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ShieldCheck, ExternalLink } from 'lucide-react';
import { formatDate, formatRelativeTime, formatRUT, truncateText } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { listComplianceSubjectsForCase, type ComplianceSubjectDTO } from '@/lib/actions/compliance-monitoring';
import type { ComplianceSource } from '@/lib/compliance/sources';

type Props = {
  caseId: string;
  canRefresh: boolean;
};

function kindLabel(kind: ComplianceSubjectDTO['kind']) {
  if (kind === 'client') return 'Cliente';
  if (kind === 'counterparty') return 'Contraparte';
  return 'Otro';
}

function pickSnapshot(subject: ComplianceSubjectDTO, source: string) {
  return subject.latest_snapshots?.[source] ?? null;
}

export function ComplianceMonitoringPanel({ caseId, canRefresh }: Props) {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<ComplianceSubjectDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, startRefresh] = useTransition();
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const [sources, setSources] = useState<ComplianceSource[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listComplianceSubjectsForCase(caseId);
      if (!res.success) throw new Error(res.error ?? 'No se pudo cargar monitoreo.');
      setSubjects(res.subjects ?? []);
    } catch (e: any) {
      console.error('[ComplianceMonitoringPanel] load error', e);
      toast({ title: 'Monitoreo', description: e?.message ?? 'No se pudo cargar.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/compliance/sources')
      .then((r) => r.json().catch(() => null))
      .then((json) => {
        if (json?.ok && Array.isArray(json.sources)) setSources(json.sources as ComplianceSource[]);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    load().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const expanded = useMemo(
    () => subjects.find((s) => s.id === expandedSubjectId) ?? null,
    [expandedSubjectId, subjects],
  );

  const handleRefresh = () => {
    startRefresh(async () => {
      try {
        const res = await fetch('/api/compliance/refresh-case', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ caseId }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error ?? `No se pudo actualizar (${res.status}).`);
        }

        toast({
          title: 'Monitoreo actualizado',
          description: `Consultado PJUD para ${json.refreshed ?? 0} RUT(s).`,
        });

        await load();
      } catch (e: any) {
        console.error('[ComplianceMonitoringPanel] refresh error', e);
        toast({
          title: 'No se pudo actualizar',
          description: e?.message ?? 'Error consultando monitoreo.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Monitoreo
            </CardTitle>
            {sources.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sources.slice(0, 3).map((s) => (
                  <Badge key={s.id} variant="secondary">
                    {s.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canRefresh && (
              <Button size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando…
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Actualizar
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando monitoreo…
            </div>
          ) : subjects.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-foreground/60">
                Aún no hay sujetos monitoreados para este caso.
              </p>
              {canRefresh && (
                <p className="text-xs text-foreground/50">
                  Tip: agrega RUTs en Cliente/Contrapartes y presiona “Actualizar”.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {subjects.map((s) => {
                const latest = pickSnapshot(s, 'pjud_ojv') ?? s.latest_snapshot;
                const total = Number(latest?.summary?.total_causes ?? 0);
                const latestDate = typeof latest?.summary?.latest_date === 'string' ? latest.summary.latest_date : null;
                const lastFetched = latest?.fetched_at ? formatRelativeTime(latest.fetched_at) : null;
                const hasError = Boolean(latest?.error);
                const sourcesPresent = Object.keys(s.latest_snapshots ?? {});

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setExpandedSubjectId((prev) => (prev === s.id ? null : s.id))}
                    className="flex w-full items-start justify-between gap-3 rounded-2xl border border-white/20 bg-white/55 px-4 py-3 text-left hover:bg-white/70"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{s.display_name}</p>
                        <Badge variant="outline">{kindLabel(s.kind)}</Badge>
                        {s.role && <Badge variant="secondary">{s.role}</Badge>}
                        {hasError && <Badge variant="destructive">Error</Badge>}
                        {sourcesPresent.length > 1 && (
                          <Badge variant="secondary">+{sourcesPresent.length - 1} fuente(s)</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-foreground/60">
                        {formatRUT(s.rut)} {lastFetched ? `· actualizado ${lastFetched}` : ''}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-foreground">{total}</p>
                      <p className="text-xs text-foreground/55">
                        {latestDate ? `Últ.: ${formatDate(latestDate)}` : 'Sin fecha'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {expanded && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Detalle · {expanded.display_name} ({formatRUT(expanded.rut)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!expanded.latest_snapshot && Object.keys(expanded.latest_snapshots ?? {}).length === 0 ? (
              <p className="text-sm text-foreground/60">Sin snapshot aún.</p>
            ) : (
              <div className="space-y-3">
                {/* PJUD */}
                {(() => {
                  const snap = pickSnapshot(expanded, 'pjud_ojv');
                  if (!snap) return null;
                  if (snap.error) {
                    return (
                      <div className="space-y-2">
                        <Badge variant="destructive">PJUD · Error</Badge>
                        <p className="text-sm text-foreground/60">{snap.error}</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-foreground/55">PJUD · actualizado: {formatDate(snap.fetched_at)}</p>
                      <div className="space-y-2">
                        {(snap.payload?.causes ?? []).slice(0, 12).map((c: any, idx: number) => {
                          const sourceUrl = typeof c.sourceUrl === 'string' ? c.sourceUrl : null;
                          const labeled = typeof c.labeled === 'string' ? c.labeled : '';
                          const court = typeof c.court === 'string' ? c.court : '';
                          const role = typeof c.role === 'string' ? c.role : '';
                          const date = typeof c.date === 'string' ? c.date : '';
                          return (
                            <div
                              key={`${expanded.id}_pjud_${idx}`}
                              className="rounded-2xl border border-white/20 bg-white/55 px-4 py-3"
                            >
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground">
                                    {truncateText(labeled || 'Causa', 120)}
                                  </p>
                                  <p className="mt-1 text-xs text-foreground/55">
                                    {role ? `${role} · ` : ''}
                                    {court}
                                    {date ? ` · ${date}` : ''}
                                  </p>
                                </div>
                                {sourceUrl && (
                                  <a
                                    href={sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Ver <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {(snap.payload?.causes ?? []).length > 12 && (
                        <p className="text-xs text-foreground/55">
                          Mostrando 12 de {(snap.payload?.causes ?? []).length} causas.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* ChileCompra */}
                {(() => {
                  const snap = pickSnapshot(expanded, 'chilecompra_supplier');
                  if (!snap) return null;
                  const supplier = (snap.payload?.suppliers ?? [])[0] ?? null;
                  const found = Boolean(snap.summary?.supplier_found);
                  return (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs text-foreground/55">
                        ChileCompra · actualizado: {formatDate(snap.fetched_at)}
                      </p>
                      {snap.error ? (
                        <div className="space-y-1">
                          <Badge variant="destructive">ChileCompra · Error</Badge>
                          <p className="text-sm text-foreground/60">{snap.error}</p>
                        </div>
                      ) : found ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">Proveedor</Badge>
                          <span className="text-sm text-foreground/70">
                            Código: {supplier?.codigoEmpresa ?? snap.summary?.codigo_empresa ?? '—'}
                          </span>
                          {supplier?.nombreEmpresa && (
                            <span className="text-sm text-foreground/70">{supplier.nombreEmpresa}</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">No proveedor</Badge>
                          <span className="text-sm text-foreground/60">Sin coincidencias en Mercado Público.</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
