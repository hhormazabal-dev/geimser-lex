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

    const { data: isSuper, error: superErr } = await supabase.rpc('is_super_admin');
    if (superErr) return jsonError(superErr.message ?? 'Error validando permisos', 500);
    if (!isSuper) return jsonError('Sin permisos', 403);

    const body = await req.json().catch(() => null);
    const organizationId = String(body?.organizationId ?? '').trim();
    const email = normalizeEmail(body?.email);
    const role = ROLE_MAP[String(body?.role ?? 'lawyer').trim().toLowerCase()] ?? 'lawyer';

    if (!organizationId) return jsonError('organizationId requerido', 400);
    if (!email) return jsonError('email requerido', 400);

    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('id, status')
      .eq('id', organizationId)
      .maybeSingle();
    if (orgErr) return jsonError(orgErr.message ?? 'Error leyendo organización', 500);
    if (!org?.id) return jsonError('Organización no encontrada', 404);

    const { data: member, error: rpcErr } = await supabase.rpc('add_org_member_by_email', {
      p_org_id: organizationId,
      p_email: email,
      p_role: role,
    });
    if (rpcErr) return jsonError(rpcErr.message ?? 'Error agregando miembro', 500);

    return NextResponse.json({ ok: true, member });
  } catch (e: any) {
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}

