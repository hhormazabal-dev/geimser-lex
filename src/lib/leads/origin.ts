export type LeadOrigin = 'bot' | 'form' | 'unknown';

const ORIGIN_LABELS: Record<LeadOrigin, string> = {
  bot: 'Bot',
  form: 'Formulario',
  unknown: 'Desconocido',
};

const BOT_HINTS = ['bot', 'chat', 'ia', 'ai', 'assistant'];
const FORM_HINTS = ['form', 'formulario', 'landing', 'web', 'site'];

function normalizeText(value?: string | null) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeLeadOrigin(value?: string | null): LeadOrigin {
  const normalized = normalizeText(value);
  if (!normalized) return 'unknown';
  if (BOT_HINTS.some((hint) => normalized.includes(hint))) return 'bot';
  if (FORM_HINTS.some((hint) => normalized.includes(hint))) return 'form';
  return 'unknown';
}

export function detectLeadOrigin(payload?: Record<string, unknown>): LeadOrigin {
  if (!payload) return 'unknown';
  const keys = ['origin', 'lead_origin', 'leadOrigin', 'origen', 'channel', 'source_type', 'sourceType'];
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string') {
      const normalized = normalizeLeadOrigin(value);
      if (normalized !== 'unknown') return normalized;
    }
  }

  if (payload.conversation_id || payload.conversationId || payload.bot) return 'bot';
  if (payload.form_id || payload.formId || payload.formulario) return 'form';

  return 'unknown';
}

export function getLeadOriginLabel(value?: string | null) {
  return ORIGIN_LABELS[normalizeLeadOrigin(value)];
}
