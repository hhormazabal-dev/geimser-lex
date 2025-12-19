import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/roles';
import { fetchPjudDailyStatementsHtml } from '@/lib/pjud/daily-statements';
import { parsePjudDailyStatementsHtml } from '@/lib/pjud/daily-statements-parser';
import { getTipoJuzgadoCandidates } from '@/lib/pjud/tipo-juzgado';

export const runtime = 'nodejs';

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function parseUpstreamStatus(error: unknown): number | null {
  const msg = error instanceof Error ? error.message : String((error as any)?.message ?? error ?? '');
  const m = msg.match(/PJUD respondi[oó]\s+(\d{3})/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function hasDailyStatements(html: string): boolean {
  if (html.includes('data-table-estado-diario-')) return true;
  if (html.includes('id="data-table-estado-diario"')) return true;
  if (html.includes('auxfechaestadodiario=moment(')) return true;
  return false;
}

const detectCache = new Map<string, { expiresAtMs: number; tipoJuzgado: string }>();

export async function GET(req: Request) {
  try {
    await requireAuth(['admin_firma', 'abogado', 'analista']);
    const { searchParams } = new URL(req.url);
    const codTribunal = normalizeText(searchParams.get('codTribunal'));
    const nombreTribunal = normalizeText(searchParams.get('nombreTribunal'));
    const date = normalizeText(searchParams.get('date')) || null;

    if (!codTribunal || !/^\d+$/.test(codTribunal)) {
      return NextResponse.json({ success: false, error: 'codTribunal inválido.' }, { status: 400 });
    }
    if (!nombreTribunal) {
      return NextResponse.json({ success: false, error: 'Falta nombreTribunal.' }, { status: 400 });
    }

    const cacheKey = `${codTribunal}::${nombreTribunal.toLowerCase()}`;
    const cached = detectCache.get(cacheKey);
    if (cached && cached.expiresAtMs > Date.now()) {
      return NextResponse.json({ success: true, codTribunal, nombreTribunal, tipoJuzgado: cached.tipoJuzgado, cached: true });
    }

    const candidates = getTipoJuzgadoCandidates();

    const attempts: Array<{ tipoJuzgado: string; ok: boolean; status?: number | null }> = [];

    for (const tipoJuzgado of candidates) {
      let html = '';
      try {
        html = await fetchPjudDailyStatementsHtml({
          codTribunal,
          tipoJuzgado,
          nombreTribunal,
          date,
        });
      } catch (error) {
        const status = parseUpstreamStatus(error);
        attempts.push({ tipoJuzgado, ok: false, status });
        // Si PJUD devuelve error (p.ej. 500) para un candidato, seguimos probando.
        // Si es un fallo de red/abort, abortamos para no hacer más requests inútiles.
        if (status === null) {
          throw error;
        }
        continue;
      }

      if (!hasDailyStatements(html)) {
        attempts.push({ tipoJuzgado, ok: false, status: 200 });
        continue;
      }

      const parsed = parsePjudDailyStatementsHtml(html);
      detectCache.set(cacheKey, { tipoJuzgado, expiresAtMs: Date.now() + 1000 * 60 * 60 * 24 * 30 });
      return NextResponse.json({
        success: true,
        codTribunal,
        nombreTribunal,
        tipoJuzgado,
        dateDetected: parsed.date,
        itemCount: parsed.items.length,
        cached: false,
        attempts: attempts.slice(0, 10),
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          'No se pudo detectar tipo_juzgado automáticamente (no hubo tablas de Estado Diario para los candidatos probados).',
        attempts: attempts.slice(0, 10),
      },
      { status: 404 },
    );
  } catch (error) {
    console.error('[detect-tipo-juzgado] error', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error inesperado.' },
      { status: 500 },
    );
  }
}
