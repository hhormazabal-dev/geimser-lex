'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Org = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  is_default?: boolean;
};

export function SelectOrgClient(props: { organizations: Org[]; activeOrgId: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(props.activeOrgId ?? '');
  const [message, setMessage] = useState<string | null>(null);

  async function setActiveOrg() {
    setMessage(null);
    if (!selected) return setMessage('Selecciona una empresa');
    const res = await fetch('/api/set-active-org', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: selected }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error seteando empresa activa');

    startTransition(() => {
      router.push('/dashboard');
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {message}
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-5">
        <h1 className="text-xl font-semibold">Selecciona una empresa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta selección define el contexto (RLS) para ver clientes, casos y documentos.
        </p>

        <div className="mt-4">
          <label className="text-xs font-medium text-muted-foreground">Empresa activa</label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Selecciona…</option>
            {props.organizations.map((o) => (
              <option key={o.id} value={o.id} disabled={o.status !== 'active'}>
                {o.name} {o.status !== 'active' ? '(inactiva)' : ''} {o.is_default ? '(default)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => void setActiveOrg()}
            disabled={isPending}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

