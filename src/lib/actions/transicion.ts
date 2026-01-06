'use server';

import { revalidatePath } from 'next/cache';
import { assignLawyerSchema, type AssignLawyerInput } from '@/lib/validators/case';
import { createServiceClient } from '@/lib/supabase/server';
import { requireTransitionAccess } from '@/lib/auth/transition';
import { logAuditAction } from '@/lib/audit/log';

const CASE_ORG_TABLES = [
  'case_stages',
  'notes',
  'documents',
  'info_requests',
  'case_clients',
  'case_collaborators',
  'portal_tokens',
  'magic_links',
  'case_messages',
  'case_counterparties',
  'case_lawyer_checklist_items',
  'billing_account_cases',
  'case_external_refs',
  'case_events',
] as const;

type TransitionResult =
  | {
      success: true;
      case: { id: string; abogado_responsable: string | null; organization_id: string | null };
      moved: boolean;
      fromOrgId: string | null;
      toOrgId: string | null;
    }
  | { success: false; error: string };

async function updateCaseOrgLinks(supabase: any, caseId: string, organizationId: string) {
  for (const table of CASE_ORG_TABLES) {
    const { error } = await supabase
      .from(table)
      .update({ organization_id: organizationId })
      .eq('case_id', caseId);
    if (error) {
      throw new Error(`Error actualizando ${table}: ${error.message}`);
    }
  }
}

async function moveClientOrganizations(supabase: any, caseId: string, targetOrgId: string, mainClientId?: string | null) {
  const { data: caseClients, error } = await supabase
    .from('case_clients')
    .select('client_profile_id')
    .eq('case_id', caseId);
  if (error) {
    throw new Error(`Error buscando clientes del caso: ${error.message}`);
  }

  const candidateIds = new Set<string>();
  for (const row of caseClients ?? []) {
    if (row?.client_profile_id) {
      candidateIds.add(String(row.client_profile_id));
    }
  }
  if (mainClientId) candidateIds.add(String(mainClientId));

  const candidates = Array.from(candidateIds);
  if (candidates.length === 0) return;

  const { data: linkedCases, error: linkedError } = await supabase
    .from('case_clients')
    .select('client_profile_id, case:cases!case_clients_case_id_fkey(organization_id)')
    .in('client_profile_id', candidates);
  if (linkedError) {
    throw new Error(`Error validando org de clientes: ${linkedError.message}`);
  }

  const conflictIds = new Set<string>();
  for (const row of linkedCases ?? []) {
    const orgId = row?.case?.organization_id ?? null;
    if (orgId && orgId !== targetOrgId) {
      conflictIds.add(String(row.client_profile_id));
    }
  }

  const { data: primaryCases, error: primaryError } = await supabase
    .from('cases')
    .select('cliente_principal_id, organization_id')
    .in('cliente_principal_id', candidates);

  if (primaryError) {
    throw new Error(`Error validando casos principales: ${primaryError.message}`);
  }

  for (const row of primaryCases ?? []) {
    const orgId = row?.organization_id ?? null;
    if (orgId && orgId !== targetOrgId && row?.cliente_principal_id) {
      conflictIds.add(String(row.cliente_principal_id));
    }
  }

  const moveIds = candidates.filter((id) => !conflictIds.has(id));
  if (moveIds.length === 0) return;

  const { error: moveError } = await supabase
    .from('profiles')
    .update({ organization_id: targetOrgId })
    .in('id', moveIds)
    .eq('role', 'cliente');

  if (moveError) {
    throw new Error(`Error moviendo clientes: ${moveError.message}`);
  }
}

async function reconcileBillingAccounts(supabase: any, caseId: string, targetOrgId: string) {
  const { data: billingRows, error } = await supabase
    .from('billing_account_cases')
    .select('billing_account_id')
    .eq('case_id', caseId);
  if (error) {
    throw new Error(`Error buscando billing accounts: ${error.message}`);
  }

  const accountIds = Array.from(
    new Set((billingRows ?? []).map((row: any) => row?.billing_account_id).filter(Boolean)),
  ) as string[];

  if (accountIds.length === 0) return;

  const movedAccountIds: string[] = [];

  for (const accountId of accountIds) {
    const { data: accountCases, error: accountCasesError } = await supabase
      .from('billing_account_cases')
      .select('case_id, case:cases!billing_account_cases_case_id_fkey(organization_id)')
      .eq('billing_account_id', accountId);

    if (accountCasesError) {
      throw new Error(`Error validando billing account: ${accountCasesError.message}`);
    }

    const hasOtherOrg = (accountCases ?? []).some(
      (row: any) => row?.case?.organization_id && row.case.organization_id !== targetOrgId,
    );

    if (!hasOtherOrg) {
      const { error: updateAccountError } = await supabase
        .from('billing_accounts')
        .update({ organization_id: targetOrgId })
        .eq('id', accountId);
      if (updateAccountError) {
        throw new Error(`Error moviendo billing account: ${updateAccountError.message}`);
      }
      movedAccountIds.push(accountId);
    }
  }

  if (movedAccountIds.length === 0) return;

  const { error: paymentError } = await supabase
    .from('billing_payments')
    .update({ organization_id: targetOrgId })
    .in('billing_account_id', movedAccountIds);
  if (paymentError) {
    throw new Error(`Error actualizando pagos: ${paymentError.message}`);
  }
}

export async function reassignCaseAcrossOrganizations(input: AssignLawyerInput): Promise<TransitionResult> {
  try {
    await requireTransitionAccess();
    const validated = assignLawyerSchema.parse(input);
    const supabase = createServiceClient() as any;

    const { data: caseRow, error: caseError } = await supabase
      .from('cases')
      .select('id, abogado_responsable, organization_id, cliente_principal_id')
      .eq('id', validated.case_id)
      .maybeSingle();

    if (caseError || !caseRow) {
      return { success: false, error: caseError?.message ?? 'Caso no encontrado.' };
    }

    if (caseRow.abogado_responsable === validated.abogado_id) {
      return { success: false, error: 'El caso ya esta asignado a ese abogado.' };
    }

    const { data: lawyerRow, error: lawyerError } = await supabase
      .from('profiles')
      .select('id, user_id, nombre, email, role, active_organization_id')
      .eq('id', validated.abogado_id)
      .maybeSingle();

    if (lawyerError || !lawyerRow) {
      return { success: false, error: lawyerError?.message ?? 'Abogado no encontrado.' };
    }

    if (String(lawyerRow.role) !== 'abogado') {
      return { success: false, error: 'El usuario destino no es abogado.' };
    }

    const targetOrgId = lawyerRow.active_organization_id ? String(lawyerRow.active_organization_id) : null;
    if (!targetOrgId) {
      return { success: false, error: 'El abogado destino no tiene empresa activa asignada.' };
    }

    if (lawyerRow.user_id) {
      const { data: membership, error: membershipError } = await supabase
        .from('org_members')
        .select('id')
        .eq('user_id', lawyerRow.user_id)
        .eq('organization_id', targetOrgId)
        .maybeSingle();

      if (membershipError) {
        return { success: false, error: membershipError.message ?? 'No se pudo validar la empresa destino.' };
      }

      if (!membership) {
        return { success: false, error: 'El abogado destino no pertenece a la empresa activa.' };
      }
    }

    const fromOrgId = caseRow.organization_id ? String(caseRow.organization_id) : null;
    const shouldMoveOrg = !fromOrgId || fromOrgId !== targetOrgId;

    const { data: updatedCase, error: updateError } = await supabase
      .from('cases')
      .update({
        abogado_responsable: validated.abogado_id,
        organization_id: shouldMoveOrg ? targetOrgId : fromOrgId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.case_id)
      .select('id, abogado_responsable, organization_id')
      .single();

    if (updateError || !updatedCase) {
      return { success: false, error: updateError?.message ?? 'No se pudo actualizar el caso.' };
    }

    if (shouldMoveOrg) {
      await updateCaseOrgLinks(supabase, validated.case_id, targetOrgId);
      await reconcileBillingAccounts(supabase, validated.case_id, targetOrgId);
      await moveClientOrganizations(supabase, validated.case_id, targetOrgId, caseRow.cliente_principal_id);
    }

    await logAuditAction({
      action: 'ASSIGN_LAWYER_GLOBAL',
      entity_type: 'case',
      entity_id: validated.case_id,
      diff_json: {
        previous_lawyer: caseRow.abogado_responsable ?? null,
        new_lawyer: validated.abogado_id,
        from_organization_id: fromOrgId,
        to_organization_id: targetOrgId,
        moved_case: shouldMoveOrg,
      },
    });

    revalidatePath(`/cases/${validated.case_id}`);
    revalidatePath('/cases');
    revalidatePath('/dashboard');
    revalidatePath('/transicion');

    return {
      success: true,
      case: updatedCase,
      moved: shouldMoveOrg,
      fromOrgId,
      toOrgId: targetOrgId,
    };
  } catch (error) {
    console.error('Error in reassignCaseAcrossOrganizations:', error);
    return { success: false, error: (error as Error).message };
  }
}
