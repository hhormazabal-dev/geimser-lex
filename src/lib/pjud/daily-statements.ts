import 'server-only';

import type { DailyStatementItem } from '@/types/daily-statements';
import { parsePjudDailyStatementsHtml } from '@/lib/pjud/daily-statements-parser';

type CourtConfig = {
  codTribunal: string;
  tipoJuzgado: string;
  nombreTribunal: string;
};

function formatDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let upstreamQueue: Promise<void> = Promise.resolve();
let lastUpstreamAtMs = 0;

async function withPjudRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  const task = upstreamQueue.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, 1000 - (now - lastUpstreamAtMs));
    if (waitMs > 0) await sleep(waitMs);
    lastUpstreamAtMs = Date.now();
    return fn();
  });

  upstreamQueue = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function fetchPjudDailyStatementsHtml(input: CourtConfig & { date?: string | null }) {
  const timeoutMs = Number(process.env.PJUD_DAILY_STATEMENTS_TIMEOUT_MS ?? 15_000);
  const body = new URLSearchParams({
    cod_tribunal: input.codTribunal,
    tipo_juzgado: input.tipoJuzgado,
    nombre_tribunal: input.nombreTribunal,
  });
  if (input.date) body.set('date', input.date);

  return await withPjudRateLimit(async () => {
    const upstream = await fetchWithTimeout('https://www.pjud.cl/ajax/Courts/getDailyStatements', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
      },
      body,
    }, timeoutMs);

    if (!upstream.ok) {
      throw new Error(`PJUD respondió ${upstream.status}`);
    }

    return await upstream.text();
  });
}

type CacheEntry = {
  expiresAtMs: number;
  fetchedAt: string;
  date: string;
  items: DailyStatementItem[];
};

const memCacheByKey = new Map<string, CacheEntry>();
const memLatestByCourt = new Map<string, { expiresAtMs: number; date: string }>();

function cacheKey(court: CourtConfig, date: string) {
  return `${court.codTribunal}::${court.tipoJuzgado}::${date}`;
}

function getCacheTtlMs(hasItems: boolean) {
  const hours = Number(process.env.PJUD_DAILY_STATEMENTS_CACHE_HOURS ?? 12);
  const emptyMinutes = Number(process.env.PJUD_DAILY_STATEMENTS_EMPTY_CACHE_MINUTES ?? 30);
  return hasItems ? hours * 60 * 60 * 1000 : emptyMinutes * 60 * 1000;
}

export type DailyStatementsCachedResult = {
  date: string;
  items: DailyStatementItem[];
  fetchedAt: string;
  cached: boolean;
};

type DbCacheRow = {
  cod_tribunal: string;
  tipo_juzgado: string;
  date: string;
  item_count: number;
  payload_json: { items?: DailyStatementItem[] } | null;
  fetched_at: string;
};

async function readDbCache(
  db: any,
  court: CourtConfig,
  date: string,
): Promise<DailyStatementsCachedResult | null> {
  try {
    const { data, error } = await db
      .from('daily_statements_cache')
      .select('cod_tribunal,tipo_juzgado,date,item_count,payload_json,fetched_at')
      .eq('cod_tribunal', court.codTribunal)
      .eq('tipo_juzgado', court.tipoJuzgado)
      .eq('date', date)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as DbCacheRow;
    const items = (row.payload_json?.items ?? []) as DailyStatementItem[];
    const ttlMs = getCacheTtlMs((row.item_count ?? items.length) > 0);
    const fetchedAtMs = Date.parse(row.fetched_at);
    if (!Number.isFinite(fetchedAtMs)) return null;
    if (Date.now() - fetchedAtMs > ttlMs) return null;

    const entry: CacheEntry = {
      date: row.date,
      items,
      fetchedAt: row.fetched_at,
      expiresAtMs: fetchedAtMs + ttlMs,
    };
    memCacheByKey.set(cacheKey(court, row.date), entry);
    return { date: row.date, items, fetchedAt: row.fetched_at, cached: true };
  } catch (error: any) {
    if (String(error?.code ?? '').toUpperCase() === '42P01') return null;
    return null;
  }
}

async function readDbLatest(
  db: any,
  court: CourtConfig,
): Promise<DailyStatementsCachedResult | null> {
  try {
    const { data, error } = await db
      .from('daily_statements_cache')
      .select('cod_tribunal,tipo_juzgado,date,item_count,payload_json,fetched_at')
      .eq('cod_tribunal', court.codTribunal)
      .eq('tipo_juzgado', court.tipoJuzgado)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as DbCacheRow;
    const items = (row.payload_json?.items ?? []) as DailyStatementItem[];
    const ttlMs = getCacheTtlMs((row.item_count ?? items.length) > 0);
    const fetchedAtMs = Date.parse(row.fetched_at);
    if (!Number.isFinite(fetchedAtMs)) return null;
    if (Date.now() - fetchedAtMs > ttlMs) return null;

    const entry: CacheEntry = {
      date: row.date,
      items,
      fetchedAt: row.fetched_at,
      expiresAtMs: fetchedAtMs + ttlMs,
    };
    memCacheByKey.set(cacheKey(court, row.date), entry);
    memLatestByCourt.set(`${court.codTribunal}::${court.tipoJuzgado}`, { date: row.date, expiresAtMs: fetchedAtMs + ttlMs });
    return { date: row.date, items, fetchedAt: row.fetched_at, cached: true };
  } catch (error: any) {
    if (String(error?.code ?? '').toUpperCase() === '42P01') return null;
    return null;
  }
}

async function writeDbCache(db: any, court: CourtConfig, date: string, items: DailyStatementItem[]): Promise<void> {
  try {
    const payload = {
      items,
    };

    const { error } = await db
      .from('daily_statements_cache')
      .upsert(
        {
          cod_tribunal: court.codTribunal,
          tipo_juzgado: court.tipoJuzgado,
          nombre_tribunal: court.nombreTribunal,
          date,
          item_count: items.length,
          payload_json: payload,
          fetched_at: nowIso(),
        },
        { onConflict: 'cod_tribunal,tipo_juzgado,date' },
      );

    if (error) throw error;
  } catch (error: any) {
    if (String(error?.code ?? '').toUpperCase() === '42P01') return;
  }
}

export async function getPjudDailyStatementsCached(
  input: CourtConfig & { dateRequested?: string | null; cacheDb?: any },
): Promise<DailyStatementsCachedResult> {
  const dateRequested = input.dateRequested?.trim() ? input.dateRequested.trim() : null;
  const cacheDb = input.cacheDb;

  if (!dateRequested) {
    const latest = memLatestByCourt.get(`${input.codTribunal}::${input.tipoJuzgado}`);
    if (latest && latest.expiresAtMs > Date.now()) {
      const key = cacheKey(input, latest.date);
      const cached = memCacheByKey.get(key);
      if (cached && cached.expiresAtMs > Date.now()) {
        return { date: cached.date, items: cached.items, fetchedAt: cached.fetchedAt, cached: true };
      }
    }

    if (cacheDb) {
      const latestFromDb = await readDbLatest(cacheDb, input);
      if (latestFromDb) return latestFromDb;
    }

    const html = await fetchPjudDailyStatementsHtml({ ...input, date: null });
    const parsed = parsePjudDailyStatementsHtml(html);
    const date = parsed.date ?? formatDDMMYYYY(new Date());

    const ttlMs = getCacheTtlMs(parsed.items.length > 0);
    const entry: CacheEntry = { date, items: parsed.items, fetchedAt: nowIso(), expiresAtMs: Date.now() + ttlMs };
    memCacheByKey.set(cacheKey(input, date), entry);
    memLatestByCourt.set(`${input.codTribunal}::${input.tipoJuzgado}`, { date, expiresAtMs: Date.now() + ttlMs });
    if (cacheDb) await writeDbCache(cacheDb, input, date, parsed.items);
    return { date, items: parsed.items, fetchedAt: entry.fetchedAt, cached: false };
  }

  const key = cacheKey(input, dateRequested);
  const cached = memCacheByKey.get(key);
  if (cached && cached.expiresAtMs > Date.now()) {
    return { date: cached.date, items: cached.items, fetchedAt: cached.fetchedAt, cached: true };
  }

  if (cacheDb) {
    const fromDb = await readDbCache(cacheDb, input, dateRequested);
    if (fromDb) return fromDb;
  }

  const html = await fetchPjudDailyStatementsHtml({ ...input, date: dateRequested });
  const parsed = parsePjudDailyStatementsHtml(html);
  const date = parsed.date ?? dateRequested;

  const ttlMs = getCacheTtlMs(parsed.items.length > 0);
  const entry: CacheEntry = { date, items: parsed.items, fetchedAt: nowIso(), expiresAtMs: Date.now() + ttlMs };
  memCacheByKey.set(key, entry);
  if (cacheDb) await writeDbCache(cacheDb, input, dateRequested, parsed.items);

  return { date, items: parsed.items, fetchedAt: entry.fetchedAt, cached: false };
}
