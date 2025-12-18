import { NextResponse } from 'next/server';
import { ojvScrapeSearchSelects } from '@/lib/pjud/ojv';

export const runtime = 'nodejs';

function requireApiKey(req: Request) {
  const required = process.env.SERVICES_API_KEY?.trim();
  if (!required) return null;
  const provided =
    req.headers.get('x-api-key')?.trim() ||
    req.headers.get('x-api-key'.toUpperCase())?.trim() ||
    '';
  if (provided !== required) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(req: Request) {
  const authErr = requireApiKey(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const baseUrl = searchParams.get('baseUrl')?.trim() || undefined;

  try {
    const data = await ojvScrapeSearchSelects(baseUrl ? { baseUrl } : undefined);
    return NextResponse.json({ success: true, ...data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message ?? 'No se pudieron obtener los selects de PJUD.' },
      { status: 502 },
    );
  }
}
