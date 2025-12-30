'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createBillingAccount, listBillableStages, listBillingAccounts, type BillableStageSummary, type BillingAccountSummary } from '@/lib/actions/billing';
import { getCases } from '@/lib/actions/cases';
import { updateStage } from '@/lib/actions/stages';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Case } from '@/lib/supabase/types';

function formatAmount(currency: string, amount: number): string {
  if (currency === 'UF') {
    return `${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} UF`;
  }
  if (currency === 'CLP') return formatCurrency(amount);
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: currency as 'USD' }).format(amount);
}

function formatUf(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} UF`;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  parcial: { label: 'Parcial', className: 'bg-amber-50 text-amber-700 border border-amber-100' },
  pagado: { label: 'Pagado', className: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  vencido: { label: 'Vencido', className: 'bg-rose-50 text-rose-700 border border-rose-100' },
};

const STAGE_PAYMENT_BADGE: Record<string, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  solicitado: { label: 'Solicitado', className: 'bg-sky-50 text-sky-700 border border-sky-100' },
  parcial: { label: 'Parcial', className: 'bg-amber-50 text-amber-700 border border-amber-100' },
  pagado: { label: 'Pagado', className: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  vencido: { label: 'Vencido', className: 'bg-rose-50 text-rose-700 border border-rose-100' },
};

const DEFAULT_STAGE_BADGE = { label: 'Pendiente', className: 'bg-slate-100 text-slate-700 border border-slate-200' };

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
  const searchParams = useSearchParams();
  const caseIdFilter = searchParams.get('caseId')?.trim() || '';
  const [accounts, setAccounts] = useState<BillingAccountSummary[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [billableStages, setBillableStages] = useState<BillableStageSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStagesLoading, setIsStagesLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<BillingCreateForm>(EMPTY_FORM);
  const [canManage, setCanManage] = useState(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState<string | null>(null);
  const [roleReady, setRoleReady] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setIsLoading(true);
    setIsStagesLoading(true);
    try {
      const stagesResPromise = listBillableStages(caseIdFilter ? { case_id: caseIdFilter } : undefined);
      const accountsResPromise = canManage ? listBillingAccounts() : Promise.resolve({ success: true as const, accounts: [] as BillingAccountSummary[] });
      const casesResPromise = canManage ? getCases({ page: 1, limit: 200 }) : Promise.resolve({ success: true as const, cases: [] as any[] });

      const [stagesRes, accountsRes, casesRes] = await Promise.all([stagesResPromise, accountsResPromise, casesResPromise]);

      if (stagesRes.success) setBillableStages(stagesRes.stages);
      else throw new Error(stagesRes.error ?? 'No se pudieron cargar las etapas por cobrar.');

      if (accountsRes.success) setAccounts(accountsRes.accounts);
      else throw new Error(accountsRes.error ?? 'No se pudieron cargar los cobros.');

      if ((casesRes as any).success) setCases((casesRes as any).cases as any);
    } catch (error) {
      console.error('[billing] load error', error);
      toast({
        title: 'Error al cargar cobros',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsStagesLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/whoami')
      .then((res) => res.json())
      .then((payload) => {
        const role = String(payload?.profile?.role ?? '').trim().toLowerCase();
        setCanManage(['admin_firma', 'abogado', 'analista'].includes(role));
        setRoleReady(true);
      })
      .catch(() => {
        setCanManage(false);
        setRoleReady(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!roleReady) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleReady, canManage, caseIdFilter]);

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

  const filteredStages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return billableStages;
    return billableStages.filter((stage) => {
      const haystack = [
        stage.case?.caratulado ?? '',
        stage.case?.numero_causa ?? '',
        stage.etapa ?? '',
        String(stage.orden ?? ''),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [billableStages, search]);

  const groupedStages = useMemo(() => {
    const buckets = new Map<string, { caseId: string; title: string; numero: string | null; stages: BillableStageSummary[] }>();
    for (const stage of filteredStages) {
      const caseId = stage.case_id;
      if (!buckets.has(caseId)) {
        buckets.set(caseId, {
          caseId,
          title: stage.case?.caratulado ?? 'Caso',
          numero: stage.case?.numero_causa ?? null,
          stages: [],
        });
      }
      buckets.get(caseId)!.stages.push(stage);
    }
    return Array.from(buckets.values());
  }, [filteredStages]);

  const handleEditStageLink = async (stage: BillableStageSummary) => {
    if (!canManage) return;
    const current = stage.enlace_pago ?? '';
    const input = prompt('Ingresa el enlace de pago (Payku) para esta etapa', current);
    if (input === null) return;
    const trimmed = input.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast({ title: 'URL inválida', description: 'Debe comenzar con http:// o https://', variant: 'destructive' });
      return;
    }

    try {
      setIsUpdatingStage(stage.id);
      const res = await updateStage(stage.id, {
        enlace_pago: trimmed || undefined,
        requiere_pago: true,
      });
      if (!res.success) throw new Error(res.error ?? 'No se pudo guardar el enlace.');
      toast({ title: 'Enlace actualizado', description: trimmed ? 'Se guardó el enlace de pago.' : 'Se eliminó el enlace.' });
      await load();
    } catch (error) {
      toast({ title: 'No se pudo actualizar', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsUpdatingStage(null);
    }
  };

  const handleEditStageCost = async (stage: BillableStageSummary) => {
    if (!canManage) return;
    const current = stage.costo_uf ?? 0;
    const input = prompt('Costo en UF para esta etapa', String(current));
    if (input === null) return;
    const parsed = Number(input.trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast({ title: 'Monto inválido', description: 'Ingresa un número válido (>= 0).', variant: 'destructive' });
      return;
    }

    try {
      setIsUpdatingStage(stage.id);
      const res = await updateStage(stage.id, { costo_uf: parsed, requiere_pago: true });
      if (!res.success) throw new Error(res.error ?? 'No se pudo actualizar el costo.');
      toast({ title: 'Costo actualizado', description: `Nuevo costo: ${formatUf(parsed)}.` });
      await load();
    } catch (error) {
      toast({ title: 'No se pudo actualizar', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsUpdatingStage(null);
    }
  };

  const handleRegisterPayment = async (stage: BillableStageSummary) => {
    if (!canManage) return;
    const inspiration = stage.monto_pagado_uf ?? stage.costo_uf ?? 0;
    const input = prompt('Monto pagado (UF)', String(inspiration));
    if (input === null) return;
    const parsed = Number(input.trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast({ title: 'Monto inválido', description: 'Ingresa un número válido (>= 0).', variant: 'destructive' });
      return;
    }
    const expected = stage.costo_uf ?? 0;
    const estado_pago = expected > 0 && parsed >= expected ? 'pagado' : 'parcial';

    try {
      setIsUpdatingStage(stage.id);
      const res = await updateStage(stage.id, { monto_pagado_uf: parsed, estado_pago, requiere_pago: true });
      if (!res.success) throw new Error(res.error ?? 'No se pudo registrar el pago.');
      toast({ title: 'Pago registrado', description: estado_pago === 'pagado' ? 'Etapa marcada como pagada.' : 'Etapa marcada como parcial.' });
      await load();
    } catch (error) {
      toast({ title: 'No se pudo registrar', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsUpdatingStage(null);
    }
  };

  const handleMarkPaid = async (stage: BillableStageSummary) => {
    if (!canManage) return;
    try {
      setIsUpdatingStage(stage.id);
      const res = await updateStage(stage.id, {
        estado_pago: 'pagado',
        monto_pagado_uf: stage.costo_uf ?? stage.monto_pagado_uf ?? 0,
        requiere_pago: true,
      });
      if (!res.success) throw new Error(res.error ?? 'No se pudo marcar como pagado.');
      toast({ title: 'Etapa pagada', description: 'Se marcó la etapa como pagada.' });
      await load();
    } catch (error) {
      toast({ title: 'No se pudo actualizar', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsUpdatingStage(null);
    }
  };

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

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Etapas por cobrar</CardTitle>
            <p className="text-sm text-slate-500">
              {caseIdFilter ? 'Mostrando etapas pendientes del caso seleccionado.' : 'Pendientes de pago por etapa, agrupadas por causa.'}
            </p>
          </div>
          <div className="w-full sm:w-80">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por caso o etapa…" />
          </div>
        </CardHeader>
        <CardContent>
          {isStagesLoading ? (
            <div className="h-32 rounded-xl bg-slate-100/60" />
          ) : groupedStages.length === 0 ? (
            <p className="text-sm text-slate-500">No hay etapas por cobrar para mostrar.</p>
          ) : (
            <div className="grid gap-3">
              {groupedStages.map((group) => (
                <div key={group.caseId} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">
                        {(group.numero ? `[${group.numero}] ` : '') + group.title}
                      </p>
                      <p className="text-xs text-slate-500">{group.stages.length} etapa(s) pendiente(s)</p>
                    </div>
                    <Link className="text-sm text-sky-700 hover:underline" href={`/cases/${group.caseId}`}>
                      Ver causa
                    </Link>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {group.stages.map((stage) => {
                      const badge = STAGE_PAYMENT_BADGE[stage.estado_pago ?? 'pendiente'] ?? DEFAULT_STAGE_BADGE;
                      const busy = isUpdatingStage === stage.id;
                      return (
                        <div key={stage.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-slate-900">
                                {(stage.orden ? `Etapa ${stage.orden} · ` : '') + stage.etapa}
                              </p>
                              <Badge className={badge.className}>{badge.label}</Badge>
                              {stage.fecha_programada && <span className="text-xs text-slate-500">Fecha: {formatDate(stage.fecha_programada)}</span>}
                            </div>
                            <p className="text-xs text-slate-500">
                              Costo: {formatUf(stage.costo_uf)}{stage.monto_pagado_uf ? ` · Pagado: ${formatUf(stage.monto_pagado_uf)}` : ''}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {stage.enlace_pago && (
                              <a
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-sky-200 hover:text-sky-700"
                                href={stage.enlace_pago}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Abrir enlace
                              </a>
                            )}
                            {canManage && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleEditStageCost(stage)} disabled={busy}>
                                  {busy ? '...' : 'Editar costo'}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleEditStageLink(stage)} disabled={busy}>
                                  {busy ? '...' : stage.enlace_pago ? 'Editar enlace' : 'Asignar enlace'}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleRegisterPayment(stage)} disabled={busy}>
                                  {busy ? '...' : 'Registrar pago'}
                                </Button>
                                <Button size="sm" onClick={() => handleMarkPaid(stage)} disabled={busy}>
                                  {busy ? '...' : 'Marcar pagado'}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
