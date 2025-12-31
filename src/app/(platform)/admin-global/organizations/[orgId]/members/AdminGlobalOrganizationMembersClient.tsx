'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function AdminGlobalOrganizationMembersClient(props: { orgId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [message, setMessage] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const [newLawyerEmail, setNewLawyerEmail] = useState('');
  const [newLawyerName, setNewLawyerName] = useState('');
  const [newLawyerPassword, setNewLawyerPassword] = useState('');

  const [assignEmail, setAssignEmail] = useState('');
  const [assignMode, setAssignMode] = useState<'A' | 'B'>('A');

  async function createLawyer() {
    setMessage(null);
    setCreatedPassword(null);

    const email = newLawyerEmail.trim().toLowerCase();
    const nombre = newLawyerName.trim();
    const password = newLawyerPassword.trim();
    if (!email) return setMessage('Email requerido');
    if (!nombre) return setMessage('Nombre requerido');

    const res = await fetch('/api/admin-global/create-lawyer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: props.orgId,
        email,
        nombre,
        password: password || undefined,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error creando abogado');

    if (json?.password) setCreatedPassword(String(json.password));

    setNewLawyerEmail('');
    setNewLawyerName('');
    setNewLawyerPassword('');
    setMessage('Abogado creado y agregado a la empresa');
    startTransition(() => router.refresh());
  }

  async function assignLawyer() {
    setMessage(null);
    setCreatedPassword(null);

    const email = assignEmail.trim().toLowerCase();
    if (!email) return setMessage('Email requerido');

    const res = await fetch('/api/admin-global/assign-lawyer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: props.orgId,
        email,
        mode: assignMode,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error asignando abogado');

    setAssignEmail('');
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

      {createdPassword ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Password inicial generado: <span className="font-mono font-semibold">{createdPassword}</span>
        </div>
      ) : null}

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-base font-semibold">Crear abogado (en esta empresa)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea el usuario, su perfil y lo agrega a la empresa como abogado.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={newLawyerEmail}
              onChange={(e) => setNewLawyerEmail(e.target.value)}
              placeholder="abogado@dominio.com"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Nombre</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={newLawyerName}
              onChange={(e) => setNewLawyerName(e.target.value)}
              placeholder="Nombre Apellido"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Password (opcional)</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={newLawyerPassword}
              onChange={(e) => setNewLawyerPassword(e.target.value)}
              placeholder="(se genera automáticamente si lo dejas vacío)"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => void createLawyer()}
            disabled={isPending}
          >
            Crear abogado
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-base font-semibold">Agregar / mover abogado a esta empresa</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Si el abogado ya existe, usa este formulario para moverlo a esta empresa.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={assignEmail}
              onChange={(e) => setAssignEmail(e.target.value)}
              placeholder="abogado@dominio.com"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Modo</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={assignMode}
              onChange={(e) => setAssignMode(e.target.value as 'A' | 'B')}
            >
              <option value="A">A (simple)</option>
              <option value="B">B (strict)</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => void assignLawyer()}
            disabled={isPending}
          >
            Ejecutar
          </button>
        </div>
      </section>
    </div>
  );
}

