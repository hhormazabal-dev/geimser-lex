import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xsvvdshbhaheqymquzjl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdnZkc2hiaGFoZXF5bXF1empsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTUwNTExMywiZXhwIjoyMDc1MDgxMTEzfQ.WbV1RNDbGlR6swAmlU0rs1PNCIIhTvGbxhqUA9uDN4A'
)

const users = [
  {
    id: '0b195feb-75f0-46eb-b797-08b08a2c7129',
    email: 'lpincheirah@geimser.cl',
  },
  {
    id: '8d5112a5-8268-47ad-9e2e-069773ec43b4',
    email: 'pmelellim@gmail.com',
  },
  {
    id: 'adf25326-08ea-4cde-9052-125fdb4eec47',
    email: 'hh2fc24@gmail.com',
  },
  {
    id: 'd173f066-bf27-4fa0-be2e-508bbd7845ce',
    email: 'israel.alvarez.huerta@gmail.com',
  },
]

const newPassword = 'Temporal#2025'

async function forceResetPasswords() {
  for (const user of users) {
    console.log(`🔄 Reseteando ${user.email}...`)
    
    // Primero invalidamos sesiones previas
    await supabase.auth.admin.signOut(user.id).catch(() => {})

    // Luego actualizamos la contraseña y forzamos confirmación de email
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
      email_confirm: true,
    })

    if (error) {
      console.error(`❌ ${user.email}: ${error.message}`)
    } else {
      console.log(`✅ Contraseña actualizada correctamente para ${user.email}`)
    }
  }
}

forceResetPasswords()
