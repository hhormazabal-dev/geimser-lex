'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';
import type { LegalTemplate, QuickLink } from '@/lib/supabase/types';

export async function listQuickLinks() {
  const profile = await requireAuth();
  if (profile.role === 'cliente') {
    throw new Error('Sin permisos');
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('quick_links')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data as QuickLink[];
}

export async function createQuickLink(formData: FormData) {
  const profile = await requireAuth();
  if (profile.role === 'cliente') {
    throw new Error('Sin permisos');
  }

  const title = String(formData.get('title') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim() || null;

  if (!title || !url) {
    throw new Error('Título y URL son obligatorios');
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from('quick_links').insert({
    title,
    url,
    category,
    created_by: profile.id,
    icon: formData.get('icon') ? String(formData.get('icon')) : null,
  });

  if (error) {
    throw error;
  }

  revalidatePath('/dashboard/abogado');
  return { success: true };
}

export async function deleteQuickLink(id: string) {
  const profile = await requireAuth();
  if (profile.role === 'cliente') {
    throw new Error('Sin permisos');
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from('quick_links').delete().eq('id', id);

  if (error) {
    throw error;
  }

  revalidatePath('/dashboard/abogado');
  return { success: true };
}

export async function listLegalTemplates() {
  const profile = await requireAuth();
  if (profile.role === 'cliente') {
    throw new Error('Sin permisos');
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('legal_templates')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data as LegalTemplate[];
}

export async function createLegalTemplate(formData: FormData) {
  const profile = await requireAuth();
  if (profile.role === 'cliente') {
    throw new Error('Sin permisos');
  }

  const title = String(formData.get('title') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim() || null;

  if (!title || !content) {
    throw new Error('Debes completar título y contenido');
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from('legal_templates').insert({
    title,
    content,
    category,
    created_by: profile.id,
    is_shared: profile.role === 'admin_firma',
  });

  if (error) {
    throw error;
  }

  revalidatePath('/dashboard/abogado');
  return { success: true };
}
