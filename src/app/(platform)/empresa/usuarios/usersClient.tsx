'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type OrgRole = 'org_admin' | 'lawyer' | 'staff';
type MemberRow = {
  user_id: string;
  org_role: OrgRole;
  email: string | null;
  nombre: string | null;
  profile_role: string | null;
  activo: boolean | null;
};

export function OrgUsersClient({ members }: { members: MemberRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const [createEmail, setCreateEmail] = useState('');
  const [createNombre, setCreateNombre] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createOrgRole, setCreateOrgRole] = useState<OrgRole>('lawyer');

  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<OrgRole>('lawyer');

  async function createMember() {
    setMessage(null);
    const email = createEmail.trim().toLowerCase();
    const nombre = createNombre.trim();
    const password = createPassword.trim();
    if (!email) return setMessage('Email requerido');
    if (!nombre) return setMessage('Nombre requerido');

    const res = await fetch('/api/org-admin/create-member', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, nombre, password: password || undefined, orgRole: createOrgRole }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error creando usuario');

    setCreateEmail('');
    setCreateNombre('');
    setCreatePassword('');
    setCreateOrgRole('lawyer');
    if (json?.password) {
      setMessage(`Usuario creado. Password inicial: ${String(json.password)}`);
    } else {
      setMessage('Usuario creado y agregado a la empresa');
    }
    startTransition(() => router.refresh());
  }

  async function addExistingMember() {
    setMessage(null);
    const email = addEmail.trim().toLowerCase();
    if (!email) return setMessage('Email requerido');

    const res = await fetch('/api/org-admin/add-member', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, role: addRole }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error agregando miembro');

    setAddEmail('');
    setMessage('Miembro agregado');
    startTransition(() => router.refresh());
  }

  async function updateRole(userId: string, role: OrgRole) {
    setMessage(null);
    const res = await fetch('/api/org-admin/update-member-role', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error actualizando rol');
    setMessage('Rol actualizado');
    startTransition(() => router.refresh());
  }

  async function removeMember(userId: string) {
    setMessage(null);
    const res = await fetch('/api/org-admin/remove-member', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error removiendo miembro');
    setMessage('Miembro removido');
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>
      ) : null}

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-base font-semibold">Crear usuario interno (en esta empresa)</h2>
        <p className="mt-1 text-sm text-muted-foreground">Crea el usuario y lo agrega como miembro a la empresa activa.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder="usuario@dominio.com"
              disabled={isPending}
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Nombre</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={createNombre}
              onChange={(e) => setCreateNombre(e.target.value)}
              placeholder="Nombre Apellido"
              disabled={isPending}
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Rol en empresa</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={createOrgRole}
              onChange={(e) => setCreateOrgRole(e.target.value as OrgRole)}
              disabled={isPending}
            >
              <option value="lawyer">Abogado</option>
              <option value="staff">Staff</option>
              <option value="org_admin">Admin empresa</option>
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Password (opcional)</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              placeholder="(se genera automáticamente si lo dejas vacío)"
              disabled={isPending}
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => void createMember()}
            disabled={isPending}
          >
            Crear y agregar
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-base font-semibold">Sumar miembro (sin mover casos)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Agrega por email a un usuario existente a esta empresa, sin ver usuarios globales.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              disabled={isPending}
              placeholder="usuario@dominio.com"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Rol en empresa</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as OrgRole)}
              disabled={isPending}
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
            onClick={() => void addExistingMember()}
            disabled={isPending}
          >
            Agregar miembro
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
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4">{m.nombre ?? '-'}</td>
                  <td className="py-2 pr-4">{m.email ?? '-'}</td>
                  <td className="py-2 pr-4">
                    <select
                      className="rounded-md border px-2 py-1 text-sm"
                      value={m.org_role}
                      disabled={isPending}
                      onChange={(e) => void updateRole(m.user_id, e.target.value as OrgRole)}
                    >
                      <option value="lawyer">Abogado</option>
                      <option value="staff">Staff</option>
                      <option value="org_admin">Admin empresa</option>
                    </select>
                  </td>
                  <td className="py-2 pr-4">{m.activo === false ? 'Inactivo' : 'Activo'}</td>
                  <td className="py-2 pr-4 text-right">
                    <button
                      className="rounded-md border px-3 py-1 text-xs text-foreground/80 hover:bg-slate-50 disabled:opacity-60"
                      onClick={() => void removeMember(m.user_id)}
                      disabled={isPending}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
              {members.length === 0 ? (
                <tr>
                  <td className="py-3 text-muted-foreground" colSpan={5}>
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
