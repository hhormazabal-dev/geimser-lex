'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

export type EmpresaMemberRow = {
  user_id: string;
  email: string | null;
  nombre: string | null;
  profile_role: string | null;
  org_role: string;
};

type OrgNotificationSettings = {
  case_change_emails_enabled: boolean;
  deadline_emails_enabled: boolean;
  calendar_links_enabled: boolean;
  deadline_reminder_days: number[];
  deadline_send_to_lawyer: boolean;
  deadline_send_to_staff: boolean;
  deadline_send_to_clients: boolean;
  case_change_send_to_lawyer: boolean;
  case_change_send_to_staff: boolean;
  case_change_send_to_clients: boolean;
};

const DEFAULT_SETTINGS: OrgNotificationSettings = {
  case_change_emails_enabled: true,
  deadline_emails_enabled: true,
  calendar_links_enabled: true,
  deadline_reminder_days: [7, 3, 1],
  deadline_send_to_lawyer: true,
  deadline_send_to_staff: false,
  deadline_send_to_clients: true,
  case_change_send_to_lawyer: true,
  case_change_send_to_staff: false,
  case_change_send_to_clients: true,
};

export function EmpresaAdminClient(props: { members: EmpresaMemberRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'A' | 'B'>('A');
  const [message, setMessage] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'lawyer' | 'staff' | 'org_admin'>('lawyer');

  const [newLawyerEmail, setNewLawyerEmail] = useState('');
  const [newLawyerName, setNewLawyerName] = useState('');
  const [newLawyerPassword, setNewLawyerPassword] = useState('');
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const [settings, setSettings] = useState<OrgNotificationSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const dayOptions = useMemo(() => [1, 3, 7, 14], []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/org-admin/notification-settings', { method: 'GET' });
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) throw new Error(json?.error ?? 'Error cargando configuración');
        const next = (json?.settings ?? null) as Partial<OrgNotificationSettings> | null;
        setSettings({ ...DEFAULT_SETTINGS, ...(next ?? {}) });
        setSettingsLoaded(true);
      } catch (e: any) {
        if (!alive) return;
        setMessage(e?.message ?? 'No se pudo cargar la configuración de alertas');
        setSettingsLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function saveSettings(next?: OrgNotificationSettings) {
    setMessage(null);
    setSettingsSaving(true);
    try {
      const payload = next ?? settings;
      const res = await fetch('/api/org-admin/notification-settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? 'Error guardando configuración');
      setSettings({ ...DEFAULT_SETTINGS, ...(json?.settings ?? payload) });
      setMessage('Configuración de alertas guardada');
    } catch (e: any) {
      setMessage(e?.message ?? 'Error guardando configuración');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function assign() {
    setMessage(null);
    setCreatedPassword(null);
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

  async function addMember() {
    setMessage(null);
    setCreatedPassword(null);
    const e = inviteEmail.trim().toLowerCase();
    if (!e) return setMessage('Email requerido');
    const res = await fetch('/api/org-admin/add-member', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: e, role: inviteRole }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error agregando miembro');
    setInviteEmail('');
    setMessage('Miembro agregado a la empresa (sin mover casos)');
    startTransition(() => router.refresh());
  }

  async function createLawyer() {
    setMessage(null);
    setCreatedPassword(null);

    const e = newLawyerEmail.trim().toLowerCase();
    const n = newLawyerName.trim();
    const p = newLawyerPassword.trim();
    if (!e) return setMessage('Email requerido');
    if (!n) return setMessage('Nombre requerido');

    const res = await fetch('/api/org-admin/create-lawyer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: e, nombre: n, password: p || undefined }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error creando abogado');

    if (json?.password) {
      setCreatedPassword(String(json.password));
    }
    setNewLawyerEmail('');
    setNewLawyerName('');
    setNewLawyerPassword('');
    setMessage('Abogado creado y asignado a la empresa');
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
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Alertas por email (empresa)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Controla recordatorios de fechas y avisos por cambios en causas. Incluye links para agregar al calendario.
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2 sm:mt-0">
            <Button
              variant="secondary"
              className="h-9 rounded-xl px-4"
              onClick={() => void saveSettings()}
              disabled={!settingsLoaded || settingsSaving}
            >
              {settingsSaving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-[color:var(--glass)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Cambios en causas</p>
                <p className="mt-1 text-xs text-muted-foreground">Creación/actualización de etapas, cambios de estado y fechas.</p>
              </div>
              <Switch
                checked={settings.case_change_emails_enabled}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, case_change_emails_enabled: Boolean(v) }))}
              />
            </div>
            <div className="mt-4 grid gap-2">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Abogado responsable</span>
                <Switch
                  checked={settings.case_change_send_to_lawyer}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, case_change_send_to_lawyer: Boolean(v) }))}
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Equipo interno (admins/staff)</span>
                <Switch
                  checked={settings.case_change_send_to_staff}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, case_change_send_to_staff: Boolean(v) }))}
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Clientes del caso (solo hitos públicos)</span>
                <Switch
                  checked={settings.case_change_send_to_clients}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, case_change_send_to_clients: Boolean(v) }))}
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border bg-[color:var(--glass)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Próximas fechas</p>
                <p className="mt-1 text-xs text-muted-foreground">Recordatorios automáticos antes de un hito con fecha programada.</p>
              </div>
              <Switch
                checked={settings.deadline_emails_enabled}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, deadline_emails_enabled: Boolean(v) }))}
              />
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Días antes</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dayOptions.map((d) => {
                  const active = settings.deadline_reminder_days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      className={`rounded-full border px-3 py-1 text-xs ${
                        active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white/40 text-foreground/80'
                      }`}
                      onClick={() => {
                        setSettings((s) => {
                          const nextDays = active
                            ? s.deadline_reminder_days.filter((x) => x !== d)
                            : Array.from(new Set([...s.deadline_reminder_days, d]));
                          return { ...s, deadline_reminder_days: nextDays.sort((a, b) => b - a) };
                        });
                      }}
                    >
                      {d} día{d === 1 ? '' : 's'}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Tip: si dejas vacío, se usa el estándar (7, 3, 1).</p>
            </div>

            <div className="mt-4 grid gap-2">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Abogado responsable</span>
                <Switch
                  checked={settings.deadline_send_to_lawyer}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, deadline_send_to_lawyer: Boolean(v) }))}
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Equipo interno (admins/staff)</span>
                <Switch
                  checked={settings.deadline_send_to_staff}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, deadline_send_to_staff: Boolean(v) }))}
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Clientes del caso</span>
                <Switch
                  checked={settings.deadline_send_to_clients}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, deadline_send_to_clients: Boolean(v) }))}
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border bg-white/40 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Links de calendario</p>
                <p className="text-xs text-muted-foreground">Adjunta .ics + Google/Outlook.</p>
              </div>
              <Switch
                checked={settings.calendar_links_enabled}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, calendar_links_enabled: Boolean(v) }))}
              />
            </div>
          </div>
        </div>
      </section>

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
          Útil cuando Camila debe ver los casos de Álvaro, pero además tener su propia empresa aparte. Se agrega membresía a esta empresa.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="camila@dominio.com"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Rol en empresa</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
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
        <h2 className="text-base font-semibold">Mover abogado a esta empresa (transferencia)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Esto mueve al abogado (y opcionalmente sus casos) entre empresas. No usar para “colaborar” entre empresas.
        </p>
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
