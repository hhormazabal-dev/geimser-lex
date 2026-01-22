export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';
import { listDeudaCeroLeads } from '@/lib/actions/leads';
import { getLeadStatusLabel, getLeadStatusTone, normalizeLeadStatus } from '@/lib/leads/status';
import { isDeudaCeroOrgName } from '@/lib/leads/org';
import { detectLeadOrigin, getLeadOriginLabel } from '@/lib/leads/origin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatDate, formatDateShort, formatDateTime, formatRelativeTime } from '@/lib/utils';
import type { LeadRecord } from '@/lib/leads/types';
import { ArrowUpRight, ClipboardList, UserPlus } from 'lucide-react';

function buildNotification(lead: LeadRecord) {
  const status = normalizeLeadStatus(lead.status);
  const followUp = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null;
  const followUpLabel = followUp ? formatDateShort(lead.next_follow_up_at) : null;

  if (lead.case_id || status === 'convertido') return 'Caso creado';
  if (status === 'listo') return 'Listo para crear caso';
  if (status === 'seguimiento') {
    if (followUp && followUp <= new Date()) {
      return followUpLabel ? `Seguimiento atrasado (${followUpLabel})` : 'Seguimiento atrasado';
    }
    return followUpLabel ? `Seguimiento agendado (${followUpLabel})` : 'Seguimiento pendiente';
  }
  if (status === 'esperando_datos') return 'Esperando datos del cliente';
  if (status === 'no_responde') return 'Cliente no responde';
  if (status === 'error') return 'Ingreso por error';
  if (status === 'contactado') return 'Contacto realizado';
  return 'Sin contacto registrado';
}

function countByStatus(leads: LeadRecord[], status: string) {
  return leads.filter((lead) => normalizeLeadStatus(lead.status) === status).length;
}

function resolveOriginLabel(lead: LeadRecord) {
  const direct = getLeadOriginLabel(lead.origin);
  if (direct !== 'Desconocido') return direct;
  if (lead.raw_payload && typeof lead.raw_payload === 'object' && !Array.isArray(lead.raw_payload)) {
    return getLeadOriginLabel(detectLeadOrigin(lead.raw_payload as Record<string, unknown>));
  }
  return direct;
}

export default async function DeudaCeroLeadsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login?redirectTo=/dashboard/admin/leads');
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

  const result = await listDeudaCeroLeads();
  const leads = result.success ? result.data ?? [] : [];

  const summary = {
    sinContacto: countByStatus(leads, 'new'),
    seguimiento: countByStatus(leads, 'seguimiento'),
    esperandoDatos: countByStatus(leads, 'esperando_datos'),
    listos: countByStatus(leads, 'listo'),
    convertidos: leads.filter((lead) => lead.case_id).length,
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Deuda Cero"
          title="Leads y seguimiento"
          description="Centraliza el intake, registra contacto y prepara casos listos para el pipeline de Xel."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline">
                <Link href="/dashboard/admin/leads/control" className="inline-flex items-center gap-2">
                  Panel de control
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/cases" className="inline-flex items-center gap-2">
                  Ver casos
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          }
        />

        {!result.success && (
          <Card className="rounded-3xl border border-red-200 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-red-700">No se pudieron cargar los leads</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-600/80">{result.error ?? 'Intenta nuevamente en unos minutos.'}</p>
            </CardContent>
          </Card>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Sin contacto', value: summary.sinContacto, icon: UserPlus },
            { label: 'Seguimiento', value: summary.seguimiento, icon: ClipboardList },
            { label: 'Esperando datos', value: summary.esperandoDatos, icon: ClipboardList },
            { label: 'Listos', value: summary.listos, icon: ClipboardList },
            { label: 'Casos creados', value: summary.convertidos, icon: ClipboardList },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 text-slate-500">
                    <Icon className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="space-y-4">
          {leads.length === 0 && (
            <Card className="rounded-3xl border border-dashed border-slate-200 bg-white/80">
              <CardContent className="p-8 text-center text-sm text-slate-500">
                Aun no hay leads registrados desde Deuda Cero.
              </CardContent>
            </Card>
          )}

          {leads.map((lead) => (
            <Card key={lead.id} className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-900">{lead.full_name}</p>
                    <Badge className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getLeadStatusTone(lead.status)}`}>
                      {getLeadStatusLabel(lead.status)}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span>{lead.email}</span>
                    {lead.phone && <span>· {lead.phone}</span>}
                    {lead.lead_type && <span>· {lead.lead_type}</span>}
                    <span>· Origen: {resolveOriginLabel(lead)}</span>
                    <span>· {lead.assigned_lawyer_id ? 'Asignado a abogado' : 'Sin asignacion'}</span>
                  </div>

                  <div className="text-xs text-slate-400">
                    Recibido {lead.created_at ? formatRelativeTime(lead.created_at) : 'recientemente'}
                    {lead.created_at && ` · Enviado ${formatDateTime(lead.created_at)}`}
                    {lead.last_contact_at && ` · Ultimo contacto ${formatDate(lead.last_contact_at)}`}
                  </div>

                  {lead.message && (
                    <p className="line-clamp-2 text-sm text-slate-600">{lead.message}</p>
                  )}

                  <div className="text-sm text-slate-700">
                    <span className="font-semibold">Notificacion:</span> {buildNotification(lead)}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {lead.case_id && (
                    <Button asChild variant="outline">
                      <Link href={`/cases/${lead.case_id}`} className="inline-flex items-center gap-2">
                        Ver caso
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  <Button asChild>
                    <Link href={`/dashboard/admin/leads/${lead.id}`} className="inline-flex items-center gap-2">
                      Gestionar
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
