// scripts/gen-admin-reset-links.ts
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !service) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
}

const REDIRECT =
  process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
    : undefined

const ADMIN_EMAILS = [
  'lpincheirah@geimser.cl',
  'israel.alvarez.huerta@gmail.com',
  'pmelellim@gmail.com',
  'hh2fc24@gmail.com',
]

async function main() {
  // 👇 ya están validados arriba; castear elimina el union con undefined
  const supabase = createClient(url as string, service as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`[gen-admin-reset-links] usando ${url}`)
  console.log(`Redirect después del reset: ${REDIRECT ?? '(none)'}`)
  console.log('---')

  for (const email of ADMIN_EMAILS) {
    try {
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: REDIRECT },
      })
      if (error) {
        console.error(`✖ Error generando link para ${email}: ${error.message}`)
        continue
      }
      const link = data?.properties?.action_link
      if (!link) {
        console.error(`✖ ${email}: respuesta sin action_link`)
        continue
      }
      console.log(`✔ ${email}\n${link}\n`)
    } catch (e) {
      console.error(`✖ Excepción para ${email}:`, e)
    }
  }

  console.log('Listo.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})