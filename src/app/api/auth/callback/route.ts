// src/app/api/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const { access_token, refresh_token, expires_in } = body ?? {};

  if (!access_token || !refresh_token) {
    return NextResponse.json({ ok: false, error: 'Missing tokens' }, { status: 400 });
    }

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
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true });
}
