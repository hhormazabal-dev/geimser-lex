'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type {
  DailyStatementItem,
  DailyStatementsResponse,
  DailyStatementsHistoryEntry,
  DailyStatementsHistoryResponse,
} from '@/types/daily-statements';

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeRolLoose(raw: string): string {
  const s = normalizeSpace(raw).toUpperCase();
  if (!s) return '';

  // Normaliza formatos tipo "T-03127-2024" -> "T-3127-2024" (quita ceros a la izquierda del rol)
  const m = s.match(/^([A-Z]{1,5})\s*[-/ ]\s*([0-9]{1,10})\s*[-/ ]\s*([0-9]{4})$/);
  if (m) {
    const tipo = m[1] ?? '';
    const rol = String(Number(m[2] ?? '0'));
    const era = m[3] ?? '';
    return `${tipo}-${rol}-${era}`;
  }

  return s.replace(/\s+/g, '');
}

function isMatchToCase(item: DailyStatementItem, caseNumeroCausa: string): boolean {
  const target = normalizeRolLoose(caseNumeroCausa);
  const numero = normalizeRolLoose(item.numeroIngreso);
  if (numero === target) return true;
  if (numero && target && (numero.includes(target) || target.includes(numero))) return true;
  const meta = item.linkMeta;
  if (meta?.tipocausa && meta?.rol && meta?.era) {
    const fromMeta = `${meta.tipocausa}-${meta.rol}-${meta.era}`;
    if (normalizeRolLoose(fromMeta) === target) return true;
  }
  return false;
}

function isDDMMYYYY(value: string): boolean {
  return /^\d{2}-\d{2}-\d{4}$/.test(value);
}

function parseDDMMYYYY(value: string): Date | null {
  if (!isDDMMYYYY(value)) return null;
  const [dd, mm, yyyy] = value.split('-').map((x) => Number(x));
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (isNaN(d.getTime())) return null;
  return d;
}

function formatDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
}

function addDays(value: string, delta: number): string | null {
  const d = parseDDMMYYYY(value);
  if (!d) return null;
  d.setDate(d.getDate() + delta);
  return formatDDMMYYYY(d);
}

type DailyStatementsPanelProps = {
  caseId: string;
  caseNumeroCausa?: string | null;
};

export function DailyStatementsPanel({ caseId, caseNumeroCausa }: DailyStatementsPanelProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<DailyStatementsHistoryEntry[]>([]);
  const [historyNextTo, setHistoryNextTo] = useState<string | null>(null);
  const [historyMaxAvailableDate, setHistoryMaxAvailableDate] = useState<string | null>(null);
  const [historyScannedDays, setHistoryScannedDays] = useState<number>(0);
  const [historyFailures, setHistoryFailures] = useState<number>(0);
  const [historyPartial, setHistoryPartial] = useState<boolean>(false);
  const [lastLoading, setLastLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastNextTo, setLastNextTo] = useState<string | null>(null);
  const [lastScannedDays, setLastScannedDays] = useState<number>(0);
  const [lastFailures, setLastFailures] = useState<number>(0);
  const [lastPartial, setLastPartial] = useState<boolean>(false);
  const historyAbortRef = useRef<AbortController | null>(null);
  const lastAbortRef = useRef<AbortController | null>(null);

  const [dateInput, setDateInput] = useState<string>('');
  const [maxKnownDate, setMaxKnownDate] = useState<string | null>(null);
  const [competenciaFilter, setCompetenciaFilter] = useState<string>('all');
  const [onlyThisCase, setOnlyThisCase] = useState<boolean>(Boolean(caseNumeroCausa));
  const [search, setSearch] = useState<string>('');

  const [data, setData] = useState<DailyStatementsResponse | null>(null);

  const load = useCallback(
    async (date?: string | null, source: 'auto' | 'manual' = 'manual') => {
      setIsLoading(true);
      setError(null);
      try {
        const url = new URL(`/api/causas/${caseId}/estado-diario`, window.location.origin);
        if (date) url.searchParams.set('date', date);

        const res = await fetch(`${url.pathname}${url.search}`, { method: 'GET' });
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok || !json?.success) {
          const msg = json?.error || `Error consultando Estado Diario (${res.status}).`;
          setError(msg);
          setData(null);
          return;
        }

        const payload = json as DailyStatementsResponse;
        setData(payload);
        setDateInput(payload.date);

        if (source === 'auto') setMaxKnownDate((prev) => prev ?? (payload.maxAvailableDate || payload.date));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error inesperado.');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [caseId],
  );

  const loadHistory = useCallback(
    async (params: { mode: 'last' | 'range'; days: number; to?: string | null; append?: boolean }) => {
      if (!caseNumeroCausa) {
        toast({
          title: 'Falta ROL',
          description: 'La causa debe tener “Número de causa / ROL” para buscar histórico.',
          variant: 'destructive',
        });
        return null;
      }

      setHistoryLoading(true);
      setHistoryError(null);
      try {
        historyAbortRef.current?.abort();
        historyAbortRef.current = new AbortController();

        const url = new URL(`/api/causas/${caseId}/estado-diario/historial`, window.location.origin);
        url.searchParams.set('mode', params.mode);
        url.searchParams.set('days', String(params.days));
        if (params.to) url.searchParams.set('to', params.to);

        const res = await fetch(`${url.pathname}${url.search}`, {
          method: 'GET',
          signal: historyAbortRef.current.signal,
        });
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok || !json?.success) {
          const msg = json?.error || `Error consultando histórico (${res.status}).`;
          setHistoryError(msg);
          return null;
        }

        const payload = json as DailyStatementsHistoryResponse;
        setHistoryMaxAvailableDate(payload.maxAvailableDate);
        setHistoryNextTo(payload.nextTo);
        setHistoryScannedDays(payload.scannedDays ?? 0);
        setHistoryFailures(payload.failures ?? 0);
        setHistoryPartial(Boolean(payload.partial));
        setHistoryEntries((prev) => (params.append ? [...prev, ...(payload.matches ?? [])] : payload.matches ?? []));
        return payload;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return null;
        const msg = e instanceof Error ? e.message : 'Error inesperado.';
        setHistoryError(msg);
        return null;
      } finally {
        setHistoryLoading(false);
      }
    },
    [caseId, caseNumeroCausa, toast],
  );

  const findLastMovement = useCallback(
    async (days: number, to?: string | null) => {
      if (!caseNumeroCausa) {
        toast({
          title: 'Falta ROL',
          description: 'La causa debe tener “Número de causa / ROL” para buscar histórico.',
          variant: 'destructive',
        });
        return null;
      }

      setLastLoading(true);
      setLastError(null);
      try {
        lastAbortRef.current?.abort();
        lastAbortRef.current = new AbortController();

        const url = new URL(`/api/causas/${caseId}/estado-diario/historial`, window.location.origin);
        url.searchParams.set('mode', 'last');
        url.searchParams.set('days', String(days));
        url.searchParams.set('source', 'hybrid');
        if (to) url.searchParams.set('to', to);

        const res = await fetch(`${url.pathname}${url.search}`, {
          method: 'GET',
          signal: lastAbortRef.current.signal,
        });
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok || !json?.success) {
          const msg = json?.error || `Error consultando último movimiento (${res.status}).`;
          setLastError(msg);
          return null;
        }
        const payload = json as DailyStatementsHistoryResponse;
        setLastNextTo(payload.nextTo ?? null);
        setLastScannedDays(payload.scannedDays ?? 0);
        setLastFailures(payload.failures ?? 0);
        setLastPartial(Boolean(payload.partial));
        return payload;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return null;
        const msg = e instanceof Error ? e.message : 'Error inesperado.';
        setLastError(msg);
        return null;
      } finally {
        setLastLoading(false);
      }
    },
    [caseId, caseNumeroCausa, toast],
  );

  const HISTORY_PAGE_DAYS = 10;

  useEffect(() => {
    load(null, 'auto');
  }, [load]);

  const competences = useMemo(() => {
    const set = new Set<string>();
    for (const item of data?.items ?? []) set.add(item.competencia);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [data?.items]);

  const filteredItems = useMemo(() => {
    const q = normalizeSpace(search).toLowerCase();
    return (data?.items ?? []).filter((item) => {
      if (onlyThisCase && caseNumeroCausa && !isMatchToCase(item, caseNumeroCausa)) return false;
      if (competenciaFilter !== 'all' && item.competencia !== competenciaFilter) return false;
      if (!q) return true;
      const haystack = `${item.competencia} ${item.numeroIngreso} ${item.partes} ${item.providencias}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [caseNumeroCausa, competenciaFilter, data?.items, onlyThisCase, search]);

  const maxKey = maxKnownDate ? parseDDMMYYYY(maxKnownDate)?.getTime() ?? null : null;
  const nextDate = dateInput ? addDays(dateInput, +1) : null;
  const nextDisabled =
    isLoading ||
    !nextDate ||
    (maxKey !== null && (parseDDMMYYYY(nextDate)?.getTime() ?? 0) > maxKey);

  const prevDate = dateInput ? addDays(dateInput, -1) : null;
  const prevDisabled = isLoading || !prevDate;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Estado Diario
            </span>
            <Badge variant="outline">{filteredItems.length}</Badge>
          </CardTitle>
          <p className="text-sm text-foreground/60">
            Consulta el estado diario del tribunal para una fecha y filtra por competencia o texto.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr_220px] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="daily_date">Fecha (DD-MM-YYYY)</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => prevDate && load(prevDate)}
                  disabled={prevDisabled}
                  className="shrink-0"
                  title="Día anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input
                  id="daily_date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  placeholder="18-12-2025"
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => nextDate && load(nextDate)}
                  disabled={nextDisabled}
                  className="shrink-0"
                  title="Día siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {maxKnownDate ? (
                <p className="text-xs text-foreground/55">Último día disponible conocido: {maxKnownDate}</p>
              ) : (
                <p className="text-xs text-foreground/45">Cargando último día disponible…</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="daily_search">Buscar</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="daily_search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ej: Herrera / C-155-2025 / providencia…"
                />
                <Button
                  type="button"
                  onClick={() => {
                    const clean = normalizeSpace(dateInput);
                    if (clean && !isDDMMYYYY(clean)) {
                      toast({
                        title: 'Fecha inválida',
                        description: 'Usa formato DD-MM-YYYY.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    load(clean || null);
                  }}
                  disabled={isLoading}
                  className="shrink-0"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Consultando…
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Buscar
                    </>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="daily_only_case"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={onlyThisCase}
                  onChange={(e) => setOnlyThisCase(e.target.checked)}
                  disabled={!caseNumeroCausa}
                />
                <Label
                  htmlFor="daily_only_case"
                  className={!caseNumeroCausa ? 'text-foreground/40' : undefined}
                >
                  Solo mi causa {caseNumeroCausa ? `(${caseNumeroCausa})` : ''}
                </Label>
              </div>
              {caseNumeroCausa ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={historyLoading || lastLoading || isLoading}
                    onClick={async () => {
                      setHistoryEntries([]);
                      setHistoryNextTo(null);
                      setHistoryError(null);

                      setLastNextTo(null);
                      setLastError(null);
                      setLastFailures(0);
                      setLastPartial(false);
                      setLastScannedDays(0);

                      const payload = await findLastMovement(90, null);
                      const hit = payload?.matches?.[0];
                      if (!hit) {
                        toast({
                          title: 'Sin resultados',
                          description: payload?.partial && payload?.nextTo
                            ? 'La búsqueda quedó parcial (PJUD lento). Puedes presionar “Seguir buscando”.'
                            : 'No se encontró tu causa en los últimos 90 días. Prueba “Histórico” y carga más.',
                        });
                        return;
                      }
                      setOnlyThisCase(true);
                      setDateInput(hit.date);
                      await load(hit.date);
                      toast({ title: 'Último movimiento', description: `Encontrado en ${hit.date}.` });
                    }}
                  >
                    {lastLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Buscando…
                      </>
                    ) : (
                      'Último movimiento'
                    )}
                  </Button>

                  {lastNextTo && !lastLoading && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={historyLoading || lastLoading || isLoading}
                      onClick={async () => {
                        const payload = await findLastMovement(90, lastNextTo);
                        const hit = payload?.matches?.[0];
                        if (!hit) {
                          toast({
                            title: 'Sin resultados',
                            description: payload?.partial && payload?.nextTo
                              ? 'Sigue quedando parcial. Puedes intentar nuevamente.'
                              : 'No se encontró tu causa en el rango consultado.',
                          });
                          return;
                        }
                        setOnlyThisCase(true);
                        setDateInput(hit.date);
                        await load(hit.date);
                        toast({ title: 'Último movimiento', description: `Encontrado en ${hit.date}.` });
                      }}
                    >
                      Seguir buscando
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={historyLoading || lastLoading || isLoading}
                    onClick={async () => {
                      setHistoryEntries([]);
                      setHistoryNextTo(null);
                      setHistoryError(null);
                      await loadHistory({ mode: 'range', days: HISTORY_PAGE_DAYS, append: false });
                      toast({
                        title: 'Histórico',
                        description: `Mostrando coincidencias en los últimos ${HISTORY_PAGE_DAYS} días (puedes cargar más).`,
                      });
                    }}
                  >
                    {historyLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Buscando…
                      </>
                    ) : (
                      `Histórico ${HISTORY_PAGE_DAYS} días`
                    )}
                  </Button>

                  {(historyLoading || lastLoading) && (
                    <span className="text-xs text-foreground/55">
                      Buscando histórico… puede tardar (PJUD limita 1 req/seg).
                    </span>
                  )}
                  {(historyLoading || lastLoading) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        historyAbortRef.current?.abort();
                        lastAbortRef.current?.abort();
                        toast({ title: 'Búsqueda cancelada' });
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="daily_competencia">Competencia</Label>
              <select
                id="daily_competencia"
                className="form-input"
                value={competenciaFilter}
                onChange={(e) => setCompetenciaFilter(e.target.value)}
              >
                <option value="all">Todas</option>
                {competences.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>{error}</div>
                {error.toLowerCase().includes('región') ||
                error.toLowerCase().includes('comuna') ||
                error.toLowerCase().includes('tribunal') ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/cases/${caseId}/edit`)}
                  >
                    Editar causa
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          {historyError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {historyError}
            </div>
          )}

          {lastError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {lastError}
            </div>
          )}

          {historyEntries.length > 0 && (
            <div className="rounded-2xl border border-white/40 bg-white/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-foreground">Histórico (mi causa)</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground/60">
                    Escaneado: {historyScannedDays}d{historyPartial ? ' (parcial)' : ''}{historyFailures ? ` · fallas: ${historyFailures}` : ''}
                  </span>
                  {historyMaxAvailableDate ? (
                    <span className="text-xs text-foreground/60">Último día disponible: {historyMaxAvailableDate}</span>
                  ) : null}
                  {historyNextTo ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={historyLoading || lastLoading || isLoading}
                      onClick={() =>
                        loadHistory({ mode: 'range', days: HISTORY_PAGE_DAYS, to: historyNextTo, append: true })
                      }
                    >
                      {historyLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Cargando…
                        </>
                      ) : (
                        `Cargar ${HISTORY_PAGE_DAYS} días más`
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/60">
                    <tr className="text-left text-foreground/70">
                      <th className="px-3 py-2 font-semibold">Fecha</th>
                      <th className="px-3 py-2 font-semibold">Movimientos</th>
                      <th className="px-3 py-2 font-semibold" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/30">
                    {historyEntries.map((entry) => (
                      <tr key={entry.date}>
                        <td className="px-3 py-2 font-medium text-foreground">{entry.date}</td>
                        <td className="px-3 py-2 text-foreground/80">
                          <div className="space-y-1">
                            {entry.items.slice(0, 2).map((item, idx) => (
                              <div key={`${entry.date}-${item.numeroIngreso}-${idx}`} className="text-xs">
                                <span className="font-medium text-foreground/80">{item.competencia}</span>
                                <span className="text-foreground/60"> · </span>
                                <span className="text-foreground/75">{item.providencias}</span>
                              </div>
                            ))}
                            {entry.items.length > 2 && (
                              <div className="text-xs text-foreground/55">
                                +{entry.items.length - 2} movimiento(s) más
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              setOnlyThisCase(true);
                              setDateInput(entry.date);
                              await load(entry.date);
                            }}
                          >
                            Ver ese día
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!error && data?.dateRequested && data.dateRequested !== data.date && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {data.dateResolution === 'nearest_previous'
                ? `No hay registros para la fecha solicitada (${data.dateRequested}). Mostrando el día anterior con registros: ${data.date}.`
                : `No hay registros para la fecha solicitada (${data.dateRequested}). Mostrando el último día disponible: ${data.date}.`}
            </div>
          )}

          {!error &&
            !data?.dateRequested &&
            data?.maxAvailableDate &&
            data.maxAvailableDate !== data.date && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {data.dateResolution === 'nearest_previous'
                  ? `No hay registros para el último día disponible (${data.maxAvailableDate}). Mostrando el día anterior con registros: ${data.date}.`
                  : `Mostrando el último día disponible con registros: ${data.date}.`}
              </div>
            )}

          {!error && data && data.items.length === 0 && (
            <div className="rounded-xl border border-white/40 bg-white/70 px-4 py-6 text-sm text-foreground/70">
              No hay registros para {data.date}.
            </div>
          )}

          {!error && data && data.items.length > 0 && filteredItems.length === 0 && (
            <div className="rounded-xl border border-white/40 bg-white/70 px-4 py-6 text-sm text-foreground/70">
              {onlyThisCase && caseNumeroCausa
                ? `No hay registros para tu causa (${caseNumeroCausa}) en esta fecha. Desmarca “Solo mi causa” para ver el tribunal completo.`
                : 'No hay resultados con los filtros actuales.'}
            </div>
          )}

          {!error && filteredItems.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/70">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/60">
                    <tr className="text-left text-foreground/70">
                      <th className="px-4 py-3 font-semibold">Competencia</th>
                      <th className="px-4 py-3 font-semibold">Número de Ingreso</th>
                      <th className="px-4 py-3 font-semibold">Partes</th>
                      <th className="px-4 py-3 font-semibold">Providencias</th>
                      <th className="px-4 py-3 font-semibold" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/30">
                    {filteredItems.map((item, idx) => (
                      <DailyRow
                        key={`${item.competencia}-${item.numeroIngreso}-${idx}`}
                        item={item}
                        matchNumeroCausa={caseNumeroCausa ?? null}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DailyRow({
  item,
  matchNumeroCausa,
}: {
  item: DailyStatementItem;
  matchNumeroCausa?: string | null;
}) {
  const { toast } = useToast();
  const matches = matchNumeroCausa
    ? normalizeRolLoose(item.numeroIngreso) === normalizeRolLoose(matchNumeroCausa)
    : false;

  return (
    <tr className={matches ? 'bg-emerald-50/70' : undefined}>
      <td className="px-4 py-3 text-foreground/70">{item.competencia}</td>
      <td className="px-4 py-3 font-medium text-foreground">{item.numeroIngreso}</td>
      <td className="px-4 py-3 text-foreground/80">{item.partes}</td>
      <td className="px-4 py-3 text-foreground/80">{item.providencias}</td>
      <td className="px-4 py-3 text-right">
        {item.linkMeta ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              console.log('[Estado Diario] Ver detalle placeholder', item.linkMeta);
              toast({ title: 'Placeholder', description: 'Ver detalle aún no implementado (log en consola).' });
            }}
          >
            Ver detalle
          </Button>
        ) : null}
      </td>
    </tr>
  );
}
