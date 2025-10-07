import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Faltan email/password' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !anon) {
      return NextResponse.json({ error: 'Faltan envs de Supabase en el server' }, { status: 500 })
    }

    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': anon,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    })

    const body = await r.json()

    if (!r.ok) {
      // devuelve el mismo mensaje que da Supabase (ej. "Invalid login credentials")
      return NextResponse.json({ error: body?.message || 'Auth error' }, { status: r.status })
    }

    // seguridad: no devuelvas TODO; lo mínimo necesario para setSession
    const payload = {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      token_type: body.token_type,
      expires_in: body.expires_in,
      user: body.user,
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
