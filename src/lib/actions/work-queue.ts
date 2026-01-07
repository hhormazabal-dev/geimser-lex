'use server';

import { createServerClient } from '@/lib/supabase/server';
import { getCurrentProfile, requireAuth } from '@/lib/auth/roles';

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

export async function getWorkQueue(): Promise<{ success: boolean; data?: WorkQueueData; error?: string }> {
  try {
    await requireAuth();
    const supabase = await createServerClient();

    const today = isoDateOnly(new Date());
    const next7 = isoDateOnly(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    const baseStageSelect = `
      id,
      etapa,
      fecha_programada,
      requiere_pago,
      estado_pago,
      enlace_pago,
      case_id,
      case:cases(id, caratulado, materia, prioridad, workflow_state)
    `;

    const stageBase = supabase
      .from('case_stages')
      .select(baseStageSelect)
      .neq('estado', 'completado')
      .not('fecha_programada', 'is', null);

    const overdueQuery = stageBase.lt('fecha_programada', today).order('fecha_programada', { ascending: true });
    const dueQuery = stageBase
      .gte('fecha_programada', today)
      .lte('fecha_programada', next7)
      .order('fecha_programada', { ascending: true });

    const requestsQuery = supabase
      .from('info_requests')
      .select('id, titulo, estado, tipo, prioridad, fecha_limite, case:cases(id, caratulado)')
      .in('estado', ['pendiente', 'en_revision'])
      .order('fecha_limite', { ascending: true, nullsFirst: false });

    const [overdueRes, dueRes, requestsRes] = await Promise.all([
      overdueQuery,
      dueQuery,
      requestsQuery,
    ]);

    if (overdueRes.error) throw overdueRes.error;
    if (dueRes.error) throw dueRes.error;
    if (requestsRes.error) throw requestsRes.error;

    const mapStage = (row: any): WorkQueueStage => ({
      stage_id: row.id,
      etapa: row.etapa,
      fecha_programada: row.fecha_programada,
      requiere_pago: Boolean(row.requiere_pago),
      estado_pago: row.estado_pago,
      enlace_pago: row.enlace_pago ?? null,
      case_id: row.case_id,
      caratulado: row.case?.caratulado ?? 'Caso',
      materia: row.case?.materia ?? null,
      prioridad: row.case?.prioridad ?? null,
      workflow_state: row.case?.workflow_state ?? null,
    });

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

    const overdueStages = (overdueRes.data ?? []).map(mapStage);
    const dueNext7Days = (dueRes.data ?? []).map(mapStage);
    const paymentBlocks: WorkQueueStage[] = [];
    const pendingRequests = (requestsRes.data ?? []).map(mapRequest);

    return {
      success: true,
      data: {
        overdueStages,
        dueNext7Days,
        paymentBlocks,
        pendingRequests,
        stats: {
          overdueStages: overdueStages.length,
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
