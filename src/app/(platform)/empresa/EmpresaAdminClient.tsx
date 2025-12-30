'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export type EmpresaMemberRow = {
  user_id: string;
  email: string | null;
  nombre: string | null;
  profile_role: string | null;
  org_role: string;
};

export function EmpresaAdminClient(props: { members: EmpresaMemberRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'A' | 'B'>('A');
  const [message, setMessage] = useState<string | null>(null);

  async function assign() {
    setMessage(null);
    const e = email.trim().toLowerCase();
    if (!e) return setMessage('Email requerido');
    const res = await fetch('/api/org-admin/assign-lawyer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: e, mode }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error asignando abogado');
    setEmail('');
    setMessage('Traslado ejecutado');
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {message}
        </div>
      ) : null}

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-base font-semibold">Agregar / mover abogado a esta empresa</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="abogado@dominio.com"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Modo</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'A' | 'B')}
            >
              <option value="A">A (simple)</option>
              <option value="B">B (strict)</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => void assign()}
            disabled={isPending}
          >
            Ejecutar
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-base font-semibold">Miembros</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Rol empresa</th>
                <th className="py-2 pr-4">Rol perfil</th>
              </tr>
            </thead>
            <tbody>
              {props.members.map((m) => (
                <tr key={m.user_id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4">{m.nombre ?? '-'}</td>
                  <td className="py-2 pr-4">{m.email ?? '-'}</td>
                  <td className="py-2 pr-4">{m.org_role}</td>
                  <td className="py-2 pr-4">{m.profile_role ?? '-'}</td>
                </tr>
              ))}
              {props.members.length === 0 ? (
                <tr>
                  <td className="py-3 text-muted-foreground" colSpan={4}>
                    Sin miembros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

