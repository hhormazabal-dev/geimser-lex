import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'Temporal#2025'
const supabase = createClient(url, serviceRole)

type Cand = { email: string; user_metadata?: Record<string, any> }
const candidates: Cand[] = [
  { email: 'lpincheirah@geimser.cl', user_metadata: { nombre: 'Luis Pincheira' } },
  { email: 'israel.alvarez.huerta@gmail.com', user_metadata: { nombre: 'Israel Álvarez' } },
  { email: 'pmelellim@gmail.com', user_metadata: { nombre: 'Pablo Meléllim' } },
  { email: 'hh2fc24@gmail.com', user_metadata: { nombre: 'Hugo (alt)' } },
]

async function findByEmail(email: string) {
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const hit = data.users.find(u => (u.email || '').toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 1000) return null
    page++
  }
}

async function upsertUser(email: string, meta: Record<string, any> = {}) {
  const existing = await findByEmail(email)

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: DEFAULT_PASSWORD,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: meta,
    })
    if (error) throw error
    console.log('✅ Updated password/meta for', email)
    return
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: DEFAULT_PASSWORD,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: meta,
  })
  if (error) throw error
  console.log('🆕 Created', email, data.user?.id)
}

;(async () => {
  for (const c of candidates) {
    try { await upsertUser(c.email, c.user_metadata ?? {}) }
    catch (e) { console.error('❌', c.email, e) }
  }
  process.exit(0)
})()
