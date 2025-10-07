import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }))
        },
        setAll() {}, // read-only
      },
    }
  )

  const { data: authData, error: authErr } = await supabase.auth.getUser()
  const user = authData?.user ?? null

  let profile = null as any
  let profileErr: string | null = null
  if (user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, email, role, nombre, activo')
      .eq('user_id', user.id)
      .maybeSingle()
    profile = data ?? null
    profileErr = error?.message ?? null
  }

  return NextResponse.json({
    hasAuthCookies: cookieStore.getAll().some((c) => c.name.includes('sb-') || c.name.includes('auth')),
    user: user ? { id: user.id, email: user.email } : null,
    profile,
    errors: { auth: authErr?.message ?? null, profile: profileErr },
  })
}
