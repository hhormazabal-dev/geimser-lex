import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

function escapeIcsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function toIcsDate(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = String(url.searchParams.get('token') ?? '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'token requerido' }, { status: 400 });

  const svc = createServiceClient() as any;

  const { data: tokenRow, error: tokenErr } = await svc
    .from('calendar_event_tokens')
    .select('stage_id, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (tokenErr) return NextResponse.json({ ok: false, error: tokenErr.message ?? 'Error validando token' }, { status: 500 });
  if (!tokenRow?.stage_id) return NextResponse.json({ ok: false, error: 'token inválido' }, { status: 404 });

  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null;
  if (expiresAt && Number.isFinite(expiresAt.valueOf()) && expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'token expirado' }, { status: 410 });
  }

  const { data: stageRow, error: stageErr } = await svc
    .from('case_stages')
    .select(
      `
        id,
        etapa,
        descripcion,
        fecha_programada,
        case:cases(
          id,
          caratulado,
          tribunal
        )
      `
    )
    .eq('id', tokenRow.stage_id)
    .maybeSingle();

  if (stageErr) return NextResponse.json({ ok: false, error: stageErr.message ?? 'Error leyendo evento' }, { status: 500 });
  if (!stageRow?.id) return NextResponse.json({ ok: false, error: 'evento no encontrado' }, { status: 404 });

  const dateOnly = String(stageRow.fecha_programada ?? '').trim();
  if (!dateOnly) return NextResponse.json({ ok: false, error: 'evento sin fecha' }, { status: 409 });

  const start = new Date(`${dateOnly}T00:00:00.000Z`);
  if (!Number.isFinite(start.valueOf())) return NextResponse.json({ ok: false, error: 'fecha inválida' }, { status: 400 });
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const caseId = stageRow.case?.id ?? null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://geimser-lex.vercel.app';
  const eventUrl = caseId ? `${appUrl}/cases/${caseId}` : `${appUrl}/dashboard`;

  const summary = `${stageRow.case?.caratulado ?? 'Caso'} · ${stageRow.etapa ?? 'Hito'}`;
  const descParts = [
    stageRow.descripcion ? String(stageRow.descripcion) : null,
    stageRow.case?.tribunal ? `Tribunal: ${stageRow.case.tribunal}` : null,
    `Ver en LEX: ${eventUrl}`,
  ].filter(Boolean) as string[];

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Geimser LEX//Calendario//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(token)}@geimser-lex`,
    `DTSTAMP:${toIcsDate(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${toIcsDate(start)}`,
    `DTEND;VALUE=DATE:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(descParts.join('\n'))}`,
    `URL:${escapeIcsText(eventUrl)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');

  const filenameBase = `${(stageRow.case?.caratulado ?? 'caso').slice(0, 48)}-${(stageRow.etapa ?? 'hito').slice(0, 48)}`
    .replace(/[^\p{L}\p{N}\-_. ]/gu, '')
    .trim()
    .replace(/\s+/g, '_');

  return new Response(ics, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${filenameBase || 'evento'}.ics"`,
      'cache-control': 'private, max-age=60',
    },
  });
}

