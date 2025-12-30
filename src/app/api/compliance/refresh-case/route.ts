import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { ojvCausesPerLegalPerson, ojvScrapeSearchSelects, type OJVCause } from '@/lib/pjud/ojv';
import { validateRUT } from '@/lib/utils';
import { chileCompraBuscarProveedor, chileCompraEnabled } from '@/lib/chilecompra/api';

export const runtime = 'nodejs';
export const preferredRegion = ['gru1'];
export const maxDuration = 60;

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

const bodySchema = z.object({
  caseId: z.string().uuid(),
  sources: z.array(z.string().min(1)).optional(),
  pjud: z
    .object({
      baseUrl: z.string().url().optional(),
      contextSelectName: z.string().min(1),
      contextValue: z.string().min(1),
      courtSelectName: z.string().min(1).optional(),
      courtValue: z.string().min(1).optional(),
    })
    .optional(),
});

function normalizeText(v: string) {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function pickSelect(selects: any[], keywords: string[]) {
  const scored = (selects ?? [])
    .filter((s) => s?.name && Array.isArray(s.options) && s.options.length > 0)
    .map((s) => {
      const hay = normalizeText(`${s.label ?? ''} ${s.name ?? ''}`);
      const score = keywords.reduce((acc, k) => acc + (hay.includes(k) ? 1 : 0), 0);
      return { s, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].s : null;
}

function normalizeRut(raw: string): { rutNormalized: string; rutClean: string } | null {
  const rutClean = String(raw ?? '').replace(/[^0-9kK]/g, '').toUpperCase();
  if (!rutClean) return null;
  if (!validateRUT(rutClean)) return null;
  return { rutNormalized: rutClean, rutClean };
}

function summarizeCauses(causes: OJVCause[]) {
  const dates = causes
    .map((c) => (typeof c.date === 'string' ? c.date.trim() : ''))
    .filter(Boolean)
    .map((d) => {
      // OJV normaliza a YYYY-MM-DD cuando puede; si no, dejamos null
      const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? d : null;
    })
    .filter((d): d is string => Boolean(d))
    .sort()
    .reverse();

  const courts = new Set<string>();
  for (const c of causes) {
    const court = typeof c.court === 'string' ? c.court.trim() : '';
    if (court) courts.add(court);
  }

  return {
    total_causes: causes.length,
    latest_date: dates[0] ?? null,
    distinct_courts: courts.size,
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let idx = 0;
  const workers = new Array(Math.max(1, limit)).fill(null).map(async () => {
    for (;;) {
      const i = idx++;
      if (i >= items.length) break;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

type OJVConfig = {
  baseUrl: string;
  contextSelectName: string;
  contextValue: string;
  courtSelectName: string | null;
  courtValue: string | null;
};

let ojvConfigCache: { at: number; value: OJVConfig } | null = null;
const OJV_CONFIG_TTL_MS = 1000 * 60 * 60 * 6;

async function getOJVConfig(): Promise<OJVConfig> {
  const now = Date.now();
  if (ojvConfigCache && now - ojvConfigCache.at < OJV_CONFIG_TTL_MS) return ojvConfigCache.value;

  const { baseUrl, selects } = await ojvScrapeSearchSelects();
  const contextSel = pickSelect(selects, ['compet', 'competencia', 'materia', 'jurisd']) ?? selects?.[0] ?? null;
  if (!contextSel?.name) throw new Error('PJUD: no se pudo determinar el select de contexto.');
  const contextValue = contextSel.options?.find((o: any) => o?.value)?.value ?? '';
  if (!contextValue) throw new Error('PJUD: no se pudo determinar el valor de contexto por defecto.');

  const courtSel = pickSelect(selects, ['corte', 'tribunal', 'juzgado', 'court']);
  const courtValue = courtSel?.options?.find((o: any) => o?.value)?.value ?? null;

  const value: OJVConfig = {
    baseUrl,
    contextSelectName: String(contextSel.name),
    contextValue: String(contextValue),
    courtSelectName: courtSel?.name ? String(courtSel.name) : null,
    courtValue: courtValue ? String(courtValue) : null,
  };

  ojvConfigCache = { at: now, value };
  return value;
}

export async function POST(req: Request) {
  try {
    const supabase = (await createServerClient()) as any;

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return jsonError('No autenticado', 401);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError('caseId inválido', 400);

    const caseId = parsed.data.caseId;
    const requestedSources = (parsed.data.sources ?? []).map((s) => String(s).trim()).filter(Boolean);
    const pjudOverride = parsed.data.pjud ?? null;

    const { data: hasAccess, error: accessErr } = await supabase.rpc('has_case_access', { case_uuid: caseId });
    if (accessErr) return jsonError(accessErr.message ?? 'Error validando permisos', 500);
    if (!hasAccess) return jsonError('Sin permisos', 403);

    const { data: myProfile, error: myProfileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (myProfileErr) return jsonError(myProfileErr.message ?? 'Error leyendo perfil', 500);

    const { data: isSuper, error: superErr } = await supabase.rpc('is_super_admin');
    if (superErr) return jsonError(superErr.message ?? 'Error validando permisos', 500);

    const role = String(myProfile?.role ?? 'cliente');
    if (!isSuper && !['admin_firma', 'abogado', 'analista'].includes(role)) {
      return jsonError('Sin permisos', 403);
    }

    const { data: caseRow, error: caseErr } = await supabase
      .from('cases')
      .select('id, organization_id, nombre_cliente, rut_cliente')
      .eq('id', caseId)
      .single();
    if (caseErr || !caseRow) return jsonError('Caso no encontrado', 404);
    if (!caseRow.organization_id) return jsonError('Caso sin organization_id (migración pendiente)', 400);

    const [clientsRes, counterpartiesRes] = await Promise.all([
      supabase
        .from('case_clients')
        .select('is_primary, client:profiles!case_clients_client_profile_id_fkey(id, nombre, rut)')
        .eq('case_id', caseId),
      supabase.from('case_counterparties').select('nombre, rut, tipo').eq('case_id', caseId),
    ]);

    if (clientsRes.error) return jsonError(clientsRes.error.message ?? 'Error leyendo clientes', 500);
    if (counterpartiesRes.error) return jsonError(counterpartiesRes.error.message ?? 'Error leyendo contrapartes', 500);

    const candidates: Array<{
      rut: string;
      rut_normalized: string;
      display_name: string;
      kind: 'client' | 'counterparty' | 'other';
      role: string | null;
    }> = [];

    // Cliente desde fields legacy (si es válido)
    if (caseRow.rut_cliente && validateRUT(caseRow.rut_cliente)) {
      const norm = normalizeRut(caseRow.rut_cliente);
      if (norm) {
        candidates.push({
          rut: caseRow.rut_cliente,
          rut_normalized: norm.rutNormalized,
          display_name: String(caseRow.nombre_cliente ?? 'Cliente'),
          kind: 'client',
          role: 'client_legacy',
        });
      }
    }

    for (const row of (clientsRes.data ?? []) as any[]) {
      const client = row.client;
      const rut = String(client?.rut ?? '').trim();
      const norm = rut ? normalizeRut(rut) : null;
      if (!norm) continue;
      candidates.push({
        rut,
        rut_normalized: norm.rutNormalized,
        display_name: String(client?.nombre ?? 'Cliente'),
        kind: 'client',
        role: row.is_primary ? 'primary_client' : 'client',
      });
    }

    for (const row of (counterpartiesRes.data ?? []) as any[]) {
      const rut = String(row?.rut ?? '').trim();
      const norm = rut ? normalizeRut(rut) : null;
      if (!norm) continue;
      candidates.push({
        rut,
        rut_normalized: norm.rutNormalized,
        display_name: String(row?.nombre ?? 'Contraparte'),
        kind: 'counterparty',
        role: String(row?.tipo ?? '').trim() || null,
      });
    }

    const dedup = new Map<string, (typeof candidates)[number]>();
    for (const c of candidates) {
      if (!dedup.has(c.rut_normalized)) dedup.set(c.rut_normalized, c);
    }
    const uniqueCandidates = Array.from(dedup.values());

    const MAX_RUTS = 12;
    const truncated = uniqueCandidates.length > MAX_RUTS;
    const selected = truncated ? uniqueCandidates.slice(0, MAX_RUTS) : uniqueCandidates;

    if (selected.length === 0) {
      return NextResponse.json({ ok: true, refreshed: 0, subjects: 0, message: 'No hay RUTs válidos en este caso.' });
    }

    const { data: upsertedSubjects, error: upsertErr } = await supabase
      .from('compliance_subjects')
      .upsert(
        selected.map((s) => ({
          organization_id: caseRow.organization_id,
          rut: s.rut,
          rut_normalized: s.rut_normalized,
          display_name: s.display_name,
          kind: s.kind,
        })),
        { onConflict: 'organization_id,rut_normalized' },
      )
      .select('id, rut, rut_normalized, display_name, kind');

    if (upsertErr) return jsonError(upsertErr.message ?? 'Error guardando sujetos', 500);

    const subjectByRut = new Map<string, any>();
    for (const s of (upsertedSubjects ?? []) as any[]) subjectByRut.set(String(s.rut_normalized), s);

    const linksPayload = selected
      .map((c) => {
        const subj = subjectByRut.get(c.rut_normalized);
        if (!subj?.id) return null;
        return { case_id: caseId, subject_id: subj.id, role: c.role };
      })
      .filter(Boolean);

    if (linksPayload.length > 0) {
      const { error: linkErr } = await supabase
        .from('compliance_subject_case_links')
        .upsert(linksPayload, { onConflict: 'case_id,subject_id' });
      if (linkErr) return jsonError(linkErr.message ?? 'Error guardando vínculos', 500);
    }

    const enabledSources = new Set<string>();
    enabledSources.add('pjud_ojv');
    if (chileCompraEnabled()) enabledSources.add('chilecompra_supplier');

    const sourcesToRun =
      requestedSources.length > 0
        ? requestedSources.filter((s) => enabledSources.has(s))
        : Array.from(enabledSources);

    if (sourcesToRun.length === 0) {
      return NextResponse.json({
        ok: true,
        subjects: (upsertedSubjects ?? []).length,
        refreshed: 0,
        errors: 0,
        truncated,
        sources: [],
        message: 'No hay fuentes habilitadas para ejecutar (revisa configuración/credenciales).',
      });
    }

    const snapshotsToInsert: any[] = [];

    // Fuente: ChileCompra (supplier lookup). Rápida, por RUT.
    if (sourcesToRun.includes('chilecompra_supplier')) {
      const targets = (upsertedSubjects ?? []) as any[];
      const ccResults = await mapLimit(
        targets,
        6,
        async (subject) => {
          const rut = String(subject.rut ?? '').trim();
          try {
            const r = await chileCompraBuscarProveedor(rut);
            const supplier = r.suppliers[0] ?? null;
            const summary = {
              supplier_found: Boolean(supplier),
              supplier_count: r.suppliers.length,
              codigo_empresa: supplier?.codigoEmpresa ?? null,
            };

            return {
              ok: true,
              snapshot: {
                case_id: caseId,
                subject_id: subject.id,
                source: 'chilecompra_supplier',
                summary,
                payload: {
                  fetchedAt: r.fetchedAt,
                  suppliers: r.suppliers,
                },
                error: null,
              },
            };
          } catch (e: any) {
            const msg = e?.message ?? 'Error consultando ChileCompra.';
            return {
              ok: false,
              snapshot: {
                case_id: caseId,
                subject_id: subject.id,
                source: 'chilecompra_supplier',
                summary: { supplier_found: false, supplier_count: 0, codigo_empresa: null },
                payload: { rut, error: msg },
                error: msg,
              },
            };
          }
        },
      );
      snapshotsToInsert.push(...ccResults.map((r: any) => r.snapshot));
    }

    let ojvConfig: OJVConfig | null = null;
    if (sourcesToRun.includes('pjud_ojv')) {
      try {
        if (pjudOverride) {
          ojvConfig = {
            baseUrl: pjudOverride.baseUrl ?? (await getOJVConfig()).baseUrl,
            contextSelectName: pjudOverride.contextSelectName,
            contextValue: pjudOverride.contextValue,
            courtSelectName: pjudOverride.courtSelectName ?? null,
            courtValue: pjudOverride.courtValue ?? null,
          };
        } else {
          // Env override (opcional) -> si no hay, scrapea selects.
          const envContextSelectName = process.env.PJUD_OJV_CONTEXT_SELECT_NAME?.trim() || '';
          const envContextValue = process.env.PJUD_OJV_CONTEXT_VALUE?.trim() || '';
          const envCourtSelectName = process.env.PJUD_OJV_COURT_SELECT_NAME?.trim() || '';
          const envCourtValue = process.env.PJUD_OJV_COURT_VALUE?.trim() || '';

          if (envContextSelectName && envContextValue) {
            const base = await getOJVConfig();
            ojvConfig = {
              baseUrl: base.baseUrl,
              contextSelectName: envContextSelectName,
              contextValue: envContextValue,
              courtSelectName: envCourtSelectName || null,
              courtValue: envCourtValue || null,
            };
          } else {
            ojvConfig = await getOJVConfig();
          }
        }
      } catch (e: any) {
        // Guardamos snapshots de error (para que el usuario vea el motivo)
        const errMsg = e?.message ?? 'Error obteniendo configuración PJUD.';
        const snapshotsError = (upsertedSubjects ?? []).map((s: any) => ({
          case_id: caseId,
          subject_id: s.id,
          source: 'pjud_ojv',
          summary: { total_causes: 0, latest_date: null, distinct_courts: 0 },
          payload: { config_error: errMsg },
          error: errMsg,
        }));

        const { error: snapErr } = await supabase
          .from('compliance_subject_snapshots')
          .insert([...snapshotsToInsert, ...snapshotsError]);
        if (snapErr) return jsonError(snapErr.message ?? 'Error guardando snapshots', 500);

        return NextResponse.json({
          ok: true,
          refreshed: 0,
          subjects: (upsertedSubjects ?? []).length,
          truncated,
          pj_config_ok: false,
          sources: sourcesToRun,
          error: errMsg,
        });
      }
    }

    const targets = (upsertedSubjects ?? []) as any[];

    const results = sourcesToRun.includes('pjud_ojv')
      ? await mapLimit(targets, 3, async (subject) => {
          const rut = String(subject.rut ?? '').trim();
          try {
            const causes = await ojvCausesPerLegalPerson({
              rut,
              contextValue: ojvConfig!.contextValue,
              ...(ojvConfig!.contextSelectName ? { contextSelectName: ojvConfig!.contextSelectName } : {}),
              ...(ojvConfig!.courtSelectName ? { courtSelectName: ojvConfig!.courtSelectName } : {}),
              ...(ojvConfig!.courtValue ? { courtValue: ojvConfig!.courtValue } : {}),
              detail: false,
            });

            const summary = summarizeCauses(causes);
            return {
              ok: true,
              subject_id: subject.id,
              snapshot: {
                case_id: caseId,
                subject_id: subject.id,
                source: 'pjud_ojv',
                summary,
                payload: {
                  config: ojvConfig,
                  causes: causes.slice(0, 200),
                },
                error: null,
              },
            };
          } catch (e: any) {
            const msg = e?.message ?? 'Error consultando PJUD.';
            return {
              ok: false,
              subject_id: subject.id,
              snapshot: {
                case_id: caseId,
                subject_id: subject.id,
                source: 'pjud_ojv',
                summary: { total_causes: 0, latest_date: null, distinct_courts: 0 },
                payload: { config: ojvConfig, rut, error: msg },
                error: msg,
              },
            };
          }
        })
      : [];

    const snapshots = [...snapshotsToInsert, ...results.map((r: any) => r.snapshot)];
    if (snapshots.length === 0) {
      return NextResponse.json({
        ok: true,
        subjects: targets.length,
        refreshed: 0,
        errors: 0,
        truncated,
        sources: sourcesToRun,
        message: 'No se generaron snapshots (sin fuentes o sin datos).',
      });
    }
    const { error: snapErr } = await supabase.from('compliance_subject_snapshots').insert(snapshots);
    if (snapErr) return jsonError(snapErr.message ?? 'Error guardando snapshots', 500);

    const refreshed = results.filter((r: any) => r.ok).length;
    const errors = results.length - refreshed;

    return NextResponse.json({
      ok: true,
      subjects: targets.length,
      refreshed,
      errors,
      truncated,
      pj_config_ok: sourcesToRun.includes('pjud_ojv') ? true : null,
      sources: sourcesToRun,
      ...(ojvConfig
        ? {
            config: {
              contextSelectName: ojvConfig.contextSelectName,
              contextValue: ojvConfig.contextValue,
              courtSelectName: ojvConfig.courtSelectName,
              courtValue: ojvConfig.courtValue,
            },
          }
        : {}),
    });
  } catch (e: any) {
    console.error('[api/compliance/refresh-case] error', e);
    return jsonError(e?.message ?? 'Error interno', 500);
  }
}
