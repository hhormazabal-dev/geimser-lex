'use server';

import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';
import { diditCreateSession, diditGetSessionDecision, diditListSessions } from '@/lib/didit/client';

const uuidSchema = z.string().uuid();

type StartVerificationResult =
  | { success: true; sessionId: string; url: string; status: string }
  | { success: false; error: string };

type SyncVerificationResult =
  | { success: true; sessionId: string; status: string }
  | { success: false; error: string };

function resolveAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
}

function resolveWorkflowId(requireBiometric: boolean) {
  const defaultWorkflowId = process.env.DIDIT_WORKFLOW_ID?.trim();
  if (!defaultWorkflowId) {
    throw new Error('Falta configurar DIDIT_WORKFLOW_ID en el entorno.');
  }

  const biometricWorkflowId = process.env.DIDIT_WORKFLOW_ID_BIOMETRIC?.trim();
  if (requireBiometric && biometricWorkflowId) return biometricWorkflowId;
  return defaultWorkflowId;
}

async function getRequireBiometricSetting(supabase: any, profileId: string, organizationId: string) {
  const { data } = await supabase
    .from('didit_profile_settings')
    .select('require_biometric')
    .eq('profile_id', profileId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  return Boolean(data?.require_biometric);
}

export async function startDiditVerification(profileId: string): Promise<StartVerificationResult> {
  try {
    const actor = await requireAuth(['admin_firma', 'analista']);
    const activeOrgId = (actor as any)?.active_organization_id ?? null;
    if (!activeOrgId) return { success: false, error: 'Debes seleccionar una empresa activa antes de iniciar una validación.' };

    const targetId = uuidSchema.parse(profileId);
    const supabase = (await createServiceClient()) as any;

    const { data: target, error: targetErr } = await supabase
      .from('profiles')
      .select('id, role, organization_id, active_organization_id, email, nombre')
      .eq('id', targetId)
      .maybeSingle();
    if (targetErr || !target) throw new Error(targetErr?.message ?? 'No se encontró el perfil solicitado.');

    const targetOrg = target.role === 'cliente' ? target.organization_id : target.active_organization_id;
    if (targetOrg !== activeOrgId) {
      return { success: false, error: 'El usuario/cliente no pertenece a la empresa activa.' };
    }

    const requireBiometric = await getRequireBiometricSetting(supabase, targetId, activeOrgId);
    const workflowId = resolveWorkflowId(requireBiometric);

    const callback = `${resolveAppUrl()}/didit/callback`;
    const session = await diditCreateSession({
      workflow_id: workflowId,
      vendor_data: targetId,
      callback,
      callback_method: 'both',
      language: 'es',
      contact_details: { email: target.email ?? undefined, send_notification_emails: true, email_lang: 'es' },
      expected_details: {
        first_name: target.nombre?.split(' ')?.[0] ?? undefined,
      },
      metadata: {
        account_id: activeOrgId,
        user_type: target.role,
        initiated_by: actor.id,
        require_biometric: requireBiometric,
      },
    });

    await supabase
      .from('didit_verification_sessions')
      .insert({
        organization_id: activeOrgId,
        subject_profile_id: targetId,
        initiated_by_profile_id: actor.id,
        didit_session_id: session.session_id,
        workflow_id: session.workflow_id,
        vendor_data: session.vendor_data ?? targetId,
        callback: session.callback ?? callback,
        session_url: session.url,
        status: session.status,
        raw: session,
        last_synced_at: new Date().toISOString(),
      })
      .throwOnError();

    return { success: true, sessionId: session.session_id, url: session.url, status: session.status };
  } catch (error) {
    console.error('startDiditVerification error', error);
    return { success: false, error: error instanceof Error ? error.message : 'No se pudo iniciar la validación de identidad.' };
  }
}

export async function syncDiditVerification(sessionId: string): Promise<SyncVerificationResult> {
  try {
    const actor = await requireAuth();
    const safeSessionId = uuidSchema.parse(sessionId);
    const supabase = (await createServiceClient()) as any;

    const { data: row, error: rowErr } = await supabase
      .from('didit_verification_sessions')
      .select('id, organization_id, subject_profile_id')
      .eq('didit_session_id', safeSessionId)
      .maybeSingle();
    if (rowErr || !row) throw new Error(rowErr?.message ?? 'No se encontró la sesión.');

    const activeOrgId = (actor as any)?.active_organization_id ?? null;
    const canAccess = row.subject_profile_id === actor.id || (activeOrgId && row.organization_id === activeOrgId);
    if (!canAccess) return { success: false, error: 'Sin permisos para acceder a esta sesión.' };

    const decision = await diditGetSessionDecision(safeSessionId);
    const status = String(decision.status ?? '').trim() || 'unknown';

    await supabase
      .from('didit_verification_sessions')
      .update({
        status,
        raw: decision,
        last_synced_at: new Date().toISOString(),
      })
      .eq('didit_session_id', safeSessionId)
      .throwOnError();

    return { success: true, sessionId: safeSessionId, status };
  } catch (error) {
    console.error('syncDiditVerification error', error);
    return { success: false, error: error instanceof Error ? error.message : 'No se pudo sincronizar la sesión.' };
  }
}

export async function syncLatestDiditVerificationForCurrentUser(): Promise<SyncVerificationResult> {
  try {
    const actor = await requireAuth();
    const sessions = await diditListSessions({ vendor_data: actor.id, limit: 1, offset: 0 });
    const latest = Array.isArray((sessions as any).results) ? (sessions as any).results[0] : null;
    const sessionId = latest?.session_id;
    if (!sessionId || typeof sessionId !== 'string') return { success: false, error: 'No hay sesiones recientes para sincronizar.' };
    return await syncDiditVerification(sessionId);
  } catch (error) {
    console.error('syncLatestDiditVerificationForCurrentUser error', error);
    return { success: false, error: error instanceof Error ? error.message : 'No se pudo sincronizar la sesión.' };
  }
}

