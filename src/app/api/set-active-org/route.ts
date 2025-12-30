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
    const organizationId = String(body?.organizationId ?? '').trim();
    if (!organizationId) return jsonError('organizationId requerido', 400);

    const { data: isSuper, error: superErr } = await supabase.rpc('is_super_admin');
    if (superErr) return jsonError(superErr.message ?? 'Error validando permisos', 500);

    if (!isSuper) {
      const { data: membership, error: memErr } = await supabase
        .from('org_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (memErr) return jsonError(memErr.message ?? 'Error validando membresía', 500);
      if (!membership) return jsonError('No eres miembro de esa empresa', 403);
    }

    const { error: upErr } = await supabase
      .from('profiles')
      .update({ active_organization_id: organizationId })
      .eq('user_id', authData.user.id);

    if (upErr) return jsonError(upErr.message ?? 'Error seteando empresa activa', 500);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}

