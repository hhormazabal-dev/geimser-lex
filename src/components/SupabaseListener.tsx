'use client'

import { useEffect } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'

export default function SupabaseListener() {
  useEffect(() => {
    const supabase = getBrowserClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Sincroniza cookies/SSR state con tu API
      await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ event: _event, session }),
      })
    })

    return () => subscription.unsubscribe()
  }, [])

  return null
}
