'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { createServiceClient, createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';
import { createClientSchema, type CreateClientInput } from '@/lib/validators/clients';

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
    await requireAuth(['analista', 'admin_firma']);

    if (!process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('Falta configurar SUPABASE_SERVICE_KEY en el entorno.');
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

function resolveClientSupabase() {
  if (process.env.SUPABASE_SERVICE_KEY) {
    return createServiceClient();
  }
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
