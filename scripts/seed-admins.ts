// 1) Carga dotenv desde .env.local
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false }
});

type NewAdmin = { email: string; nombre: string };

// Lista a invitar/crear
const admins: NewAdmin[] = [
  { email: 'lpincheirah@geimser.cl', nombre: 'Laura Pincheira' },
  { email: 'israel.alvarez.huerta@gmail.com', nombre: 'Israel Alvarez' },
  { email: 'pmelellim@gmail.com', nombre: 'Paula Melelli' },
  { email: 'hh2fc24@gmail.com', nombre: 'Hugo Hormazabal' },
];

const TEMP_PASSWORD = 'Temporal#2025'; // o genera uno al vuelo

async function upsertAdmin({ email, nombre }: NewAdmin) {
  // 1) Crea usuario auth si no existe
  const { data: authUser, error: signUpErr } = await supabase.auth.admin.createUser({
    email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { nombre, role: 'admin_firma' }
  });

  // Si ya existe, buscamos su id
  let userId = authUser?.user?.id;
  if (signUpErr && !userId) {
    const { data: existing, error: getErr } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', email)
      .maybeSingle();
    if (getErr) throw getErr;
    userId = existing?.user_id ?? undefined;
  }

  if (!userId) {
    // último intento: consulta a auth.users vía RPC (si tienes rpc) o avisa
    throw new Error(`No se pudo obtener user_id para ${email}: ${signUpErr?.message ?? 'desconocido'}`);
  }

  // 2) Upsert en profiles
  const { error: upsertErr } = await supabase
    .from('profiles')
    .upsert(
      { user_id: userId, nombre, email, role: 'admin_firma' },
      { onConflict: 'user_id' }
    );

  if (upsertErr) throw upsertErr;

  console.log(`✔ Admin listo: ${email}`);
}

(async () => {
  for (const a of admins) {
    try {
      await upsertAdmin(a);
    } catch (e) {
      console.error(`✖ Error con ${a.email}:`, e);
    }
  }
  console.log('Done.');
})();
