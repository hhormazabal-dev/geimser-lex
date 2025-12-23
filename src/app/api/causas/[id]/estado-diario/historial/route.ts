import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/roles';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { getPjudDailyStatementsCached } from '@/lib/pjud/daily-statements';
import { fetchPjudDailyStatementsHtml } from '@/lib/pjud/daily-statements';
import { parsePjudDailyStatementsHtml } from '@/lib/pjud/daily-statements-parser';
import { getTipoJuzgadoCandidates } from '@/lib/pjud/tipo-juzgado';
import { fetchPjudTribunalesByComunaCode, findTribunalByName, resolveComunaCode } from '@/lib/pjud/tribunales';
import type {
  DailyStatementItem,
  DailyStatementsHistoryEntry,
  DailyStatementsHistoryResponse,
  DailyStatementsHistoryMode,
} from '@/types/daily-statements';

export const runtime = 'nodejs';

type CourtConfig = { codTribunal: string; tipoJuzgado: string; nombreTribunal: string };

function isDDMMYYYY(value: string): boolean {
  return /^\d{2}-\d{2}-\d{4}$/.test(value);
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error.trim() || 'Error inesperado.';
  if (!error) return 'Error inesperado.';
  if (typeof error === 'object') {
    const maybeMessage = (error as any).message ?? (error as any).error ?? (error as any).details;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage.trim();
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Error inesperado.';
  }
}

function isMissingTableError(error: unknown, table: string): boolean {
  const code = typeof error === 'object' && error ? String((error as any).code ?? '') : '';
  if (code.toUpperCase() === 'PGRST205') return true;
  const msg = toErrorMessage(error).toLowerCase();
  return msg.includes('could not find the table') && msg.includes(table.toLowerCase());
}

function getUpstreamErrorCode(error: unknown): string | null {
  const anyErr = error as any;
  const direct = anyErr?.code ? String(anyErr.code) : null;
  if (direct) return direct;
  const cause = anyErr?.cause;
  if (cause?.code) return String(cause.code);
  return null;
}

function hasDailyStatements(html: string): boolean {
  if (html.includes('data-table-estado-diario-')) return true;
  if (html.includes('id="data-table-estado-diario"')) return true;
  if (html.includes('auxfechaestadodiario=moment(')) return true;
  return false;
}

function toDateKeyDDMMYYYY(value: string): number | null {
  const m = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!yyyy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return yyyy * 10_000 + mm * 100 + dd;
}

function addDaysDDMMYYYY(value: string, deltaDays: number): string | null {
  const m = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + deltaDays);
  const outDd = String(d.getDate()).padStart(2, '0');
  const outMm = String(d.getMonth() + 1).padStart(2, '0');
  const outYyyy = String(d.getFullYear());
  return `${outDd}-${outMm}-${outYyyy}`;
}

function normalizeRolLoose(raw: string): string {
  const s = normalizeText(raw).replace(/\s+/g, ' ').trim().toUpperCase();
  if (!s) return '';
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

async function detectTipoJuzgado(params: { codTribunal: string; nombreTribunal: string; date?: string | null }): Promise<string | null> {
  const candidates = getTipoJuzgadoCandidates();
  for (const tipoJuzgado of candidates) {
    let html = '';
    try {
      html = await fetchPjudDailyStatementsHtml({
        codTribunal: params.codTribunal,
        tipoJuzgado,
        nombreTribunal: params.nombreTribunal,
        date: params.date ?? null,
      });
    } catch {
      continue;
    }
    if (!hasDailyStatements(html)) continue;
    return tipoJuzgado;
  }
  return null;
}

async function resolveCourtForCase(params: {
  caseId: string;
  supabase: any;
  service: any | null;
  dateForDetection?: string | null;
}): Promise<{ ok: true; court: CourtConfig; caseNumeroCausa: string } | { ok: false; status: number; error: string }> {
  const { data: caseRow, error: caseError } = await params.supabase
    .from('cases')
    .select('id, tribunal, region, comuna, numero_causa')
    .eq('id', params.caseId)
    .maybeSingle();
  if (caseError) return { ok: false, status: 500, error: toErrorMessage(caseError) };
  if (!caseRow) return { ok: false, status: 404, error: 'Causa no encontrada.' };

  const caseTribunal = normalizeText(caseRow?.tribunal);
  const caseRegion = normalizeText(caseRow?.region);
  const caseComuna = normalizeText(caseRow?.comuna);
  const caseNumeroCausa = normalizeText(caseRow?.numero_causa);

  if (!caseNumeroCausa) {
    return { ok: false, status: 409, error: 'No se puede buscar histórico: falta “Número de causa / ROL” en la causa.' };
  }
  if (!caseTribunal) {
    return { ok: false, status: 409, error: 'No se puede consultar Estado Diario: falta “Tribunal” en la causa.' };
  }
  if (!caseComuna) {
    return { ok: false, status: 409, error: 'No se puede autovincular PJUD: falta “Comuna” en la causa.' };
  }

  // External ref (si existe) NO es requisito.
  let payload: any = {};
  const { data: linkRow, error: linkError } = await params.supabase
    .from('case_external_refs')
    .select('payload')
    .eq('case_id', params.caseId)
    .eq('provider', 'pjud')
    .maybeSingle();
  if (!linkError) payload = (linkRow?.payload ?? {}) as any;
  if (linkError && !isMissingTableError(linkError, 'public.case_external_refs')) {
    return { ok: false, status: 500, error: toErrorMessage(linkError) };
  }

  let nombreTribunal = normalizeText(payload.nombreTribunal ?? payload.tribunal) || caseTribunal;
  let codTribunal = normalizeText(payload.codTribunal ?? payload.tribunalId);
  let tipoJuzgado = normalizeText(payload.tipoJuzgado);
  let comunaCode = normalizeText(payload.comunaCode);

  if (!codTribunal) {
    const resolved = await resolveComunaCode({ region: caseRegion || null, comuna: caseComuna });
    if (!resolved?.comunaCode) {
      return {
        ok: false,
        status: 409,
        error: caseRegion
          ? `No se encontró la comuna "${caseComuna}" en PJUD para la región "${caseRegion}".`
          : `No se encontró la comuna "${caseComuna}" en PJUD (probé todas las regiones).`,
      };
    }
    comunaCode = resolved.comunaCode;

    const tribunales = await fetchPjudTribunalesByComunaCode(comunaCode);
    const tribunalMatch = findTribunalByName(tribunales, nombreTribunal);
    if (!tribunalMatch) {
      return {
        ok: false,
        status: 409,
        error: 'No se pudo resolver cod_tribunal automáticamente: revisa el nombre del Tribunal en la causa.',
      };
    }
    codTribunal = tribunalMatch.id;
    nombreTribunal = tribunalMatch.name;
  }

  if (!tipoJuzgado) {
    const detected = await detectTipoJuzgado({
      codTribunal,
      nombreTribunal,
      date: params.dateForDetection ?? null,
    });
    if (detected) {
      tipoJuzgado = detected;
    } else {
      try {
        const html = await fetchPjudDailyStatementsHtml({
          codTribunal,
          tipoJuzgado: '8',
          nombreTribunal,
          date: params.dateForDetection ?? null,
        });
        const parsed = parsePjudDailyStatementsHtml(html);
        if (parsed.items.length > 0) tipoJuzgado = '8';
      } catch {
        // ignore
      }
    }
  }

  if (!codTribunal || !nombreTribunal || !tipoJuzgado) {
    return {
      ok: false,
      status: 409,
      error: 'No se pudo autovincular PJUD para “Estado Diario”. Verifica que la causa tenga Tribunal y Comuna.',
    };
  }

  if (!/^\d+$/.test(tipoJuzgado)) {
    return { ok: false, status: 400, error: 'tipo_juzgado debe ser numérico (ej: 8).' };
  }

  // Persistir si es posible (no bloquea).
  if (params.service && !linkError) {
    const mergedPayload = {
      ...(typeof payload === 'object' && payload ? payload : {}),
      tribunal: nombreTribunal,
      nombreTribunal,
      tribunalId: codTribunal,
      codTribunal,
      tipoJuzgado,
      ...(comunaCode ? { comunaCode } : {}),
      ...(caseNumeroCausa && !payload?.rit ? { rit: caseNumeroCausa } : {}),
    };
    await params.service
      .from('case_external_refs')
      .upsert(
        {
          case_id: params.caseId,
          provider: 'pjud',
          external_id: null,
          payload: mergedPayload,
          status: 'linked',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'case_id,provider' },
      );
  }

  return { ok: true, court: { codTribunal, tipoJuzgado, nombreTribunal }, caseNumeroCausa };
}

type DbCacheRow = {
  date: string;
  date_key?: number | null;
  item_count: number;
  payload_json: { items?: DailyStatementItem[] } | null;
  fetched_at: string;
};

async function readMatchesFromDbCache(params: {
  db: any;
  court: CourtConfig;
  toDate: string;
  days: number;
  caseNumeroCausa: string;
}): Promise<DailyStatementsHistoryEntry[]> {
  const toKey = toDateKeyDDMMYYYY(params.toDate);
  if (toKey === null) return [];
  const fromDate = addDaysDDMMYYYY(params.toDate, -(Math.max(0, params.days) - 1));
  const fromKey = fromDate ? toDateKeyDDMMYYYY(fromDate) : null;
  if (fromKey === null) return [];

  try {
    const { data, error } = await params.db
      .from('daily_statements_cache')
      .select('date,date_key,item_count,payload_json,fetched_at')
      .eq('cod_tribunal', params.court.codTribunal)
      .eq('tipo_juzgado', params.court.tipoJuzgado)
      .gt('item_count', 0)
      .gte('date_key', fromKey)
      .lte('date_key', toKey)
      .order('date_key', { ascending: false });

    if (error) throw error;
    const rows = ((data as DbCacheRow[]) ?? []).filter((r) => Boolean(r?.date));
    return rows
      .map((r) => {
        const items = (r.payload_json?.items ?? []) as DailyStatementItem[];
        const matches = items.filter((it) => isMatchToCase(it, params.caseNumeroCausa));
        if (matches.length === 0) return null;
        return { date: r.date, items: matches } satisfies DailyStatementsHistoryEntry;
      })
      .filter((x): x is DailyStatementsHistoryEntry => Boolean(x));
  } catch (error: any) {
    const code = String(error?.code ?? '').toUpperCase();
    // tabla/columna no existe aún
    if (code === '42P01' || code === 'PGRST205' || code === '42703') return [];
    return [];
  }
}

async function scanRangeFromPjud(params: {
  court: CourtConfig;
  cacheDb: any | null;
  toDate: string;
  days: number;
  caseNumeroCausa: string;
  deadlineAtMs: number;
}): Promise<{
  entries: DailyStatementsHistoryEntry[];
  scannedDays: number;
  failures: number;
  partial: boolean;
}> {
  const out: DailyStatementsHistoryEntry[] = [];
  const uniqueByDate = new Map<string, DailyStatementsHistoryEntry>();

  let scannedDays = 0;
  let failures = 0;
  let consecutiveFailures = 0;
  for (let i = 0; i < Math.max(0, params.days); i++) {
    if (Date.now() > params.deadlineAtMs) break;
    scannedDays++;
    const date = i === 0 ? params.toDate : addDaysDDMMYYYY(params.toDate, -i);
    if (!date) break;

    let res: { date: string; items: DailyStatementItem[] } | null = null;
    try {
      res = await getPjudDailyStatementsCached({
        ...params.court,
        dateRequested: date,
        cacheDb: params.cacheDb,
      });
      consecutiveFailures = 0;
    } catch (err) {
      failures++;
      consecutiveFailures++;
      const code = getUpstreamErrorCode(err);
      // Si PJUD está caído (timeouts seguidos), cortamos para no dejar pegada la request.
      if (consecutiveFailures >= 3 || code === 'UND_ERR_CONNECT_TIMEOUT') break;
      continue;
    }
    if (!res) continue;

    if (res.items.length > 0) {
      const matches = res.items.filter((it) => isMatchToCase(it, params.caseNumeroCausa));
      if (matches.length > 0) {
        const entry = { date: res.date, items: matches } satisfies DailyStatementsHistoryEntry;
        uniqueByDate.set(entry.date, entry);
      }
    }
  }

  for (const entry of uniqueByDate.values()) out.push(entry);
  out.sort((a, b) => (toDateKeyDDMMYYYY(b.date) ?? 0) - (toDateKeyDDMMYYYY(a.date) ?? 0));
  const partial = scannedDays < Math.max(0, params.days);
  return { entries: out, scannedDays, failures, partial };
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function mergeHistoryEntries(
  a: DailyStatementsHistoryEntry[],
  b: DailyStatementsHistoryEntry[],
): DailyStatementsHistoryEntry[] {
  const byDate = new Map<string, DailyStatementsHistoryEntry>();

  const upsert = (entry: DailyStatementsHistoryEntry) => {
    const existing = byDate.get(entry.date);
    if (!existing) {
      byDate.set(entry.date, { date: entry.date, items: [...(entry.items ?? [])] });
      return;
    }

    const seen = new Set(
      (existing.items ?? []).map((it) =>
        normalizeSpace(`${it.competencia}|${it.numeroIngreso}|${it.partes}|${it.providencias}`),
      ),
    );

    for (const it of entry.items ?? []) {
      const key = normalizeSpace(`${it.competencia}|${it.numeroIngreso}|${it.partes}|${it.providencias}`);
      if (seen.has(key)) continue;
      seen.add(key);
      existing.items.push(it);
    }
  };

  for (const entry of a) upsert(entry);
  for (const entry of b) upsert(entry);

  const merged = Array.from(byDate.values());
  merged.sort((x, y) => (toDateKeyDDMMYYYY(y.date) ?? 0) - (toDateKeyDDMMYYYY(x.date) ?? 0));
  return merged;
}

async function scanLastFromPjud(params: {
  court: CourtConfig;
  cacheDb: any | null;
  toDate: string;
  maxDays: number;
  caseNumeroCausa: string;
  deadlineAtMs: number;
}): Promise<{ entry: DailyStatementsHistoryEntry | null; scannedDays: number; failures: number; partial: boolean }> {
  let scannedDays = 0;
  let failures = 0;
  let consecutiveFailures = 0;
  for (let i = 0; i < Math.max(0, params.maxDays); i++) {
    if (Date.now() > params.deadlineAtMs) break;
    scannedDays++;
    const date = i === 0 ? params.toDate : addDaysDDMMYYYY(params.toDate, -i);
    if (!date) break;
    let res: { date: string; items: DailyStatementItem[] } | null = null;
    try {
      res = await getPjudDailyStatementsCached({
        ...params.court,
        dateRequested: date,
        cacheDb: params.cacheDb,
      });
      consecutiveFailures = 0;
    } catch (err) {
      failures++;
      consecutiveFailures++;
      const code = getUpstreamErrorCode(err);
      if (consecutiveFailures >= 3 || code === 'UND_ERR_CONNECT_TIMEOUT') break;
      continue;
    }
    if (!res) continue;
    if (res.items.length === 0) continue;
    const matches = res.items.filter((it) => isMatchToCase(it, params.caseNumeroCausa));
    if (matches.length > 0) {
      return { entry: { date: res.date, items: matches }, scannedDays, failures, partial: scannedDays < params.maxDays };
    }
  }
  const partial = scannedDays < Math.max(0, params.maxDays);
  return { entry: null, scannedDays, failures, partial };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string | string[] | undefined>> },
) {
  const startedAt = Date.now();
  // server-side budget para evitar requests "pegadas" por PJUD
  const maxRuntimeMs = Number(process.env.PJUD_DAILY_STATEMENTS_HISTORY_MAX_MS ?? 25_000);
  const deadlineAtMs = startedAt + Math.max(1_000, maxRuntimeMs);
  try {
    await requireAuth();
    const { id } = (await ctx.params) ?? {};
    const caseId = Array.isArray(id) ? id[0] : id;
    if (!caseId) {
      return NextResponse.json({ success: false, error: 'Falta id de la causa.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const mode = (normalizeText(searchParams.get('mode')) || 'last') as DailyStatementsHistoryMode;
    const daysRaw = normalizeText(searchParams.get('days'));
    const toRaw = normalizeText(searchParams.get('to'));
    const source = normalizeText(searchParams.get('source')) || 'hybrid';

    if (mode !== 'last' && mode !== 'range') {
      return NextResponse.json({ success: false, error: 'mode inválido (usa last o range).' }, { status: 400 });
    }

    const daysNum = Number(daysRaw || (mode === 'last' ? 180 : 30));
    const days = Math.min(Math.max(1, Number.isFinite(daysNum) ? daysNum : mode === 'last' ? 180 : 30), mode === 'last' ? 365 : 90);

    const toParam = toRaw.length ? toRaw : null;
    if (toParam && !isDDMMYYYY(toParam)) {
      return NextResponse.json({ success: false, error: 'Formato de to inválido (usa DD-MM-YYYY).' }, { status: 400 });
    }

    const supabase = (await createServerClient()) as any;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY ? (createServiceClient() as any) : null;

    const resolved = await resolveCourtForCase({ caseId, supabase, service, dateForDetection: toParam });
    if (!resolved.ok) return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });

    const court = resolved.court;
    const caseNumeroCausa = resolved.caseNumeroCausa;

    const cacheDb = process.env.SUPABASE_SERVICE_ROLE_KEY ? (createServiceClient() as any) : null;
    const latest = await getPjudDailyStatementsCached({ ...court, cacheDb });
    const maxAvailableDate = latest.date;
    const toDate = toParam ?? maxAvailableDate;

    if (mode === 'last') {
      let entry: DailyStatementsHistoryEntry | null = null;
      let scannedDays = 0;
      let failures = 0;
      let partial = false;

      if (cacheDb && (source === 'cache' || source === 'hybrid')) {
        const cachedEntries = await readMatchesFromDbCache({
          db: cacheDb,
          court,
          toDate,
          days,
          caseNumeroCausa,
        });
        if (cachedEntries.length > 0) entry = cachedEntries[0] ?? null;
      }

      if (!entry && source !== 'cache') {
        const scanned = await scanLastFromPjud({
          court,
          cacheDb,
          toDate,
          maxDays: days,
          caseNumeroCausa,
          deadlineAtMs,
        });
        entry = scanned.entry;
        scannedDays = scanned.scannedDays;
        failures = scanned.failures;
        partial = scanned.partial;
      }

      const nextTo = entry ? null : addDaysDDMMYYYY(toDate, -Math.max(1, scannedDays));
      const resp: DailyStatementsHistoryResponse = {
        success: true,
        caseId,
        mode,
        range: { toDate, days },
        maxAvailableDate,
        scannedDays,
        failures,
        partial,
        nextTo: nextTo ?? null,
        court,
        matches: entry ? [entry] : [],
        durationMs: Date.now() - startedAt,
      };
      return NextResponse.json(resp);
    }

    // mode === 'range'
    let scannedDays = 0;
    let failures = 0;
    let partial = false;

    let matches: DailyStatementsHistoryEntry[] = [];
    let cachedMatches: DailyStatementsHistoryEntry[] = [];
    if (cacheDb && (source === 'cache' || source === 'hybrid')) {
      cachedMatches = await readMatchesFromDbCache({
        db: cacheDb,
        court,
        toDate,
        days,
        caseNumeroCausa,
      });
      matches = cachedMatches;
      scannedDays = days;
    }

    if (source !== 'cache') {
      const scanned = await scanRangeFromPjud({
        court,
        cacheDb,
        toDate,
        days,
        caseNumeroCausa,
        deadlineAtMs,
      });
      matches = source === 'hybrid' ? mergeHistoryEntries(cachedMatches, scanned.entries) : scanned.entries;
      scannedDays = scanned.scannedDays;
      failures = scanned.failures;
      partial = scanned.partial;
    }

    const nextTo = addDaysDDMMYYYY(toDate, -Math.max(1, scannedDays));
    const resp: DailyStatementsHistoryResponse = {
      success: true,
      caseId,
      mode,
      range: { toDate, days },
      maxAvailableDate,
      scannedDays,
      failures,
      partial,
      nextTo: nextTo ?? null,
      court,
      matches,
      durationMs: Date.now() - startedAt,
    };
    return NextResponse.json(resp);
  } catch (error) {
    console.error('[estado-diario.historial] error', error);
    return NextResponse.json({ success: false, error: toErrorMessage(error) }, { status: 500 });
  }
}
