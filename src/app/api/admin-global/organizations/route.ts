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
    const name = String(body?.name ?? '').trim();
    if (!name) return jsonError('name requerido', 400);

    const { data, error } = await supabase
      .from('organizations')
      .insert({ name, status: 'active', is_default: false })
      .select('id, name, status, is_default, created_at')
      .single();

    if (error) return jsonError(error.message ?? 'Error creando organización', 500);

    return NextResponse.json({ ok: true, organization: data });
  } catch (e: any) {
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = (await createServerClient()) as any;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return jsonError('No autenticado', 401);

    const { data: isSuper, error: superErr } = await supabase.rpc('is_super_admin');
    if (superErr) return jsonError(superErr.message ?? 'Error validando permisos', 500);
    if (!isSuper) return jsonError('Sin permisos', 403);

    const body = await req.json().catch(() => null);
    const id = String(body?.id ?? '').trim();
    if (!id) return jsonError('id requerido', 400);

    const patch: Record<string, any> = {};
    if (body?.name !== undefined) {
      const name = String(body.name ?? '').trim();
      if (!name) return jsonError('name inválido', 400);
      patch.name = name;
    }
    if (body?.status !== undefined) {
      const status = String(body.status ?? '').trim();
      if (!['active', 'inactive'].includes(status)) return jsonError('status inválido', 400);
      patch.status = status;
    }

    if (Object.keys(patch).length === 0) return jsonError('Nada que actualizar', 400);

    const { data, error } = await supabase
      .from('organizations')
      .update(patch)
      .eq('id', id)
      .select('id, name, status, is_default, created_at')
      .single();

    if (error) return jsonError(error.message ?? 'Error actualizando organización', 500);

    return NextResponse.json({ ok: true, organization: data });
  } catch (e: any) {
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}

