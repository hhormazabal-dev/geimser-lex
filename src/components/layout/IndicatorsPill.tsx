'use client';

import { useEffect, useMemo, useState } from 'react';

type IndicatorsResponse =
  | {
      success: true;
      indicators: { uf: number; utm: number; usd: number };
      asOf: string;
    }
  | { success: false; error?: string };

type IndicatorsState = {
  uf: number;
  utm: number;
  usd: number;
  asOf: string;
};

const STORAGE_KEY = 'geimser.indicators.v1';

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(value);
}

function formatUF(value: number): string {
  return new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function toDayKey(iso: string): string {
  return iso.split('T')[0] ?? iso;
}

function readCached(): IndicatorsState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IndicatorsState>;
    if (
      typeof parsed.uf !== 'number' ||
      typeof parsed.utm !== 'number' ||
      typeof parsed.usd !== 'number' ||
      typeof parsed.asOf !== 'string'
    ) {
      return null;
    }
    return parsed as IndicatorsState;
  } catch {
    return null;
  }
}

function writeCached(value: IndicatorsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function IndicatorsPill() {
  const [state, setState] = useState<IndicatorsState | null>(null);

  useEffect(() => {
    const cached = readCached();
    if (cached) setState(cached);

    const fetchIndicators = async () => {
      try {
        const response = await fetch('/api/indicators', { cache: 'no-store' });
        const payload = (await response.json()) as IndicatorsResponse;
        if (!payload || payload.success !== true) return;

        const next: IndicatorsState = {
          uf: payload.indicators.uf,
          utm: payload.indicators.utm,
          usd: payload.indicators.usd,
          asOf: payload.asOf,
        };

        setState(next);
        writeCached(next);
      } catch {
        // ignore: usamos cache local si existe
      }
    };

    // Solo refrescar si lo guardado no es "de hoy".
    const isFresh = cached ? toDayKey(cached.asOf) === toDayKey(new Date().toISOString()) : false;
    if (!isFresh) void fetchIndicators();
  }, []);

  const label = useMemo(() => {
    if (!state) return null;
    return {
      uf: `UF ${formatUF(state.uf)}`,
      utm: `UTM ${formatCLP(state.utm)}`,
      usd: `USD $${formatCLP(state.usd)}`,
      asOf: toDayKey(state.asOf),
    };
  }, [state]);

  if (!label) return null;

  return (
    <div className="hidden items-center gap-2 rounded-2xl border border-white/25 bg-white/55 px-3 py-2 text-xs text-foreground/60 shadow-inner transition hover:bg-white/70 lg:flex">
      <span className="font-semibold text-foreground/70">{label.uf}</span>
      <span className="text-foreground/35">·</span>
      <span className="font-semibold text-foreground/70">{label.utm}</span>
      <span className="text-foreground/35">·</span>
      <span className="font-semibold text-foreground/70">{label.usd}</span>
      <span className="ml-1 text-[10px] text-foreground/40">({label.asOf})</span>
    </div>
  );
}

