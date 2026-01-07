import { NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const supabase = (await createServerClient()) as any;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return jsonError('No autenticado', 401);

    const body = await req.json().catch(() => null);
    const userId = String(body?.userId ?? '').trim();
    if (!userId) return jsonError('userId requerido', 400);

    const { data: meProfile, error: meErr } = await supabase
      .from('profiles')
      .select('active_organization_id')
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (meErr) return jsonError(meErr.message ?? 'Error leyendo perfil', 500);

    const orgId = (meProfile?.active_organization_id as string | null) ?? null;
    if (!orgId) return jsonError('Debes seleccionar una empresa activa primero', 400);

    const { data: isSuper, error: superErr } = await supabase.rpc('is_super_admin');
    if (superErr) return jsonError(superErr.message ?? 'Error validando permisos', 500);

    if (!isSuper) {
      const { data: membership, error: memErr } = await supabase
        .from('org_members')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', authData.user.id)
        .maybeSingle();
      if (memErr) return jsonError(memErr.message ?? 'Error validando membresía', 500);
      if (!membership || membership.role !== 'org_admin') return jsonError('Sin permisos', 403);
    }

    if (userId === authData.user.id) return jsonError('No puedes removerte a ti mismo', 400);

    const svc = createServiceClient() as any;
    const { error: delErr } = await svc.from('org_members').delete().eq('organization_id', orgId).eq('user_id', userId);
    if (delErr) return jsonError(delErr.message ?? 'Error removiendo miembro', 500);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}

