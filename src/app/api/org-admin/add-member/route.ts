import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeEmail(value: unknown): string | null {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return null;
  if (!s.includes('@')) return null;
  return s;
}

const ROLE_MAP: Record<string, 'org_admin' | 'lawyer' | 'staff'> = {
  org_admin: 'org_admin',
  lawyer: 'lawyer',
  staff: 'staff',
};

export async function POST(req: Request) {
  try {
    const supabase = (await createServerClient()) as any;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return jsonError('No autenticado', 401);

    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    const role = ROLE_MAP[String(body?.role ?? 'lawyer').trim().toLowerCase()] ?? 'lawyer';
    if (!email) return jsonError('email requerido', 400);

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

    const { data: row, error: rpcErr } = await supabase.rpc('add_org_member_by_email', {
      p_org_id: orgId,
      p_email: email,
      p_role: role,
    });
    if (rpcErr) return jsonError(rpcErr.message ?? 'Error agregando miembro', 500);

    return NextResponse.json({ ok: true, member: row });
  } catch (e: any) {
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}

