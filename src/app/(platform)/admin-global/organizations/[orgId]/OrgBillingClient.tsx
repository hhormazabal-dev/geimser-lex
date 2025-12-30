'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type BillingState = {
  billing_currency: 'UF' | 'CLP' | 'USD';
  billing_user_seats: number;
  billing_price_per_user: number;
  billing_monthly_base_fee: number;
  billing_setup_fee: number;
  billing_notes: string | null;
};

export function OrgBillingClient(props: { orgId: string; initial: BillingState }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const [currency, setCurrency] = useState<BillingState['billing_currency']>(props.initial.billing_currency);
  const [seats, setSeats] = useState<number>(props.initial.billing_user_seats);
  const [pricePerUser, setPricePerUser] = useState<number>(props.initial.billing_price_per_user);
  const [baseFee, setBaseFee] = useState<number>(props.initial.billing_monthly_base_fee);
  const [setupFee, setSetupFee] = useState<number>(props.initial.billing_setup_fee);
  const [notes, setNotes] = useState<string>(props.initial.billing_notes ?? '');

  const monthly = useMemo(() => {
    const s = Math.max(0, Math.trunc(Number(seats || 0)));
    const p = Math.max(0, Number(pricePerUser || 0));
    const b = Math.max(0, Number(baseFee || 0));
    return b + s * p;
  }, [baseFee, pricePerUser, seats]);

  async function save() {
    setMessage(null);
    const payload = {
      id: props.orgId,
      billing_currency: currency,
      billing_user_seats: Math.max(0, Math.trunc(Number(seats || 0))),
      billing_price_per_user: Math.max(0, Number(pricePerUser || 0)),
      billing_monthly_base_fee: Math.max(0, Number(baseFee || 0)),
      billing_setup_fee: Math.max(0, Number(setupFee || 0)),
      billing_notes: notes.trim() ? notes.trim() : null,
    };

    const res = await fetch('/api/admin-global/organizations', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error guardando billing');

    setMessage('Guardado');
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      {message ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {message}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-6">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Moneda</label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as BillingState['billing_currency'])}
          >
            <option value="UF">UF</option>
            <option value="CLP">CLP</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Seats</label>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            type="number"
            min={0}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Precio / usuario</label>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            type="number"
            min={0}
            step="0.01"
            value={pricePerUser}
            onChange={(e) => setPricePerUser(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Base mensual</label>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            type="number"
            min={0}
            step="0.01"
            value={baseFee}
            onChange={(e) => setBaseFee(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Setup</label>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            type="number"
            min={0}
            step="0.01"
            value={setupFee}
            onChange={(e) => setSetupFee(Number(e.target.value))}
          />
        </div>
        <div className="md:col-span-1">
          <label className="text-xs font-medium text-muted-foreground">MRR</label>
          <div className="mt-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span className="font-semibold text-foreground">{monthly}</span>{' '}
            <span className="text-xs text-muted-foreground">{currency}</span>
          </div>
        </div>

        <div className="md:col-span-6">
          <label className="text-xs font-medium text-muted-foreground">Notas</label>
          <textarea
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Descuentos, acuerdos, fechas, etc."
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Fórmula: <span className="font-medium">base + seats × precio</span>
        </p>
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={() => void save()}
          disabled={isPending}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

