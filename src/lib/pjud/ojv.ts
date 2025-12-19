import 'server-only';

import * as cheerio from 'cheerio';
import { validateRUT } from '@/lib/utils';

type AnyNode = any;

export const OJV_BASE_URL =
  process.env.PJUD_OJV_BASE_URL?.trim() || 'https://oficinajudicialvirtual.pjud.cl/indexN.php';

const OJV_TIMEOUT_MS = Number(process.env.PJUD_OJV_TIMEOUT_MS ?? 25_000);

export type OJVCausesPerLegalPersonInput = {
  rut: string;
  contextValue: string;
  courtValue?: string | null;
  contextSelectName?: string;
  courtSelectName?: string;
  detail?: boolean;
  baseUrl?: string;
};

export type OJVLitigant = {
  entity?: string | null;
  incarcerationStatus?: string | null;
  name?: string | null;
  participant?: string | null;
  rut?: string | null;
  subject?: string | null;
  type?: string | null;
};

export type OJVCause = {
  administrativeStatus?: string | null;
  causeState?: string | null;
  court?: string | null;
  date?: string | null;
  labeled?: string | null;
  litigants?: OJVLitigant[];
  procedure?: string | null;
  resource?: string | null;
  role?: string | null;
  ruc?: string | null;
  ubication?: string | null;
  sourceUrl?: string | null;
};

type CookieJar = Map<string, string>;

function parseSetCookies(setCookies: string[] | undefined): Array<{ name: string; value: string }> {
  if (!setCookies || setCookies.length === 0) return [];
  const out: Array<{ name: string; value: string }> = [];
  for (const c of setCookies) {
    const firstPart = c.split(';', 1)[0] ?? '';
    const idx = firstPart.indexOf('=');
    if (idx <= 0) continue;
    const name = firstPart.slice(0, idx).trim();
    const value = firstPart.slice(idx + 1).trim();
    if (!name) continue;
    out.push({ name, value });
  }
  return out;
}

function jarToCookieHeader(jar: CookieJar): string {
  const parts: string[] = [];
  for (const [name, value] of jar.entries()) parts.push(`${name}=${value}`);
  return parts.join('; ');
}

function normalizeSpace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function normalizeRut(raw: string): { body: string; dv: string; formatted: string } {
  const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 8) throw new Error('RUT inválido.');
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formatted = `${body}-${dv}`;
  return { body, dv, formatted };
}

function tryParseDateToIso(raw: string): string | null {
  const s = normalizeSpace(raw);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return null;
  const dd = m[1]!.padStart(2, '0');
  const mm = m[2]!.padStart(2, '0');
  const yyyy = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  return `${yyyy}-${mm}-${dd}`;
}

function pickBestTable($: cheerio.CheerioAPI): cheerio.Cheerio<AnyNode> | null {
  const tables = $('table').toArray() as AnyNode[];
  if (tables.length === 0) return null;

  const keywords = [
    'rol',
    'rit',
    'ruc',
    'tribunal',
    'caratul',
    'carátul',
    'estado',
    'fecha',
    'materia',
    'proced',
  ];

  let best: { score: number; el: AnyNode } | null = null;
  for (const el of tables) {
    const headers = $(el)
      .find('th')
      .toArray()
      .map((th) => normalizeSpace($(th).text()).toLowerCase());
    if (headers.length === 0) continue;
    const score = keywords.reduce(
      (acc, k) => acc + (headers.some((h) => h.includes(k)) ? 1 : 0),
      0,
    );
    if (!best || score > best.score) best = { score, el };
  }

  if (!best || best.score === 0) return null;
  return $(best.el as any);
}

function tableToObjects(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<AnyNode>,
): Array<Record<string, string>> {
  const headers = table
    .find('tr')
    .first()
    .find('th,td')
    .toArray()
    .map((cell) => normalizeSpace($(cell).text()));

  const rows = table.find('tr').slice(1).toArray();
  return rows
    .map((tr) => {
      const cells = $(tr)
        .find('td')
        .toArray()
        .map((td) => normalizeSpace($(td).text()));
      if (cells.length === 0) return null;
      const obj: Record<string, string> = {};
      for (let i = 0; i < Math.max(headers.length, cells.length); i++) {
        const key = headers[i] ? headers[i]! : `col_${i + 1}`;
        obj[key] = cells[i] ?? '';
      }
      return obj;
    })
    .filter((x): x is Record<string, string> => Boolean(x));
}

function findFirstLinkHref($: cheerio.CheerioAPI, table: cheerio.Cheerio<AnyNode>, rowIndex: number): string | null {
  const tr = table.find('tr').slice(1).eq(rowIndex);
  const href = tr.find('a[href]').first().attr('href');
  return href ? href.trim() : null;
}

function resolveUrl(base: string, maybeRelative: string): string {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

function classifyValueType(values: string[]): 'numeric-string' | 'string' | 'mixed' {
  const nonEmpty = values.map((v) => v.trim()).filter((v) => v.length > 0);
  if (nonEmpty.length === 0) return 'string';
  const numeric = nonEmpty.filter((v) => /^\d+$/.test(v)).length;
  if (numeric === nonEmpty.length) return 'numeric-string';
  if (numeric === 0) return 'string';
  return 'mixed';
}

function getFormFields(
  $: cheerio.CheerioAPI,
  form: cheerio.Cheerio<AnyNode>,
): {
  actionUrl: string;
  method: string;
  fields: URLSearchParams;
  selects: Array<{ name: string; options: string[] }>;
} {
  const action = form.attr('action')?.trim() || '';
  const method = (form.attr('method')?.trim() || 'GET').toUpperCase();

  const fields = new URLSearchParams();

  form.find('input[name]').each((_, el) => {
    const input = $(el);
    const name = input.attr('name')?.trim();
    if (!name) return;
    const type = (input.attr('type') ?? 'text').toLowerCase();
    if (type === 'checkbox' || type === 'radio') {
      const checked = input.is(':checked');
      if (!checked) return;
      const v = input.attr('value') ?? 'on';
      fields.append(name, v);
      return;
    }
    const v = input.attr('value') ?? '';
    fields.set(name, v);
  });

  const selects: Array<{ name: string; options: string[] }> = [];
  form.find('select[name]').each((_, el) => {
    const sel = $(el);
    const name = sel.attr('name')?.trim();
    if (!name) return;
    const options = sel
      .find('option')
      .toArray()
      .map((o) => ($(o).attr('value') ?? '').trim());
    selects.push({ name, options });

    const selected = sel.find('option[selected]').attr('value');
    const first = sel.find('option').first().attr('value');
    fields.set(name, (selected ?? first ?? '').trim());
  });

  form.find('textarea[name]').each((_, el) => {
    const ta = $(el);
    const name = ta.attr('name')?.trim();
    if (!name) return;
    fields.set(name, (ta.text() ?? '').trim());
  });

  return { actionUrl: action, method, fields, selects };
}

function findSelectByOptionValue(selects: Array<{ name: string; options: string[] }>, value: string): string | null {
  const matches = selects.filter((s) => s.options.includes(value));
  if (matches.length === 1) return matches[0]!.name;
  return null;
}

function findRutFieldNames(fieldNames: string[]) {
  const lower = fieldNames.map((n) => ({ n, l: n.toLowerCase() }));
  const rutCandidates = lower.filter((x) => x.l.includes('rut'));
  const dvCandidates = lower.filter(
    (x) =>
      x.l.includes('dv') ||
      x.l.includes('dig') ||
      x.l.includes('verif') ||
      x.l.includes('verificador'),
  );

  // Caso 1: un solo input rut (rut completo)
  if (rutCandidates.length === 1 && dvCandidates.length === 0) {
    return { rut: rutCandidates[0]!.n, dv: null as string | null };
  }

  // Caso 2: rut + dv separados
  const rutBody = rutCandidates.find((x) => x.l.includes('rut') && !x.l.includes('dv')) ?? rutCandidates[0];
  const dv = dvCandidates[0];
  if (rutBody?.n && dv?.n) return { rut: rutBody.n, dv: dv.n };

  // Caso 3: fallback: cualquier input con rut
  if (rutCandidates.length > 0) return { rut: rutCandidates[0]!.n, dv: null as string | null };
  return { rut: null as string | null, dv: null as string | null };
}

async function fetchWithJar(
  jar: CookieJar,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OJV_TIMEOUT_MS);

  const headers = new Headers(init?.headers ?? {});
  const cookieHeader = jarToCookieHeader(jar);
  if (cookieHeader) headers.set('cookie', cookieHeader);
  headers.set('user-agent', headers.get('user-agent') ?? 'Mozilla/5.0 (compatible; GeimserLexBot/1.0)');
  let resp: Response;
  try {
    resp = await fetch(url, { ...init, headers, redirect: 'follow', signal: controller.signal });
  } catch (e: any) {
    const msg = e?.name === 'AbortError'
      ? `PJUD: timeout conectando a OJV (${OJV_TIMEOUT_MS}ms).`
      : `PJUD: no se pudo conectar a OJV (${e?.message ?? 'fetch failed'}).`;
    throw new Error(msg);
  } finally {
    clearTimeout(timeout);
  }

  const setCookies = (resp.headers as any).getSetCookie?.() as string[] | undefined;
  for (const { name, value } of parseSetCookies(setCookies)) jar.set(name, value);
  return resp;
}

export async function ojvCausesPerLegalPerson(input: OJVCausesPerLegalPersonInput): Promise<OJVCause[]> {
  const { rut, contextValue, courtValue, detail = false, contextSelectName, courtSelectName } = input;
  if (!validateRUT(rut)) throw new Error('RUT inválido.');

  const jar: CookieJar = new Map();
  const baseUrl = input.baseUrl?.trim() || OJV_BASE_URL;

  const landing = await fetchWithJar(jar, baseUrl, { method: 'GET' });
  const landingHtml = await landing.text();
  const $landing = cheerio.load(landingHtml);

  const forms = $landing('form').toArray();
  if (forms.length === 0) throw new Error('PJUD: no se encontró formulario de búsqueda.');

  // Elegimos el form con más selects/inputs.
  let bestForm: AnyNode = forms[0]! as any;
  let bestScore = -1;
  for (const f of forms) {
    const form = $landing(f);
    const score =
      form.find('select').length * 3 +
      form.find('input').length * 2 +
      (form.text().toLowerCase().includes('rut') ? 10 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestForm = f;
    }
  }

  const form = $landing(bestForm);
  const { actionUrl, method, fields, selects } = getFormFields($landing, form);

  const availableSelectNames = new Set(selects.map((s) => s.name));

  const resolvedContextSelectName = contextSelectName?.trim()
    ? contextSelectName.trim()
    : findSelectByOptionValue(selects, contextValue);
  if (!resolvedContextSelectName) {
    throw new Error('PJUD: no se pudo identificar el select de competencia/contexto para el value entregado.');
  }
  if (!availableSelectNames.has(resolvedContextSelectName)) {
    throw new Error('PJUD: ContextSelect no existe en el formulario.');
  }
  fields.set(resolvedContextSelectName, contextValue);

  if (courtValue) {
    const resolvedCourtSelectName = courtSelectName?.trim()
      ? courtSelectName.trim()
      : findSelectByOptionValue(selects, courtValue);
    if (!resolvedCourtSelectName) {
      throw new Error('PJUD: no se pudo identificar el select de corte/tribunal para el value entregado.');
    }
    if (!availableSelectNames.has(resolvedCourtSelectName)) {
      throw new Error('PJUD: CourtSelect no existe en el formulario.');
    }
    fields.set(resolvedCourtSelectName, courtValue);
  }

  const fieldNames = Array.from(fields.keys());
  const { rut: rutField, dv: dvField } = findRutFieldNames(fieldNames);
  if (!rutField) {
    throw new Error('PJUD: no se encontró campo de RUT en el formulario.');
  }
  const parsedRut = normalizeRut(rut);
  if (dvField) {
    fields.set(rutField, parsedRut.body);
    fields.set(dvField, parsedRut.dv);
  } else {
    fields.set(rutField, parsedRut.formatted);
  }

  const submitUrl = resolveUrl(baseUrl, actionUrl || baseUrl);
  const isPost = method === 'POST';

  const res = await fetchWithJar(
    jar,
    submitUrl,
    isPost
      ? {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: fields.toString(),
        }
      : { method: 'GET' },
  );

  const html = await res.text();
  const $ = cheerio.load(html);
  const table = pickBestTable($);
  if (!table) {
    const text = normalizeSpace($.text()).toLowerCase();
    if (text.includes('captcha') || text.includes('recaptcha')) {
      throw new Error('PJUD: el sitio requiere captcha para esta consulta.');
    }
    throw new Error('PJUD: no se pudo encontrar la tabla de resultados.');
  }

  const rowObjects = tableToObjects($, table);
  const causes: OJVCause[] = rowObjects.map((row, idx) => {
    const keys = Object.keys(row);
    const get = (...needles: string[]) => {
      const found = keys.find((k) => needles.some((n) => k.toLowerCase().includes(n)));
      return found ? (row[found] ?? '') : '';
    };

    const href = findFirstLinkHref($, table, idx);
    const sourceUrl = href ? resolveUrl(submitUrl, href) : null;

    const date = get('fecha');
    return {
      role: get('rol', 'rit') || null,
      ruc: get('ruc') || null,
      labeled: get('caratul', 'carátul') || null,
      court: get('tribunal', 'juzgado', 'corte') || null,
      causeState: get('estado') || null,
      procedure: get('proced') || null,
      resource: get('recurso') || null,
      administrativeStatus: get('situaci', 'admin') || null,
      ubication: get('ubic') || null,
      date: tryParseDateToIso(date) ?? (date || null),
      litigants: [],
      sourceUrl,
    };
  });

  if (!detail) return causes;

  // Best-effort: si hay link, intentamos extraer litigantes desde la página de detalle.
  for (const cause of causes) {
    if (!cause.sourceUrl) continue;
    try {
      const detailRes = await fetchWithJar(jar, cause.sourceUrl, { method: 'GET' });
      const detailHtml = await detailRes.text();
      const $d = cheerio.load(detailHtml);

      const litigants: OJVLitigant[] = [];
      $d('table tr').each((_, tr) => {
        const tds = $d(tr)
          .find('td')
          .toArray()
          .map((td) => normalizeSpace($d(td).text()));
        if (tds.length < 2) return;
        const label = (tds[0] ?? '').toLowerCase();
        const value = tds[1] ?? '';
        if (label.includes('rut') && value) {
          litigants.push({ rut: value });
        }
      });

      if (litigants.length > 0) cause.litigants = litigants;
    } catch {
      // best-effort
    }
  }

  return causes;
}

export async function ojvScrapeSearchSelects(input?: { baseUrl?: string }) {
  const jar: CookieJar = new Map();
  const baseUrl = input?.baseUrl?.trim() || OJV_BASE_URL;

  const landing = await fetchWithJar(jar, baseUrl, { method: 'GET' });
  const landingHtml = await landing.text();
  const $ = cheerio.load(landingHtml);

  const forms = $('form').toArray();
  if (forms.length === 0) throw new Error('PJUD: no se encontró formulario de búsqueda.');

  let bestForm: AnyNode = forms[0]!;
  let bestScore = -1;
  for (const f of forms) {
    const form = $(f);
    const score =
      form.find('select').length * 3 +
      form.find('input').length * 2 +
      (form.text().toLowerCase().includes('rut') ? 10 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestForm = f;
    }
  }

  const form = $(bestForm);
  const selects = form.find('select').toArray();

  const getLabelText = (select: cheerio.Cheerio<AnyNode>): string | null => {
    const id = select.attr('id')?.trim();
    if (id) {
      const label = $(`label[for="${id.replace(/"/g, '\\"')}"]`).first();
      const text = label.text();
      if (text) return normalizeSpace(text);
    }

    const aria = select.attr('aria-label');
    if (aria) return normalizeSpace(aria);

    // fallback: texto del contenedor cercano
    const containerText = select.parent().text();
    const t = normalizeSpace(containerText);
    return t.length > 0 ? t : null;
  };

  return {
    baseUrl,
    selects: selects.map((sel) => {
      const s = $(sel);
      const options = s
        .find('option')
        .toArray()
        .map((opt) => ({
          value: ($(opt).attr('value') ?? '').trim(),
          text: normalizeSpace($(opt).text()),
        }));
      const values = options.map((o) => o.value);
      return {
        id: s.attr('id')?.trim() ?? null,
        name: s.attr('name')?.trim() ?? null,
        label: getLabelText(s),
        valueTypeHint: classifyValueType(values),
        options,
      };
    }),
  };
}
