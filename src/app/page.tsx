// src/app/page.tsx
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Home() {
  const h = await headers()
  const cookie = h.get('cookie') || ''
  // si ya hay sesión, manda al dashboard; si no, al login
  if (cookie.includes('sb-access-token=')) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
