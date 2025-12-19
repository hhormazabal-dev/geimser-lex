export type PjudTipoJuzgadoOption = {
  value: string;
  label: string;
};

export const PJUD_TIPO_JUZGADO_OPTIONS: PjudTipoJuzgadoOption[] = [
  { value: '8', label: '8 (sugerido)' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '9', label: '9' },
  { value: '10', label: '10' },
  { value: '11', label: '11' },
  { value: '12', label: '12' },
];

export function getTipoJuzgadoCandidates(): string[] {
  const raw = process.env.PJUD_TIPO_JUZGADO_DETECT_CANDIDATES?.trim();
  if (!raw) return PJUD_TIPO_JUZGADO_OPTIONS.map((o) => o.value);
  const parsed = raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => /^\d+$/.test(x));
  return parsed.length ? parsed : PJUD_TIPO_JUZGADO_OPTIONS.map((o) => o.value);
}
