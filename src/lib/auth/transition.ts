import { createServerClient } from '@/lib/supabase/server';

const TRANSITION_ADMIN_EMAILS = new Set(['catalina@xel', 'hh2fc24@gmail.com']);

export function isTransitionEmail(email?: string | null) {
  if (!email) return false;
  return TRANSITION_ADMIN_EMAILS.has(email.trim().toLowerCase());
}

export async function requireTransitionAccess() {
  const supabase = await createServerClient();
  const { data: authData, error } = await supabase.auth.getUser();
  if (error || !authData?.user) {
    throw new Error('No autenticado');
  }

  const email = (authData.user.email ?? '').trim().toLowerCase();
  if (!isTransitionEmail(email)) {
    throw new Error('Sin permisos');
  }

  return { user: authData.user, email };
}
