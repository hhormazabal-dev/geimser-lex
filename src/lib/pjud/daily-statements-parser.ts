import * as cheerio from 'cheerio';
import type { DailyStatementItem, DailyStatementLinkMeta } from '@/types/daily-statements';

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toDateKeyDDMMYYYY(value: string): number | null {
  const m = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!yyyy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return yyyy * 10_000 + mm * 100 + dd;
}

function extractDateFromHeader(headerText: string): string | null {
  const m = normalizeSpace(headerText).match(/del d[ií]a\s+(\d{2}-\d{2}-\d{4})/i);
  return m?.[1] ?? null;
}

function pickBestDate(dates: string[]): string | null {
  let best: { key: number; value: string } | null = null;
  for (const date of dates) {
    const key = toDateKeyDDMMYYYY(date);
    if (key === null) continue;
    if (!best || key > best.key) best = { key, value: date };
  }
  return best?.value ?? null;
}

function extractLinkMeta(a: cheerio.Cheerio<any>): DailyStatementLinkMeta | undefined {
  const node = a.get(0);
  const attribs = (node as any)?.attribs as Record<string, string> | undefined;
  if (!attribs) return undefined;

  const meta: DailyStatementLinkMeta = {};
  for (const [k, v] of Object.entries(attribs)) {
    if (!k.toLowerCase().startsWith('data-')) continue;
    const key = k.slice('data-'.length).trim().toLowerCase();
    if (!key) continue;
    meta[key] = normalizeSpace(String(v ?? ''));
  }

  return Object.keys(meta).length ? meta : undefined;
}

export type ParsedDailyStatements = {
  date: string | null;
  items: DailyStatementItem[];
};

export function parsePjudDailyStatementsHtml(html: string): ParsedDailyStatements {
  const $ = cheerio.load(html);

  const items: DailyStatementItem[] = [];
  const datesFound: string[] = [];

  $('table[id^="data-table-estado-diario-"]').each((_, tableEl) => {
    const table = $(tableEl);
    const id = table.attr('id') ?? '';
    const competencia = normalizeSpace(id.replace(/^data-table-estado-diario-/, '')).toLowerCase();

    const headerText = normalizeSpace(table.closest('.card').find('.card-header').first().text());
    const dateInHeader = headerText ? extractDateFromHeader(headerText) : null;
    if (dateInHeader) datesFound.push(dateInHeader);

    table.find('tbody tr').each((_, trEl) => {
      const tds = $(trEl).find('td').toArray();
      if (tds.length === 0) return;

      const numeroTd = tds[1] ? $(tds[1]) : null;
      const partesTd = tds[2] ? $(tds[2]) : null;
      const providenciasTd = tds[3] ? $(tds[3]) : null;

      const anchor = numeroTd ? numeroTd.find('a').first() : null;
      const numeroIngreso = normalizeSpace(
        anchor && anchor.length ? anchor.text() : numeroTd ? numeroTd.text() : '',
      );
      const partes = normalizeSpace(partesTd ? partesTd.text() : '');
      const providencias = normalizeSpace(providenciasTd ? providenciasTd.text() : '');

      if (!numeroIngreso && !partes && !providencias) return;

      const linkMeta = anchor && anchor.length && competencia === 'civil' ? extractLinkMeta(anchor) : undefined;
      if (!datesFound.length && linkMeta?.date) datesFound.push(linkMeta.date);

      items.push({
        competencia: competencia || 'desconocida',
        numeroIngreso,
        partes,
        providencias,
        ...(linkMeta ? { linkMeta } : {}),
      });
    });
  });

  return { date: pickBestDate(datesFound), items };
}

