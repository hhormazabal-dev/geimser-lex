import 'server-only';

const CKAN_BASE_URL = 'https://datos.gob.cl/api/3/action';

function normalizeText(v: unknown): string {
  return String(v ?? '').trim();
}

export type CkanResourceSummary = {
  id: string;
  name: string | null;
  format: string | null;
  url: string | null;
  datastore_active: boolean;
  last_modified: string | null;
};

export type CkanPackageSummary = {
  name: string;
  title: string | null;
  notes: string | null;
  organization: { title: string | null; name: string | null } | null;
  metadata_modified: string | null;
  resources: CkanResourceSummary[];
};

export async function ckanPackageSearch(input: { q: string; rows?: number; start?: number }) {
  const q = normalizeText(input.q);
  const rows = Math.min(Math.max(Number(input.rows ?? 10), 1), 50);
  const start = Math.max(Number(input.start ?? 0), 0);

  const url = new URL(`${CKAN_BASE_URL}/package_search`);
  url.searchParams.set('q', q);
  url.searchParams.set('rows', String(rows));
  url.searchParams.set('start', String(start));

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { accept: 'application/json' },
    next: { revalidate: 60 * 60 * 6 },
  });
  if (!res.ok) throw new Error(`datos.gob.cl respondió ${res.status}`);

  const json = (await res.json().catch(() => null)) as any;
  if (!json?.success) throw new Error('datos.gob.cl: respuesta inválida.');

  const out: CkanPackageSummary[] = (json.result?.results ?? []).map((p: any) => ({
    name: normalizeText(p?.name),
    title: p?.title ? normalizeText(p.title) : null,
    notes: p?.notes ? normalizeText(p.notes) : null,
    organization: p?.organization
      ? { title: p.organization.title ? normalizeText(p.organization.title) : null, name: normalizeText(p.organization.name) }
      : null,
    metadata_modified: p?.metadata_modified ? normalizeText(p.metadata_modified) : null,
    resources: Array.isArray(p?.resources)
      ? p.resources.map((r: any) => ({
          id: normalizeText(r?.id),
          name: r?.name ? normalizeText(r.name) : null,
          format: r?.format ? normalizeText(r.format) : null,
          url: r?.url ? normalizeText(r.url) : null,
          datastore_active: Boolean(r?.datastore_active),
          last_modified: r?.last_modified ? normalizeText(r.last_modified) : null,
        }))
      : [],
  }));

  return {
    count: Number(json.result?.count ?? out.length),
    start,
    rows,
    results: out.filter((p) => p.name),
  };
}

