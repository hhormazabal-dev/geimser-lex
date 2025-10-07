// src/lib/supabase/server.ts
import { cookies } from 'next/headers';
import { createServerClient as createSSRClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente ligado a cookies (SSR/App Router)
export async function createServerClient() {
  const store = await cookies();

  const client = createSSRClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieOptions) {
        // En Next 15, mutar cookies fuera de Server Action/Route Handler rompe.
        // Envolvemos en try/catch para no reventar durante el render de RSC.
        try {
          if (options) {
            store.set(name, value, options);
          } else {
            store.set(name, value);
          }
        } catch {
          // no-op en contextos donde Next prohíbe la mutación (RSC render)
        }
      },
      remove(name: string, options?: CookieOptions) {
        try {
          if (options) {
            store.set(name, '', { ...options, expires: new Date(0) });
          } else {
            store.set(name, '', { expires: new Date(0) });
          }
        } catch {
          // no-op en contextos donde Next prohíbe la mutación (RSC render)
        }
      },
    },
  });

  return client;
}

// Cliente de servicio (bypassa RLS para jobs/upserts controlados)
export function createServiceClient() {
  return createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}