'use client';

import { useState, useMemo, useEffect, useTransition, useCallback, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NotesPanel } from '@/components/NotesPanel';
import { DocumentsPanel } from '@/components/DocumentsPanel';
import { TimelinePanel } from '@/components/TimelinePanel';
import { InfoRequestsPanel } from '@/components/InfoRequestsPanel';
import { CaseMessagesPanel } from '@/components/CaseMessagesPanel';
import { DailyStatementsPanel } from '@/components/DailyStatementsPanel';
import { ComplianceMonitoringPanel } from '@/components/ComplianceMonitoringPanel';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatDate, formatCurrency, getInitials, stringToColor } from '@/lib/utils';
import { CASE_SENTENCE_STATUSES } from '@/lib/validators/case';
import { useToast } from '@/hooks/use-toast';
import { authorizeCaseAdvance, assignLawyer, listAvailableLawyers } from '@/lib/actions/cases';
import { createCaseCounterparty, deleteCaseCounterparty } from '@/lib/actions/counterparties';
import {
  listCaseEvents,
  createManualCaseEvent,
  type CaseEventRow,
} from '@/lib/actions/pjud-link';
import {
  ArrowLeft,
  Scale,
  FolderOpen,
  FileText,
  Clock,
  MessageCircle,
  ClipboardList,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  DollarSign,
  Edit,
  Users,
  Wallet,
  Loader2,
  Trash2,
  ListChecks,
  ShieldCheck,
} from 'lucide-react';
import type { Profile, Case, CaseStage, CaseCounterparty } from '@/lib/supabase/types';
import type { CaseMessageDTO } from '@/lib/actions/messages';
import { LawyerChecklistPanel } from '@/components/LawyerChecklistPanel';

const SENTENCE_STATUS_LABELS: Record<string, string> = CASE_SENTENCE_STATUSES.reduce(
  (acc, item) => {
    acc[item.value] = item.label;
    return acc;
  },
  {} as Record<string, string>,
);

function getSentenceStatusLabel(status?: string | null): string {
  if (!status || status === 'no_registra') return 'Sin sentencia registrada';
  return SENTENCE_STATUS_LABELS[status] ?? 'Sin sentencia registrada';
}

const CASE_META_REGEX = /<!--case-form-meta:[\s\S]*?-->/g;

function cleanObservaciones(value?: string | null): string {
  if (!value) return '';
  return value.replace(CASE_META_REGEX, '').trim();
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(startIso?: string | null, endIso?: string | null): number | null {
  const start = parseDateOnly(startIso);
  const end = parseDateOnly(endIso);
  if (!start || !end) return null;
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(Math.round((end.getTime() - start.getTime()) / msPerDay), 0);
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parsePartyLines(raw?: string | null): Array<{ nombre: string; rut?: string | null }> {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)(?:\s*\(RUT[:\s]+(.+?)\))?\s*$/i);
      const nombre = normalizeSpace((match?.[1] ?? line).trim());
      const rut = normalizeSpace((match?.[2] ?? '').trim());
      return { nombre, ...(rut ? { rut } : {}) };
    })
    .filter((row) => row.nombre.length > 0);
}

interface CaseDetailViewProps {
  case: Omit<Case, 'abogado_responsable'> & {
    fecha_termino?: string | null;
    abogado_responsable?: {
      id: string;
      nombre: string;
      telefono?: string;
      email?: string;
    };
    clients?: Array<{
      id: string;
      nombre: string;
      email: string;
      telefono?: string;
      rut?: string | null;
      is_primary?: boolean;
    }>;
    case_stages?: CaseStage[];
    counterparties?: CaseCounterparty[];
  };
  profile: Profile;
  messages: CaseMessageDTO[];
}

export function CaseDetailView({ case: caseData, profile, messages }: CaseDetailViewProps) {
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'timeline'
    | 'documents'
    | 'activity'
    | 'monitoring'
    | 'daily'
    | 'notes'
    | 'messages'
    | 'requests'
    | 'checklist'
    | 'clients'
  >('overview');
  const router = useRouter();
  const { toast } = useToast();
  const [stageCatalog, setStageCatalog] = useState<CaseStage[]>(caseData.case_stages ?? []);
  const [clientAdvance, setClientAdvance] = useState({
    solicitado: caseData.alcance_cliente_solicitado ?? 0,
    autorizado: caseData.alcance_cliente_autorizado ?? 0,
  });
  const [counterparties, setCounterparties] = useState<CaseCounterparty[]>(caseData.counterparties ?? []);
  const [counterpartyForm, setCounterpartyForm] = useState({
    nombre: '',
    rut: '',
    tipo: 'demandado' as 'demandado' | 'demandante' | 'tercero',
  });
  const [isSubmittingCounterparty, startTransitionCounterparty] = useTransition();
  const [pendingDeleteCounterparty, setPendingDeleteCounterparty] = useState<string | null>(null);
  const [currentLawyer, setCurrentLawyer] = useState<{
    id: string;
    nombre: string;
    telefono?: string | null;
    email?: string | null;
  } | null>(
    caseData.abogado_responsable
      ? {
          id: caseData.abogado_responsable.id,
          nombre: caseData.abogado_responsable.nombre,
          telefono: caseData.abogado_responsable.telefono ?? null,
          email: caseData.abogado_responsable.email ?? null,
        }
      : null,
  );
  const [availableLawyers, setAvailableLawyers] = useState<
    Array<{ id: string; nombre: string; email: string | null; telefono: string | null }>
  >(
    caseData.abogado_responsable
      ? [
          {
            id: caseData.abogado_responsable.id,
            nombre: caseData.abogado_responsable.nombre,
            email: caseData.abogado_responsable.email ?? null,
            telefono: caseData.abogado_responsable.telefono ?? null,
          },
        ]
      : [],
  );

  const [caseEvents, setCaseEvents] = useState<CaseEventRow[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [eventDraft, setEventDraft] = useState<{ kind: 'movement' | 'resolution' | 'deadline' | 'note'; title: string }>(
    { kind: 'movement', title: '' },
  );

  useEffect(() => {
    let canceled = false;
    setIsLoadingEvents(true);
    Promise.all([listCaseEvents(caseData.id, 50)])
      .then(([eventsRes]) => {
        if (canceled) return;
        if (eventsRes.success) {
          setCaseEvents(eventsRes.events ?? []);
        }
      })
      .catch((error) => {
        console.error('[CaseDetailView] load integration data error', error);
      })
      .finally(() => {
        if (canceled) return;
        setIsLoadingEvents(false);
      });

    return () => {
      canceled = true;
    };
  }, [caseData.id]);

  const handleCreateEvent = async () => {
    const title = eventDraft.title.trim();
    if (!title) return;
    setIsCreatingEvent(true);
    try {
      const result = await createManualCaseEvent({
        caseId: caseData.id,
        kind: eventDraft.kind,
        title,
      });
      if (result.success && result.event) {
        setCaseEvents((prev) => [result.event!, ...prev]);
        setEventDraft((prev) => ({ ...prev, title: '' }));
        toast({ title: 'Evento registrado', description: 'Se añadió a la bitácora del expediente.' });
      } else {
        toast({ title: 'No se pudo registrar', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      console.error('[CaseDetailView] handleCreateEvent error', error);
      toast({ title: 'Error inesperado', description: 'No se pudo registrar el evento.', variant: 'destructive' });
    } finally {
      setIsCreatingEvent(false);
    }
  };
  const [selectedLawyerId, setSelectedLawyerId] = useState<string>(caseData.abogado_responsable?.id ?? '');
  const [isLoadingLawyers, setIsLoadingLawyers] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const observacionesClean = useMemo(
    () => cleanObservaciones(caseData.observaciones),
    [caseData.observaciones],
  );
  const stageNamesByOrder = useMemo(() => {
    const map = new Map<number, string>();
    stageCatalog.forEach((stage) => {
      const order = stage.orden ?? 0;
      if (order > 0 && !map.has(order)) {
        map.set(order, stage.etapa);
      }
    });
    return map;
  }, [stageCatalog]);
  const stageInsights = useMemo(() => {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const todayIso = new Date().toISOString().split('T')[0]!;
    const sorted = [...stageCatalog].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const currentStage = sorted.find((stage) => stage.estado !== 'completado') ?? null;

    const stagesWithDate = <T extends CaseStage>(
      items: T[],
      selector: (item: T) => string | null,
    ) =>
      items
        .map((item) => ({ item, time: parseDateOnly(selector(item))?.getTime() ?? null }))
        .filter((row): row is { item: T; time: number } => typeof row.time === 'number')
        .sort((a, b) => a.time - b.time);

    const nextScheduled = (() => {
      const upcoming = stagesWithDate(
        sorted.filter((s) => s.estado !== 'completado' && Boolean(s.fecha_programada)),
        (s) => s.fecha_programada ?? null,
      );
      return upcoming[0]?.item ?? null;
    })();

    const lastCompleted = (() => {
      const completed = stagesWithDate(
        sorted.filter((s) => s.estado === 'completado' && Boolean(s.fecha_cumplida)),
        (s) => s.fecha_cumplida ?? null,
      );
      return completed.length > 0 ? completed[completed.length - 1]!.item : null;
    })();

    const notificationFromStages = (() => {
      const candidates = sorted.filter((stage) => normalize(stage.etapa ?? '').includes('notific'));
      const completed = stagesWithDate(candidates.filter((s) => Boolean(s.fecha_cumplida)), (s) => s.fecha_cumplida ?? null);
      if (completed.length > 0) return completed[completed.length - 1]!.item.fecha_cumplida ?? null;
      const scheduled = stagesWithDate(candidates.filter((s) => Boolean(s.fecha_programada)), (s) => s.fecha_programada ?? null);
      return scheduled.length > 0 ? scheduled[0]!.item.fecha_programada ?? null : null;
    })();

    const audienceStages = sorted.filter((stage) => {
      if (stage.audiencia_tipo) return true;
      const name = normalize(stage.etapa ?? '');
      if (name.includes('audiencia')) return true;
      if (name.includes('preparator') || name.includes('preliminar')) return true;
      if (name.includes('juicio')) return true;
      if (name.includes('alegatos') && name.includes('vista')) return true;
      return false;
    });
    const nextAudience = (() => {
      const candidates = stagesWithDate(
        audienceStages.filter((s) => s.estado !== 'completado' && Boolean(s.fecha_programada)),
        (s) => s.fecha_programada ?? null,
      );
      return candidates[0]?.item ?? null;
    })();
    const lastAudience = (() => {
      const candidates = stagesWithDate(
        audienceStages.filter((s) => s.estado === 'completado' && Boolean(s.fecha_cumplida)),
        (s) => s.fecha_cumplida ?? null,
      );
      return candidates.length > 0 ? candidates[candidates.length - 1]!.item : null;
    })();

    const notificacionDate = caseData.notificacion_demanda_fecha ?? notificationFromStages ?? null;
    const endDate =
      caseData.fecha_termino ??
      (caseData.sentencia_estado === 'dictada' ? caseData.sentencia_fecha : null) ??
      lastCompleted?.fecha_cumplida ??
      todayIso;

    return {
      etapaActual: currentStage?.etapa ?? caseData.etapa_actual ?? null,
      nextScheduled,
      lastCompleted,
      notificacionDate,
      nextAudience,
      lastAudience,
      durationEndDate: endDate,
      durationDays: daysBetween(caseData.fecha_inicio, endDate),
      todayIso,
    };
  }, [
    caseData.etapa_actual,
    caseData.fecha_inicio,
    caseData.fecha_termino,
    caseData.notificacion_demanda_fecha,
    caseData.sentencia_estado,
    caseData.sentencia_fecha,
    stageCatalog,
  ]);

  const parties = useMemo(() => {
    const primaryClientId = caseData.cliente_principal_id ?? null;
    const allClients = Array.isArray(caseData.clients) ? caseData.clients : [];
    const primaryFromFlag = allClients.filter((client) => Boolean(client.is_primary));
    const primaryFromLegacy =
      primaryClientId ? allClients.find((client) => client.id === primaryClientId) ?? null : null;

    const primaryClients = (() => {
      const seen = new Set<string>();
      const out: Array<(typeof allClients)[number]> = [];
      const useLegacy = primaryFromFlag.length === 0;
      for (const c of primaryFromFlag) {
        if (!c?.id || seen.has(c.id)) continue;
        seen.add(c.id);
        out.push(c);
      }
      if (useLegacy && primaryFromLegacy && !seen.has(primaryFromLegacy.id)) out.push(primaryFromLegacy);
      return out;
    })();

    const demandantesFromText = parsePartyLines(caseData.nombre_cliente);
    const demandadosFromText = parsePartyLines(caseData.contraparte);

    const demandantesFromCounterparties = (counterparties ?? [])
      .filter((item) => item.tipo === 'demandante')
      .map((item) => ({ nombre: normalizeSpace(item.nombre ?? ''), rut: item.rut ?? null }))
      .filter((row) => row.nombre.length > 0);

    const demandadosFromCounterparties = (counterparties ?? [])
      .filter((item) => item.tipo === 'demandado')
      .map((item) => ({ nombre: normalizeSpace(item.nombre ?? ''), rut: item.rut ?? null }))
      .filter((row) => row.nombre.length > 0);

    const mergeUnique = (rows: Array<{ nombre: string; rut?: string | null }>) => {
      const seen = new Set<string>();
      const out: Array<{ nombre: string; rut?: string | null }> = [];
      for (const row of rows) {
        const key = normalizeSpace(row.nombre).toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(row);
      }
      return out;
    };

    return {
      primaryClients,
      demandantes: mergeUnique([...demandantesFromCounterparties, ...demandantesFromText]),
      demandados: mergeUnique([...demandadosFromCounterparties, ...demandadosFromText]),
    };
  }, [caseData.clients, caseData.cliente_principal_id, caseData.contraparte, caseData.nombre_cliente, counterparties]);
  const requestedStageName = clientAdvance.solicitado > 0 ? stageNamesByOrder.get(clientAdvance.solicitado) ?? null : null;
  const authorizedStageName = clientAdvance.autorizado > 0 ? stageNamesByOrder.get(clientAdvance.autorizado) ?? null : null;
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  useEffect(() => {
    setStageCatalog(caseData.case_stages ?? []);
  }, [caseData.case_stages]);

  useEffect(() => {
    setClientAdvance({
      solicitado: caseData.alcance_cliente_solicitado ?? 0,
      autorizado: caseData.alcance_cliente_autorizado ?? 0,
    });
  }, [caseData.alcance_cliente_solicitado, caseData.alcance_cliente_autorizado]);

  useEffect(() => {
    setCounterparties(caseData.counterparties ?? []);
  }, [caseData.counterparties]);

  useEffect(() => {
    if (caseData.abogado_responsable) {
      setCurrentLawyer({
        id: caseData.abogado_responsable.id,
        nombre: caseData.abogado_responsable.nombre,
        telefono: caseData.abogado_responsable.telefono ?? null,
        email: caseData.abogado_responsable.email ?? null,
      });
      setSelectedLawyerId(caseData.abogado_responsable.id);
    } else {
      setCurrentLawyer(null);
      setSelectedLawyerId('');
    }
  }, [
    caseData.abogado_responsable?.id,
    caseData.abogado_responsable?.nombre,
    caseData.abogado_responsable?.telefono,
    caseData.abogado_responsable?.email,
  ]);

  const canEdit =
    profile.role === 'admin_firma' ||
    profile.role === 'analista' ||
    (profile.role === 'abogado' && caseData.abogado_responsable?.id === profile.id);
  const canReassign = profile.role === 'admin_firma' || profile.role === 'analista';

  const canManageStages = canEdit;
  const canManageDocuments = canEdit;
  const canManageNotes = profile.role !== 'cliente';
  const canManageRequests = profile.role !== 'cliente';
  const canManageClients = canEdit;

  const showPrivateContent = profile.role !== 'cliente';

  const fetchAvailableLawyers = useCallback(
    async (ensureLawyer?: {
      id: string;
      nombre: string;
      email: string | null;
      telefono: string | null;
    }) => {
      if (!canReassign) return;
      setIsLoadingLawyers(true);
      try {
        const result = await listAvailableLawyers();
        if (result.success) {
          let options =
            (result.lawyers ?? []).map((lawyer: any) => ({
              id: lawyer.id,
              nombre: (lawyer.nombre ?? 'Sin nombre') as string,
              email: lawyer.email ?? null,
              telefono: lawyer.telefono ?? null,
            })) ?? [];

          const fallback =
            ensureLawyer ??
            (currentLawyer
              ? {
                  id: currentLawyer.id,
                  nombre: currentLawyer.nombre,
                  email: currentLawyer.email ?? null,
                  telefono: currentLawyer.telefono ?? null,
                }
              : null);

          if (fallback && !options.some((lawyer) => lawyer.id === fallback.id)) {
            options = [...options, fallback];
          }

          options.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
          setAvailableLawyers(options);
        } else {
          toast({
            title: 'No se pudo cargar el equipo',
            description: result.error ?? 'Intenta nuevamente en unos minutos.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error fetching lawyers:', error);
        toast({
          title: 'Error',
          description: 'No pudimos obtener la lista de abogados disponibles.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingLawyers(false);
      }
    },
    [canReassign, currentLawyer, toast],
  );

  useEffect(() => {
    fetchAvailableLawyers().catch(() => {
      /* la notificación ya se maneja dentro */
    });
  }, [fetchAvailableLawyers]);

  useEffect(() => {
    if (!currentLawyer && selectedLawyerId) {
      const match = availableLawyers.find((lawyer) => lawyer.id === selectedLawyerId);
      if (match) {
        setCurrentLawyer(match);
      }
    }
  }, [availableLawyers, currentLawyer, selectedLawyerId]);

  useEffect(() => {
    setSelectedLawyerId(currentLawyer?.id ?? '');
  }, [currentLawyer?.id]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      activo: 'bg-green-100 text-green-800',
      suspendido: 'bg-yellow-100 text-yellow-800',
      archivado: 'bg-gray-100 text-gray-800',
      terminado_apelacion: 'bg-violet-100 text-violet-800',
      terminado: 'bg-blue-100 text-blue-800',
      terminado_desistido_demandante: 'bg-blue-100 text-blue-800',
    };
    const labels: Record<string, string> = {
      activo: 'Activo',
      suspendido: 'Suspendido',
      archivado: 'Archivado',
      terminado_apelacion: 'Terminado – Apelación',
      terminado: 'Terminado',
      terminado_desistido_demandante: 'Terminada (Desistida)',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          variants[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {labels[status] ?? status}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      baja: 'bg-gray-100 text-gray-800',
      media: 'bg-blue-100 text-blue-800',
      alta: 'bg-orange-100 text-orange-800',
      urgente: 'bg-red-100 text-red-800',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          variants[priority] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  const handleReassignLawyer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canReassign) return;

    if (!selectedLawyerId) {
      toast({
        title: 'Selecciona un abogado',
        description: 'Debes elegir un abogado para reasignar el caso.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedLawyerId === currentLawyer?.id) {
      toast({
        title: 'Sin cambios',
        description: 'El caso ya está asignado a ese abogado.',
      });
      return;
    }

    setIsReassigning(true);
    try {
      const result = await assignLawyer({
        case_id: caseData.id,
        abogado_id: selectedLawyerId,
      });

      if (result.success) {
        const resolvedLawyer =
          (result.lawyer as { id: string; nombre: string | null; email: string | null; telefono: string | null } | null) ??
          availableLawyers.find((lawyer) => lawyer.id === selectedLawyerId) ??
          null;

        if (resolvedLawyer) {
          const normalized = {
            id: resolvedLawyer.id,
            nombre: resolvedLawyer.nombre ?? 'Sin nombre',
            email: resolvedLawyer.email ?? null,
            telefono: resolvedLawyer.telefono ?? null,
          };
          setCurrentLawyer(normalized);
          await fetchAvailableLawyers(normalized);
        } else {
          setCurrentLawyer(null);
          await fetchAvailableLawyers();
        }

        toast({
          title: 'Caso reasignado',
          description: 'Actualizamos el abogado responsable sin afectar el historial del caso.',
        });
      } else {
        toast({
          title: 'No se pudo reasignar',
          description: result.error ?? 'Intenta nuevamente en unos minutos.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error reassigning lawyer:', error);
      toast({
        title: 'Error inesperado',
        description: 'No pudimos reasignar este caso, intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setIsReassigning(false);
    }
  };

  const handleAuthorizeAdvance = async (targetOrder: number) => {
    if (!targetOrder || targetOrder <= 0) return;
    setIsAuthorizing(true);
    try {
      const result = await authorizeCaseAdvance(caseData.id, targetOrder);
      if (result.success) {
        const authorizedOrder = result.authorizedOrder ?? targetOrder;
        setClientAdvance((prev) => ({ ...prev, autorizado: authorizedOrder }));
        toast({
          title: 'Avance autorizado',
          description: `Se autorizó avanzar hasta ${
            stageNamesByOrder.get(authorizedOrder) ?? `la etapa ${authorizedOrder}`
          }.`,
        });
        router.refresh();
      } else {
        toast({
          title: 'No se pudo autorizar',
          description: result.error ?? 'Intenta nuevamente en unos minutos.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error authorizing advance', error);
      toast({
        title: 'Error inesperado',
        description: 'No fue posible autorizar el avance solicitado.',
        variant: 'destructive',
      });
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleCounterpartyInputChange = (field: 'nombre' | 'rut' | 'tipo', value: string) => {
    setCounterpartyForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateCounterparty = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransitionCounterparty(async () => {
      const result = await createCaseCounterparty({
        caseId: caseData.id,
        nombre: counterpartyForm.nombre,
        rut: counterpartyForm.rut || undefined,
        tipo: counterpartyForm.tipo,
      });

      if (result.success) {
        setCounterparties((prev) => [result.counterparty, ...prev]);
        setCounterpartyForm({ nombre: '', rut: '', tipo: 'demandado' as 'demandado' | 'demandante' | 'tercero' });
        toast({
          title: 'Contraparte agregada',
          description: 'Registramos la contraparte en el expediente.',
        });
      } else {
        toast({
          title: 'No se pudo agregar la contraparte',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  const handleDeleteCounterparty = async (id: string) => {
    setPendingDeleteCounterparty(id);
    try {
      const result = await deleteCaseCounterparty({ id });
      if (result.success) {
        setCounterparties((prev) => prev.filter((item) => item.id !== id));
        toast({ title: 'Contraparte eliminada' });
      } else {
        toast({
          title: 'No se pudo eliminar la contraparte',
          description: result.error,
          variant: 'destructive',
        });
      }
    } finally {
      setPendingDeleteCounterparty(null);
    }
  };

  const tabs = useMemo(() => {
    const base: Array<{
      id:
        | 'overview'
        | 'timeline'
        | 'documents'
        | 'activity'
        | 'monitoring'
        | 'daily'
        | 'notes'
        | 'messages'
        | 'requests'
        | 'checklist'
        | 'clients';
      label: string;
      icon: any;
      count?: number;
    }> = [
      { id: 'overview', label: 'Resumen', icon: Scale },
      { id: 'timeline', label: 'Timeline', icon: Clock },
      { id: 'documents', label: 'Documentos', icon: FileText },
      { id: 'activity', label: 'Actividad', icon: ClipboardList, count: caseEvents.length },
      { id: 'monitoring', label: 'Monitoreo', icon: ShieldCheck },
      { id: 'daily', label: 'Estado Diario', icon: Calendar },
      { id: 'notes', label: 'Notas', icon: MessageCircle },
      { id: 'messages', label: 'Mensajes', icon: MessageCircle, count: messages.length },
      { id: 'requests', label: 'Solicitudes', icon: MessageCircle },
    ];

    if (showPrivateContent) {
      base.push({
        id: 'checklist',
        label: 'Checklist',
        icon: ListChecks,
      });
    }

    if (canManageClients) {
      base.push({
        id: 'clients',
        label: 'Clientes',
        icon: Users,
        count: caseData.clients?.length ?? 0,
      });
    }

    return base;
  }, [canManageClients, caseData.clients?.length, caseEvents.length, messages.length, showPrivateContent]);

  useEffect(() => {
    const raw = window.location.hash?.replace('#', '').trim();
    if (!raw) return;
    const target = tabs.find((t) => t.id === raw);
    if (target) {
      setActiveTab(target.id as typeof activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const nextHash = `#${activeTab}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }, [activeTab]);

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Expediente"
        title={caseData.caratulado}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {caseData.numero_causa && (
              <span className="inline-flex items-center gap-1">
                <Scale className="h-4 w-4 text-primary" />
                <span className="text-foreground/70">Causa:</span> {caseData.numero_causa}
              </span>
            )}
            {caseData.materia && (
              <span className="inline-flex items-center gap-1">
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="text-foreground/70">Materia:</span> {caseData.materia}
              </span>
            )}
          </span>
        }
        actions={
          <>
	            <Button
	              variant="ghost"
	              size="sm"
	              className="rounded-2xl border border-white/25 bg-white/50 px-3 text-foreground/70 shadow-sm hover:bg-white hover:text-foreground"
	              onClick={() => router.back()}
	            >
	              <ArrowLeft className="mr-2 h-4 w-4" />
	              Volver
	            </Button>
	            <Button
	              asChild
	              size="sm"
	              variant="outline"
	              className="rounded-2xl border border-white/25 bg-white/60 px-3 text-foreground/70 shadow-sm hover:bg-white hover:text-foreground"
	            >
	              <Link href={`/billing?caseId=${caseData.id}`}>
	                <Wallet className="mr-2 h-4 w-4" />
	                Cobros
	              </Link>
	            </Button>
	            {canEdit && (
	              <Button
	                asChild
	                size="sm"
	                className="rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-sm hover:bg-primary/15"
	              >
                <Link href={`/cases/${caseData.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Link>
              </Button>
            )}
          </>
        }
      />

        {/* Header del caso */}
        <Card className="mb-10 shadow-[0_35px_65px_-34px_rgba(15,23,42,0.45)]">
          <CardContent className="pt-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground/60">
                  {caseData.numero_causa && (
                    <span className="flex items-center">
                      <Scale className="h-4 w-4 mr-1 text-blue-600" />
                      Causa: {caseData.numero_causa}
                    </span>
                  )}
                  {caseData.materia && <span className="inline-flex items-center gap-2">
                    <Badge variant="outline" className="badge-spark capitalize">
                      {caseData.materia.toLowerCase()}
                    </Badge>
                  </span>}
                  {caseData.tribunal && (
                    <span className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1 text-foreground/40" />
                      {caseData.tribunal}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 md:flex-col md:items-end md:gap-3">
                {getStatusBadge(caseData.estado || 'activo')}
                {caseData.prioridad && getPriorityBadge(caseData.prioridad)}
                {stageInsights.etapaActual && (
                  <Badge variant="outline" className="badge-spark">
                    {stageInsights.etapaActual}
                  </Badge>
                )}
                {caseData.sentencia_estado && caseData.sentencia_estado !== 'no_registra' && (
                  <span className="text-xs text-foreground/60">
                    Sentencia: {getSentenceStatusLabel(caseData.sentencia_estado)}
                    {caseData.sentencia_fecha && <> · {formatDate(caseData.sentencia_fecha)}</>}
                  </span>
                )}
              </div>
            </div>

            {/* Información principal */}
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              {/* Abogado responsable */}
              <div className="group relative overflow-hidden rounded-2xl border border-blue-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-200/50 via-white/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <div className="relative z-10 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground/40">
                        Abogado responsable
                      </p>
                      {currentLawyer ? (
                        <div className="mt-3 space-y-1.5 text-sm text-foreground/70">
                          <p className="text-base font-semibold text-foreground">{currentLawyer.nombre}</p>
                          {currentLawyer.telefono && (
                            <p className="flex items-center gap-2 text-foreground/60">
                              <Phone className="h-3.5 w-3.5 text-blue-500" />
                              {currentLawyer.telefono}
                            </p>
                          )}
                          {currentLawyer.email && (
                            <p className="flex items-center gap-2 text-foreground/60">
                              <Mail className="h-3.5 w-3.5 text-blue-500" />
                              {currentLawyer.email}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-foreground/60">
                          Este caso aún no tiene un abogado asignado.
                        </p>
                      )}
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent text-blue-600">
                      <User className="h-5 w-5" />
                    </div>
                  </div>

                  {canReassign && (
                    <form className="space-y-3" onSubmit={handleReassignLawyer}>
                      <Label
                        htmlFor="case-lawyer-select"
                        className="text-[11px] font-semibold uppercase tracking-[0.32em] text-foreground/45"
                      >
                        Reasignar · asignar abogado
                      </Label>
                      <div className="flex flex-col gap-2">
                        <select
                          id="case-lawyer-select"
                          className="input-field w-full"
                          value={selectedLawyerId}
                          onChange={(event) => setSelectedLawyerId(event.target.value)}
                          disabled={isLoadingLawyers || isReassigning}
                        >
                          <option value="">
                            {isLoadingLawyers ? 'Cargando abogados…' : 'Selecciona un abogado'}
                          </option>
                          {availableLawyers.map((lawyer) => (
                            <option key={lawyer.id} value={lawyer.id}>
                              {lawyer.nombre}
                              {lawyer.email ? ` · ${lawyer.email}` : ''}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="submit"
                          size="sm"
                          className="rounded-full px-4 self-start"
                          disabled={isReassigning || !selectedLawyerId || selectedLawyerId === currentLawyer?.id}
                        >
                          {isReassigning ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Guardando…
                            </>
                          ) : (
                            'Actualizar'
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-foreground/50">
                        Los cambios quedarán registrados automáticamente en el historial del caso.
                      </p>
                    </form>
                  )}
                </div>
              </div>

              {/* Cliente */}
              {(parties.primaryClients.length > 0 || parties.demandantes.length > 0 || parties.demandados.length > 0) && (
                <div className="group relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-200/50 via-white/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground/40">
                          Partes
                        </p>
                        <div className="mt-3 space-y-3 text-sm text-foreground/70">
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="badge-spark shrink-0">
                              Clientes principales
                            </Badge>
                            <div className="min-w-0">
                              {parties.primaryClients.length === 0 ? (
                                <p className="font-semibold text-foreground">Sin registrar</p>
                              ) : (
                                <>
                                  {parties.primaryClients.slice(0, 2).map((client, idx) => (
                                    <div key={`primary-client-${client.id}-${idx}`} className="space-y-0.5">
                                      <p className="font-semibold text-foreground">{client.nombre}</p>
                                      {(client.rut || client.email) && (
                                        <p className="text-xs text-foreground/55">
                                          {client.rut ? `RUT · ${client.rut}` : ''}
                                          {client.rut && client.email ? ' · ' : ''}
                                          {client.email ? client.email : ''}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                  {parties.primaryClients.length > 2 && (
                                    <p className="text-xs text-foreground/55">
                                      +{parties.primaryClients.length - 2} más
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="badge-spark shrink-0">
                              Demandante
                            </Badge>
                            <div className="min-w-0 space-y-1">
                              {parties.demandantes.length === 0 ? (
                                <p className="text-foreground/55">Sin registrar</p>
                              ) : (
                                <>
                                  {parties.demandantes.slice(0, 2).map((row, idx) => (
                                    <p key={`demandante-${row.nombre}-${idx}`} className="text-foreground/75">
                                      {row.nombre}
                                      {row.rut ? <span className="text-xs text-foreground/55">{` · RUT ${row.rut}`}</span> : null}
                                    </p>
                                  ))}
                                  {parties.demandantes.length > 2 && (
                                    <p className="text-xs text-foreground/55">+{parties.demandantes.length - 2} más</p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="badge-spark shrink-0">
                              Demandado
                            </Badge>
                            <div className="min-w-0 space-y-1">
                              {parties.demandados.length === 0 ? (
                                <p className="text-foreground/55">Sin registrar</p>
                              ) : (
                                <>
                                  {parties.demandados.slice(0, 2).map((row, idx) => (
                                    <p key={`demandado-${row.nombre}-${idx}`} className="text-foreground/75">
                                      {row.nombre}
                                      {row.rut ? <span className="text-xs text-foreground/55">{` · RUT ${row.rut}`}</span> : null}
                                    </p>
                                  ))}
                                  {parties.demandados.length > 2 && (
                                    <p className="text-xs text-foreground/55">+{parties.demandados.length - 2} más</p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/10 to-transparent text-emerald-600">
                        <User className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fechas */}
              <div className="group relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-200/50 via-white/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <div className="relative z-10 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground/40">
                        Fechas clave
                      </p>
                      <div className="mt-3 space-y-1.5 text-sm text-foreground/65">
                        {caseData.fecha_inicio && (
                          <p>
                            Inicio · <span className="font-medium text-foreground">{formatDate(caseData.fecha_inicio)}</span>
                          </p>
                        )}
                        {stageInsights.notificacionDate && (
                          <p>
                            Notificación ·{' '}
                            <span className="font-medium text-foreground">
                              {formatDate(stageInsights.notificacionDate)}
                            </span>
                          </p>
                        )}
                        {stageInsights.nextAudience?.fecha_programada && (
                          <p>
                            Audiencia próxima ·{' '}
                            <span className="font-medium text-foreground">
                              {formatDate(stageInsights.nextAudience.fecha_programada)}
                            </span>
                            <span className="text-xs text-foreground/50"> · {stageInsights.nextAudience.etapa}</span>
                          </p>
                        )}
                        {stageInsights.nextScheduled?.fecha_programada && (
                          <p>
                            Próximo hito ·{' '}
                            <span className="font-medium text-foreground">
                              {formatDate(stageInsights.nextScheduled.fecha_programada)}
                            </span>
                            <span className="text-xs text-foreground/50"> · {stageInsights.nextScheduled.etapa}</span>
                          </p>
                        )}
                        {stageInsights.lastCompleted?.fecha_cumplida && (
                          <p>
                            Último hito ·{' '}
                            <span className="font-medium text-foreground">
                              {formatDate(stageInsights.lastCompleted.fecha_cumplida)}
                            </span>
                            <span className="text-xs text-foreground/50"> · {stageInsights.lastCompleted.etapa}</span>
                          </p>
                        )}
                        {caseData.sentencia_fecha && (
                          <p>
                            Sentencia · <span className="font-medium text-foreground">{formatDate(caseData.sentencia_fecha)}</span>
                          </p>
                        )}
                        {(caseData as any).fecha_desistimiento && (
                          <p>
                            Desistimiento ·{' '}
                            <span className="font-medium text-foreground">
                              {formatDate((caseData as any).fecha_desistimiento)}
                            </span>
                          </p>
                        )}
                        {caseData.fecha_termino && (
                          <p>
                            Término · <span className="font-medium text-foreground">{formatDate(caseData.fecha_termino)}</span>
                          </p>
                        )}
                        {stageInsights.durationDays !== null && (
                          <p>
                            {caseData.fecha_termino || (caseData.sentencia_estado === 'dictada' && caseData.sentencia_fecha)
                              ? 'Duración total'
                              : 'Duración'}
                            {' '}·{' '}
                            <span className="font-medium text-foreground">{stageInsights.durationDays} días</span>
                            {stageInsights.durationEndDate && (
                              <span className="text-xs text-foreground/50">
                                {' '}· al {formatDate(stageInsights.durationEndDate)}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 via-indigo-500/10 to-transparent text-indigo-600">
                      <Calendar className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Valor */}
              {caseData.valor_estimado && (
                <div className="group relative overflow-hidden rounded-2xl border border-amber-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-200/50 via-white/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground/40">
                          Cuantía en disputa
                        </p>
                        <p className="mt-3 text-2xl font-semibold text-foreground">
                          {formatCurrency(caseData.valor_estimado)}
                        </p>
                        <p className="mt-1 text-xs text-foreground/50">Monto reclamado o discutido (no honorarios).</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent text-amber-600">
                        <DollarSign className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(clientAdvance.solicitado > 0 || clientAdvance.autorizado > 0) && (
                <div className="group relative overflow-hidden rounded-2xl border border-sky-200/60 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-200/50 via-white/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground/40">
                          Alcance del cliente
                        </p>
                        <div className="mt-3 space-y-1.5 text-sm text-foreground/60">
                          <p>
                            {clientAdvance.solicitado > 0
                              ? `Solicitado · ${requestedStageName ?? `Etapa ${clientAdvance.solicitado}`}`
                              : 'Sin solicitudes vigentes'}
                          </p>
                          <p>
                            {clientAdvance.autorizado > 0
                              ? `Autorizado · ${authorizedStageName ?? `Etapa ${clientAdvance.autorizado}`}`
                              : 'Aprobación pendiente'}
                          </p>
                        </div>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-sky-500/10 to-transparent text-sky-600">
                        <Clock className="h-5 w-5" />
                      </div>
                    </div>

                    {(profile.role === 'admin_firma' || profile.role === 'analista') &&
                      clientAdvance.solicitado > clientAdvance.autorizado && (
                        <Button
                          size="sm"
                          className="inline-flex items-center gap-2 rounded-full px-4"
                          onClick={() => handleAuthorizeAdvance(clientAdvance.solicitado)}
                          disabled={isAuthorizing}
                        >
                          {isAuthorizing ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Autorizando…
                            </>
                          ) : (
                            'Autorizar solicitud'
                          )}
                        </Button>
                      )}
                  </div>
                </div>
              )}

            </div>

            {/* Contraparte */}
            {caseData.contraparte && (
              <div className="mt-8 rounded-3xl border border-white/30 bg-white/75 p-6 shadow-inner">
                <h3 className="text-lg font-semibold text-foreground mb-2">Contraparte</h3>
                <p className="text-sm text-foreground/65">{caseData.contraparte}</p>
              </div>
            )}

            {/* Observaciones */}
            {observacionesClean && (
              <div className="mt-6 rounded-3xl border border-white/30 bg-white/75 p-6 shadow-inner">
                <h3 className="text-lg font-semibold text-foreground mb-2">Observaciones</h3>
                <p className="text-sm text-foreground/65 whitespace-pre-wrap">
                  {observacionesClean}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs de navegación */}
        <div className="sticky top-16 z-40 -mx-4 border-y border-white/20 bg-white/65 py-3 backdrop-blur-2xl sm:-mx-6 lg:-mx-8">
          <nav className="mx-auto flex w-full max-w-[1600px] items-center justify-start gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const count = tab.count ?? 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-foreground text-white shadow-md'
                      : 'border border-white/20 bg-white/40 text-foreground/60 hover:bg-white/70 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`ml-1 inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Contenido de las tabs */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,4.5fr)_minmax(0,2.5fr)] xl:items-start">
              <div className="space-y-6">
                <TimelinePanel
                  caseId={caseData.id}
                  caseMateria={caseData.materia ?? 'General'}
                  canManageStages={canManageStages}
                  showPrivateStages={showPrivateContent}
                  clientContext={{
                    role: profile.role === 'usuario' ? 'cliente' : profile.role,
                    alcanceAutorizado: clientAdvance.autorizado,
                    alcanceSolicitado: clientAdvance.solicitado,
                  }}
                  onClientProgressChange={(progress) => {
                    setClientAdvance((prev) => {
                      const nextSolicitado = progress.solicitado ?? prev.solicitado;
                      const nextAutorizado = progress.autorizado ?? prev.autorizado;
                      if (
                        nextSolicitado === prev.solicitado &&
                        nextAutorizado === prev.autorizado
                      ) {
                        return prev;
                      }
                      return { solicitado: nextSolicitado, autorizado: nextAutorizado };
                    });
                  }}
                  onStagesLoaded={setStageCatalog}
                />
              </div>
              <div className="space-y-6">
                <DocumentsPanel
                  caseId={caseData.id}
                  canUpload={canManageDocuments}
                  canEdit={canManageDocuments}
                  canDelete={canManageDocuments}
                  showPrivateDocuments={showPrivateContent}
                />
                <InfoRequestsPanel
                  caseId={caseData.id}
                  canCreateRequests={true}
                  canRespondRequests={canManageRequests}
                  showPrivateRequests={showPrivateContent}
                />
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <TimelinePanel
              caseId={caseData.id}
              caseMateria={caseData.materia ?? 'General'}
              canManageStages={canManageStages}
              showPrivateStages={showPrivateContent}
              clientContext={{
                role: profile.role === 'usuario' ? 'cliente' : profile.role,
                alcanceAutorizado: clientAdvance.autorizado,
                alcanceSolicitado: clientAdvance.solicitado,
              }}
              onClientProgressChange={(progress) => {
                setClientAdvance((prev) => {
                  const nextSolicitado = progress.solicitado ?? prev.solicitado;
                  const nextAutorizado = progress.autorizado ?? prev.autorizado;
                  if (nextSolicitado === prev.solicitado && nextAutorizado === prev.autorizado) {
                    return prev;
                  }
                  return { solicitado: nextSolicitado, autorizado: nextAutorizado };
                });
              }}
              onStagesLoaded={setStageCatalog}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentsPanel
              caseId={caseData.id}
              caseMateria={caseData.materia ?? null}
              initialDocumentationReceived={caseData.documentacion_recibida ?? null}
              canRequestDocuments={profile.role !== 'cliente'}
              canUpload={canManageDocuments}
              canEdit={canManageDocuments}
              canDelete={canManageDocuments}
              showPrivateDocuments={showPrivateContent}
            />
          )}

          {activeTab === 'activity' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      Bitácora del expediente
                    </span>
                    <Badge variant="outline">{caseEvents.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr_auto]">
                    <div className="space-y-2">
                      <Label htmlFor="event_kind">Tipo</Label>
                      <select
                        id="event_kind"
                        className="h-11 w-full rounded-2xl border border-white/25 bg-white/60 px-4 text-sm text-foreground shadow-inner outline-none transition focus:border-primary/40 focus:bg-white/85 focus:ring-2 focus:ring-primary/20"
                        value={eventDraft.kind}
                        onChange={(e) =>
                          setEventDraft((prev) => ({ ...prev, kind: e.target.value as any }))
                        }
                        disabled={isCreatingEvent}
                      >
                        <option value="movement">Movimiento</option>
                        <option value="resolution">Resolución</option>
                        <option value="deadline">Vencimiento</option>
                        <option value="note">Nota</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event_title">Detalle</Label>
                      <Input
                        id="event_title"
                        value={eventDraft.title}
                        onChange={(e) => setEventDraft((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Ej: Se tuvo por notificada la demanda / Se programó audiencia..."
                        disabled={isCreatingEvent}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" onClick={handleCreateEvent} disabled={isCreatingEvent || !eventDraft.title.trim()}>
                        {isCreatingEvent ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          'Agregar'
                        )}
                      </Button>
                    </div>
                  </div>

                  {isLoadingEvents ? (
                    <div className="flex items-center gap-2 text-sm text-foreground/60">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando bitácora...
                    </div>
                  ) : caseEvents.length === 0 ? (
                    <p className="text-sm text-foreground/60">Aún no hay eventos registrados.</p>
                  ) : (
                    <div className="space-y-2">
                      {caseEvents.slice(0, 30).map((event) => (
                        <div
                          key={event.id}
                          className="rounded-2xl border border-white/20 bg-white/55 px-4 py-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{event.title}</p>
                              <p className="text-xs text-foreground/55">
                                {event.kind} · {formatDate(event.occurred_at)}
                              </p>
                            </div>
                            <Badge variant="outline" className="w-fit">
                              {event.provider}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      {caseEvents.length > 30 && (
                        <p className="text-xs text-foreground/55">
                          Mostrando 30 de {caseEvents.length} eventos.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'daily' && (
            <DailyStatementsPanel
              caseId={caseData.id}
              caseNumeroCausa={caseData.numero_causa ?? null}
            />
          )}

          {activeTab === 'monitoring' && (
            <ComplianceMonitoringPanel
              caseId={caseData.id}
              canRefresh={profile.role !== 'cliente'}
            />
          )}

          {activeTab === 'notes' && (
            <NotesPanel
              caseId={caseData.id}
              canCreateNotes={canManageNotes}
              canEditNotes={canManageNotes}
              showPrivateNotes={showPrivateContent}
            />
          )}

          {activeTab === 'messages' && (
            <CaseMessagesPanel
              caseId={caseData.id}
              initialMessages={messages}
              currentProfileId={profile.id}
              allowSend={profile.role !== 'cliente'}
            />
          )}

          {activeTab === 'requests' && (
            <InfoRequestsPanel
              caseId={caseData.id}
              canCreateRequests={true}
              canRespondRequests={canManageRequests}
              showPrivateRequests={showPrivateContent}
            />
          )}

          {activeTab === 'checklist' && showPrivateContent && (
            <LawyerChecklistPanel caseId={caseData.id} canEdit={canEdit} />
          )}

          {activeTab === 'clients' && canManageClients && (
            <div className="space-y-6">
              {/* Lista de clientes asociados */}
		              {caseData.clients && caseData.clients.length > 0 && (
	                <Card>
	                  <CardHeader>
	                    <CardTitle className="flex items-center gap-2">
	                      <Users className="h-5 w-5" />
	                      Clientes Asociados ({caseData.clients.length})
	                    </CardTitle>
	                  </CardHeader>
	                  <CardContent>
	                    <div className="space-y-3">
	                      {caseData.clients.map((client) => (
	                        <div
	                          key={client.id}
	                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/55 px-4 py-3"
	                        >
	                          <div className="flex items-center space-x-3">
	                            <div
	                              className="flex h-10 w-10 items-center justify-center rounded-2xl text-white font-medium"
	                              style={{ backgroundColor: stringToColor(client.nombre) }}
	                            >
	                              {getInitials(client.nombre)}
	                            </div>
	                            <div>
	                              <h4 className="font-semibold text-foreground">{client.nombre}</h4>
	                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/55">
	                                <span className="flex items-center">
	                                  <Mail className="mr-1 h-3 w-3" />
	                                  {client.email}
	                                </span>
	                                {client.telefono && (
	                                  <span className="flex items-center">
	                                    <Phone className="mr-1 h-3 w-3" />
	                                    {client.telefono}
	                                  </span>
	                                )}
	                              </div>
	                            </div>
	                          </div>
	                          <Badge variant="outline">Cliente</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Contrapartes (demandados)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={handleCreateCounterparty} className="grid gap-4 md:grid-cols-[1.2fr_1fr_0.8fr_auto]">
                    <div className="space-y-2">
                      <Label htmlFor="counterparty_nombre">Nombre completo *</Label>
                      <Input
                        id="counterparty_nombre"
                        placeholder="Empresa demandada o persona"
                        value={counterpartyForm.nombre}
                        onChange={(event) => handleCounterpartyInputChange('nombre', event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="counterparty_rut">RUT</Label>
                      <Input
                        id="counterparty_rut"
                        placeholder="12.345.678-9"
                        value={counterpartyForm.rut}
                        onChange={(event) => handleCounterpartyInputChange('rut', event.target.value)}
                      />
                    </div>
	                    <div className="space-y-2">
	                      <Label htmlFor="counterparty_tipo">Rol</Label>
	                      <select
	                        id="counterparty_tipo"
	                        className="h-11 w-full rounded-2xl border border-white/25 bg-white/60 px-4 text-sm text-foreground shadow-inner outline-none transition focus:border-primary/40 focus:bg-white/85 focus:ring-2 focus:ring-primary/20"
	                        value={counterpartyForm.tipo}
	                        onChange={(event) => handleCounterpartyInputChange('tipo', event.target.value as 'demandado' | 'demandante' | 'tercero')}
	                      >
                        <option value="demandado">Demandado</option>
                        <option value="demandante">Demandante</option>
                        <option value="tercero">Tercero</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmittingCounterparty || counterpartyForm.nombre.trim().length < 2}
                      >
                        {isSubmittingCounterparty ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Registrando…
                          </>
                        ) : (
                          'Agregar'
                        )}
                      </Button>
                    </div>
                  </form>

	                  <div className="space-y-3">
	                    {counterparties.length === 0 ? (
	                      <p className="text-sm text-foreground/60">
	                        Aún no se agregan demandados al expediente. Regístralos para tener claridad de las partes involucradas.
	                      </p>
	                    ) : (
	                      counterparties.map((item) => (
	                        <div
	                          key={item.id}
	                          className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/55 px-4 py-3 text-sm shadow-sm"
	                        >
	                          <div className="flex flex-col">
	                            <span className="font-semibold text-foreground">{item.nombre}</span>
	                            <div className="flex flex-wrap gap-3 text-xs text-foreground/55">
	                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-600">
	                                {item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)}
	                              </span>
	                              {item.rut && <span>RUT: {item.rut}</span>}
	                              <span>Agregado: {item.created_at ? formatDate(item.created_at) : '—'}</span>
	                            </div>
	                          </div>
	                          <Button
	                            variant="ghost"
	                            size="icon"
	                            className="h-9 w-9 rounded-full text-foreground/45 hover:text-red-600"
	                            onClick={() => handleDeleteCounterparty(item.id)}
	                            disabled={pendingDeleteCounterparty === item.id}
	                          >
                            {pendingDeleteCounterparty === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          </div>

          {/* Right rail (Salesforce-like) */}
          <aside className="space-y-6 lg:sticky lg:top-24">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acciones rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="justify-start" onClick={() => setActiveTab('documents')}>
                    <FileText className="mr-2 h-4 w-4" />
                    Documentos
                  </Button>
                  <Button type="button" variant="outline" className="justify-start" onClick={() => setActiveTab('requests')}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Solicitudes
                  </Button>
                  <Button type="button" variant="outline" className="justify-start" onClick={() => setActiveTab('messages')}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Mensajes
                  </Button>
                  <Button type="button" variant="outline" className="justify-start" onClick={() => setActiveTab('activity')}>
                    <Clock className="mr-2 h-4 w-4" />
                    Bitácora
                  </Button>
                </div>
                {canEdit && (
                  <Button
                    asChild
                    className="w-full rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-sm hover:bg-primary/15"
                  >
                    <Link href={`/cases/${caseData.id}/edit`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar caso
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Equipo y contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentLawyer ? (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45">
                      Abogado responsable
                    </p>
                    <p className="text-sm font-semibold text-foreground">{currentLawyer.nombre}</p>
                    <div className="flex flex-wrap gap-2 pt-1 text-xs text-foreground/60">
                      {currentLawyer.email && (
                        <a className="pill hover:bg-white/70" href={`mailto:${currentLawyer.email}`}>
                          <Mail className="h-3.5 w-3.5" />
                          {currentLawyer.email}
                        </a>
                      )}
                      {currentLawyer.telefono && (
                        <a className="pill hover:bg-white/70" href={`tel:${currentLawyer.telefono}`}>
                          <Phone className="h-3.5 w-3.5" />
                          {currentLawyer.telefono}
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground/60">Sin abogado responsable asignado.</p>
                )}

                {caseData.clients && caseData.clients.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45">
                      Clientes
                    </p>
                    <div className="space-y-2">
                      {caseData.clients.slice(0, 3).map((client) => (
                        <div
                          key={client.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/55 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{client.nombre}</p>
                            <p className="truncate text-xs text-foreground/55">{client.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {client.telefono && (
                              <a
                                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/25 bg-white/60 text-foreground/70 hover:bg-white"
                                href={`tel:${client.telefono}`}
                                aria-label="Llamar"
                              >
                                <Phone className="h-4 w-4" />
                              </a>
                            )}
                            {client.email && (
                              <a
                                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/25 bg-white/60 text-foreground/70 hover:bg-white"
                                href={`mailto:${client.email}`}
                                aria-label="Enviar correo"
                              >
                                <Mail className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                      {caseData.clients.length > 3 && (
                        <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => setActiveTab('clients')}>
                          Ver {caseData.clients.length - 3} más…
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-foreground/70">
                <div className="flex items-center justify-between gap-3">
                  <span>Etapa actual</span>
                  <span className="font-medium text-foreground">{stageInsights.etapaActual ?? 'Sin definir'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Estado</span>
                  <span className="font-medium text-foreground">{caseData.estado ?? 'Sin definir'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Sentencia</span>
                  <span className="font-medium text-foreground">{getSentenceStatusLabel(caseData.sentencia_estado)}</span>
                </div>
                {typeof caseData.valor_estimado === 'number' && (
                  <div className="flex items-center justify-between gap-3">
                    <span>Cuantía</span>
                    <span className="font-medium text-foreground">{formatCurrency(caseData.valor_estimado)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
    </div>
  );
}

export default CaseDetailView;
