'use server';

type DiditApiKey = string;

export type DiditCreateSessionInput = {
  workflow_id: string;
  vendor_data?: string;
  callback?: string;
  callback_method?: 'initiator' | 'completer' | 'both';
  metadata?: unknown;
  language?: string | null;
  contact_details?: {
    email?: string;
    send_notification_emails?: boolean;
    email_lang?: string;
    phone?: string;
  };
  expected_details?: Record<string, unknown>;
  portrait_image?: string;
};

export type DiditCreateSessionResponse = {
  session_id: string;
  session_number: number;
  session_token: string;
  vendor_data?: string;
  metadata?: Record<string, unknown> | null;
  status: string;
  workflow_id: string;
  callback?: string | null;
  url: string;
};

export type DiditSessionDecisionResponse = {
  session_id: string;
  session_number?: number;
  session_url?: string;
  status?: string;
  workflow_id?: string;
  vendor_data?: string;
  metadata?: Record<string, unknown> | null;
  expected_details?: Record<string, unknown> | null;
  contact_details?: Record<string, unknown> | null;
  callback?: string | null;
  id_verification?: Record<string, unknown> | null;
  liveness?: Record<string, unknown> | null;
  face_match?: Record<string, unknown> | null;
  reviews?: unknown[] | null;
  created_at?: string | null;
  [key: string]: unknown;
};

export type DiditListSessionsResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

function resolveDiditBaseUrl() {
  return (process.env.DIDIT_BASE_URL?.trim() || 'https://verification.didit.me').replace(/\/+$/, '');
}

function resolveDiditApiKey(): DiditApiKey {
  const apiKey = process.env.DIDIT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Falta configurar DIDIT_API_KEY en el entorno.');
  }
  return apiKey;
}

async function diditFetch(path: string, init: RequestInit = {}) {
  const baseUrl = resolveDiditBaseUrl();
  const apiKey = resolveDiditApiKey();
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

  const controller = new AbortController();
  const timeoutMs = Number(process.env.DIDIT_TIMEOUT_MS ?? 25_000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'x-api-key': apiKey,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    const contentType = res.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '');

    if (!res.ok) {
      const message =
        (body && typeof body === 'object' && 'detail' in body && typeof (body as any).detail === 'string'
          ? (body as any).detail
          : null) ||
        (body && typeof body === 'object' && 'message' in body && typeof (body as any).message === 'string'
          ? (body as any).message
          : null) ||
        `Didit API error (${res.status})`;
      throw new Error(message);
    }

    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export async function diditCreateSession(input: DiditCreateSessionInput): Promise<DiditCreateSessionResponse> {
  const payload = {
    ...input,
    callback_method: input.callback_method ?? 'both',
    metadata: typeof input.metadata === 'string' || input.metadata == null ? input.metadata : JSON.stringify(input.metadata),
  };

  const data = await diditFetch('/v2/session/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return data as DiditCreateSessionResponse;
}

export async function diditGetSessionDecision(sessionId: string): Promise<DiditSessionDecisionResponse> {
  const safeId = encodeURIComponent(sessionId);
  const data = await diditFetch(`/v2/session/${safeId}/decision/`, { method: 'GET' });
  return data as DiditSessionDecisionResponse;
}

export async function diditListSessions(params: { vendor_data?: string; workflow_id?: string; status?: string; limit?: number; offset?: number }) {
  const search = new URLSearchParams();
  if (params.vendor_data) search.set('vendor_data', params.vendor_data);
  if (params.workflow_id) search.set('workflow_id', params.workflow_id);
  if (params.status) search.set('status', params.status);
  if (typeof params.limit === 'number') search.set('limit', String(params.limit));
  if (typeof params.offset === 'number') search.set('offset', String(params.offset));

  const data = await diditFetch(`/v2/sessions?${search.toString()}`, { method: 'GET' });
  return data as DiditListSessionsResponse;
}

