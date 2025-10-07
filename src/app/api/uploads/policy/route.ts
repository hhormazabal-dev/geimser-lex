import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, canAccessCase } from '@/lib/auth/roles'

export const runtime = 'nodejs' // evita edge con SERVICE_ROLE

export async function POST(request: NextRequest) {
  const profile = await requireAuth()

  const body = await request.json().catch(() => ({} as any))
  const { caseId, fileName } = body

  if (!caseId || !fileName) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const hasAccess = await canAccessCase(caseId)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const supabase = await createServiceClient() // <-- AQUÍ EL AWAIT

  const filePath = `cases/${caseId}/${fileName}`

  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUploadUrl(filePath, { upsert: false })

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo generar la firma' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    path: filePath,
    signedUrl: data.signedUrl,
    token: data.token,
  })
}