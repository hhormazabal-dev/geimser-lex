import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function parseNonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n < 0 ? null : n;
}

function parseNonNegativeInt(value: unknown): number | null {
  const n = parseNonNegativeNumber(value);
  if (n === null) return null;
  return Math.trunc(n);
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

    const billing_currency = body?.billing_currency ? String(body.billing_currency).trim() : 'UF';
    if (!['UF', 'CLP', 'USD'].includes(billing_currency)) return jsonError('billing_currency inválida', 400);

    const billing_user_seats = parseNonNegativeInt(body?.billing_user_seats) ?? 0;
    const billing_price_per_user = parseNonNegativeNumber(body?.billing_price_per_user) ?? 0;
    const billing_monthly_base_fee = parseNonNegativeNumber(body?.billing_monthly_base_fee) ?? 0;
    const billing_setup_fee = parseNonNegativeNumber(body?.billing_setup_fee) ?? 0;
    const billing_notes = body?.billing_notes ? String(body.billing_notes).trim() : null;

    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name,
        status: 'active',
        is_default: false,
        billing_currency,
        billing_user_seats,
        billing_price_per_user,
        billing_monthly_base_fee,
        billing_setup_fee,
        billing_notes,
      })
      .select(
        'id, name, status, is_default, created_at, billing_currency, billing_user_seats, billing_price_per_user, billing_monthly_base_fee, billing_setup_fee, billing_notes',
      )
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
    if (body?.billing_currency !== undefined) {
      const billing_currency = String(body.billing_currency ?? '').trim();
      if (!['UF', 'CLP', 'USD'].includes(billing_currency)) return jsonError('billing_currency inválida', 400);
      patch.billing_currency = billing_currency;
    }
    if (body?.billing_user_seats !== undefined) {
      const seats = parseNonNegativeInt(body.billing_user_seats);
      if (seats === null) return jsonError('billing_user_seats inválido', 400);
      patch.billing_user_seats = seats;
    }
    if (body?.billing_price_per_user !== undefined) {
      const v = parseNonNegativeNumber(body.billing_price_per_user);
      if (v === null) return jsonError('billing_price_per_user inválido', 400);
      patch.billing_price_per_user = v;
    }
    if (body?.billing_monthly_base_fee !== undefined) {
      const v = parseNonNegativeNumber(body.billing_monthly_base_fee);
      if (v === null) return jsonError('billing_monthly_base_fee inválido', 400);
      patch.billing_monthly_base_fee = v;
    }
    if (body?.billing_setup_fee !== undefined) {
      const v = parseNonNegativeNumber(body.billing_setup_fee);
      if (v === null) return jsonError('billing_setup_fee inválido', 400);
      patch.billing_setup_fee = v;
    }
    if (body?.billing_notes !== undefined) {
      const v = body.billing_notes;
      patch.billing_notes = v === null || v === undefined ? null : String(v).trim();
    }

    if (Object.keys(patch).length === 0) return jsonError('Nada que actualizar', 400);

    const { data, error } = await supabase
      .from('organizations')
      .update(patch)
      .eq('id', id)
      .select(
        'id, name, status, is_default, created_at, billing_currency, billing_user_seats, billing_price_per_user, billing_monthly_base_fee, billing_setup_fee, billing_notes',
      )
      .single();

    if (error) return jsonError(error.message ?? 'Error actualizando organización', 500);

    return NextResponse.json({ ok: true, organization: data });
  } catch (e: any) {
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}
