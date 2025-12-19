import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/roles';
import { completeStage, updateStage } from '@/lib/actions/stages';
import { updateCase } from '@/lib/actions/cases';
import { closeInfoRequest } from '@/lib/actions/info-requests';

const MAX_ITEMS = 50;

const stageIdsSchema = z.array(z.string().uuid()).min(1).max(MAX_ITEMS);
const requestIdsSchema = z.array(z.string().uuid()).min(1).max(MAX_ITEMS);
const caseIdsSchema = z.array(z.string().uuid()).min(1).max(MAX_ITEMS);

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('completeStages'), stageIds: stageIdsSchema }),
  z.object({
    action: z.literal('rescheduleStages'),
    stageIds: stageIdsSchema,
    date: z.string().min(8),
  }),
  z.object({ action: z.literal('closeRequests'), requestIds: requestIdsSchema }),
  z.object({
    action: z.literal('setCasePriority'),
    caseIds: caseIdsSchema,
    priority: z.enum(['baja', 'media', 'alta', 'urgente']),
  }),
  z.object({
    action: z.literal('setCaseWorkflow'),
    caseIds: caseIdsSchema,
    workflow_state: z.enum(['preparacion', 'en_revision', 'activo', 'cerrado']),
  }),
]);

type BulkResponse = {
  success: true;
  ok: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
};

async function runAll(ids: string[], fn: (id: string) => Promise<{ success: boolean; error?: string }>) {
  const results = await Promise.allSettled(ids.map((id) => fn(id)));
  const errors: BulkResponse['errors'] = [];
  let ok = 0;

  results.forEach((res, index) => {
    const id = ids[index]!;
    if (res.status === 'fulfilled') {
      if (res.value.success) ok += 1;
      else errors.push({ id, error: res.value.error ?? 'Error desconocido' });
      return;
    }
    errors.push({ id, error: res.reason instanceof Error ? res.reason.message : 'Error desconocido' });
  });

  return { ok, errors };
}

export async function POST(req: Request) {
  try {
    const profile = await requireAuth(['admin_firma', 'abogado', 'analista']);
    if (!profile) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const json = await req.json();
    const body = bodySchema.parse(json);

    if (body.action === 'completeStages') {
      const { ok, errors } = await runAll(body.stageIds, async (id) => completeStage(id));
      const payload: BulkResponse = { success: true, ok, failed: errors.length, errors };
      return NextResponse.json(payload);
    }

    if (body.action === 'rescheduleStages') {
      const { ok, errors } = await runAll(body.stageIds, async (id) =>
        updateStage(id, { fecha_programada: body.date }),
      );
      const payload: BulkResponse = { success: true, ok, failed: errors.length, errors };
      return NextResponse.json(payload);
    }

    if (body.action === 'closeRequests') {
      const { ok, errors } = await runAll(body.requestIds, async (id) => closeInfoRequest(id));
      const payload: BulkResponse = { success: true, ok, failed: errors.length, errors };
      return NextResponse.json(payload);
    }

    if (body.action === 'setCasePriority') {
      const { ok, errors } = await runAll(body.caseIds, async (id) => updateCase(id, { prioridad: body.priority }));
      const payload: BulkResponse = { success: true, ok, failed: errors.length, errors };
      return NextResponse.json(payload);
    }

    if (body.action === 'setCaseWorkflow') {
      const { ok, errors } = await runAll(body.caseIds, async (id) =>
        updateCase(id, { workflow_state: body.workflow_state }),
      );
      const payload: BulkResponse = { success: true, ok, failed: errors.length, errors };
      return NextResponse.json(payload);
    }

    return NextResponse.json({ success: false, error: 'Acción no soportada' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

