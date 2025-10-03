'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentProfile, requireAuth, canAccessCase } from '@/lib/auth/roles';
import { logAuditAction } from '@/lib/audit/log';
import {
  generateMagicLinkSchema,
  validateMagicLinkSchema,
  createClientFromMagicLinkSchema,
  magicLinkFiltersSchema,
  type GenerateMagicLinkInput,
  type ValidateMagicLinkInput,
  type CreateClientFromMagicLinkInput,
  type MagicLinkFiltersInput,
} from '@/lib/validators/magic-links';
import type { MagicLink, MagicLinkInsert, Profile, ProfileInsert } from '@/lib/supabase/types';
import { randomBytes } from 'crypto';

/**
 * Genera un magic link para acceso de cliente
 */
export async function generateMagicLink(input: GenerateMagicLinkInput) {
  try {
    const profile = await requireAuth();
    const validatedInput = generateMagicLinkSchema.parse(input);
    
    // Verificar acceso al caso
    const hasAccess = await canAccessCase(validatedInput.case_id);
    if (!hasAccess) {
      throw new Error('Sin permisos para acceder a este caso');
    }

    // Solo abogados y admin pueden generar magic links
    if (profile.role === 'cliente') {
      throw new Error('Sin permisos para generar enlaces de acceso');
    }

    const supabase = createServiceClient();

    // Generar token único
    const token = randomBytes(32).toString('hex');
    
    // Calcular fecha de expiración
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + validatedInput.expires_in_hours);

    const magicLinkData: MagicLinkInsert = {
      token,
      email: validatedInput.email,
      case_id: validatedInput.case_id,
      created_by: profile.id,
      expires_at: expiresAt.toISOString(),
      permissions: validatedInput.permissions,
    };

    const { data: newMagicLink, error } = await supabase
      .from('magic_links')
      .insert(magicLinkData)
      .select(`
        *,
        case:cases(caratulado),
        created_by_profile:profiles(nombre)
      `)
      .single();

    if (error) {
      console.error('Error creating magic link:', error);
      throw new Error('Error al generar el enlace de acceso');
    }

    // Construir URL del magic link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const magicLinkUrl = `${baseUrl}/client-access?token=${token}`;

    // Log de auditoría
    await logAuditAction({
      action: 'GENERATE_MAGIC_LINK',
      entity_type: 'magic_link',
      entity_id: newMagicLink.id,
      diff_json: { 
        created: { 
          email: validatedInput.email, 
          case_id: validatedInput.case_id,
          expires_at: expiresAt.toISOString()
        } 
      },
    });

    // TODO: Enviar email con el magic link
    // await sendMagicLinkEmail(validatedInput.email, magicLinkUrl, newMagicLink.case);

    revalidatePath(`/cases/${validatedInput.case_id}`);

    return { 
      success: true, 
      magicLink: newMagicLink,
      url: magicLinkUrl
    };
  } catch (error) {
    console.error('Error in generateMagicLink:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Valida un magic link y retorna la información del caso
 */
export async function validateMagicLink(input: ValidateMagicLinkInput) {
  try {
    const validatedInput = validateMagicLinkSchema.parse(input);
    const supabase = createServiceClient();

    const { data: magicLink, error } = await supabase
      .from('magic_links')
      .select(`
        *,
        case:cases(
          id,
          caratulado,
          nombre_cliente,
          estado,
          etapa_actual,
          abogado_responsable:profiles(nombre, telefono)
        )
      `)
      .eq('token', validatedInput.token)
      .single();

    if (error || !magicLink) {
      throw new Error('Enlace de acceso inválido o expirado');
    }

    // Verificar si el enlace ha expirado
    if (new Date(magicLink.expires_at) < new Date()) {
      throw new Error('El enlace de acceso ha expirado');
    }

    // Verificar si ya fue usado (si es de un solo uso)
    if (magicLink.is_used && magicLink.single_use) {
      throw new Error('Este enlace de acceso ya fue utilizado');
    }

    return { 
      success: true, 
      magicLink,
      case: magicLink.case
    };
  } catch (error) {
    console.error('Error in validateMagicLink:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Crea un perfil de cliente desde un magic link
 */
export async function createClientFromMagicLink(input: CreateClientFromMagicLinkInput) {
  try {
    const validatedInput = createClientFromMagicLinkSchema.parse(input);
    const supabase = createServiceClient();

    // Validar el magic link primero
    const linkValidation = await validateMagicLink({ token: validatedInput.token });
    if (!linkValidation.success || !linkValidation.magicLink) {
      throw new Error(linkValidation.error || 'Magic link inválido');
    }

    const magicLink = linkValidation.magicLink;

    // Verificar si ya existe un usuario con este email
    const { data: existingUser } = await supabase.auth.admin.getUserByEmail(magicLink.email);
    
    if (existingUser.user) {
      // Si el usuario ya existe, solo crear la relación con el caso
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', existingUser.user.id)
        .single();

      if (existingProfile) {
        // Crear relación cliente-caso si no existe
        const { error: relationError } = await supabase
          .from('case_clients')
          .upsert({
            case_id: magicLink.case_id,
            client_profile_id: existingProfile.id,
          });

        if (relationError) {
          console.error('Error creating case-client relation:', relationError);
        }

        // Marcar magic link como usado
        await supabase
          .from('magic_links')
          .update({ 
            is_used: true, 
            used_at: new Date().toISOString(),
            client_profile_id: existingProfile.id
          })
          .eq('id', magicLink.id);

        return { 
          success: true, 
          profile: existingProfile,
          isNewUser: false
        };
      }
    }

    // Crear nuevo usuario con email
    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email: magicLink.email,
      email_confirm: true,
    });

    if (authError || !newUser.user) {
      console.error('Error creating user:', authError);
      throw new Error('Error al crear el usuario');
    }

    // Crear perfil del cliente
    const profileData: ProfileInsert = {
      id: newUser.user.id,
      email: magicLink.email,
      nombre: validatedInput.nombre,
      telefono: validatedInput.telefono,
      rut: validatedInput.rut,
      role: 'cliente',
    };

    const { data: newProfile, error: profileError } = await supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single();

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Intentar eliminar el usuario creado
      await supabase.auth.admin.deleteUser(newUser.user.id);
      throw new Error('Error al crear el perfil del cliente');
    }

    // Crear relación cliente-caso
    const { error: relationError } = await supabase
      .from('case_clients')
      .insert({
        case_id: magicLink.case_id,
        client_profile_id: newProfile.id,
      });

    if (relationError) {
      console.error('Error creating case-client relation:', relationError);
      throw new Error('Error al asociar el cliente con el caso');
    }

    // Marcar magic link como usado
    await supabase
      .from('magic_links')
      .update({ 
        is_used: true, 
        used_at: new Date().toISOString(),
        client_profile_id: newProfile.id
      })
      .eq('id', magicLink.id);

    // Log de auditoría
    await logAuditAction({
      action: 'CREATE_CLIENT_FROM_MAGIC_LINK',
      entity_type: 'profile',
      entity_id: newProfile.id,
      diff_json: { 
        created: profileData,
        magic_link_id: magicLink.id
      },
    });

    return { 
      success: true, 
      profile: newProfile,
      isNewUser: true
    };
  } catch (error) {
    console.error('Error in createClientFromMagicLink:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Autentica un cliente usando un magic link
 */
export async function authenticateWithMagicLink(token: string) {
  try {
    const supabase = createServiceClient();

    // Validar el magic link
    const linkValidation = await validateMagicLink({ token });
    if (!linkValidation.success || !linkValidation.magicLink) {
      throw new Error(linkValidation.error || 'Magic link inválido');
    }

    const magicLink = linkValidation.magicLink;

    // Buscar si ya existe un perfil asociado
    let clientProfile = null;
    if (magicLink.client_profile_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', magicLink.client_profile_id)
        .single();
      
      clientProfile = profile;
    } else {
      // Buscar por email
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', magicLink.email)
        .eq('role', 'cliente')
        .single();
      
      clientProfile = profile;
    }

    if (!clientProfile) {
      // El cliente necesita completar su registro
      return {
        success: true,
        needsRegistration: true,
        magicLink,
        case: linkValidation.case
      };
    }

    // Generar sesión para el cliente
    const { data: session, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: magicLink.email,
    });

    if (sessionError) {
      console.error('Error generating session:', sessionError);
      throw new Error('Error al generar la sesión');
    }

    // Actualizar último acceso del magic link
    await supabase
      .from('magic_links')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', magicLink.id);

    return {
      success: true,
      needsRegistration: false,
      profile: clientProfile,
      case: linkValidation.case,
      sessionUrl: session.properties?.action_link
    };
  } catch (error) {
    console.error('Error in authenticateWithMagicLink:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Obtiene magic links con filtros
 */
export async function getMagicLinks(filters: MagicLinkFiltersInput = {}) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new Error('No autenticado');
    }

    // Solo abogados y admin pueden ver magic links
    if (profile.role === 'cliente') {
      throw new Error('Sin permisos para ver enlaces de acceso');
    }

    const validatedFilters = magicLinkFiltersSchema.parse(filters);
    const supabase = createClient();

    let query = supabase
      .from('magic_links')
      .select(`
        *,
        case:cases(id, caratulado),
        created_by_profile:profiles!magic_links_created_by_fkey(nombre),
        client_profile:profiles!magic_links_client_profile_id_fkey(nombre)
      `);

    // Aplicar filtros de acceso según rol
    if (profile.role === 'abogado') {
      // Los abogados solo ven magic links de sus casos
      const { data: abogadoCases } = await supabase
        .from('cases')
        .select('id')
        .eq('abogado_responsable', profile.id);
      
      const caseIds = abogadoCases?.map(c => c.id) || [];
      if (caseIds.length === 0) {
        return { success: true, magicLinks: [], total: 0 };
      }
      
      query = query.in('case_id', caseIds);
    }

    // Aplicar filtros adicionales
    if (validatedFilters.case_id) {
      // Verificar acceso al caso específico
      const hasAccess = await canAccessCase(validatedFilters.case_id);
      if (!hasAccess) {
        throw new Error('Sin permisos para acceder a este caso');
      }
      query = query.eq('case_id', validatedFilters.case_id);
    }

    if (validatedFilters.email) {
      query = query.eq('email', validatedFilters.email);
    }

    if (validatedFilters.is_used !== undefined) {
      query = query.eq('is_used', validatedFilters.is_used);
    }

    if (validatedFilters.is_expired !== undefined) {
      if (validatedFilters.is_expired) {
        query = query.lt('expires_at', new Date().toISOString());
      } else {
        query = query.gte('expires_at', new Date().toISOString());
      }
    }

    if (validatedFilters.created_by) {
      query = query.eq('created_by', validatedFilters.created_by);
    }

    // Paginación
    const from = (validatedFilters.page - 1) * validatedFilters.limit;
    const to = from + validatedFilters.limit - 1;

    const { data: magicLinks, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching magic links:', error);
      throw new Error('Error al obtener enlaces de acceso');
    }

    return { 
      success: true, 
      magicLinks: magicLinks || [], 
      total: count || 0,
      page: validatedFilters.page,
      limit: validatedFilters.limit,
    };
  } catch (error) {
    console.error('Error in getMagicLinks:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido',
      magicLinks: [],
      total: 0,
    };
  }
}

/**
 * Revoca un magic link
 */
export async function revokeMagicLink(magicLinkId: string) {
  try {
    const profile = await requireAuth();
    const supabase = createClient();

    // Obtener el magic link
    const { data: magicLink, error: fetchError } = await supabase
      .from('magic_links')
      .select('*')
      .eq('id', magicLinkId)
      .single();

    if (fetchError || !magicLink) {
      throw new Error('Enlace de acceso no encontrado');
    }

    // Verificar permisos
    if (profile.role !== 'admin_firma' && magicLink.created_by !== profile.id) {
      // Los abogados pueden revocar magic links de sus casos
      if (profile.role === 'abogado') {
        const hasAccess = await canAccessCase(magicLink.case_id);
        if (!hasAccess) {
          throw new Error('Sin permisos para revocar este enlace');
        }
      } else {
        throw new Error('Sin permisos para revocar este enlace');
      }
    }

    // Marcar como expirado
    const { error } = await supabase
      .from('magic_links')
      .update({ 
        expires_at: new Date().toISOString(),
        revoked_at: new Date().toISOString(),
        revoked_by: profile.id
      })
      .eq('id', magicLinkId);

    if (error) {
      console.error('Error revoking magic link:', error);
      throw new Error('Error al revocar el enlace de acceso');
    }

    // Log de auditoría
    await logAuditAction({
      action: 'REVOKE_MAGIC_LINK',
      entity_type: 'magic_link',
      entity_id: magicLinkId,
      diff_json: { revoked: true },
    });

    revalidatePath(`/cases/${magicLink.case_id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in revokeMagicLink:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}
