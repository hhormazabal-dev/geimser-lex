export type LeadStatus =
  | 'new'
  | 'contactado'
  | 'seguimiento'
  | 'esperando_datos'
  | 'no_responde'
  | 'error'
  | 'listo'
  | 'convertido';

export const LEAD_STATUS_OPTIONS: Array<{
  value: LeadStatus;
  label: string;
  tone: string;
}> = [
  { value: 'new', label: 'Sin contacto', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'contactado', label: 'Contactado', tone: 'bg-sky-50 text-sky-700 border-sky-100' },
  { value: 'seguimiento', label: 'Seguimiento', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  { value: 'esperando_datos', label: 'Esperando datos', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { value: 'no_responde', label: 'No responde', tone: 'bg-orange-50 text-orange-700 border-orange-100' },
  { value: 'error', label: 'Lead erroneo', tone: 'bg-rose-50 text-rose-700 border-rose-100' },
  { value: 'listo', label: 'Listo para caso', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { value: 'convertido', label: 'Caso creado', tone: 'bg-slate-200 text-slate-700 border-slate-300' },
];

const LEAD_STATUS_LABELS = new Map(LEAD_STATUS_OPTIONS.map((item) => [item.value, item.label]));
const LEAD_STATUS_TONES = new Map(LEAD_STATUS_OPTIONS.map((item) => [item.value, item.tone]));

export const LEAD_STATUS_VALUES = new Set(LEAD_STATUS_OPTIONS.map((item) => item.value));

export const LEAD_CONTACT_STATUSES = new Set<LeadStatus>([
  'contactado',
  'seguimiento',
  'esperando_datos',
  'no_responde',
]);

export function normalizeLeadStatus(value?: string | null): LeadStatus | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (LEAD_STATUS_VALUES.has(normalized as LeadStatus)) {
    return normalized as LeadStatus;
  }
  return null;
}

export function getLeadStatusLabel(value?: string | null) {
  const normalized = normalizeLeadStatus(value);
  return (normalized && LEAD_STATUS_LABELS.get(normalized)) || 'Sin estado';
}

export function getLeadStatusTone(value?: string | null) {
  const normalized = normalizeLeadStatus(value);
  return (normalized && LEAD_STATUS_TONES.get(normalized)) || 'bg-slate-100 text-slate-600 border-slate-200';
}
