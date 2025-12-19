import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/roles';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { getPjudDailyStatementsCached } from '@/lib/pjud/daily-statements';
import type { DailyStatementsResponse } from '@/types/daily-statements';

function isDDMMYYYY(value: string): boolean {
  return /^\d{2}-\d{2}-\d{4}$/.test(value);
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
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
      .select('id')
      .eq('id', caseId)
      .maybeSingle();
    if (caseError) throw caseError;
    if (!caseRow) {
      return NextResponse.json({ success: false, error: 'Causa no encontrada.' }, { status: 404 });
    }

    const { data: linkRow, error: linkError } = await supabase
      .from('case_external_refs')
      .select('payload')
      .eq('case_id', caseId)
      .eq('provider', 'pjud')
      .maybeSingle();
    if (linkError) throw linkError;

    const payload = (linkRow?.payload ?? {}) as any;
    const codTribunal = normalizeText(payload.codTribunal ?? payload.tribunalId);
    const tipoJuzgado = normalizeText(payload.tipoJuzgado);
    const nombreTribunal = normalizeText(payload.nombreTribunal ?? payload.tribunal);

    if (!codTribunal || !nombreTribunal || !tipoJuzgado) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Falta vinculación PJUD para “Estado Diario”. Completa “Código tribunal (cod_tribunal)”, “Tipo juzgado (tipo_juzgado)” y “Tribunal”.',
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

    const cacheDb = process.env.SUPABASE_SERVICE_ROLE_KEY ? (createServiceClient() as any) : null;
    const result = await getPjudDailyStatementsCached({
      codTribunal,
      tipoJuzgado,
      nombreTribunal,
      dateRequested,
      cacheDb,
    });

    const response: DailyStatementsResponse = {
      success: true,
      caseId,
      dateRequested,
      date: result.date,
      court: { codTribunal, tipoJuzgado, nombreTribunal },
      items: result.items,
      fetchedAt: result.fetchedAt,
      cached: result.cached,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[estado-diario] error', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error inesperado.' },
      { status: 500 },
    );
  }
}
