import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xsvvdshbhaheqymquzjl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdnZkc2hiaGFoZXF5bXF1empsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MDUxMTMsImV4cCI6MjA3NTA4MTExM30.exy4Scb4paVi8tGs_-FXuHpIW9OFsbCS5sC8J_XdLv8'
)

const testLogin = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'hh2fc24@gmail.com',
    password: 'Temporal#2025',
  })

  if (error) console.error('❌', error.message)
  else console.log('✅ Login correcto:', data.user?.email)
}

testLogin()
