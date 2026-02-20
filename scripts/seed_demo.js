require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE URL or KEY in environment.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DEMO_EMAIL = 'demo@geimser.cl';
const NUM_CASES = 60;

const matters = ['Civil', 'Familia', 'Laboral', 'Comercial', 'Penal'];
const statuses = ['activo', 'activo', 'activo', 'terminado', 'terminado_apelacion', 'terminado_desistido_demandante'];
const priorities = ['alta', 'media', 'media', 'baja'];
const wfStates = ['preparacion', 'mediacion', 'juicio', 'apelacion', 'cierre'];

function randomDateIn2026() {
    const start = new Date(2026, 0, 1).getTime();
    const end = new Date(2026, 11, 31).getTime();
    const randTime = start + Math.random() * (end - start);
    return new Date(randTime).toISOString();
}

function randElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function run() {
    console.log(`Buscando usuario ${DEMO_EMAIL}...`);
    const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('id, nombre, active_organization_id')
        .eq('email', DEMO_EMAIL)
        .single();

    if (userError || !users) {
        console.error("Error buscando al usuario (asegurate de que el email exista en la tabla profiles):", userError);
        process.exit(1);
    }

    const userId = users.id;
    const orgId = users.active_organization_id;
    console.log(`Usuario encontrado: ${users.nombre} (${userId}) | Org: ${orgId}`);

    console.log(`Generando ${NUM_CASES} casos aleatorios para 2026...`);
    const newCases = [];

    for (let i = 1; i <= NUM_CASES; i++) {
        const materia = randElement(matters);
        const estado = randElement(statuses);

        // Simulate cases with past and future 2026 dates
        const date1 = randomDateIn2026();
        const date2 = randomDateIn2026();
        // ensure created_at is before updated_at
        const [created_at, updated_at] = date1 < date2 ? [date1, date2] : [date2, date1];

        let sentencia = null;
        let terminoSinDoc = false;
        if (estado.startsWith('terminado')) {
            terminoSinDoc = true;
            sentencia = 'dictada';
        }

        newCases.push({
            caratulado: `Causa Demo ${materia} N° ${i}-${new Date(created_at).getFullYear()}`,
            estado: estado,
            materia: materia,
            prioridad: randElement(priorities),
            valor_estimado: Math.floor(Math.random() * 5000000) + 500000,
            fecha_inicio: created_at,
            abogado_responsable: userId,
            organization_id: orgId,
            workflow_state: randElement(wfStates),
            nombre_cliente: `Cliente Prueba ${i}`,
            sentencia_estado: sentencia,
            termino_sin_documento: terminoSinDoc,
            created_at: created_at,
            updated_at: updated_at
        });
    }

    const { error: insertError } = await supabase
        .from('cases')
        .insert(newCases);

    if (insertError) {
        console.error("Error insertando casos:", insertError);
    } else {
        console.log("¡60 Casos insertados con éxito!");
    }
}

run();
