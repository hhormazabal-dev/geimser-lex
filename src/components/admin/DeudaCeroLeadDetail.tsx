'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { updateLeadCaseData, updateLeadStatus, convertLeadToCase } from '@/lib/actions/leads';
import { LEAD_STATUS_OPTIONS, getLeadStatusLabel, getLeadStatusTone, normalizeLeadStatus } from '@/lib/leads/status';
import type { LeadRecord } from '@/lib/leads/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatDateShort, formatRelativeTime } from '@/lib/utils';
import { ArrowUpRight, CheckCircle2, Loader2 } from 'lucide-react';

const PRIORITY_OPTIONS = [
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

function toDateInput(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

type LawyerOption = {
  id: string;
  nombre: string | null;
  email?: string | null;
};

export function DeudaCeroLeadDetail({ lead, lawyers }: { lead: LeadRecord; lawyers: LawyerOption[] }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [currentLead, setCurrentLead] = useState(lead);
  const [status, setStatus] = useState(normalizeLeadStatus(lead.status) ?? 'new');
  const [followUpDate, setFollowUpDate] = useState(toDateInput(lead.next_follow_up_at));
  const [contactNotes, setContactNotes] = useState(lead.contact_notes ?? '');
  const [caseCaratulado, setCaseCaratulado] = useState(lead.case_caratulado ?? '');
  const [caseMateria, setCaseMateria] = useState(lead.case_materia ?? '');
  const [caseDescripcion, setCaseDescripcion] = useState(lead.case_descripcion ?? '');
  const [casePrioridad, setCasePrioridad] = useState(lead.case_prioridad ?? 'media');
  const [caseContraparte, setCaseContraparte] = useState(lead.case_contraparte ?? '');
  const [lawyerId, setLawyerId] = useState('');

  const isReadyToConvert = useMemo(() => {
    return Boolean(
      caseCaratulado.trim() &&
        caseMateria.trim() &&
        caseDescripcion.trim().length >= 20 &&
        !currentLead.case_id,
    );
  }, [caseCaratulado, caseMateria, caseDescripcion, currentLead.case_id]);

  const handleStatusSave = () => {
    startTransition(async () => {
      const result = await updateLeadStatus({
        id: currentLead.id,
        status,
        contactNotes,
        nextFollowUpAt: followUpDate || null,
      });

      if (!result.success || !result.lead) {
        toast({
          title: 'No se pudo actualizar',
          description: result.error ?? 'Intenta nuevamente en unos minutos.',
          variant: 'destructive',
        });
        return;
      }

      setCurrentLead(result.lead);
      setStatus(normalizeLeadStatus(result.lead.status) ?? 'new');
      setFollowUpDate(toDateInput(result.lead.next_follow_up_at));
      setContactNotes(result.lead.contact_notes ?? '');
      toast({ title: 'Estado actualizado' });
    });
  };

  const handleCaseSave = () => {
    startTransition(async () => {
      const result = await updateLeadCaseData({
        id: currentLead.id,
        caseCaratulado,
        caseMateria,
        caseDescripcion,
        casePrioridad,
        caseContraparte,
      });

      if (!result.success || !result.lead) {
        toast({
          title: 'No se pudieron guardar los datos del caso',
          description: result.error ?? 'Intenta nuevamente en unos minutos.',
          variant: 'destructive',
        });
        return;
      }

      setCurrentLead(result.lead);
      setCaseCaratulado(result.lead.case_caratulado ?? '');
      setCaseMateria(result.lead.case_materia ?? '');
      setCaseDescripcion(result.lead.case_descripcion ?? '');
      setCasePrioridad(result.lead.case_prioridad ?? 'media');
      setCaseContraparte(result.lead.case_contraparte ?? '');
      toast({ title: 'Datos del caso actualizados' });
    });
  };

  const handleConvert = () => {
    startTransition(async () => {
      const result = await convertLeadToCase({ id: currentLead.id, abogadoResponsableId: lawyerId });
      if (!result.success) {
        toast({
          title: 'No se pudo crear el caso',
          description: result.error ?? 'Revisa los datos y reintenta.',
          variant: 'destructive',
        });
        return;
      }

      if (result.lead) setCurrentLead(result.lead);
      if (result.lead) setStatus(normalizeLeadStatus(result.lead.status) ?? 'new');
      toast({ title: 'Caso creado', description: 'El expediente ya aparece en la bandeja de Xel.' });
    });
  };

  const statusBadge = (
    <Badge className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getLeadStatusTone(currentLead.status)}`}>
      {getLeadStatusLabel(currentLead.status)}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-semibold text-slate-900">{currentLead.full_name}</p>
              {statusBadge}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>{currentLead.email}</span>
              {currentLead.phone && <span>· {currentLead.phone}</span>}
              {currentLead.rut && <span>· {currentLead.rut}</span>}
              {currentLead.lead_type && <span>· {currentLead.lead_type}</span>}
            </div>
            <div className="text-xs text-slate-400">
              Recibido {currentLead.created_at ? formatRelativeTime(currentLead.created_at) : 'recientemente'}
              {currentLead.last_contact_at && ` · Ultimo contacto ${formatDate(currentLead.last_contact_at)}`}
            </div>
            {currentLead.message && (
              <p className="text-sm text-slate-600">{currentLead.message}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentLead.case_id && (
              <Button asChild variant="outline">
                <Link href={`/cases/${currentLead.case_id}`} className="inline-flex items-center gap-2">
                  Ver caso
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/dashboard/admin/leads" className="inline-flex items-center gap-2">
                Volver
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Estado y seguimiento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Estado
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    {LEAD_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Proximo seguimiento
                  <Input
                    type="date"
                    value={followUpDate}
                    onChange={(event) => setFollowUpDate(event.target.value)}
                    className="rounded-2xl border-slate-200"
                  />
                </label>
              </div>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Notas de contacto
                <Textarea
                  value={contactNotes}
                  onChange={(event) => setContactNotes(event.target.value)}
                  placeholder="Ej. Cliente respondio, esta revisando documentos..."
                  className="min-h-[120px]"
                />
              </label>

              <Button onClick={handleStatusSave} disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar estado'}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Preparar caso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Caratulado
                <Input
                  value={caseCaratulado}
                  onChange={(event) => setCaseCaratulado(event.target.value)}
                  placeholder="Ej. Nombre cliente c/ Empleador"
                  className="rounded-2xl border-slate-200"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Materia
                  <Input
                    value={caseMateria}
                    onChange={(event) => setCaseMateria(event.target.value)}
                    placeholder="Ej. Laboral"
                    className="rounded-2xl border-slate-200"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Prioridad
                  <select
                    value={casePrioridad}
                    onChange={(event) => setCasePrioridad(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Contraparte (opcional)
                <Input
                  value={caseContraparte}
                  onChange={(event) => setCaseContraparte(event.target.value)}
                  placeholder="Ej. Empresa o persona demandada"
                  className="rounded-2xl border-slate-200"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Descripcion inicial
                <Textarea
                  value={caseDescripcion}
                  onChange={(event) => setCaseDescripcion(event.target.value)}
                  placeholder="Describe el contexto del caso (minimo 20 caracteres)."
                  className="min-h-[140px]"
                />
              </label>

              <Button onClick={handleCaseSave} disabled={isPending} variant="outline" className="w-full">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar datos del caso'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Crear caso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentLead.case_id ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> Caso creado
                  </div>
                  <p className="mt-2">El lead ya esta convertido en caso.</p>
                </div>
              ) : (
                <>
                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    Abogado responsable
                    <select
                      value={lawyerId}
                      onChange={(event) => setLawyerId(event.target.value)}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    >
                      <option value="">Selecciona abogado</option>
                      {lawyers.map((lawyer) => (
                        <option key={lawyer.id} value={lawyer.id}>
                          {lawyer.nombre ?? lawyer.email ?? lawyer.id}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <p className="font-semibold">Checklist</p>
                    <ul className="mt-2 space-y-1 text-xs">
                      <li>{caseCaratulado.trim() ? '✓' : '•'} Caratulado completo</li>
                      <li>{caseMateria.trim() ? '✓' : '•'} Materia definida</li>
                      <li>{caseDescripcion.trim().length >= 20 ? '✓' : '•'} Descripcion inicial (20+)</li>
                    </ul>
                    {followUpDate && (
                      <p className="mt-2 text-xs text-slate-500">Proximo seguimiento: {formatDateShort(followUpDate)}</p>
                    )}
                  </div>

                  <Button
                    onClick={handleConvert}
                    disabled={isPending || !isReadyToConvert || !lawyerId}
                    className="w-full"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear caso en Xel'}
                  </Button>

                  {!isReadyToConvert && (
                    <p className="text-xs text-slate-500">
                      Completa los campos obligatorios antes de crear el caso.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Payload recibido</CardTitle>
            </CardHeader>
            <CardContent>
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer font-semibold text-slate-600">Ver datos originales</summary>
                <pre className="mt-3 max-h-64 overflow-auto rounded-2xl bg-slate-50 p-3 text-[11px]">
                  {JSON.stringify(currentLead.raw_payload ?? {}, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Resumen rapido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Estado</span>
                {statusBadge}
              </div>
              <div className="flex items-center justify-between">
                <span>Ultimo contacto</span>
                <span>{currentLead.last_contact_at ? formatDate(currentLead.last_contact_at) : 'Sin registro'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Seguimiento</span>
                <span>{currentLead.next_follow_up_at ? formatDate(currentLead.next_follow_up_at) : 'No agendado'}</span>
              </div>
              {currentLead.case_id && (
                <Button asChild variant="outline" className="w-full justify-between">
                  <Link href={`/cases/${currentLead.case_id}`}>
                    Abrir caso
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {isPending && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Guardando cambios...
        </div>
      )}
    </div>
  );
}
