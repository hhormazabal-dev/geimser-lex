// src/app/api/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  // ⬇️ En Next 15 hay que AWAIT
  const c = await cookies();
  c.delete('sb-access-token');
  c.delete('sb-refresh-token');
  return NextResponse.json({ ok: true });
}
