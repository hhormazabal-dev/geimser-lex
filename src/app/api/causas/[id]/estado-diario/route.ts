import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/roles';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { findNearestPreviousDailyStatementsWithItems, getPjudDailyStatementsCached } from '@/lib/pjud/daily-statements';
import { fetchPjudDailyStatementsHtml } from '@/lib/pjud/daily-statements';
import { parsePjudDailyStatementsHtml } from '@/lib/pjud/daily-statements-parser';
import { getTipoJuzgadoCandidates } from '@/lib/pjud/tipo-juzgado';
import { fetchPjudTribunalesByComunaCode, findTribunalByName, resolveComunaCode } from '@/lib/pjud/tribunales';
import type { DailyStatementsResponse } from '@/types/daily-statements';

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

function nowIso() {
  return new Date().toISOString();
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

async function resolveNearestPreviousWithItems(params: {
  cacheDb: any | null;
  court: CourtConfig;
  fromDate: string;
  maxFallbackDays: number;
}) {
  if (params.cacheDb) {
    const nearestFromDb = await findNearestPreviousDailyStatementsWithItems(
      params.cacheDb,
      params.court,
      params.fromDate,
    );
    if (nearestFromDb?.items?.length) return nearestFromDb;
  }

  for (let i = 1; i <= Math.max(0, params.maxFallbackDays); i++) {
    const candidate = addDaysDDMMYYYY(params.fromDate, -i);
    if (!candidate) break;
    const candidateRes = await getPjudDailyStatementsCached({
      ...params.court,
      dateRequested: candidate,
      cacheDb: params.cacheDb,
    });
    if (candidateRes.items.length > 0) return candidateRes;
  }

  return null;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string | string[] | undefined>> },
) {
  try {
    await requireAuth();
    const { id } = (await ctx.params) ?? {};
    const caseId = Array.isArray(id) ? id[0] : id;
    if (!caseId) {
      return NextResponse.json({ success: false, error: 'Falta id de la causa.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const dateRequestedRaw = normalizeText(searchParams.get('date'));
    const dateRequested = dateRequestedRaw.length ? dateRequestedRaw : null;
    if (dateRequested && !isDDMMYYYY(dateRequested)) {
      return NextResponse.json(
        { success: false, error: 'Formato de date inválido (usa DD-MM-YYYY).' },
        { status: 400 },
      );
    }

    const supabase = (await createServerClient()) as any;

    const { data: caseRow, error: caseError } = await supabase
      .from('cases')
      .select('id, tribunal, region, comuna, numero_causa')
      .eq('id', caseId)
      .maybeSingle();
    if (caseError) {
      return NextResponse.json({ success: false, error: toErrorMessage(caseError) }, { status: 500 });
    }
    if (!caseRow) {
      return NextResponse.json({ success: false, error: 'Causa no encontrada.' }, { status: 404 });
    }

    const { data: linkRow, error: linkError } = await supabase
      .from('case_external_refs')
      .select('payload')
      .eq('case_id', caseId)
      .eq('provider', 'pjud')
      .maybeSingle();
    const canUseExternalRefs = !linkError || !isMissingTableError(linkError, 'public.case_external_refs');
    if (linkError && canUseExternalRefs) {
      return NextResponse.json({ success: false, error: toErrorMessage(linkError) }, { status: 500 });
    }

    const payload = (canUseExternalRefs ? linkRow?.payload : null) ?? {};
    const caseTribunal = normalizeText(caseRow?.tribunal);
    const caseRegion = normalizeText(caseRow?.region);
    const caseComuna = normalizeText(caseRow?.comuna);
    const caseNumeroCausa = normalizeText(caseRow?.numero_causa);

    const dateToUseForDetection = dateRequested;

    let nombreTribunal = normalizeText(payload.nombreTribunal ?? payload.tribunal) || caseTribunal;
    let codTribunal = normalizeText(payload.codTribunal ?? payload.tribunalId);
    let tipoJuzgado = normalizeText(payload.tipoJuzgado);
    let comunaCode = normalizeText(payload.comunaCode);

    // Auto-vinculación silenciosa: si faltan campos, intentamos resolverlos desde los datos del caso.
    if (!nombreTribunal) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede consultar Estado Diario: falta “Tribunal” en la causa.',
        },
        { status: 409 },
      );
    }

    if (!codTribunal) {
      if (!caseComuna) {
        return NextResponse.json(
          {
            success: false,
            error:
              'No se puede autovincular PJUD: la causa debe tener Comuna (y ojalá Región) para resolver cod_tribunal.',
          },
          { status: 409 },
        );
      }

      const resolved = await resolveComunaCode({ region: caseRegion || null, comuna: caseComuna });
      if (!resolved?.comunaCode) {
        return NextResponse.json(
          {
            success: false,
            error: caseRegion
              ? `No se encontró la comuna "${caseComuna}" en PJUD para la región "${caseRegion}".`
              : `No se encontró la comuna "${caseComuna}" en PJUD (probé todas las regiones).`,
          },
          { status: 409 },
        );
      }
      comunaCode = resolved.comunaCode;

      const tribunales = await fetchPjudTribunalesByComunaCode(comunaCode);
      const tribunalMatch = findTribunalByName(tribunales, nombreTribunal);
      if (!tribunalMatch) {
        return NextResponse.json(
          {
            success: false,
            error:
              'No se pudo resolver cod_tribunal automáticamente: revisa el nombre del Tribunal en la causa.',
          },
          { status: 409 },
        );
      }
      codTribunal = tribunalMatch.id;
      nombreTribunal = tribunalMatch.name;
    }

    if (!tipoJuzgado) {
      const detected = await detectTipoJuzgado({
        codTribunal,
        nombreTribunal,
        date: dateToUseForDetection,
      });
      if (!detected) {
        // Diagnóstico: intentar parsear para entender si hubo respuesta 200 pero sin tablas
        try {
          const html = await fetchPjudDailyStatementsHtml({ codTribunal, tipoJuzgado: '8', nombreTribunal, date: dateToUseForDetection });
          const parsed = parsePjudDailyStatementsHtml(html);
          if (parsed.items.length > 0) {
            tipoJuzgado = '8';
          }
        } catch {
          // ignore
        }
      } else {
        tipoJuzgado = detected;
      }
    }

    if (!codTribunal || !nombreTribunal || !tipoJuzgado) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No se pudo autovincular PJUD para “Estado Diario”. Verifica que la causa tenga Tribunal, Región y Comuna.',
        },
        { status: 409 },
      );
    }

    if (!/^\d+$/.test(tipoJuzgado)) {
      return NextResponse.json(
        { success: false, error: 'tipo_juzgado debe ser numérico (ej: 8).' },
        { status: 400 },
      );
    }

    // Persistir vinculación en segundo plano (si hay service role key).
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY && canUseExternalRefs ? (createServiceClient() as any) : null;
    if (service) {
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
      await service
        .from('case_external_refs')
        .upsert(
          {
            case_id: caseId,
            provider: 'pjud',
            external_id: null,
            payload: mergedPayload,
            status: 'linked',
            updated_at: nowIso(),
          },
          { onConflict: 'case_id,provider' },
        );
    }

    const cacheDb = process.env.SUPABASE_SERVICE_ROLE_KEY ? (createServiceClient() as any) : null;
    const court: CourtConfig = { codTribunal, tipoJuzgado, nombreTribunal };
    const maxFallbackDays = Number(process.env.PJUD_DAILY_STATEMENTS_FALLBACK_DAYS ?? 7);

    let result = await getPjudDailyStatementsCached({
      ...court,
      dateRequested,
      cacheDb,
    });

    let dateResolution: DailyStatementsResponse['dateResolution'] = dateRequested ? 'requested' : 'latest';
    let maxAvailableDate: string | null = null;

    // Si no se pide fecha, PJUD suele responder "hoy" (aunque esté vacío). En ese caso,
    // buscamos el día anterior con registros para mostrar algo útil por defecto.
    if (!dateRequested) {
      maxAvailableDate = result.date;
      if (result.items.length === 0) {
        const nearest = await resolveNearestPreviousWithItems({
          cacheDb,
          court,
          fromDate: maxAvailableDate,
          maxFallbackDays,
        });
        if (nearest && nearest.items.length > 0) {
          result = nearest;
          dateResolution = 'nearest_previous';
        }
      }
    }

    // Si se pidió una fecha sin registros, devolver el último día disponible con datos:
    // 1) buscar en cache BD el día <= solicitado con item_count>0
    // 2) si no existe, caer al "último disponible" (consulta sin date, cacheada)
    if (dateRequested && result.items.length === 0) {
      const nearestFromDb = cacheDb
        ? await findNearestPreviousDailyStatementsWithItems(
            cacheDb,
            court,
            dateRequested,
          )
        : null;

      if (nearestFromDb && nearestFromDb.items.length > 0) {
        result = nearestFromDb;
        dateResolution = 'nearest_previous';
      } else {
        const latest = await getPjudDailyStatementsCached({ ...court, cacheDb });
        maxAvailableDate = latest.date;
        const requestedKey = toDateKeyDDMMYYYY(dateRequested);
        const latestKey = toDateKeyDDMMYYYY(latest.date);

        // Si la fecha solicitada es futura respecto al último día disponible, caemos al último día disponible.
        if (latest.items.length > 0 && requestedKey !== null && latestKey !== null && requestedKey > latestKey) {
          result = latest;
          dateResolution = 'latest';
        } else {
          // Intentar buscar hacia atrás desde la fecha solicitada (p.ej. fines de semana / feriados).
          for (let i = 1; i <= Math.max(0, maxFallbackDays); i++) {
            const candidate = addDaysDDMMYYYY(dateRequested, -i);
            if (!candidate) break;
            const candidateRes = await getPjudDailyStatementsCached({
              ...court,
              dateRequested: candidate,
              cacheDb,
            });
            if (candidateRes.items.length > 0) {
              result = candidateRes;
              dateResolution = 'nearest_previous';
              break;
            }
          }

          if (result.items.length === 0) {
            const nearestFromLatest =
              maxAvailableDate
                ? await resolveNearestPreviousWithItems({
                    cacheDb,
                    court,
                    fromDate: maxAvailableDate,
                    maxFallbackDays,
                  })
                : null;
            if (nearestFromLatest && nearestFromLatest.items.length > 0) {
              result = nearestFromLatest;
              dateResolution = 'latest';
            } else if (latest.items.length > 0) {
              result = latest;
              dateResolution = 'latest';
            }
          }
        }
      }
    }

    const response: DailyStatementsResponse = {
      success: true,
      caseId,
      dateRequested,
      ...(maxAvailableDate ? { maxAvailableDate } : {}),
      date: result.date,
      dateResolution,
      court: { codTribunal, tipoJuzgado, nombreTribunal },
      items: result.items,
      fetchedAt: result.fetchedAt,
      cached: result.cached,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[estado-diario] error', error);
    return NextResponse.json(
      { success: false, error: toErrorMessage(error) },
      { status: 500 },
    );
  }
}
