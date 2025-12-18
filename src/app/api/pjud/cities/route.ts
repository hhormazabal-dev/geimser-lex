import { NextResponse } from 'next/server';

const REGION_CODE_BY_NAME: Record<string, string> = {
  'Tarapacá': '1',
  'Antofagasta': '2',
  'Atacama': '3',
  'Coquimbo': '4',
  'Valparaíso': '5',
  "O'Higgins": '6',
  'Maule': '7',
  'Biobío': '8',
  'La Araucanía': '9',
  'Los Lagos': '10',
  'Aysén': '11',
  'Magallanes': '12',
  'Metropolitana': '13',
  'Los Ríos': '14',
  'Arica y Parinacota': '15',
  'Ñuble': '16',
};

function sortByName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, 'es');
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get('region')?.trim() ?? '';
  const regionCode = REGION_CODE_BY_NAME[region];

  if (!regionCode) {
    return NextResponse.json(
      { success: false, error: 'Región inválida o no soportada.' },
      { status: 400 },
    );
  }

  const body = new URLSearchParams({
    region_code: regionCode,
    bandera: 'TR1RA',
  });

  const upstream = await fetch('https://www.pjud.cl/ajax/Courts/getCityListByRegion', {
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
  if (!json?.status || !json?.data?.regiones_list1) {
    return NextResponse.json(
      { success: false, error: 'PJUD no devolvió comunas.' },
      { status: 502 },
    );
  }

  const comunas = Object.entries(json.data.regiones_list1 as Record<string, string>)
    .map(([code, name]) => ({ code, name }))
    .sort(sortByName);

  return NextResponse.json({ success: true, region, regionCode, comunas });
}

