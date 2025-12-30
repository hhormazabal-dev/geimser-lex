import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeEmail(value: unknown): string | null {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return null;
  if (!s.includes('@')) return null;
  return s;
}

function resolvePassword(value: unknown): string {
  const s = String(value ?? '').trim();
  if (s) return s;
  return randomBytes(12).toString('base64url');
}

export async function POST(req: Request) {
  try {
    const supabase = (await createServerClient()) as any;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return jsonError('No autenticado', 401);

    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    const nombre = String(body?.nombre ?? '').trim();
    if (!email) return jsonError('email requerido', 400);
    if (!nombre) return jsonError('nombre requerido', 400);

    const { data: meProfile, error: meErr } = await supabase
      .from('profiles')
      .select('active_organization_id')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (meErr) return jsonError(meErr.message ?? 'Error leyendo perfil', 500);
    const orgId = meProfile?.active_organization_id as string | null;
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

    const password = resolvePassword(body?.password);

    const svc = createServiceClient() as any;

    let userId: string | null = null;
    let createdPassword: string | null = null;

    const created = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'abogado' },
      user_metadata: { nombre },
    });

    if (created.error || !created.data?.user?.id) {
      const fallback = await svc.from('profiles').select('user_id, role').eq('email', email).maybeSingle();
      const existingUserId = fallback?.data?.user_id as string | undefined;
      const existingRole = fallback?.data?.role as string | undefined;
      if (!existingUserId) {
        return jsonError(created.error?.message ?? 'No se pudo crear el abogado', 500);
      }
      if (existingRole && existingRole !== 'abogado') {
        return jsonError('El usuario ya existe pero no es abogado', 400);
      }
      userId = existingUserId;
      createdPassword = null;
    } else {
      userId = created.data.user.id;
      createdPassword = password;
    }

    await svc
      .from('profiles')
      .upsert(
        {
          id: userId,
          user_id: userId,
          email,
          nombre,
          role: 'abogado',
          activo: true,
          active_organization_id: orgId,
        },
        { onConflict: 'id' },
      );

    await svc.from('org_members').upsert(
      {
        organization_id: orgId,
        user_id: userId,
        role: 'lawyer',
      },
      { onConflict: 'organization_id,user_id' },
    );

    return NextResponse.json({
      ok: true,
      lawyer: { user_id: userId, email, nombre },
      password: createdPassword,
    });
  } catch (e: any) {
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}

