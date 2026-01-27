'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';

type WorkQueueStage = {
  stage_id: string;
  etapa: string;
  fecha_programada: string;
  requiere_pago: boolean;
  estado_pago: string;
  enlace_pago: string | null;
  case_id: string;
  caratulado: string;
  materia: string | null;
  prioridad: string | null;
  workflow_state: string | null;
};

type WorkQueueRequest = {
  request_id: string;
  titulo: string;
  estado: string;
  tipo: string;
  prioridad: string | null;
  fecha_limite: string | null;
  case_id: string;
  caratulado: string;
};

export type WorkQueueData = {
  overdueStages: WorkQueueStage[];
  dueNext7Days: WorkQueueStage[];
  paymentBlocks: WorkQueueStage[]; // legacy: se mantiene por compatibilidad (deprecado)
  pendingRequests: WorkQueueRequest[];
  stats: {
    overdueStages: number;
    dueNext7Days: number;
    paymentBlocks: number; // legacy
    pendingRequests: number;
  };
};

function isoDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeDateOnly(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  // 'YYYY-MM-DD' o ISO con hora -> nos quedamos con date-only.
  if (raw.length >= 10) return raw.slice(0, 10);
  return null;
}

export async function getWorkQueue(): Promise<{ success: boolean; data?: WorkQueueData; error?: string }> {
  try {
    const profile = await requireAuth();
    const supabase = await createServerClient();

    // Configurar fechas en zona horaria Santiago (Chile)
    const now = new Date();
    const chileFormatter = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = chileFormatter.format(now);

    // Hour in Chile (0-23)
    const chileHour = Number(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Santiago',
      hour: 'numeric',
      hour12: false,
    }).format(now));

    // Next 7 days based on Chile time
    const next7Date = new Date(now);
    next7Date.setDate(next7Date.getDate() + 7);
    const next7 = chileFormatter.format(next7Date);

    const requestsQuery = supabase
      .from('info_requests')
      .select('id, titulo, estado, tipo, prioridad, fecha_limite, case:cases(id, caratulado)')
      .in('estado', ['pendiente', 'en_revision'])
      .order('fecha_limite', { ascending: true, nullsFirst: false });

    const requestsRes = await requestsQuery;
    if (requestsRes.error) throw requestsRes.error;

    // Vencimientos: basados en fechas del caso y audiencias reales del expediente.
    // Nota: RLS ya filtra por org activa + permisos.
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select(
        [
          'id',
          'caratulado',
          'materia',
          'prioridad',
          'workflow_state',
          'estado',
          'sentencia_estado',
          'sentencia_fecha',
          'notificacion_demanda_estado',
          'notificacion_demanda_fecha',
          'fecha_desistimiento',
          'next_action_title',
          'next_action_at',
        ].join(','),
      )
      // Inbox: solo casos activos / en seguimiento. No alertar casos finalizados.
      .is('deleted_at', null)
      .not('estado', 'in', '("archivado","terminado","terminado_desistido_demandante")');
    if (casesError) throw casesError;

    const deadlineItems: WorkQueueStage[] = [];
    for (const c of (cases ?? []) as Array<Record<string, any>>) {
      const caseId = String(c.id);
      const caratulado = String(c.caratulado ?? 'Caso');
      const materia = (c.materia as string | null) ?? null;
      const prioridad = (c.prioridad as string | null) ?? null;
      const workflow_state = (c.workflow_state as string | null) ?? null;

      const add = (kind: string, label: string, rawDate: string | null | undefined) => {
        const dateOnly = normalizeDateOnly(rawDate);
        if (!dateOnly) return;
        deadlineItems.push({
          stage_id: `${caseId}:${kind}`,
          etapa: label,
          fecha_programada: dateOnly,
          requiere_pago: false,
          estado_pago: 'pendiente',
          enlace_pago: null,
          case_id: caseId,
          caratulado,
          materia,
          prioridad,
          workflow_state,
        });
      };

      // Próxima acción manual (si existe).
      add('next_action', String(c.next_action_title ?? 'Próxima acción'), c.next_action_at ?? null);

      // Notificación de demanda pendiente (si existe fecha).
      const notifEstado = String(c.notificacion_demanda_estado ?? '').trim();
      if (notifEstado !== 'realizada') {
        add('notificacion', 'Notificación demanda', c.notificacion_demanda_fecha ?? null);
      }

      // Sentencia:
      // - 'pendiente' no es un vencimiento: se excluye del Inbox para evitar "atención inmediata" falsa.
      // - 'programada' sí puede alertar (fecha informada explícitamente).
      const sentEstado = String(c.sentencia_estado ?? '').trim();
      if (sentEstado === 'programada') {
        add('sentencia', 'Sentencia programada', c.sentencia_fecha ?? null);
      }

      // Desistimiento: si viene planificado (fecha futura), se muestra como vencimiento.
      // Si la fecha ya pasó, lo tratamos como hito histórico (no alerta).
      const desist = normalizeDateOnly(c.fecha_desistimiento ?? null);
      if (desist && desist >= today) {
        add('desistimiento', 'Desistimiento', desist);
      }
    }

    // Audiencias reales: vienen desde etapas con audiencia_tipo y fecha_programada, no inventadas.
    const stagesQuery = supabase
      .from('case_stages')
      .select(
        [
          'id',
          'etapa',
          'estado',
          'fecha_programada',
          'audiencia_tipo',
          'es_publica',
          'case:cases!inner(id, caratulado, materia, prioridad, workflow_state, estado, deleted_at)',
        ].join(','),
      )
      .is('case.deleted_at', null)
      .in('estado', ['pendiente', 'en_proceso'])
      .not('fecha_programada', 'is', null)
      .not('audiencia_tipo', 'is', null);

    if (profile.role === 'cliente') {
      stagesQuery.eq('es_publica', true);
    }

    const stagesRes = await stagesQuery;
    if (stagesRes.error) throw stagesRes.error;

    for (const row of (stagesRes.data ?? []) as any[]) {
      const linkedCase = row.case;
      if (!linkedCase?.id) continue;
      // Failsafe: asegurar que no procesamos casos eliminados si el filtro SQL falló
      if (linkedCase.deleted_at) continue;

      const estadoCaso = String(linkedCase.estado ?? '').trim();
      if (['archivado', 'terminado', 'terminado_desistido_demandante'].includes(estadoCaso)) continue;

      const dateOnly = normalizeDateOnly(row.fecha_programada);
      if (!dateOnly) continue;

      const caseId = String(linkedCase.id);
      deadlineItems.push({
        stage_id: `${caseId}:audiencia:${String(row.id)}`,
        etapa: String(row.etapa ?? 'Audiencia'),
        fecha_programada: dateOnly,
        requiere_pago: false,
        estado_pago: 'pendiente',
        enlace_pago: null,
        case_id: caseId,
        caratulado: String(linkedCase.caratulado ?? 'Caso'),
        materia: (linkedCase.materia as string | null) ?? null,
        prioridad: (linkedCase.prioridad as string | null) ?? null,
        workflow_state: (linkedCase.workflow_state as string | null) ?? null,
      });
    }

    // REGLA 8 AM: Si es hoy y ya pasaron las 8 AM, se considera vencido/urgente (overdue).
    const isOverdue = (dateStr: string) => {
      if (dateStr < today) return true;
      if (dateStr === today && chileHour >= 8) return true;
      return false;
    };

    const overdueDeadlines = deadlineItems
      .filter((i) => isOverdue(i.fecha_programada))
      .sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada));

    const dueNext7Days = deadlineItems
      .filter((i) => !isOverdue(i.fecha_programada) && i.fecha_programada >= today && i.fecha_programada <= next7)
      .sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada));

    const mapRequest = (row: any): WorkQueueRequest => ({
      request_id: row.id,
      titulo: row.titulo,
      estado: row.estado,
      tipo: row.tipo,
      prioridad: row.prioridad ?? null,
      fecha_limite: row.fecha_limite ?? null,
      case_id: row.case?.id ?? row.case_id,
      caratulado: row.case?.caratulado ?? 'Caso',
    });

    const paymentBlocks: WorkQueueStage[] = [];
    const pendingRequests = (requestsRes.data ?? []).map(mapRequest);

    return {
      success: true,
      data: {
        overdueStages: overdueDeadlines,
        dueNext7Days,
        paymentBlocks,
        pendingRequests,
        stats: {
          overdueStages: overdueDeadlines.length,
          dueNext7Days: dueNext7Days.length,
          paymentBlocks: 0,
          pendingRequests: pendingRequests.length,
        },
      },
    };
  } catch (error) {
    console.error('Error in getWorkQueue:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}
