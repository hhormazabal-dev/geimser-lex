'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import type { DailyStatementItem, DailyStatementsResponse } from '@/types/daily-statements';

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeRol(value: string): string {
  return normalizeSpace(value).toUpperCase().replace(/\s+/g, '');
}

function isMatchToCase(item: DailyStatementItem, caseNumeroCausa: string): boolean {
  const target = normalizeRol(caseNumeroCausa);
  if (normalizeRol(item.numeroIngreso) === target) return true;
  const meta = item.linkMeta;
  if (meta?.tipocausa && meta?.rol && meta?.era) {
    const fromMeta = `${meta.tipocausa}-${meta.rol}-${meta.era}`;
    if (normalizeRol(fromMeta) === target) return true;
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        if (source === 'auto') setMaxKnownDate((prev) => prev ?? payload.date);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error inesperado.');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [caseId],
  );

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
              {error}
            </div>
          )}

          {!error && data && data.items.length === 0 && (
            <div className="rounded-xl border border-white/40 bg-white/70 px-4 py-6 text-sm text-foreground/70">
              No hay registros para {data.date}.
            </div>
          )}

          {!error && data && data.items.length > 0 && filteredItems.length === 0 && (
            <div className="rounded-xl border border-white/40 bg-white/70 px-4 py-6 text-sm text-foreground/70">
              No hay resultados con los filtros actuales.
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
    ? normalizeRol(item.numeroIngreso) === normalizeRol(matchNumeroCausa)
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
