'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type OrganizationRow = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  is_default: boolean;
  created_at?: string | null;
  billing_currency?: string | null;
  billing_price_per_user?: number | null;
  billing_user_seats?: number | null;
  billing_monthly_base_fee?: number | null;
  billing_setup_fee?: number | null;
};

type OrganizationOption = Pick<OrganizationRow, 'id' | 'name' | 'status' | 'is_default'>;

type LawyerRow = {
  id: string;
  user_id: string;
  nombre: string;
  email: string;
};

type PaginationState = {
  q: string;
  status: 'all' | 'active' | 'inactive';
  page: number;
  pageSize: number;
  totalCount: number;
};

export function AdminGlobalClient(props: {
  organizations: OrganizationRow[];
  organizationOptions: OrganizationOption[];
  lawyers: LawyerRow[];
  pagination: PaginationState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCurrency, setNewOrgCurrency] = useState<'UF' | 'CLP' | 'USD'>('UF');
  const [newOrgSeats, setNewOrgSeats] = useState<number>(5);
  const [newOrgPricePerUser, setNewOrgPricePerUser] = useState<number>(0);
  const [newOrgBaseFee, setNewOrgBaseFee] = useState<number>(0);
  const [newOrgSetupFee, setNewOrgSetupFee] = useState<number>(0);
  const [newOrgAdminEmail, setNewOrgAdminEmail] = useState<string>('');
  const [newOrgAdminName, setNewOrgAdminName] = useState<string>('');
  const [newOrgAdminPassword, setNewOrgAdminPassword] = useState<string>('');
  const [createdOrgAdminPassword, setCreatedOrgAdminPassword] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState<string>('');
  const [assignOrgId, setAssignOrgId] = useState<string>('');
  const [assignMode, setAssignMode] = useState<'A' | 'B'>('A');
  const [message, setMessage] = useState<string | null>(null);

  const organizations = useMemo(() => props.organizations ?? [], [props.organizations]);
  const organizationOptions = useMemo(
    () => props.organizationOptions ?? [],
    [props.organizationOptions],
  );
  const lawyers = useMemo(() => props.lawyers ?? [], [props.lawyers]);

  const [qInput, setQInput] = useState(props.pagination.q);
  const [statusInput, setStatusInput] = useState<PaginationState['status']>(props.pagination.status);

  const totalPages = Math.max(1, Math.ceil((props.pagination.totalCount ?? 0) / (props.pagination.pageSize ?? 50)));

  const computedMonthly = useMemo(() => {
    const seats = Number.isFinite(newOrgSeats) ? Math.max(0, Math.trunc(newOrgSeats)) : 0;
    const ppu = Number.isFinite(newOrgPricePerUser) ? Math.max(0, newOrgPricePerUser) : 0;
    const base = Number.isFinite(newOrgBaseFee) ? Math.max(0, newOrgBaseFee) : 0;
    return base + seats * ppu;
  }, [newOrgBaseFee, newOrgPricePerUser, newOrgSeats]);

  function pushWithParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function applyFilters() {
    pushWithParams({
      q: qInput.trim() || null,
      status: statusInput !== 'all' ? statusInput : null,
      page: '1',
    });
  }

  async function createOrg() {
    setMessage(null);
    setCreatedOrgAdminPassword(null);
    const name = newOrgName.trim();
    if (!name) return setMessage('Nombre requerido');
    const adminEmail = newOrgAdminEmail.trim().toLowerCase();
    const adminName = newOrgAdminName.trim();
    if (!adminEmail) return setMessage('Email de admin requerido');
    if (!adminName) return setMessage('Nombre de admin requerido');
    const seats = Math.max(0, Math.trunc(Number(newOrgSeats || 0)));
    const pricePerUser = Math.max(0, Number(newOrgPricePerUser || 0));
    const baseFee = Math.max(0, Number(newOrgBaseFee || 0));
    const setupFee = Math.max(0, Number(newOrgSetupFee || 0));
    const res = await fetch('/api/admin-global/organizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        billing_currency: newOrgCurrency,
        billing_user_seats: seats,
        billing_price_per_user: pricePerUser,
        billing_monthly_base_fee: baseFee,
        billing_setup_fee: setupFee,
        admin_email: adminEmail,
        admin_name: adminName,
        admin_password: newOrgAdminPassword.trim() || undefined,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMessage(json?.error ?? 'Error creando empresa');

    const pw = json?.org_admin?.password ? String(json.org_admin.password) : null;
    if (pw) setCreatedOrgAdminPassword(pw);
    setNewOrgName('');
    setNewOrgAdminEmail('');
    setNewOrgAdminName('');
    setNewOrgAdminPassword('');
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
    if (!assignUserId) return setMessage('Selecciona un abogado');
    if (!assignOrgId) return setMessage('Selecciona una empresa destino');

    const res = await fetch('/api/admin-global/assign-lawyer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: assignUserId, organizationId: assignOrgId, mode: assignMode }),
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

      {createdOrgAdminPassword ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Password inicial de admin generado:{' '}
          <span className="font-mono font-semibold">{createdOrgAdminPassword}</span>
        </div>
      ) : null}

      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Empresas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {props.pagination.totalCount} empresas • página {props.pagination.page} de {totalPages}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin-global" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              Dashboard
            </Link>
            <Link href="/admin-global/transfers" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              Transferencias
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-[1fr,220px,140px]">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Buscar empresa</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Nombre…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilters();
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Estado</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={statusInput}
              onChange={(e) => setStatusInput(e.target.value as PaginationState['status'])}
            >
              <option value="all">Todas</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={() => applyFilters()}
              disabled={isPending}
            >
              Aplicar
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold">Crear empresa (setup + pricing)</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Nombre de empresa"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Admin email</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={newOrgAdminEmail}
                onChange={(e) => setNewOrgAdminEmail(e.target.value)}
                placeholder="admin@empresa.com"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Admin nombre</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={newOrgAdminName}
                onChange={(e) => setNewOrgAdminName(e.target.value)}
                placeholder="Nombre Apellido"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Moneda</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={newOrgCurrency}
                onChange={(e) => setNewOrgCurrency(e.target.value as any)}
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
                value={newOrgSeats}
                onChange={(e) => setNewOrgSeats(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Precio / usuario</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                type="number"
                min={0}
                step="0.01"
                value={newOrgPricePerUser}
                onChange={(e) => setNewOrgPricePerUser(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Base mensual</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                type="number"
                min={0}
                step="0.01"
                value={newOrgBaseFee}
                onChange={(e) => setNewOrgBaseFee(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Setup (one-off)</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                type="number"
                min={0}
                step="0.01"
                value={newOrgSetupFee}
                onChange={(e) => setNewOrgSetupFee(Number(e.target.value))}
              />
            </div>
            <div className="md:col-span-6">
              <label className="text-xs font-medium text-muted-foreground">Admin password (opcional)</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={newOrgAdminPassword}
                onChange={(e) => setNewOrgAdminPassword(e.target.value)}
                placeholder="(se genera automáticamente si lo dejas vacío)"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Mensualidad estimada: <span className="font-semibold text-foreground">{computedMonthly}</span>{' '}
              <span className="text-xs">{newOrgCurrency}</span>
              <span className="ml-2 text-xs text-muted-foreground">(base + seats × precio)</span>
            </p>
            <button
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={() => void createOrg()}
              disabled={isPending}
            >
              Crear empresa
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Seats</th>
                <th className="py-2 pr-4">Precio</th>
                <th className="py-2 pr-4">Base</th>
                <th className="py-2 pr-4">MRR</th>
                <th className="py-2 pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((o) => (
                <OrgRow key={o.id} org={o} onRename={renameOrg} onToggle={toggleOrg} />
              ))}
              {organizations.length === 0 ? (
                <tr>
                  <td className="py-3 text-muted-foreground" colSpan={7}>
                    No hay empresas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Mostrando {organizations.length} de {props.pagination.totalCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              disabled={props.pagination.page <= 1}
              onClick={() => pushWithParams({ page: String(Math.max(1, props.pagination.page - 1)) })}
            >
              Anterior
            </button>
            <button
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              disabled={props.pagination.page >= totalPages}
              onClick={() => pushWithParams({ page: String(Math.min(totalPages, props.pagination.page + 1)) })}
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-base font-semibold">Asignar / mover abogado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mueve al abogado a la empresa destino y migra datos según el modo elegido.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Abogado activo</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {lawyers.map((l) => (
                <option key={l.user_id} value={l.user_id}>
                  {l.nombre} — {l.email}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Empresa destino</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={assignOrgId}
              onChange={(e) => setAssignOrgId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {organizationOptions.map((o) => (
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
      <td className="py-2 pr-4">{props.org.billing_user_seats ?? 0}</td>
      <td className="py-2 pr-4">{props.org.billing_price_per_user ?? 0}</td>
      <td className="py-2 pr-4">{props.org.billing_monthly_base_fee ?? 0}</td>
      <td className="py-2 pr-4">
        {Number(props.org.billing_monthly_base_fee ?? 0) +
          Number(props.org.billing_user_seats ?? 0) * Number(props.org.billing_price_per_user ?? 0)}
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
