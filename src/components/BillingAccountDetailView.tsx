'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { addBillingPayment, type BillingAccountDetail } from '@/lib/actions/billing';
import { formatCurrency, formatDateTime } from '@/lib/utils';

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

type PaymentDraft = {
  amount: string;
  paid_at: string;
  method: string;
  notes: string;
};

const EMPTY_PAYMENT: PaymentDraft = { amount: '', paid_at: '', method: '', notes: '' };

export function BillingAccountDetailView({ account }: { account: BillingAccountDetail }) {
  const router = useRouter();
  const { toast } = useToast();
  const [draft, setDraft] = useState<PaymentDraft>(EMPTY_PAYMENT);
  const [isSubmitting, startTransition] = useTransition();

  const pendingAmount = useMemo(
    () => Math.max((account.amount_total ?? 0) - (account.amount_paid ?? 0), 0),
    [account.amount_total, account.amount_paid],
  );

  const badge = STATUS_BADGE[account.status] ?? {
    label: account.status,
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
  };

  const handleAddPayment = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Monto inválido', description: 'Ingresa un monto mayor a 0.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      const paidAt =
        draft.paid_at && draft.paid_at.trim().length > 0
          ? new Date(`${draft.paid_at}T12:00:00.000Z`).toISOString()
          : undefined;

      const result = await addBillingPayment({
        billing_account_id: account.id,
        amount,
        ...(paidAt ? { paid_at: paidAt } : {}),
        ...(draft.method.trim() ? { method: draft.method.trim() } : {}),
        ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
      });

      if (result.success) {
        toast({ title: 'Pago registrado', description: 'Se actualizó el estado del cobro automáticamente.' });
        setDraft(EMPTY_PAYMENT);
        router.refresh();
      } else {
        toast({ title: 'No se pudo registrar', description: result.error, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Resumen</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={badge.className}>{badge.label}</Badge>
              {account.due_date && <span className="text-xs text-slate-500">Vence: {account.due_date}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">
              {formatAmount(account.currency, account.amount_paid)} / {formatAmount(account.currency, account.amount_total)}
            </p>
            <p className="text-xs text-slate-500">Pendiente: {formatAmount(account.currency, pendingAmount)}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {account.description && <p className="text-sm text-slate-600 whitespace-pre-wrap">{account.description}</p>}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Casos vinculados</p>
            {account.cases.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sin casos vinculados.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {account.cases.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <Link href={`/cases/${c.id}`} className="font-medium text-slate-900 hover:underline">
                      {(c.numero_causa ? `[${c.numero_causa}] ` : '') + c.caratulado}
                    </Link>
                    {typeof c.case_amount === 'number' && (
                      <span className="text-xs text-slate-500">Asociado: {formatAmount(account.currency, c.case_amount)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Registrar pago</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleAddPayment}>
            <div className="space-y-2">
              <Label htmlFor="payment_amount">Monto *</Label>
              <Input
                id="payment_amount"
                type="number"
                min="0"
                step="0.01"
                value={draft.amount}
                onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))}
                disabled={isSubmitting}
              />
              <p className="text-xs text-slate-500">Moneda: {account.currency}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_date">Fecha</Label>
              <Input
                id="payment_date"
                type="date"
                value={draft.paid_at}
                onChange={(e) => setDraft((prev) => ({ ...prev, paid_at: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">Método</Label>
              <Input
                id="payment_method"
                value={draft.method}
                onChange={(e) => setDraft((prev) => ({ ...prev, method: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="payment_notes">Notas</Label>
              <Textarea
                id="payment_notes"
                rows={3}
                value={draft.notes}
                onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando…' : 'Registrar pago'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {account.payments.length === 0 ? (
            <p className="text-sm text-slate-500">No hay pagos registrados.</p>
          ) : (
            <div className="space-y-3">
              {account.payments.map((p) => (
                <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-slate-900">{formatAmount(account.currency, p.amount)}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(p.paid_at)}</p>
                  </div>
                  {(p.method || p.notes) && (
                    <p className="mt-2 text-sm text-slate-600">
                      {p.method ? `Método: ${p.method}` : null}
                      {p.method && p.notes ? ' · ' : null}
                      {p.notes ? p.notes : null}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

