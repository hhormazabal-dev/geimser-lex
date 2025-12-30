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

    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? '').trim().toLowerCase();
    const mode = String(body?.mode ?? 'A').trim().toUpperCase();
    if (!email) return jsonError('email requerido', 400);
    if (!['A', 'B'].includes(mode)) return jsonError('mode inválido (A|B)', 400);

    const { data: meProfile, error: meErr } = await supabase
      .from('profiles')
      .select('active_organization_id')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (meErr) return jsonError(meErr.message ?? 'Error leyendo perfil', 500);
    const orgId = meProfile?.active_organization_id as string | null;
    if (!orgId) return jsonError('Debes seleccionar una empresa activa primero', 400);

    // Valida que el caller sea org_admin del org activo (o super_admin).
    const { data: isSuper, error: superErr } = await supabase.rpc('is_super_admin');
    if (superErr) return jsonError(superErr.message ?? 'Error validando permisos', 500);

    if (!isSuper) {
      const { data: membership, error: memErr } = await supabase
        .from('org_members')
        .select('id, role')
        .eq('organization_id', orgId)
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (memErr) return jsonError(memErr.message ?? 'Error validando membresía', 500);
      if (!membership || membership.role !== 'org_admin') return jsonError('Sin permisos', 403);
    }

    const { data: target, error: targetErr } = await supabase
      .from('profiles')
      .select('user_id, email, role')
      .eq('email', email)
      .maybeSingle();

    if (targetErr) return jsonError(targetErr.message ?? 'Error buscando usuario', 500);
    if (!target?.user_id) return jsonError('Usuario no encontrado (no existe profiles para ese email)', 404);

    const { data: result, error: rpcErr } = await supabase.rpc('transfer_lawyer_to_org', {
      p_user_id: target.user_id,
      p_new_org_id: orgId,
      p_mode: mode,
    });

    if (rpcErr) return jsonError(rpcErr.message ?? 'Error ejecutando transferencia', 500);

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}

