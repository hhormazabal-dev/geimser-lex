export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';
import { getLeadControlPanelData } from '@/lib/actions/leads';
import { isDeudaCeroOrgName } from '@/lib/leads/org';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDateShort, formatDateTime } from '@/lib/utils';
import { ArrowUpRight } from 'lucide-react';

function SummaryCard({
  title,
  data,
}: {
  title: string;
  data: { total: number; bot: number; form: number; unknown: number; assigned: number; converted: number; typed: number };
}) {
  return (
    <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        <div className="flex items-center justify-between">
          <span>Total</span>
          <span className="font-semibold text-slate-900">{data.total}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Bot</span>
          <span>{data.bot}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Formulario</span>
          <span>{data.form}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Desconocido</span>
          <span>{data.unknown}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Asignados</span>
          <span>{data.assigned}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Tipificados</span>
          <span>{data.typed}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Convertidos a caso</span>
          <span>{data.converted}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function LeadsControlPanelPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login?redirectTo=/dashboard/admin/leads/control');
  if (profile.role !== 'admin_firma') redirect('/dashboard/admin');

  const orgId = (profile as any)?.active_organization_id ?? null;
  if (!orgId) redirect('/select-org');

  const supabase = (await createServerClient()) as any;
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .maybeSingle();

  if (!orgRow || !isDeudaCeroOrgName(orgRow.name)) {
    redirect('/dashboard/admin');
  }

  const result = await getLeadControlPanelData();
  const summary = result.success ? result.summary : null;
  const daily = result.success ? result.daily : [];
  const recentActions = result.success ? result.recentActions : [];

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Deuda Cero"
          title="Panel de control de leads"
          description="Resumen diario, semanal y mensual con desglose por origen, asignaciones y conversiones."
          actions={
            <Button asChild variant="outline">
              <Link href="/dashboard/admin/leads" className="inline-flex items-center gap-2">
                Volver a leads
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />

        {!result.success && (
          <Card className="rounded-3xl border border-red-200 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-red-700">No se pudo cargar el panel</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-600/80">{result.error ?? 'Intenta nuevamente en unos minutos.'}</p>
            </CardContent>
          </Card>
        )}

        {summary && (
          <section className="grid gap-4 lg:grid-cols-3">
            <SummaryCard title="Hoy" data={summary.today} />
            <SummaryCard title="Ultimos 7 dias" data={summary.week} />
            <SummaryCard title="Ultimos 30 dias" data={summary.month} />
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Resumen diario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {daily.length === 0 && <p className="text-sm text-slate-500">Sin datos recientes.</p>}
              {daily.slice(-14).map((row) => (
                <div key={row.date} className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                    <span>{formatDateShort(row.date)}</span>
                    <span>{row.total} lead(s)</span>
                  </div>
                  <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                    <span>Bot: {row.bot}</span>
                    <span>Formulario: {row.form}</span>
                    <span>Desconocido: {row.unknown}</span>
                  </div>
                  <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                    <span>Asignados: {row.assigned}</span>
                    <span>Tipificados: {row.typed}</span>
                    <span>Convertidos: {row.converted}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Ultimas acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {recentActions.length === 0 && <p className="text-sm text-slate-500">Sin acciones registradas.</p>}
              {recentActions.map((log: any) => (
                <div key={log.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-800">{String(log.action ?? 'Accion')}</p>
                  <p className="text-xs text-slate-500">
                    {(log.actor?.nombre ?? 'Usuario')} · {log.created_at ? formatDateTime(log.created_at) : 'Fecha desconocida'}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
