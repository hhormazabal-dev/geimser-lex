import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !service) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')

// ✅ después del guard, afirmar tipos a string
const supabaseUrl = url as string
const serviceRole = service as string

// redirect opcional
const REDIRECT =
  process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
    : undefined

const TEMP_PASSWORD = process.env.ADMIN_TEMP_PASSWORD || 'Temporal#2025'
const ADMIN_EMAILS = [
  'lpincheirah@geimser.cl',
  'israel.alvarez.huerta@gmail.com',
  'pmelellim@gmail.com',
  'hh2fc24@gmail.com',
]

const errMsg = (e: unknown) =>
  (e as any)?.message || (e as any)?.error_description || (e as any)?.msg || String(e)
const errStatus = (e: unknown) => (e as any)?.status as number | undefined
const errCode = (e: unknown) => (e as any)?.code as string | undefined

async function ensureOne(email: string) {
  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`\n==> ${email}`)

  // 1) crear (si ya existe, seguimos)
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'admin_firma', seed: true },
    })
    if (error) {
      const status = errStatus(error)
      const code = errCode(error)
      if (status === 422 || code === 'user_already_exists') {
        console.log(' • Ya existía en Auth, seguimos…')
      } else {
        console.warn(` • createUser: ${errMsg(error)}`)
      }
    } else {
      console.log(` • Usuario en Auth (id: ${data.user?.id})`)
    }
  } catch (e) {
    console.warn(` • createUser excepción: ${errMsg(e)}`)
  }

  // ✅ construir opciones SOLO si hay redirect
  const linkOptions = REDIRECT ? { redirectTo: REDIRECT } : undefined

  // 2) recovery
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: linkOptions, // <- ya no es string | undefined
    })
    if (error) throw error
    const link = data?.properties?.action_link
    if (link) {
      console.log(' ✔ Recovery link:')
      console.log(link)
      return
    }
    console.warn(' • Recovery sin action_link, probamos magiclink…')
  } catch (e) {
    console.warn(` • recovery falló: ${errMsg(e)}`)
  }

  // 3) fallback magiclink
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: linkOptions,
    })
    if (error) throw error
    const link = data?.properties?.action_link
    if (link) {
      console.log(' ✔ Magiclink:')
      console.log(link)
      return
    }
    console.error(' ✖ Magiclink sin action_link')
  } catch (e) {
    console.error(` ✖ magiclink falló: ${errMsg(e)}`)
  }
}

async function main() {
  console.log(`[ensure-admin-access] usando ${supabaseUrl}`)
  console.log(`Redirect: ${REDIRECT ?? '(none)'} | Temp pwd: ${'*'.repeat(8)}`)
  for (const email of ADMIN_EMAILS) await ensureOne(email)
  console.log('\nListo.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})