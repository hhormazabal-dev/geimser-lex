import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

type SettingsRow = {
  organization_id: string;
  case_change_emails_enabled: boolean;
  deadline_emails_enabled: boolean;
  calendar_links_enabled: boolean;
  deadline_reminder_days: number[];
  deadline_send_to_lawyer: boolean;
  deadline_send_to_staff: boolean;
  deadline_send_to_clients: boolean;
  case_change_send_to_lawyer: boolean;
  case_change_send_to_staff: boolean;
  case_change_send_to_clients: boolean;
};

function defaults(orgId: string): SettingsRow {
  return {
    organization_id: orgId,
    case_change_emails_enabled: true,
    deadline_emails_enabled: true,
    calendar_links_enabled: true,
    deadline_reminder_days: [7, 3, 1],
    deadline_send_to_lawyer: true,
    deadline_send_to_staff: false,
    deadline_send_to_clients: true,
    case_change_send_to_lawyer: true,
    case_change_send_to_staff: false,
    case_change_send_to_clients: true,
  };
}

async function requireOrgAdmin(supabase: any) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return { ok: false as const, status: 401, error: 'No autenticado' };

  const { data: meProfile, error: meErr } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (meErr) return { ok: false as const, status: 500, error: meErr.message ?? 'Error leyendo perfil' };

  const orgId = (meProfile?.active_organization_id as string | null) ?? null;
  if (!orgId) return { ok: false as const, status: 400, error: 'Debes seleccionar una empresa activa primero' };

  const { data: isSuper, error: superErr } = await supabase.rpc('is_super_admin');
  if (superErr) return { ok: false as const, status: 500, error: superErr.message ?? 'Error validando permisos' };

  if (!isSuper) {
    const { data: membership, error: memErr } = await supabase
      .from('org_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (memErr) return { ok: false as const, status: 500, error: memErr.message ?? 'Error validando membresía' };
    if (!membership || membership.role !== 'org_admin') return { ok: false as const, status: 403, error: 'Sin permisos' };
  }

  return { ok: true as const, orgId, userId: authData.user.id, email: authData.user.email ?? null };
}

function coerceBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function coerceDays(value: unknown, fallback: number[]) {
  if (!Array.isArray(value)) return fallback;
  const days = value
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && Number.isInteger(n) && n > 0 && n <= 365);
  const unique = Array.from(new Set(days)).sort((a, b) => b - a);
  return unique.length ? unique : fallback;
}

async function upsertSettings(supabase: any, orgId: string, patch: Partial<SettingsRow>) {
  const row: SettingsRow = {
    ...defaults(orgId),
    ...(patch as any),
    organization_id: orgId,
  };

  const { data, error } = await supabase
    .from('organization_notification_settings')
    .upsert(row, { onConflict: 'organization_id' })
    .select(
      'organization_id, case_change_emails_enabled, deadline_emails_enabled, calendar_links_enabled, deadline_reminder_days, deadline_send_to_lawyer, deadline_send_to_staff, deadline_send_to_clients, case_change_send_to_lawyer, case_change_send_to_staff, case_change_send_to_clients'
    )
    .single();

  if (error) throw error;
  return data as SettingsRow;
}

export async function GET() {
  try {
    const supabase = (await createServerClient()) as any;
    const auth = await requireOrgAdmin(supabase);
    if (!auth.ok) return jsonError(auth.error, auth.status);

    const { data, error } = await supabase
      .from('organization_notification_settings')
      .select(
        'organization_id, case_change_emails_enabled, deadline_emails_enabled, calendar_links_enabled, deadline_reminder_days, deadline_send_to_lawyer, deadline_send_to_staff, deadline_send_to_clients, case_change_send_to_lawyer, case_change_send_to_staff, case_change_send_to_clients'
      )
      .eq('organization_id', auth.orgId)
      .maybeSingle();
    if (error) return jsonError(error.message ?? 'Error leyendo configuración', 500);

    const settings = (data as SettingsRow | null) ?? (await upsertSettings(supabase, auth.orgId, {}));
    return NextResponse.json({ ok: true, settings });
  } catch (e: any) {
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = (await createServerClient()) as any;
    const auth = await requireOrgAdmin(supabase);
    if (!auth.ok) return jsonError(auth.error, auth.status);

    const body = (await req.json().catch(() => null)) as any;

    const patch: Partial<SettingsRow> = {
      case_change_emails_enabled: coerceBoolean(body?.case_change_emails_enabled, defaults(auth.orgId).case_change_emails_enabled),
      deadline_emails_enabled: coerceBoolean(body?.deadline_emails_enabled, defaults(auth.orgId).deadline_emails_enabled),
      calendar_links_enabled: coerceBoolean(body?.calendar_links_enabled, defaults(auth.orgId).calendar_links_enabled),
      deadline_reminder_days: coerceDays(body?.deadline_reminder_days, defaults(auth.orgId).deadline_reminder_days),
      deadline_send_to_lawyer: coerceBoolean(body?.deadline_send_to_lawyer, defaults(auth.orgId).deadline_send_to_lawyer),
      deadline_send_to_staff: coerceBoolean(body?.deadline_send_to_staff, defaults(auth.orgId).deadline_send_to_staff),
      deadline_send_to_clients: coerceBoolean(body?.deadline_send_to_clients, defaults(auth.orgId).deadline_send_to_clients),
      case_change_send_to_lawyer: coerceBoolean(body?.case_change_send_to_lawyer, defaults(auth.orgId).case_change_send_to_lawyer),
      case_change_send_to_staff: coerceBoolean(body?.case_change_send_to_staff, defaults(auth.orgId).case_change_send_to_staff),
      case_change_send_to_clients: coerceBoolean(body?.case_change_send_to_clients, defaults(auth.orgId).case_change_send_to_clients),
    };

    const settings = await upsertSettings(supabase, auth.orgId, patch);
    return NextResponse.json({ ok: true, settings });
  } catch (e: any) {
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}

