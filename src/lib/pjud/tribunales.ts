import 'server-only';

type PjudComuna = { code: string; name: string };
type PjudTribunal = { id: string; name: string };

const REGION_CODE_BY_NAME: Record<string, string> = {
  'Tarapacá': '1',
  'Antofagasta': '2',
  'Atacama': '3',
  'Coquimbo': '4',
  'Valparaíso': '5',
  "O'Higgins": '6',
  'Maule': '7',
  'Biobío': '8',
  'La Araucanía': '9',
  'Los Lagos': '10',
  'Aysén': '11',
  'Magallanes': '12',
  'Metropolitana': '13',
  'Los Ríos': '14',
  'Arica y Parinacota': '15',
  'Ñuble': '16',
};

export const PJUD_REGION_NAMES = Object.keys(REGION_CODE_BY_NAME);

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type ComunasCacheEntry = {
  expiresAtMs: number;
  regionCode: string;
  comunas: PjudComuna[];
};

const comunasCacheByRegion = new Map<string, ComunasCacheEntry>();

export async function fetchPjudComunasByRegionName(region: string): Promise<{ regionCode: string; comunas: PjudComuna[] }> {
  const regionCode = REGION_CODE_BY_NAME[region.trim()];
  if (!regionCode) throw new Error('Región inválida o no soportada.');

  const body = new URLSearchParams({
    region_code: regionCode,
    bandera: 'TR1RA',
  });

  const upstream = await fetch('https://www.pjud.cl/ajax/Courts/getCityListByRegion', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
    },
    body,
  });

  if (!upstream.ok) throw new Error(`PJUD respondió ${upstream.status}`);

  const json = (await upstream.json().catch(() => null)) as any;
  if (!json?.status || !json?.data?.regiones_list1) throw new Error('PJUD no devolvió comunas.');

  const comunas = Object.entries(json.data.regiones_list1 as Record<string, string>)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return { regionCode, comunas };
}

export async function fetchPjudComunasByRegionNameCached(
  region: string,
  ttlMs = 1000 * 60 * 60 * 24,
): Promise<{ regionCode: string; comunas: PjudComuna[] }> {
  const key = region.trim();
  const cached = comunasCacheByRegion.get(key);
  if (cached && cached.expiresAtMs > Date.now()) {
    return { regionCode: cached.regionCode, comunas: cached.comunas };
  }

  const fresh = await fetchPjudComunasByRegionName(key);
  comunasCacheByRegion.set(key, { ...fresh, expiresAtMs: Date.now() + ttlMs });
  return fresh;
}

export async function fetchPjudTribunalesByComunaCode(comunaCode: string): Promise<PjudTribunal[]> {
  const body = new URLSearchParams({ region_code: comunaCode.trim() });

  const upstream = await fetch('https://www.pjud.cl/ajax/Courts/getCourtsListByRegion', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
    },
    body,
  });

  if (!upstream.ok) throw new Error(`PJUD respondió ${upstream.status}`);

  const json = (await upstream.json().catch(() => null)) as any;
  if (!json?.status || !json?.data?.juridicciones) throw new Error('PJUD no devolvió tribunales.');

  return Object.entries(json.data.juridicciones as Record<string, string>)
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function findComunaCodeByName(comunas: PjudComuna[], comunaName: string): string | null {
  const needle = normalizeKey(comunaName);
  if (!needle) return null;

  const exact = comunas.find((c) => normalizeKey(c.name) === needle);
  if (exact) return exact.code;

  const included = comunas.find((c) => normalizeKey(c.name).includes(needle) || needle.includes(normalizeKey(c.name)));
  return included?.code ?? null;
}

export async function resolveComunaCode(
  input: { region?: string | null; comuna: string },
): Promise<{ region: string; regionCode: string; comunaCode: string } | null> {
  const comunaName = input.comuna?.trim();
  if (!comunaName) return null;

  const regionName = input.region?.trim();
  if (regionName) {
    const { regionCode, comunas } = await fetchPjudComunasByRegionNameCached(regionName);
    const code = findComunaCodeByName(comunas, comunaName);
    return code ? { region: regionName, regionCode, comunaCode: code } : null;
  }

  for (const candidateRegion of PJUD_REGION_NAMES) {
    try {
      const { regionCode, comunas } = await fetchPjudComunasByRegionNameCached(candidateRegion);
      const code = findComunaCodeByName(comunas, comunaName);
      if (code) return { region: candidateRegion, regionCode, comunaCode: code };
    } catch {
      // ignore and try next region
    }
  }

  return null;
}

export function findTribunalByName(tribunales: PjudTribunal[], tribunalName: string): PjudTribunal | null {
  const needle = normalizeKey(tribunalName);
  if (!needle) return null;

  const exact = tribunales.find((t) => normalizeKey(t.name) === needle);
  if (exact) return exact;

  const included = tribunales.find(
    (t) => normalizeKey(t.name).includes(needle) || needle.includes(normalizeKey(t.name)),
  );
  if (included) return included;

  const stop = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'a']);
  const normalizeTokens = (value: string) =>
    normalizeKey(value)
      .split(' ')
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !stop.has(t));

  const needleTokens = new Set(normalizeTokens(needle));
  if (needleTokens.size === 0) return null;

  let best: { score: number; tribunal: PjudTribunal } | null = null;
  for (const t of tribunales) {
    const tTokens = new Set(normalizeTokens(t.name));
    if (tTokens.size === 0) continue;
    let score = 0;
    for (const tok of needleTokens) if (tTokens.has(tok)) score++;
    if (score === 0) continue;
    if (!best || score > best.score) best = { score, tribunal: t };
  }

  return best?.tribunal ?? null;
}
