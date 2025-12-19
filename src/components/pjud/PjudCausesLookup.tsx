'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatRUT, validateRUT } from '@/lib/utils';

type OJVSelectOption = { value: string; text: string };
type OJVSelect = {
  id: string | null;
  name: string | null;
  label: string | null;
  valueTypeHint: 'numeric-string' | 'string' | 'mixed';
  options: OJVSelectOption[];
};

type OptionsResponse =
  | { success: true; baseUrl: string; selects: OJVSelect[] }
  | { success: false; error: string };

type CausesResponseOk = {
  OperationId: string;
  Status: 'OK';
  Data: { Causes: any[] } | null;
  AdditionalInformation: string | null;
  Error: null;
  LifeSpan: string | null;
};

type CausesResponseErr = {
  OperationId: string;
  Status: 'ERROR';
  Data: null;
  AdditionalInformation: string | null;
  Error: { Code?: string; Type?: string; Description?: string } | null;
  LifeSpan: string | null;
};

type CausesResponse = CausesResponseOk | CausesResponseErr;

type CompanionOptions = { baseUrl: string; selects: OJVSelect[] };
type CompanionLookup = { rows: any[] };

function normalizeText(v: string) {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
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

function normalizeCauseRowFromTable(row: Record<string, any>) {
  const keys = Object.keys(row);
  const get = (...needles: string[]) => {
    const found = keys.find((k) => needles.some((n) => normalizeText(k).includes(n)));
    const v = found ? row[found] : '';
    return typeof v === 'string' ? v : v == null ? '' : String(v);
  };

  const sourceUrl = typeof row.SourceUrl === 'string' ? row.SourceUrl : null;

  return {
    AdministrativeStatus: get('situaci', 'admin') || '',
    CauseState: get('estado') || '',
    Court: get('tribunal', 'juzgado', 'corte') || '',
    Date: get('fecha') || '',
    Labeled: get('caratul', 'caratula', 'carátul') || '',
    Litigant: [],
    Procedure: get('proced') || '',
    Resource: get('recurso') || '',
    Role: get('rol', 'rit') || '',
    Ruc: get('ruc') || '',
    Ubication: get('ubic') || '',
    SourceUrl: sourceUrl,
  };
}

declare global {
  interface Window {
    __PJUD_COMPANION__?: unknown;
  }
}

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
      reject(new Error('Companion no disponible. Abre la extensión y presiona “Conectar a esta pestaña”.'));
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

export function PjudCausesLookup() {
  const [rut, setRut] = useState('');
  const [detail, setDetail] = useState(false);

  const [companionStatus, setCompanionStatus] = useState<'unknown' | 'connected' | 'missing'>('unknown');

  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selects, setSelects] = useState<OJVSelect[]>([]);

  const [contextSelectName, setContextSelectName] = useState<string>('');
  const [courtSelectName, setCourtSelectName] = useState<string>('');
  const [contextValue, setContextValue] = useState<string>('');
  const [courtValue, setCourtValue] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CausesResponseOk | null>(null);

  const friendlyError = (raw: string) => {
    const msg = raw.trim();
    if (!msg) return 'Ocurrió un error.';
    if (normalizeText(msg).includes('no se pudo conectar a ojv')) {
      return `${msg} Esto suele pasar cuando el servidor (Vercel) no tiene acceso a la red de PJUD desde su región.`;
    }
    if (normalizeText(msg).includes('timeout conectando a ojv')) {
      return `${msg} Intenta nuevamente o configura la ejecución en una región LATAM.`;
    }
    if (normalizeText(msg) === 'fetch failed') {
      return 'No se pudo conectar a PJUD desde el servidor (fetch failed). Esto suele ser bloqueo de red/región.';
    }
    return msg;
  };

  useEffect(() => {
    let canceled = false;
    setOptionsLoading(true);
    setOptionsError(null);

    (async () => {
      // 1) Intentar vía Companion (más robusto si PJUD bloquea server-side)
      try {
        await companionRequest<{ ok: true; version: string }>('PING', null, 800);
        setCompanionStatus('connected');

        const data = await companionRequest<CompanionOptions>('OPTIONS', null, 15000);
        if (canceled) return;

        setSelects(data.selects ?? []);
        const contextSel =
          pickSelect(data.selects, ['compet', 'competencia', 'materia', 'jurisd']) ?? data.selects[0] ?? null;
        const courtSel = pickSelect(data.selects, ['corte', 'tribunal', 'juzgado', 'court']);

        if (contextSel?.name) setContextSelectName(contextSel.name);
        if (courtSel?.name) setCourtSelectName(courtSel.name);

        const ctxVal = contextSel?.options?.find((o) => o.value)?.value ?? '';
        const crtVal = courtSel?.options?.find((o) => o.value)?.value ?? '';
        setContextValue(ctxVal);
        setCourtValue(crtVal);

        setOptionsLoading(false);
        return;
      } catch {
        setCompanionStatus('missing');
      }

      // 2) Fallback server-side
      fetch('/v1/cl/services/pjud.cl/causes-per-legal-person/options')
        .then(async (res) => {
          const json = (await res.json().catch(() => null)) as OptionsResponse | null;
          if (!res.ok || !json || (json as any).success !== true) {
            const msg = (json as any)?.error ?? `No se pudieron cargar opciones PJUD (${res.status}).`;
            throw new Error(msg);
          }
          return json as Extract<OptionsResponse, { success: true }>;
        })
        .then((json) => {
          if (canceled) return;
          setSelects(json.selects ?? []);

          const contextSel =
            pickSelect(json.selects, ['compet', 'competencia', 'materia', 'jurisd']) ?? json.selects[0] ?? null;
          const courtSel = pickSelect(json.selects, ['corte', 'tribunal', 'juzgado', 'court']);

          if (contextSel?.name) setContextSelectName(contextSel.name);
          if (courtSel?.name) setCourtSelectName(courtSel.name);

          const ctxVal = contextSel?.options?.find((o) => o.value)?.value ?? '';
          const crtVal = courtSel?.options?.find((o) => o.value)?.value ?? '';
          setContextValue(ctxVal);
          setCourtValue(crtVal);
        })
        .catch((e: any) => {
          if (canceled) return;
          setOptionsError(friendlyError(e?.message ?? 'No se pudieron cargar opciones PJUD.'));
          setSelects([]);
        })
        .finally(() => {
          if (canceled) return;
          setOptionsLoading(false);
        });
    })().catch((e) => {
      if (canceled) return;
      setOptionsError(friendlyError(e?.message ?? 'No se pudieron cargar opciones PJUD.'));
      setOptionsLoading(false);
    });

    return () => {
      canceled = true;
    };
  }, []);

  const contextSelect = useMemo(
    () => selects.find((s) => s.name === contextSelectName) ?? null,
    [selects, contextSelectName],
  );
  const courtSelect = useMemo(
    () => selects.find((s) => s.name === courtSelectName) ?? null,
    [selects, courtSelectName],
  );

  const rutIsValid = useMemo(() => validateRUT(rut), [rut]);

  const canSubmit = rutIsValid && contextSelectName && contextValue && !loading;

  const onSubmit = async () => {
    setError(null);
    setResult(null);
    if (!canSubmit) return;

    setLoading(true);
    try {
      // Preferir Companion si está conectado
      if (companionStatus === 'connected') {
        const lookup = await companionRequest<CompanionLookup>(
          'LOOKUP',
          {
            rut,
            contextValue,
            courtValue: courtValue.trim().length > 0 ? courtValue : null,
            contextSelectName: contextSelectName || null,
            courtSelectName: courtSelectName || null,
            detail,
          },
          60000,
        );

        const causes = (lookup.rows ?? []).map((row) => normalizeCauseRowFromTable(row ?? {}));

        setResult({
          OperationId: `companion_${Date.now()}`,
          Status: 'OK',
          Data: { Causes: causes },
          AdditionalInformation: null,
          Error: null,
          LifeSpan: null,
        });
        return;
      }

      const res = await fetch('/v1/cl/services/pjud.cl/causes-per-legal-person', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          RequestData: {
            Rut: rut,
            Context: contextValue,
            Court: courtValue.trim().length > 0 ? courtValue : undefined,
            ContextSelect: contextSelectName,
            CourtSelect: courtSelectName.trim().length > 0 ? courtSelectName : undefined,
            Detail: detail,
          },
        }),
      });

      const json = (await res.json().catch(() => null)) as CausesResponse | null;
      if (!res.ok || !json) {
        throw new Error(`PJUD respondió ${res.status}`);
      }
      if (json.Status === 'ERROR') {
        throw new Error(json.Error?.Description ?? 'Error ejecutando consulta PJUD.');
      }

      setResult(json);
    } catch (e: any) {
      setError(friendlyError(e?.message ?? 'No se pudo ejecutar la consulta PJUD.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-white/20 bg-white/60">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            Consulta
            <Badge variant="secondary">OJV</Badge>
          </CardTitle>
          <p className="text-sm text-foreground/60">Usa los values reales de los selects del buscador PJUD.</p>
        </div>
        <Button onClick={onSubmit} disabled={!canSubmit}>
          {loading ? 'Consultando…' : 'Buscar causas'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {companionStatus !== 'connected' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Para máxima compatibilidad, instala/usa la extensión <span className="font-semibold">PJUD Companion</span>{' '}
            y presiona “Conectar a esta pestaña”.
          </div>
        )}

        {optionsLoading && <p className="text-sm text-foreground/60">Cargando opciones de PJUD…</p>}
        {optionsError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {optionsError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pjud-rut">RUT</Label>
            <Input
              id="pjud-rut"
              value={rut}
              onChange={(e) => setRut(formatRUT(e.target.value))}
              placeholder="11.111.111-1"
            />
            {!rutIsValid && rut.trim().length > 0 && (
              <p className="text-xs text-red-600">RUT inválido.</p>
            )}
          </div>

          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={detail}
                onChange={(e) => setDetail(e.target.checked)}
                className="h-4 w-4"
              />
              Incluir detalle (best-effort)
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Competencia (select)</Label>
            <select
              value={contextSelectName}
              onChange={(e) => {
                const name = e.target.value;
                setContextSelectName(name);
                const sel = selects.find((s) => s.name === name);
                setContextValue(sel?.options?.[0]?.value ?? '');
              }}
              className="h-10 w-full rounded-md border border-white/20 bg-white px-3 text-sm"
              disabled={selects.length === 0}
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {selects
                .filter((s) => s.name)
                .map((s) => (
                  <option key={s.name!} value={s.name!}>
                    {(s.label ?? s.name) as string}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Competencia (valor)</Label>
            <select
              value={contextValue}
              onChange={(e) => setContextValue(e.target.value)}
              className="h-10 w-full rounded-md border border-white/20 bg-white px-3 text-sm"
              disabled={!contextSelect}
            >
              {(contextSelect?.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.text || o.value}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Corte/Tribunal (select)</Label>
            <select
              value={courtSelectName}
              onChange={(e) => {
                const name = e.target.value;
                setCourtSelectName(name);
                const sel = selects.find((s) => s.name === name);
                setCourtValue(sel?.options?.[0]?.value ?? '');
              }}
              className="h-10 w-full rounded-md border border-white/20 bg-white px-3 text-sm"
              disabled={selects.length === 0}
            >
              <option value="">(Opcional)</option>
              {selects
                .filter((s) => s.name)
                .map((s) => (
                  <option key={s.name!} value={s.name!}>
                    {(s.label ?? s.name) as string}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Corte/Tribunal (valor)</Label>
            <select
              value={courtValue}
              onChange={(e) => setCourtValue(e.target.value)}
              className="h-10 w-full rounded-md border border-white/20 bg-white px-3 text-sm"
              disabled={!courtSelectName || !courtSelect}
            >
              {(courtSelect?.options ?? []).length === 0 && <option value="">(Opcional)</option>}
              {(courtSelect?.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.text || o.value}
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

        {result && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/70">
              <span>Operación: <span className="font-mono text-xs">{result.OperationId}</span></span>
              {result.AdditionalInformation && <span>· {result.AdditionalInformation}</span>}
              <span className="ml-auto">{result.Data?.Causes?.length ?? 0} causas</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/20 bg-white/50">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-white/60 text-xs uppercase tracking-wide text-foreground/60">
                  <tr>
                    <th className="px-4 py-3 text-left">Rol</th>
                    <th className="px-4 py-3 text-left">Carátula</th>
                    <th className="px-4 py-3 text-left">Tribunal</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.Data?.Causes ?? []).map((c: any, i: number) => (
                    <tr key={`${c.Role ?? 'cause'}-${i}`} className="border-t border-white/20">
                      <td className="px-4 py-3 font-mono text-xs">{c.Role}</td>
                      <td className="px-4 py-3">{c.Labeled}</td>
                      <td className="px-4 py-3">{c.Court}</td>
                      <td className="px-4 py-3">{c.CauseState}</td>
                      <td className="px-4 py-3">{c.Date}</td>
                      <td className="px-4 py-3">
                        {c.SourceUrl ? (
                          <a
                            href={c.SourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline underline-offset-2"
                          >
                            Ver
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                  {(result.Data?.Causes?.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-foreground/60">
                        Sin resultados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
