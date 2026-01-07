'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type LawyerOption = {
  user_id: string;
  nombre: string | null;
  email: string | null;
  role: 'admin_firma' | 'abogado' | 'analista';
};

export function AdminGlobalOrganizationMembersClient(props: { orgId: string; internalUsers: LawyerOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [message, setMessage] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const [newLawyerEmail, setNewLawyerEmail] = useState('');
  const [newLawyerName, setNewLawyerName] = useState('');
  const [newLawyerPassword, setNewLawyerPassword] = useState('');

  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<'lawyer' | 'staff' | 'org_admin'>('lawyer');

  const [assignUserId, setAssignUserId] = useState('');
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

  async function addMember() {
    setMessage(null);
    setCreatedPassword(null);

    const email = addMemberEmail.trim().toLowerCase();
    if (!email) return setMessage('Email requerido');

    const res = await fetch('/api/admin-global/add-member', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: props.orgId,
        email,
        role: addMemberRole,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error agregando miembro');

    setAddMemberEmail('');
    setMessage('Miembro agregado (sin mover casos)');
    startTransition(() => router.refresh());
  }

  async function assignLawyer() {
    setMessage(null);
    setCreatedPassword(null);

    const userId = assignUserId.trim();
    if (!userId) return setMessage('Debes seleccionar un abogado');

    const res = await fetch('/api/admin-global/assign-lawyer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: props.orgId,
        userId,
        mode: assignMode,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error asignando abogado');

    setAssignUserId('');
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
        <h2 className="text-base font-semibold">Sumar miembro (sin mover casos)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Para que una persona esté en 2 empresas a la vez (por ejemplo, Camila colabora con Álvaro pero también tiene su propia empresa).
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={addMemberEmail}
              onChange={(e) => setAddMemberEmail(e.target.value)}
              placeholder="usuario@dominio.com"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Rol en empresa</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={addMemberRole}
              onChange={(e) => setAddMemberRole(e.target.value as any)}
            >
              <option value="lawyer">Abogado</option>
              <option value="staff">Staff</option>
              <option value="org_admin">Admin empresa</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => void addMember()}
            disabled={isPending}
          >
            Agregar miembro
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-base font-semibold">Mover usuario interno a esta empresa (transferencia)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Esto lo saca de su empresa anterior y puede mover casos. No usar para “colaborar” entre empresas.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Usuario</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {props.internalUsers.map((l) => (
                <option key={l.user_id} value={l.user_id}>
                  {(l.nombre ?? 'Sin nombre') + (l.email ? ` — ${l.email}` : '') + ` (${l.role})`}
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
