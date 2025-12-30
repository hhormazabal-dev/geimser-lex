import { NextResponse } from 'next/server';

type MindicadorPayload = {
  fecha?: string;
  uf?: { valor?: number; fecha?: string };
  utm?: { valor?: number; fecha?: string };
  dolar?: { valor?: number; fecha?: string };
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export async function GET() {
  try {
    const apiUrl = process.env.INDICATORS_API_URL?.trim() || 'https://mindicador.cl/api';
    const response = await fetch(apiUrl, {
      // Cache diario en el edge/server (reduce llamadas al proveedor).
      next: { revalidate: 60 * 60 * 24 },
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Proveedor de indicadores respondió ${response.status}` },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as MindicadorPayload;

    const uf = toNumber(payload.uf?.valor);
    const utm = toNumber(payload.utm?.valor);
    const usd = toNumber(payload.dolar?.valor);

    if (uf === null || utm === null || usd === null) {
      return NextResponse.json(
        { success: false, error: 'Respuesta inválida del proveedor de indicadores.' },
        { status: 502 },
      );
    }

    const asOf = payload.fecha ?? payload.uf?.fecha ?? payload.utm?.fecha ?? payload.dolar?.fecha ?? new Date().toISOString();

    return NextResponse.json(
      {
        success: true,
        indicators: {
          uf,
          utm,
          usd,
        },
        asOf,
        source: apiUrl,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
        },
      },
    );
  } catch (error) {
    console.error('[api/indicators] error', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Error al obtener indicadores.' },
      { status: 500 },
    );
  }
}

