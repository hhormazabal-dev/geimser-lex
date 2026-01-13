const DEUDA_CERO_NAMES = new Set(['deuda cero', 'deudas cero']);

export const DEUDA_CERO_ORG_ALIASES = ['Deuda Cero', 'Deudas Cero'];

export function isDeudaCeroOrgName(name?: string | null) {
  const normalized = String(name ?? '').trim().toLowerCase();
  return DEUDA_CERO_NAMES.has(normalized);
}
