import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { ckanPackageSearch } from '@/lib/datosgob/ckan';

export const runtime = 'nodejs';
export const maxDuration = 30;

const querySchema = z.object({
  q: z.string().min(1),
  rows: z.coerce.number().int().min(1).max(50).optional(),
  start: z.coerce.number().int().min(0).optional(),
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: Request) {
  try {
    const supabase = (await createServerClient()) as any;
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return jsonError('No autenticado', 401);

    const { data: isSuper } = await supabase.rpc('is_super_admin');
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
    const role = String(profile?.role ?? 'cliente');
    if (!isSuper && !['admin_firma', 'abogado', 'analista'].includes(role)) return jsonError('Sin permisos', 403);

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      q: searchParams.get('q') ?? '',
      rows: searchParams.get('rows') ?? undefined,
      start: searchParams.get('start') ?? undefined,
    });
    if (!parsed.success) return jsonError('Query inválida', 400);

    const data = await ckanPackageSearch({
      q: parsed.data.q,
      ...(parsed.data.rows !== undefined ? { rows: parsed.data.rows } : {}),
      ...(parsed.data.start !== undefined ? { start: parsed.data.start } : {}),
    });
    return NextResponse.json({ ok: true, ...data });
  } catch (e: any) {
    console.error('[api/compliance/datosgob/search] error', e);
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}
