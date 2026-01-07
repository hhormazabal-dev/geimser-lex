'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { createServiceClient, createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';
import { logAuditAction } from '@/lib/audit/log';
import {
  createClientSchema,
  assignClientToCaseSchema,
  type AssignClientToCaseInput,
  type CreateClientInput,
} from '@/lib/validators/clients';

export type ClientCaseSummary = {
  id: string;
  caratulado: string;
  numero_causa: string | null;
  estado: string | null;
  prioridad: string | null;
  etapa_actual: string | null;
  abogado?: { id: string; nombre: string | null } | null;
  esPrincipal: boolean;
};

export type CreateClientResult =
  | { success: true; client: { id: string; nombre: string; email: string; rut: string | null; telefono: string | null } }
  | { success: false; error: string };

const DEFAULT_ERROR_MESSAGE = 'No se pudo crear el cliente. Inténtalo nuevamente.';

function resolveDefaultPassword() {
  const envPassword = process.env.DEFAULT_PASSWORD?.trim();
  if (envPassword) return envPassword;
  return randomBytes(12).toString('base64url');
}

export async function createClientProfile(input: CreateClientInput): Promise<CreateClientResult> {
  try {
    const actor = await requireAuth(['analista', 'admin_firma']);
    const activeOrgId = (actor as any)?.active_organization_id ?? null;
    if (!activeOrgId) {
      return { success: false, error: 'Debes seleccionar una empresa activa antes de crear clientes.' };
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('Falta configurar SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SERVICE_KEY) en el entorno.');
    }

    const payload = createClientSchema.parse(input);
    const supabase = await createServiceClient();

    const password = resolveDefaultPassword();

    const createdUser = await supabase.auth.admin.createUser({
      email: payload.email,
      password,
      email_confirm: true,
      app_metadata: { role: 'cliente' },
      user_metadata: { nombre: payload.nombre, role: 'cliente' },
    });

    if (createdUser.error || !createdUser.data?.user?.id) {
      throw new Error(createdUser.error?.message ?? 'Supabase no devolvió el ID del nuevo cliente');
    }

    const userId = createdUser.data.user.id;

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          user_id: userId,
          email: payload.email,
          nombre: payload.nombre,
          role: 'cliente',
          organization_id: activeOrgId,
          rut: payload.rut || null,
          telefono: payload.telefono || null,
          activo: true,
        },
        { onConflict: 'id' }
      )
      .select('id, nombre, email, rut, telefono')
      .single();

    if (profileError || !profileRow) {
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
      throw new Error(profileError?.message ?? 'No se pudo guardar el perfil del cliente');
    }

    await (supabase as any)
      .from('didit_profile_settings')
      .upsert(
        {
          profile_id: userId,
          organization_id: activeOrgId,
          require_biometric: Boolean((payload as any).require_biometric),
        },
        { onConflict: 'profile_id' },
      )
      .throwOnError();

    revalidatePath('/cases/new');
    revalidatePath('/dashboard/analista');
    revalidatePath('/clients');

    return {
      success: true,
      client: {
        id: profileRow.id,
        nombre: profileRow.nombre,
        email: profileRow.email,
        rut: profileRow.rut,
        telefono: profileRow.telefono,
      },
    };
  } catch (error) {
    console.error('Error in createClientProfile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE,
    };
  }
}

export type ListClientsResult =
  | {
      success: true;
      clients: Array<{
        id: string;
        nombre: string;
        email: string;
        telefono: string | null;
        rut: string | null;
        created_at: string | null;
      }>;
    }
  | { success: false; error: string };

export type GetClientCasesResult =
  | { success: true; cases: ClientCaseSummary[] }
  | { success: false; error: string };

export type AssignClientToCaseResult =
  | { success: true; case: ClientCaseSummary }
  | { success: false; error: string };

function resolveClientSupabase() {
  return createServerClient();
}

export async function listClients(params: { search?: string } = {}): Promise<ListClientsResult> {
  try {
    await requireAuth(['analista', 'admin_firma']);
    const supabase = await resolveClientSupabase();

    let query = supabase
      .from('profiles')
      .select('id, nombre, email, telefono, rut, created_at')
      .eq('role', 'cliente')
      .order('nombre', { ascending: true });

    const search = params.search?.trim();
    if (search) {
      query = query.or(
        `nombre.ilike.%${search}%,email.ilike.%${search}%,rut.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return {
      success: true,
      clients: data ?? [],
    };
  } catch (error) {
    console.error('Error in listClients:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'No se pudieron obtener los clientes',
    };
  }
}

export async function getClientCases(clientId: string): Promise<GetClientCasesResult> {
  try {
    await requireAuth(['admin_firma', 'analista', 'abogado']);
    const supabase = await resolveClientSupabase();

    const { data, error } = await supabase
      .from('case_clients')
      .select(
        `
          case_id,
          created_at,
          case:cases (
            id,
            caratulado,
            numero_causa,
            estado,
            prioridad,
            etapa_actual,
            cliente_principal_id,
            abogado_responsable,
            abogado_responsable_profile:profiles!cases_abogado_responsable_fkey(id, nombre)
          )
        `,
      )
      .eq('client_profile_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const cases: ClientCaseSummary[] = [];

    for (const row of data ?? []) {
      const caseData = row.case as
        | {
            id: string;
            caratulado: string;
            numero_causa: string | null;
            estado: string | null;
            prioridad: string | null;
            etapa_actual: string | null;
            cliente_principal_id: string | null;
            abogado_responsable: string | null;
            abogado_responsable_profile?: { id: string; nombre: string | null } | null;
          }
        | null;

      if (!caseData) continue;

      const lawyerInfo = caseData.abogado_responsable_profile
        ? {
            id: caseData.abogado_responsable_profile.id,
            nombre: caseData.abogado_responsable_profile.nombre ?? null,
          }
        : caseData.abogado_responsable
        ? { id: caseData.abogado_responsable, nombre: null }
        : null;

      const summary: ClientCaseSummary = {
        id: caseData.id,
        caratulado: caseData.caratulado,
        numero_causa: caseData.numero_causa ?? null,
        estado: caseData.estado ?? null,
        prioridad: caseData.prioridad ?? null,
        etapa_actual: caseData.etapa_actual ?? null,
        abogado: lawyerInfo,
        esPrincipal: caseData.cliente_principal_id === clientId,
      };

      cases.push(summary);
    }

    return { success: true, cases };
  } catch (error) {
    console.error('Error in getClientCases:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function assignClientToCase(input: AssignClientToCaseInput): Promise<AssignClientToCaseResult> {
  try {
    const profile = await requireAuth(['admin_firma', 'analista']);
    const payload = assignClientToCaseSchema.parse(input);
    const supabase = await resolveClientSupabase();

    const { data: caseRow, error: caseError } = await supabase
      .from('cases')
      .select('id, caratulado, cliente_principal_id')
      .eq('id', payload.case_id)
      .maybeSingle();
    if (caseError) throw caseError;
    if (!caseRow) {
      return { success: false, error: 'Caso no encontrado.' };
    }

    const { data: existingLink, error: existingError } = await supabase
      .from('case_clients')
      .select('case_id')
      .eq('case_id', payload.case_id)
      .eq('client_profile_id', payload.client_id)
      .maybeSingle();
    if (existingError && existingError.code !== 'PGRST116') throw existingError;
    if (existingLink) {
      return { success: false, error: 'El caso ya está asignado a este cliente.' };
    }

    const insertResult = await supabase
      .from('case_clients')
      .insert({ case_id: payload.case_id, client_profile_id: payload.client_id });
    if (insertResult.error && insertResult.error.code !== '23505') throw insertResult.error;

    const nowIso = new Date().toISOString();
    const caseUpdates: Record<string, string> = { updated_at: nowIso };
    if (payload.set_as_principal || !caseRow.cliente_principal_id) {
      caseUpdates.cliente_principal_id = payload.client_id;
    }

    const { error: updateError } = await supabase
      .from('cases')
      .update(caseUpdates)
      .eq('id', payload.case_id);
    if (updateError) throw updateError;

    const { data: refreshedCase, error: refreshError } = await supabase
      .from('cases')
      .select(
        `
          id,
          caratulado,
          numero_causa,
          estado,
          prioridad,
          etapa_actual,
          cliente_principal_id,
          abogado_responsable,
          abogado_responsable_profile:profiles!cases_abogado_responsable_fkey(id, nombre)
        `,
      )
      .eq('id', payload.case_id)
      .maybeSingle();
    if (refreshError) throw refreshError;
    if (!refreshedCase) throw new Error('No se pudo obtener el caso actualizado');

    await logAuditAction({
      action: 'ASSIGN_CLIENT',
      entity_type: 'case',
      entity_id: payload.case_id,
      diff_json: {
        client_id: payload.client_id,
        set_as_principal: payload.set_as_principal ?? false,
        changed_by: profile.id,
      },
    });

    revalidatePath(`/cases/${payload.case_id}`);
    revalidatePath('/cases');
    revalidatePath('/clients');

    const summary: ClientCaseSummary = {
      id: refreshedCase.id,
      caratulado: refreshedCase.caratulado,
      numero_causa: refreshedCase.numero_causa ?? null,
      estado: refreshedCase.estado ?? null,
      prioridad: refreshedCase.prioridad ?? null,
      etapa_actual: refreshedCase.etapa_actual ?? null,
      abogado: refreshedCase.abogado_responsable_profile
        ? {
            id: refreshedCase.abogado_responsable_profile.id,
            nombre: refreshedCase.abogado_responsable_profile.nombre ?? null,
          }
        : refreshedCase.abogado_responsable
        ? { id: refreshedCase.abogado_responsable, nombre: null }
        : null,
      esPrincipal: refreshedCase.cliente_principal_id === payload.client_id,
    };

    return { success: true, case: summary };
  } catch (error) {
    console.error('Error in assignClientToCase:', error);
    return { success: false, error: (error as Error).message };
  }
}
