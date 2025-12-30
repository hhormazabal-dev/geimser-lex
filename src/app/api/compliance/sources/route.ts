import { NextResponse } from 'next/server';
import { COMPLIANCE_SOURCES } from '@/lib/compliance/sources';

export async function GET() {
  return NextResponse.json({ ok: true, sources: COMPLIANCE_SOURCES });
}

