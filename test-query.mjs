import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase
        .from('cases')
        .select(`
        id,
        caratulado,
        numero_causa,
        demandado,
        materia,
        prioridad,
        etapa_actual,
        nombre_cliente,
        updated_at,
        next_action_at
      `)
        .is('deleted_at', null)
        .in('estado', ['activo', 'terminado_apelacion'])
        .order('prioridad', { ascending: true })
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('SUPABASE ERROR:', error);
    } else {
        console.log(`Success! Found ${data.length} cases.`);
    }
}

test();
