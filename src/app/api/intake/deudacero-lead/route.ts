import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { DEUDA_CERO_ORG_ALIASES, normalizeDeudaCeroLeadSource } from '@/lib/leads/org';
import { detectLeadOrigin } from '@/lib/leads/origin';

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function readAuthToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

function pickString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

async function ensureOrganizationId(supabase: any) {
  const orgFilters = DEUDA_CERO_ORG_ALIASES.map((name) => `name.ilike.${name}`).join(',');
  const { data: orgRow, error: orgErr } = await supabase
    .from('organizations')
    .select('id')
    .or(orgFilters)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgErr) throw orgErr;
  if (orgRow?.id) return orgRow.id;

  const { data: created, error: createErr } = await supabase
    .from('organizations')
    .insert({ name: DEUDA_CERO_ORG_ALIASES[1] ?? 'Deudas Cero', status: 'active', is_default: false })
    .select('id')
    .single();

  if (createErr) throw createErr;
  return created.id;
}

export async function POST(req: NextRequest) {
  const expectedToken = process.env.XEL_INTAKE_TOKEN?.trim() || '';
  if (!expectedToken) {
    return NextResponse.json({ ok: false, error: 'Server misconfigured' }, { status: 500 });
  }

  const authToken = readAuthToken(req);
  if (!authToken || !safeEqual(authToken, expectedToken)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const fullName =
    pickString(payload, ['nombre_completo', 'nombreCompleto', 'full_name', 'fullName', 'nombre']) ?? '';
  const email = pickString(payload, ['email', 'correo', 'correo_electronico']) ?? '';
  const phone = pickString(payload, ['telefono', 'telefono_contacto', 'phone', 'tel']);
  const rut = pickString(payload, ['rut', 'rut_cliente']);
  const message = pickString(payload, ['mensaje', 'message', 'comentarios', 'comment']);
  const leadType = pickString(payload, ['tipo_lead', 'tipoLead', 'lead_type', 'type']);
  const leadSource = normalizeDeudaCeroLeadSource(
    pickString(payload, ['source', 'lead_source', 'leadSource', 'origen', 'origin']),
  );
  const leadOrigin = detectLeadOrigin(payload);

  if (!fullName || !email) {
    return NextResponse.json({ ok: false, error: 'nombre y email requeridos' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient() as any;
    const organizationId = await ensureOrganizationId(supabase);

    const { data: leadRow, error: leadErr } = await supabase
      .from('leads')
      .insert({
        organization_id: organizationId,
        full_name: fullName,
        email,
        phone: phone ?? null,
        rut: rut ?? null,
        message: message ?? null,
        lead_type: leadType ?? null,
        status: 'new',
        source: leadSource,
        origin: leadOrigin,
        convertible_to_case: true,
        raw_payload: payload,
      })
      .select('id')
      .single();

    if (leadErr) {
      return NextResponse.json({ ok: false, error: leadErr.message ?? 'Insert failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, lead_id: leadRow.id });
  } catch (error) {
    console.error('deudacero lead intake error', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
