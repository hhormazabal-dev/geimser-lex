'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createBillingAccount, listBillingAccounts, type BillingAccountSummary } from '@/lib/actions/billing';
import { getCases } from '@/lib/actions/cases';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Case } from '@/lib/supabase/types';

function formatAmount(currency: string, amount: number): string {
  if (currency === 'UF') {
    return `${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} UF`;
  }
  if (currency === 'CLP') return formatCurrency(amount);
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: currency as 'USD' }).format(amount);
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  parcial: { label: 'Parcial', className: 'bg-amber-50 text-amber-700 border border-amber-100' },
  pagado: { label: 'Pagado', className: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  vencido: { label: 'Vencido', className: 'bg-rose-50 text-rose-700 border border-rose-100' },
};

type BillingCreateForm = {
  title: string;
  description: string;
  currency: 'UF' | 'CLP' | 'USD';
  amount_total: string;
  due_date: string;
  case_ids: string[];
};

const EMPTY_FORM: BillingCreateForm = {
  title: '',
  description: '',
  currency: 'UF',
  amount_total: '',
  due_date: '',
  case_ids: [],
};

export default function BillingPage() {
  const [accounts, setAccounts] = useState<BillingAccountSummary[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<BillingCreateForm>(EMPTY_FORM);
  const [canManage, setCanManage] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setIsLoading(true);
    try {
      const [accountsRes, casesRes] = await Promise.all([
        listBillingAccounts(),
        getCases({ page: 1, limit: 200 }),
      ]);

      if (accountsRes.success) setAccounts(accountsRes.accounts);
      else throw new Error(accountsRes.error ?? 'No se pudieron cargar los cobros.');

      if (casesRes.success) setCases(casesRes.cases as any);
    } catch (error) {
      console.error('[billing] load error', error);
      toast({
        title: 'Error al cargar cobros',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetch('/api/whoami')
      .then((res) => res.json())
      .then((payload) => {
        const role = String(payload?.profile?.role ?? '').trim().toLowerCase();
        setCanManage(['admin_firma', 'abogado', 'analista'].includes(role));
      })
      .catch(() => setCanManage(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((account) => {
      const haystack = [
        account.title,
        ...account.cases.map((c) => c.caratulado),
        ...account.cases.map((c) => c.numero_causa ?? ''),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [accounts, search]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsCreating(true);
    try {
      const amount = Number(form.amount_total);
      if (!Number.isFinite(amount) || amount < 0) throw new Error('Debes indicar un monto total válido.');
      if (form.case_ids.length === 0) throw new Error('Debes vincular al menos un caso.');

      const result = await createBillingAccount({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        currency: form.currency,
        amount_total: amount,
        due_date: form.due_date.trim() || undefined,
        case_ids: form.case_ids,
      });

      if (!result.success) {
        throw new Error(result.error ?? 'No se pudo crear el cobro.');
      }

      toast({ title: 'Cobro creado', description: 'El cobro quedó registrado y listo para registrar pagos.' });
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await load();
    } catch (error) {
      toast({
        title: 'No se pudo crear el cobro',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Gestión"
        title="Cobros"
        description="Gestiona cobros y registra pagos de manera independiente del expediente."
        actions={
          canManage ? (
            <Button variant={showCreate ? 'outline' : 'default'} onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? 'Cerrar' : 'Nuevo cobro'}
            </Button>
          ) : null
        }
      />

      {canManage && showCreate && (
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Crear cobro</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="billing_title">Título *</Label>
                <Input
                  id="billing_title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_currency">Moneda</Label>
                <select
                  id="billing_currency"
                  className="form-input"
                  value={form.currency}
                  onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value as BillingCreateForm['currency'] }))}
                  disabled={isCreating}
                >
                  <option value="UF">UF</option>
                  <option value="CLP">CLP</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_amount_total">Monto total *</Label>
                <Input
                  id="billing_amount_total"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount_total}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount_total: e.target.value }))}
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_due_date">Vencimiento</Label>
                <Input
                  id="billing_due_date"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="billing_cases">Casos vinculados *</Label>
                <select
                  id="billing_cases"
                  multiple
                  value={form.case_ids}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setForm((prev) => ({ ...prev, case_ids: selected }));
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  disabled={isCreating}
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.numero_causa ? `[${c.numero_causa}] ` : '') + c.caratulado}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">Tip: Mantén presionado Ctrl/Cmd para seleccionar más de un caso.</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="billing_desc">Descripción</Label>
                <Textarea
                  id="billing_desc"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  disabled={isCreating}
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-end gap-2">
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? 'Creando…' : 'Crear cobro'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Cobros registrados</CardTitle>
            <p className="text-sm text-slate-500">Historial de cobros, pagos y estado de cada cuenta.</p>
          </div>
          <div className="w-full sm:w-80">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título o caso…" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-32 rounded-xl bg-slate-100/60" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500">No hay cobros para mostrar.</p>
          ) : (
            <div className="grid gap-3">
              {filtered.map((account) => {
                const badge = STATUS_BADGE[account.status] ?? { label: account.status, className: 'bg-slate-100 text-slate-700 border border-slate-200' };
                return (
                  <Link
                    key={account.id}
                    href={`/billing/${account.id}`}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-sky-200 hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{account.title}</p>
                          <Badge className={badge.className}>{badge.label}</Badge>
                          {account.due_date && (
                            <span className="text-xs text-slate-500">Vence: {formatDate(account.due_date)}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {account.cases.length > 0
                            ? account.cases.map((c) => c.caratulado).slice(0, 2).join(' · ') +
                              (account.cases.length > 2 ? ` (+${account.cases.length - 2})` : '')
                            : 'Sin casos vinculados'}
                        </p>
                      </div>

                      <div className="text-sm text-slate-700">
                        <p className="font-semibold">
                          {formatAmount(account.currency, account.amount_paid)} / {formatAmount(account.currency, account.amount_total)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Pendiente: {formatAmount(account.currency, Math.max(account.amount_total - account.amount_paid, 0))}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
