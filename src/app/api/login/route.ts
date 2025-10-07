// src/app/api/login/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y password requeridos' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.session) {
      return NextResponse.json(
        { error: error?.message ?? 'Login inválido' },
        { status: 401 }
      );
    }

    const { access_token, refresh_token, expires_in } = data.session;

    // ⬇️ En Next 15 hay que AWAIT
    const c = await cookies();
    const maxAge = Math.max(1, Number(expires_in ?? 3600));

    c.set('sb-access-token', access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    c.set('sb-refresh-token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });

    return NextResponse.json({
      ok: true,
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Error en login' },
      { status: 500 }
    );
  }
}
