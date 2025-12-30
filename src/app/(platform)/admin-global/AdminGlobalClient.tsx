'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type OrganizationRow = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  is_default: boolean;
  created_at?: string | null;
};

export function AdminGlobalClient(props: { organizations: OrganizationRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [newOrgName, setNewOrgName] = useState('');
  const [assignEmail, setAssignEmail] = useState('');
  const [assignOrgId, setAssignOrgId] = useState<string>('');
  const [assignMode, setAssignMode] = useState<'A' | 'B'>('A');
  const [message, setMessage] = useState<string | null>(null);

  const organizations = useMemo(() => props.organizations ?? [], [props.organizations]);

  async function createOrg() {
    setMessage(null);
    const name = newOrgName.trim();
    if (!name) return setMessage('Nombre requerido');
    const res = await fetch('/api/admin-global/organizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error creando empresa');
    setNewOrgName('');
    startTransition(() => router.refresh());
  }

  async function toggleOrg(id: string, next: 'active' | 'inactive') {
    setMessage(null);
    const res = await fetch('/api/admin-global/organizations', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, status: next }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error actualizando empresa');
    startTransition(() => router.refresh());
  }

  async function renameOrg(id: string, name: string) {
    setMessage(null);
    const nextName = name.trim();
    if (!nextName) return setMessage('Nombre inválido');
    const res = await fetch('/api/admin-global/organizations', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, name: nextName }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error renombrando empresa');
    startTransition(() => router.refresh());
  }

  async function assignLawyer() {
    setMessage(null);
    const email = assignEmail.trim().toLowerCase();
    if (!email) return setMessage('Email requerido');
    if (!assignOrgId) return setMessage('Selecciona una empresa destino');

    const res = await fetch('/api/admin-global/assign-lawyer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, organizationId: assignOrgId, mode: assignMode }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error asignando abogado');

    setMessage('Traslado ejecutado');
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-8">
      {message ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {message}
        </div>
      ) : null}

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-base font-semibold">Empresas</h2>
        <div className="mt-4 flex gap-2">
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="Nombre de empresa"
          />
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => void createOrg()}
            disabled={isPending}
          >
            Crear
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((o) => (
                <OrgRow key={o.id} org={o} onRename={renameOrg} onToggle={toggleOrg} />
              ))}
              {organizations.length === 0 ? (
                <tr>
                  <td className="py-3 text-muted-foreground" colSpan={3}>
                    No hay empresas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          <Link href="/admin-global/transfers" className="text-primary hover:text-primary/80">
            Ver transferencias
          </Link>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-base font-semibold">Asignar / mover abogado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mueve al abogado a la empresa destino y migra datos según el modo elegido.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={assignEmail}
              onChange={(e) => setAssignEmail(e.target.value)}
              placeholder="abogado@dominio.com"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Empresa destino</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={assignOrgId}
              onChange={(e) => setAssignOrgId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.status === 'inactive' ? '(inactiva)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Modo</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={assignMode}
              onChange={(e) => setAssignMode(e.target.value as 'A' | 'B')}
            >
              <option value="A">A (simple / owned only + conflictos)</option>
              <option value="B">B (strict: mueve todo lo owned)</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => void assignLawyer()}
            disabled={isPending}
          >
            Ejecutar traslado
          </button>
        </div>
      </section>
    </div>
  );
}

function OrgRow(props: {
  org: OrganizationRow;
  onToggle: (id: string, next: 'active' | 'inactive') => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(props.org.name);

  return (
    <tr className="border-b last:border-b-0">
      <td className="py-2 pr-4">
        <div className="flex items-center gap-2">
          <input
            className="w-full rounded-md border px-2 py-1 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={props.org.is_default}
            title={props.org.is_default ? 'La empresa default no se renombra desde aquí' : undefined}
          />
          <button
            className="rounded-md border px-2 py-1 text-xs disabled:opacity-60"
            onClick={() =>
              startTransition(() => {
                void props.onRename(props.org.id, name);
              })
            }
            disabled={isPending || props.org.is_default}
          >
            Guardar
          </button>
        </div>
      </td>
      <td className="py-2 pr-4">
        <span className="rounded-full border px-2 py-0.5 text-xs">
          {props.org.status}
          {props.org.is_default ? ' (default)' : ''}
        </span>
      </td>
      <td className="py-2 pr-4">
        <button
          className="rounded-md border px-3 py-1 text-xs disabled:opacity-60"
          onClick={() =>
            startTransition(() => {
              void props.onToggle(
                props.org.id,
                props.org.status === 'active' ? 'inactive' : 'active'
              );
            })
          }
          disabled={isPending || props.org.is_default}
        >
          {props.org.status === 'active' ? 'Desactivar' : 'Activar'}
        </button>
        <Link
          href={`/admin-global/organizations/${props.org.id}`}
          className="ml-2 rounded-md border px-3 py-1 text-xs hover:bg-muted"
        >
          Ver
        </Link>
      </td>
    </tr>
  );
}
