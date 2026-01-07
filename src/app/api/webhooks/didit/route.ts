import { NextResponse, type NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { diditGetSessionDecision } from '@/lib/didit/client';

function normalizeSignature(raw: string) {
  const value = raw.trim();
  if (!value) return null;

  // Stripe-like: "t=...,v1=..."
  if (value.includes('v1=')) {
    const part = value
      .split(',')
      .map((s) => s.trim())
      .find((s) => s.startsWith('v1='));
    if (!part) return null;
    return part.slice(3).trim() || null;
  }

  // "sha256=<hex>"
  if (value.includes('=')) {
    const [, sig] = value.split('=', 2);
    return sig?.trim() || null;
  }

  return value;
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function verifyDiditWebhookSignature(params: {
  rawBody: string;
  signature: string | null;
  secret: string;
}) {
  if (!params.signature) return false;
  const signature = normalizeSignature(params.signature);
  if (!signature) return false;

  const hmacHex = createHmac('sha256', params.secret).update(params.rawBody, 'utf8').digest('hex');
  const hmacB64 = createHmac('sha256', params.secret).update(params.rawBody, 'utf8').digest('base64');

  return safeEqual(signature, hmacHex) || safeEqual(signature, hmacB64);
}

function extractSessionId(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const direct =
    (typeof payload.session_id === 'string' && payload.session_id) ||
    (typeof payload.sessionId === 'string' && payload.sessionId) ||
    (typeof payload.sid === 'string' && payload.sid) ||
    null;
  if (direct) return direct;

  const data = payload.data;
  if (data && typeof data === 'object') {
    const nested =
      (typeof data.session_id === 'string' && data.session_id) ||
      (typeof data.sessionId === 'string' && data.sessionId) ||
      null;
    if (nested) return nested;
  }

  return null;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET?.trim() || '';
  if (webhookSecret) {
    const headerName = (process.env.DIDIT_WEBHOOK_SIGNATURE_HEADER?.trim() || '').toLowerCase();
    const signature =
      (headerName ? req.headers.get(headerName) : null) ||
      req.headers.get('x-didit-signature') ||
      req.headers.get('x-webhook-signature') ||
      req.headers.get('x-signature') ||
      req.headers.get('didit-signature') ||
      null;

    const ok = verifyDiditWebhookSignature({ rawBody, signature, secret: webhookSecret });
    if (!ok) {
      return NextResponse.json({ ok: false, error: 'Firma inválida' }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const sessionId = extractSessionId(payload);
  if (!sessionId) {
    return NextResponse.json({ ok: true, warning: 'Webhook recibido sin session_id' });
  }

  try {
    const decision = await diditGetSessionDecision(sessionId);
    const vendorData = typeof decision.vendor_data === 'string' ? decision.vendor_data : null;
    const workflowId = typeof decision.workflow_id === 'string' ? decision.workflow_id : null;
    const status = typeof decision.status === 'string' ? decision.status : null;
    const metadata = decision.metadata && typeof decision.metadata === 'object' ? (decision.metadata as any) : null;
    const organizationId = typeof metadata?.account_id === 'string' ? metadata.account_id : null;

    if (!vendorData || !workflowId || !organizationId) {
      return NextResponse.json({ ok: true, warning: 'Webhook recibido, pero faltan datos para persistir', sessionId });
    }

    const supabase = createServiceClient() as any;

    await supabase
      .from('didit_verification_sessions')
      .upsert(
        {
          organization_id: organizationId,
          subject_profile_id: vendorData,
          didit_session_id: sessionId,
          workflow_id: workflowId,
          vendor_data: vendorData,
          callback: typeof decision.callback === 'string' ? decision.callback : null,
          session_url: typeof decision.session_url === 'string' ? decision.session_url : null,
          status: status ?? 'unknown',
          raw: { decision, webhook: payload },
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'didit_session_id' },
      )
      .throwOnError();

    return NextResponse.json({ ok: true, sessionId, status: status ?? 'unknown' });
  } catch (error) {
    console.error('Didit webhook error', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error procesando webhook' },
      { status: 500 },
    );
  }
}

