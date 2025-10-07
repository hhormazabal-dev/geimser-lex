'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// tipamos el cliente como el de supabase-js, esquema "public"
type SB = SupabaseClient<Database, 'public'>

let browserClient: SB | null = null

export function getBrowserClient(): SB {
  if (typeof window === 'undefined') {
    throw new Error('[Supabase] getBrowserClient() solo cliente')
  }

  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // createBrowserClient tiene firma genérica distinta: casteamos vía unknown
    browserClient = createBrowserClient<Database>(url, key) as unknown as SB
  }

  return browserClient
}

// NO exportes un "const supabase = getBrowserClient()"
// para evitar ejecutarlo en SSR.
