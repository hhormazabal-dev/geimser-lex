// scripts/set-admin-passwords.ts
import 'dotenv/config'
import { createClient, type User } from '@supabase/supabase-js'

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const
for (const k of REQUIRED) {
  if (!process.env[k]) {
    throw new Error(`Faltan ${REQUIRED.join(' o ')} en .env.local`)
  }
}

const supabaseUrl = process.env.SUPABASE_URL as string
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
const password = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin123$'

const ADMIN_EMAILS = [
  'lpincheirah@geimser.cl',
  'israel.alvarez.huerta@gmail.com',
  'pmelellim@gmail.com',
  'hh2fc24@gmail.com',
]

// Busca un usuario por email recorriendo listUsers() con paginación
async function findUserByEmail(email: string, perPage = 1000, maxPages = 10): Promise<User | null> {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < perPage) break // no hay más páginas
  }
  return null
}

async function ensurePassword(email: string) {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1) Buscar por email
  const existing = await findUserByEmail(email)

  if (!existing) {
    // 2) No existe → crear con password y email confirmado
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr) {
      console.error(`✖ Crear ${email}:`, createErr.message)
      return
    }
    console.log(`✔ Creado ${email} (${created.user?.id}) con password seteada`)
    return
  }

  // 3) Existe → intentar actualizar password
  const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, { password })
  if (!updErr) {
    console.log(`✔ Password actualizado para ${email} (${existing.id})`)
    return
  }

  // 4) Fallback: generar link de recuperación si hay error de DB
  if (updErr.message?.toLowerCase().includes('database error')) {
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
          : undefined,
      },
    })
    if (linkErr) {
      console.error(`✖ Password update y fallback fallaron para ${email}:`, updErr.message, ' | ', linkErr.message)
      return
    }
    const resetUrl = linkData?.properties?.action_link
    if (resetUrl) {
      console.log(`⚠ No se pudo actualizar password para ${email}. Usa este link de recuperación para setearla ahora:\n${resetUrl}\n`)
    } else {
      console.log(`⚠ Link de recuperación generado para ${email}, pero no se recibió action_link en la respuesta.`)
    }
    return
  }

  // Otros errores
  console.error(`✖ Update password ${email}:`, updErr.message)
}

async function main() {
  console.log(`[set-admin-passwords] usando ${supabaseUrl}`)
  console.log(`[set-admin-passwords] contraseña a aplicar: ${'*'.repeat(password.length)}`)

  for (const email of ADMIN_EMAILS) {
    try {
      await ensurePassword(email)
    } catch (e) {
      console.error(`✖ Excepción para ${email}:`, e)
    }
  }
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})