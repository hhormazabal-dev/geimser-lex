import { NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

type OrgRole = 'org_admin' | 'lawyer' | 'staff';

export async function POST(req: Request) {
  try {
    const supabase = (await createServerClient()) as any;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return jsonError('No autenticado', 401);

    const body = await req.json().catch(() => null);
    const userId = String(body?.userId ?? '').trim();
    const role = String(body?.role ?? '').trim() as OrgRole;
    if (!userId) return jsonError('userId requerido', 400);
    if (!(['org_admin', 'lawyer', 'staff'] as const).includes(role as any)) return jsonError('role inválido', 400);

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

    const svc = createServiceClient() as any;
    const { error: upErr } = await svc
      .from('org_members')
      .update({ role })
      .eq('organization_id', orgId)
      .eq('user_id', userId);
    if (upErr) return jsonError(upErr.message ?? 'Error actualizando rol', 500);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}

