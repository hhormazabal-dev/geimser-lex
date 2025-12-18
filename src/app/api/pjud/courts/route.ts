import { NextResponse } from 'next/server';

function sortByName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, 'es');
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const comunaCode = searchParams.get('comunaCode')?.trim() ?? '';

  if (!comunaCode) {
    return NextResponse.json(
      { success: false, error: 'Falta comunaCode.' },
      { status: 400 },
    );
  }

  const body = new URLSearchParams({ region_code: comunaCode });

  const upstream = await fetch('https://www.pjud.cl/ajax/Courts/getCourtsListByRegion', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body,
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { success: false, error: `PJUD respondió ${upstream.status}` },
      { status: 502 },
    );
  }

  const json = (await upstream.json().catch(() => null)) as any;
  if (!json?.status || !json?.data?.juridicciones) {
    return NextResponse.json(
      { success: false, error: 'PJUD no devolvió tribunales.' },
      { status: 502 },
    );
  }

  const tribunales = Object.entries(json.data.juridicciones as Record<string, string>)
    .map(([id, name]) => ({ id, name }))
    .sort(sortByName);

  return NextResponse.json({ success: true, comunaCode, tribunales });
}

