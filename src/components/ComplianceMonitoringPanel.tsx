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

function normalizeText(v: string) {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

type OJVSelectOption = { value: string; text: string };
type OJVSelect = {
  id: string | null;
  name: string | null;
  label: string | null;
  valueTypeHint: 'numeric-string' | 'string' | 'mixed';
  options: OJVSelectOption[];
};

const CHANNEL_REQUEST = 'PJUD_COMPANION_REQUEST';
const CHANNEL_RESPONSE = 'PJUD_COMPANION_RESPONSE';

function randomId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function companionRequest<T>(action: 'PING' | 'OPTIONS' | 'LOOKUP', payload?: any, timeoutMs = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = randomId();
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('Companion no disponible.'));
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const msg = event.data;
      if (!msg || msg.type !== CHANNEL_RESPONSE) return;
      if (msg.requestId !== requestId) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);

      if (msg.ok) resolve(msg.data as T);
      else reject(new Error(msg.error ?? 'Error Companion'));
    }

    window.addEventListener('message', onMessage);
    window.postMessage({ type: CHANNEL_REQUEST, requestId, action, payload }, '*');
  });
}

function pickSelect(selects: OJVSelect[], keywords: string[]) {
  const scored = selects
    .filter((s) => s.name && s.options.length > 0)
    .map((s) => {
      const hay = normalizeText(`${s.label ?? ''} ${s.name ?? ''}`);
      const score = keywords.reduce((acc, k) => acc + (hay.includes(k) ? 1 : 0), 0);
      return { s, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].s : null;
}

async function getPjudConfig(): Promise<
  | {
      contextSelectName: string;
      contextValue: string;
      courtSelectName?: string;
      courtValue?: string;
    }
  | null
> {
  // 1) Intentar vía Companion (más robusto si PJUD bloquea server-side)
  try {
    await companionRequest<{ ok: true; version: string }>('PING', null, 800);
    const data = await companionRequest<{ baseUrl: string; selects: OJVSelect[] }>('OPTIONS', null, 15000);
    const selects = data.selects ?? [];
    const contextSel =
      pickSelect(selects, ['compet', 'competencia', 'materia', 'jurisd']) ?? selects[0] ?? null;
    const courtSel = pickSelect(selects, ['corte', 'tribunal', 'juzgado', 'court']);
    if (!contextSel?.name) return null;
    const ctxVal = contextSel.options?.find((o) => o.value)?.value ?? '';
    if (!ctxVal) return null;
    const crtVal = courtSel?.options?.find((o) => o.value)?.value ?? '';
    return {
      contextSelectName: contextSel.name,
      contextValue: ctxVal,
      ...(courtSel?.name ? { courtSelectName: courtSel.name } : {}),
      ...(crtVal ? { courtValue: crtVal } : {}),
    };
  } catch {
    // ignore
  }

  // 2) Fallback server-side options
  try {
    const res = await fetch('/v1/cl/services/pjud.cl/causes-per-legal-person/options', { method: 'GET' });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok || !json?.success) return null;
    const selects = (json.selects ?? []) as OJVSelect[];
    const contextSel =
      pickSelect(selects, ['compet', 'competencia', 'materia', 'jurisd']) ?? selects[0] ?? null;
    const courtSel = pickSelect(selects, ['corte', 'tribunal', 'juzgado', 'court']);
    if (!contextSel?.name) return null;
    const ctxVal = contextSel.options?.find((o) => o.value)?.value ?? '';
    if (!ctxVal) return null;
    const crtVal = courtSel?.options?.find((o) => o.value)?.value ?? '';
    return {
      contextSelectName: contextSel.name,
      contextValue: ctxVal,
      ...(courtSel?.name ? { courtSelectName: courtSel.name } : {}),
      ...(crtVal ? { courtValue: crtVal } : {}),
    };
  } catch {
    return null;
  }
}

function normalizeCauseRowFromTable(row: Record<string, any>) {
  const keys = Object.keys(row);
  const get = (...needles: string[]) => {
    const found = keys.find((k) => needles.some((n) => normalizeText(k).includes(n)));
    const v = found ? row[found] : '';
    return typeof v === 'string' ? v : v == null ? '' : String(v);
  };

  const sourceUrl = typeof row.SourceUrl === 'string' ? row.SourceUrl : null;

  return {
    administrativeStatus: get('situaci', 'admin') || '',
    causeState: get('estado') || '',
    court: get('tribunal', 'juzgado', 'corte') || '',
    date: get('fecha') || '',
    labeled: get('caratul', 'caratula', 'carátul') || '',
    procedure: get('proced') || '',
    resource: get('recurso') || '',
    role: get('rol', 'rit') || '',
    ruc: get('ruc') || '',
    ubication: get('ubic') || '',
    sourceUrl,
  };
}

function summarizeCauseRows(rows: Array<{ date?: string | null; court?: string | null }>) {
  const dates = rows
    .map((c) => String(c.date ?? '').trim())
    .filter(Boolean)
    .map((d) => {
      // Acepta YYYY-MM-DD o DD/MM/YYYY
      const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})$/) ? d : null;
      if (iso) return iso;
      const m = d.match(/^(\d{1,2})[\\/.-](\d{1,2})[\\/.-](\d{2,4})$/);
      if (!m) return null;
      const dd = String(m[1]).padStart(2, '0');
      const mm = String(m[2]).padStart(2, '0');
      const yyyy = String(m[3]).length === 2 ? `20${m[3]}` : String(m[3]);
      return `${yyyy}-${mm}-${dd}`;
    })
    .filter((d): d is string => Boolean(d))
    .sort()
    .reverse();

  const courts = new Set<string>();
  for (const r of rows) {
    const c = String(r.court ?? '').trim();
    if (c) courts.add(c);
  }

  return { total_causes: rows.length, latest_date: dates[0] ?? null, distinct_courts: courts.size };
}

export function ComplianceMonitoringPanel({ caseId, canRefresh }: Props) {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<ComplianceSubjectDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, startRefresh] = useTransition();
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const [sources, setSources] = useState<ComplianceSource[]>([]);

  const load = async (): Promise<ComplianceSubjectDTO[]> => {
    setLoading(true);
    try {
      const res = await listComplianceSubjectsForCase(caseId);
      if (!res.success) throw new Error(res.error ?? 'No se pudo cargar monitoreo.');
      const nextSubjects = res.subjects ?? [];
      setSubjects(nextSubjects);
      return nextSubjects;
    } catch (e: any) {
      console.error('[ComplianceMonitoringPanel] load error', e);
      toast({ title: 'Monitoreo', description: e?.message ?? 'No se pudo cargar.', variant: 'destructive' });
      return [];
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
        // 1) Siempre: upsert de sujetos/links + otras fuentes server-side (on-demand, sin cron).
        const otherSources = ['chilecompra_supplier'];
        const res = await fetch('/api/compliance/refresh-case', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ caseId, sources: otherSources }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error ?? `No se pudo actualizar (${res.status}).`);
        }

        const current = await load();

        // 2) PJUD via Companion: lookup por RUT en el browser (más robusto, on-demand).
        const pjud = await getPjudConfig();
        const canUseCompanion = Boolean(pjud);
        if (canUseCompanion && current.length > 0) {
          const lookups = await Promise.all(
            current.map(async (s) => {
              try {
                const res = await companionRequest<{ rows: Record<string, any>[] }>(
                  'LOOKUP',
                  {
                    rut: s.rut,
                    contextValue: pjud!.contextValue,
                    contextSelectName: pjud!.contextSelectName,
                    ...(pjud!.courtValue ? { courtValue: pjud!.courtValue } : {}),
                    ...(pjud!.courtSelectName ? { courtSelectName: pjud!.courtSelectName } : {}),
                  },
                  45000,
                );

                const normalized = (res?.rows ?? []).map(normalizeCauseRowFromTable);
                return {
                  subjectId: s.id,
                  source: 'pjud_companion',
                  summary: summarizeCauseRows(normalized),
                  payload: { causes: normalized.slice(0, 200), via: 'companion' },
                  error: null,
                };
              } catch (e: any) {
                return {
                  subjectId: s.id,
                  source: 'pjud_companion',
                  summary: { total_causes: 0, latest_date: null, distinct_courts: 0 },
                  payload: { via: 'companion' },
                  error: e?.message ?? 'Error consultando PJUD (Companion).',
                };
              }
            }),
          );

          const ingestRes = await fetch('/api/compliance/ingest-snapshots', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ caseId, snapshots: lookups }),
          });
          const ingestJson = await ingestRes.json().catch(() => null);
          if (!ingestRes.ok || !ingestJson?.ok) {
            throw new Error(ingestJson?.error ?? `No se pudo guardar snapshots (${ingestRes.status}).`);
          }
        }

        toast({
          title: 'Monitoreo actualizado',
          description: `Actualizado. Fuentes: ${(json.sources ?? []).join(', ') || '—'}${
            canUseCompanion ? ' + PJUD (Companion)' : ''
          }.`,
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
                const latest = pickSnapshot(s, 'pjud_companion') ?? pickSnapshot(s, 'pjud_ojv') ?? s.latest_snapshot;
                const total = Number(latest?.summary?.total_causes ?? 0);
                const latestDate = typeof latest?.summary?.latest_date === 'string' ? latest.summary.latest_date : null;
                const lastFetched = latest?.fetched_at ? formatRelativeTime(latest.fetched_at) : null;
                const snapshots = Object.values(s.latest_snapshots ?? {});
                const hasAnyOk = snapshots.some((snap) => !snap.error);
                const hasAnyError = snapshots.some((snap) => Boolean(snap.error));
                const showError = !hasAnyOk && hasAnyError;
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
                        {showError && <Badge variant="destructive">Error</Badge>}
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
                  const snap = pickSnapshot(expanded, 'pjud_companion') ?? pickSnapshot(expanded, 'pjud_ojv');
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
                      <p className="text-xs text-foreground/55">
                        PJUD · actualizado: {formatDate(snap.fetched_at)} ({snap.source === 'pjud_companion' ? 'Companion' : 'Server'})
                      </p>
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

                {(() => {
                  const snap = pickSnapshot(expanded, 'pjud_ojv');
                  if (!snap) return null;
                  // If present, it's already rendered by unified PJUD block above; avoid duplicate.
                  return null;
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
