import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const supabase = (await createServerClient()) as any;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return jsonError('No autenticado', 401);

    const { data: isSuper, error: superErr } = await supabase.rpc('is_super_admin');
    if (superErr) return jsonError(superErr.message ?? 'Error validando permisos', 500);
    if (!isSuper) return jsonError('Sin permisos', 403);

    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? '').trim().toLowerCase();
    const organizationId = String(body?.organizationId ?? '').trim();
    const mode = String(body?.mode ?? 'A').trim().toUpperCase();

    if (!email) return jsonError('email requerido', 400);
    if (!organizationId) return jsonError('organizationId requerido', 400);
    if (!['A', 'B'].includes(mode)) return jsonError('mode inválido (A|B)', 400);

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, user_id, email, role')
      .eq('email', email)
      .maybeSingle();

    if (profileErr) return jsonError(profileErr.message ?? 'Error buscando usuario', 500);
    if (!profile?.user_id) return jsonError('Usuario no encontrado (no existe profiles para ese email)', 404);

    const { data: result, error: rpcErr } = await supabase.rpc('transfer_lawyer_to_org', {
      p_user_id: profile.user_id,
      p_new_org_id: organizationId,
      p_mode: mode,
    });

    if (rpcErr) return jsonError(rpcErr.message ?? 'Error ejecutando transferencia', 500);

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}

