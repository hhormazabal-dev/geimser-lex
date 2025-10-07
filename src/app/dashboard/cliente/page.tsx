'use server'

import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth/roles'
import { ClientDashboard } from '@/components/ClientDashboard'  // ← named import

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

  // Evita trabajo extra aquí: la page cliente muestra el dashboard del cliente
  return <ClientDashboard profile={profile as any} cases={[]} />
}
