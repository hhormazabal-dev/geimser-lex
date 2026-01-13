const DEUDA_CERO_NAMES = new Set(['deuda cero', 'deudas cero']);

export const DEUDA_CERO_ORG_ALIASES = ['Deuda Cero', 'Deudas Cero'];
export const DEUDA_CERO_LEAD_SOURCES = ['website_deudacero', 'website_deudascero'] as const;

export function isDeudaCeroOrgName(name?: string | null) {
  const normalized = String(name ?? '').trim().toLowerCase();
  return DEUDA_CERO_NAMES.has(normalized);
}

export function normalizeDeudaCeroLeadSource(value?: string | null) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'website_deudascero') return 'website_deudacero';
  if (normalized === 'website_deudacero') return 'website_deudacero';
  return 'website_deudacero';
}
