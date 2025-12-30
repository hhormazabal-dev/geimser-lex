import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

const snapshotSchema = z.object({
  subjectId: z.string().uuid(),
  source: z.string().min(1),
  summary: z.record(z.any()).default({}),
  payload: z.record(z.any()).default({}),
  error: z.string().nullable().optional(),
  fetchedAt: z.string().optional(),
});

const bodySchema = z.object({
  caseId: z.string().uuid(),
  snapshots: z.array(snapshotSchema).min(1),
});

export async function POST(req: Request) {
  try {
    const supabase = (await createServerClient()) as any;

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return jsonError('No autenticado', 401);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError('Body inválido', 400);

    const { caseId, snapshots } = parsed.data;

    const { data: hasAccess, error: accessErr } = await supabase.rpc('has_case_access', { case_uuid: caseId });
    if (accessErr) return jsonError(accessErr.message ?? 'Error validando permisos', 500);
    if (!hasAccess) return jsonError('Sin permisos', 403);

    const { data: isSuper, error: superErr } = await supabase.rpc('is_super_admin');
    if (superErr) return jsonError(superErr.message ?? 'Error validando permisos', 500);

    const { data: myProfile, error: myProfileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (myProfileErr) return jsonError(myProfileErr.message ?? 'Error leyendo perfil', 500);
    const role = String(myProfile?.role ?? 'cliente');
    if (!isSuper && !['admin_firma', 'abogado', 'analista'].includes(role)) return jsonError('Sin permisos', 403);

    const subjectIds = Array.from(new Set(snapshots.map((s) => s.subjectId)));

    const { data: links, error: linksErr } = await supabase
      .from('compliance_subject_case_links')
      .select('subject_id')
      .eq('case_id', caseId)
      .in('subject_id', subjectIds);
    if (linksErr) return jsonError(linksErr.message ?? 'Error validando sujetos', 500);

    const allowed = new Set((links ?? []).map((l: any) => String(l.subject_id)));
    const filtered = snapshots.filter((s) => allowed.has(s.subjectId));
    if (filtered.length === 0) return jsonError('No hay snapshots válidos para este caso', 400);

    const rows = filtered.map((s) => ({
      case_id: caseId,
      subject_id: s.subjectId,
      source: s.source,
      fetched_at: s.fetchedAt ?? new Date().toISOString(),
      summary: s.summary ?? {},
      payload: s.payload ?? {},
      error: s.error ?? null,
    }));

    const { error: insErr } = await supabase.from('compliance_subject_snapshots').insert(rows);
    if (insErr) return jsonError(insErr.message ?? 'Error guardando snapshots', 500);

    return NextResponse.json({ ok: true, inserted: rows.length, subjects: subjectIds.length });
  } catch (e: any) {
    console.error('[api/compliance/ingest-snapshots] error', e);
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}

