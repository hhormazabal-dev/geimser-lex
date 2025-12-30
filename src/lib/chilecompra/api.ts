import 'server-only';

import { formatRUT, validateRUT } from '@/lib/utils';

export type ChileCompraSupplier = {
  codigoEmpresa: string;
  nombreEmpresa: string;
};

export type ChileCompraBuscarProveedorResponse = {
  cantidad: number;
  suppliers: ChileCompraSupplier[];
  fetchedAt: string;
};

const BASE_URL = 'https://api.mercadopublico.cl';

function getTicket(): string | null {
  const ticket = process.env.CHILECOMPRA_TICKET?.trim() ?? '';
  return ticket ? ticket : null;
}

function toIso(date: unknown): string {
  const d = typeof date === 'string' ? new Date(date) : date instanceof Date ? date : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function normalizeText(v: unknown): string {
  return String(v ?? '').trim();
}

export function chileCompraEnabled(): boolean {
  return Boolean(getTicket());
}

export async function chileCompraBuscarProveedor(rutRaw: string): Promise<ChileCompraBuscarProveedorResponse> {
  const ticket = getTicket();
  if (!ticket) {
    throw new Error('CHILECOMPRA_TICKET no configurado.');
  }

  const rut = normalizeText(rutRaw);
  if (!validateRUT(rut)) {
    return { cantidad: 0, suppliers: [], fetchedAt: new Date().toISOString() };
  }

  const rutFormatted = formatRUT(rut);
  const url = new URL(`${BASE_URL}/servicios/v1/Publico/Empresas/BuscarProveedor`);
  url.searchParams.set('rutempresaproveedor', rutFormatted);
  url.searchParams.set('ticket', ticket);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`ChileCompra respondió ${res.status}`);
  }

  const json = (await res.json().catch(() => null)) as any;
  const cantidad = Number(json?.Cantidad ?? 0);
  const fetchedAt = toIso(json?.FechaCreacion ?? null);

  const suppliers = Array.isArray(json?.listaEmpresas)
    ? (json.listaEmpresas as any[])
        .map((row) => ({
          codigoEmpresa: normalizeText(row?.CodigoEmpresa),
          nombreEmpresa: normalizeText(row?.NombreEmpresa),
        }))
        .filter((s) => s.codigoEmpresa && s.nombreEmpresa)
    : [];

  return { cantidad: Number.isFinite(cantidad) ? cantidad : suppliers.length, suppliers, fetchedAt };
}

