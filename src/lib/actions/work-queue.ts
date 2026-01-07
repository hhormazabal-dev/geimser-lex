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
    await requireAuth();
    const supabase = await createServerClient();

    const today = isoDateOnly(new Date());
    const next7 = isoDateOnly(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    const requestsQuery = supabase
      .from('info_requests')
      .select('id, titulo, estado, tipo, prioridad, fecha_limite, case:cases(id, caratulado)')
      .in('estado', ['pendiente', 'en_revision'])
      .order('fecha_limite', { ascending: true, nullsFirst: false });

    const requestsRes = await requestsQuery;
    if (requestsRes.error) throw requestsRes.error;

    // Vencimientos: basados en fechas del caso (no en etapas).
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
      .neq('estado', 'archivado');
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

      // Sentencia (si no está dictada y existe fecha).
      const sentEstado = String(c.sentencia_estado ?? '').trim();
      if (sentEstado && sentEstado !== 'dictada' && sentEstado !== 'no_registra') {
        add('sentencia', `Sentencia · ${sentEstado.replace(/_/g, ' ')}`, c.sentencia_fecha ?? null);
      }

      // Desistimiento (si existe fecha).
      add('desistimiento', 'Desistimiento', c.fecha_desistimiento ?? null);
    }

    const overdueDeadlines = deadlineItems
      .filter((i) => i.fecha_programada < today)
      .sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada));

    const dueNext7Days = deadlineItems
      .filter((i) => i.fecha_programada >= today && i.fecha_programada <= next7)
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
