declare module '@/lib/supabase/server' {
  import type { SupabaseClient } from '@supabase/supabase-js';
  import type { Database } from '@/lib/supabase/types';

  export function createServerClient(): Promise<SupabaseClient<Database>>;
  export function createServiceClient(): SupabaseClient<Database>;
}
