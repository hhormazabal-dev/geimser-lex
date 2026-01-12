import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth/roles';

type CaseResult = {
  id: string;
  caratulado: string;
  numero_causa: string | null;
  materia: string | null;
  prioridad: string | null;
  workflow_state: string | null;
};

type ClientResult = {
  id: string;
  nombre: string;
  email: string;
  rut: string | null;
};

const DASH_VARIANTS = /[\u2010-\u2015\u2212]/g;

function normalizeSearchTerm(value: string) {
  return value.normalize('NFKD').replace(DASH_VARIANTS, '-').trim();
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return json({ error: 'No autenticado' }, 401);

  const url = new URL(req.url);
  const rawQuery = (url.searchParams.get('q') ?? '').trim();
  const normalizedQuery = normalizeSearchTerm(rawQuery);
  const q = rawQuery;

  if (q.length < 2) {
    return json({ cases: [], clients: [] } satisfies { cases: CaseResult[]; clients: ClientResult[] });
  }

  const supabase = await createServerClient();
  const role = (profile as any)._role_override ?? profile.role;

  const MAX_CASES = 8;
  const MAX_CLIENTS = 6;

  let casesQuery = supabase
    .from('cases')
    .select('id, caratulado, numero_causa, materia, prioridad, workflow_state, updated_at')
    .order('updated_at', { ascending: false })
    .limit(MAX_CASES);

  const variants = rawQuery === normalizedQuery ? [rawQuery] : [rawQuery, normalizedQuery];
  const orFilters = variants
    .filter((term) => term.length > 0)
    .map((term) => `caratulado.ilike.%${term}%,numero_causa.ilike.%${term}%`)
    .join(',');
  casesQuery = casesQuery.or(orFilters);

  if (role === 'abogado') {
    casesQuery = casesQuery.eq('abogado_responsable', profile.id);
  } else if (role === 'analista') {
    casesQuery = casesQuery.in('workflow_state', ['preparacion', 'en_revision']);
  } else if (role === 'cliente') {
    const { data: links, error: linkError } = await supabase
      .from('case_clients')
      .select('case_id')
      .eq('client_profile_id', profile.id);
    if (linkError) return json({ error: linkError.message }, 500);
    const ids = (links ?? []).map((row) => row.case_id);
    if (ids.length === 0) {
      return json({ cases: [], clients: [] } satisfies { cases: CaseResult[]; clients: ClientResult[] });
    }
    casesQuery = casesQuery.in('id', ids);
  }

  const casesRes = await casesQuery;
  if (casesRes.error) return json({ error: casesRes.error.message }, 500);

  const cases: CaseResult[] = (casesRes.data ?? []).map((row: any) => ({
    id: row.id,
    caratulado: row.caratulado,
    numero_causa: row.numero_causa ?? null,
    materia: row.materia ?? null,
    prioridad: row.prioridad ?? null,
    workflow_state: row.workflow_state ?? null,
  }));

  let clients: ClientResult[] = [];

  if (role === 'admin_firma' || role === 'analista') {
    const clientsRes = await supabase
      .from('profiles')
      .select('id, nombre, email, rut')
      .eq('role', 'cliente')
      .or(`nombre.ilike.%${q}%,email.ilike.%${q}%,rut.ilike.%${q}%`)
      .order('nombre', { ascending: true })
      .limit(MAX_CLIENTS);

    if (clientsRes.error) return json({ error: clientsRes.error.message }, 500);

    clients = (clientsRes.data ?? []).map((row: any) => ({
      id: row.id,
      nombre: row.nombre,
      email: row.email,
      rut: row.rut ?? null,
    }));
  }

  return json({ cases, clients } satisfies { cases: CaseResult[]; clients: ClientResult[] });
}
