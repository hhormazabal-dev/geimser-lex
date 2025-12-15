'use server'

import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth/roles'
import { createServerClient } from '@/lib/supabase/server'
import { ClientDashboard, type ClientPortalCase } from '@/components/ClientDashboard'  // ← named import

export default async function ClientDashboardPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  // Normaliza rol efectivo SIN romper tipos:
  const role =
    ((profile as any)._role_override as string | undefined) ??
    profile.role // 'admin_firma' | 'abogado' | 'cliente' | 'analista'

  if (role !== 'cliente') {
    console.warn('[ROLE DEBUG] acceso NO cliente a /dashboard/cliente', {
      id: (profile as any).id,
      email: profile.email,
      role_effective: role,
    })
    redirect('/dashboard') // deja que /dashboard rote según rol
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('case_clients')
    .select(
      `
        created_at,
        case:cases (
          id,
          caratulado,
          numero_causa,
          estado,
          prioridad,
          etapa_actual,
          sentencia_estado,
          sentencia_fecha,
          honorario_moneda,
          honorario_total_uf,
          honorario_pagado_uf,
          modalidad_cobro,
          valor_estimado,
          observaciones,
          contraparte,
          fecha_inicio,
          updated_at,
          tribunal,
          materia,
          abogado_responsable,
          abogado_responsable_profile:profiles!cases_abogado_responsable_fkey(id, nombre, email, telefono)
        )
      `,
    )
    .eq('client_profile_id', profile.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[CLIENT PORTAL] Error fetching client cases', error)
  }

  const cases: ClientPortalCase[] = (data ?? []).flatMap((row) => {
    const caseData = row.case
    if (!caseData) return []
    const normalized = {
      ...caseData,
      abogado_responsable_profile: caseData.abogado_responsable_profile ?? null,
    } as ClientPortalCase
    return [normalized]
  })

  // Evita trabajo extra aquí: la page cliente muestra el dashboard del cliente
  return <ClientDashboard profile={profile} cases={cases} />
}
