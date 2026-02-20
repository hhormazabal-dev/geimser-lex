require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE URL or KEY in environment.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function generateRUT() {
    const num = Math.floor(Math.random() * 20000000) + 5000000;
    return `${num}-K`;
}

function generatePhone() {
    return `+569${Math.floor(Math.random() * 90000000) + 10000000}`;
}

async function run() {
    const userId = 'baef2cf4-f47f-4cb5-a0ea-dde937b605a8'; // demo user

    console.log(`Buscando causas demo sin cliente para el usuario demo...`);
    const { data: cases, error: searchError } = await supabase
        .from('cases')
        .select('id, nombre_cliente, created_at')
        .eq('abogado_responsable', userId)
        .like('caratulado', 'Causa Demo%');

    if (searchError || !cases) {
        console.error('Error buscando causas:', searchError);
        process.exit(1);
    }

    // Find cases without a case_client entry
    const { data: caseClients } = await supabase
        .from('case_clients')
        .select('case_id')
        .in('case_id', cases.map(c => c.id));

    const casesWithClients = new Set((caseClients || []).map(cc => cc.case_id));
    const casesToProcess = cases.filter(c => !casesWithClients.has(c.id));

    console.log(`Creando clientes y asociándolos a los ${casesToProcess.length} casos...`);

    // We'll create 5 mock clients and distribute the cases among them
    const mockClients = [];
    for (let c = 1; c <= 5; c++) {
        const email = `cliente.demo.${Date.now()}.${c}@geimser.cl`;
        const nombre = `Cliente Frecuente ${c}`;

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: 'Password123!',
            email_confirm: true,
        });

        if (authError) {
            console.error(`Error creando auth user ${email}:`, authError);
            continue;
        }

        const userId = authData.user.id;

        // Upsert profile
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                user_id: userId,
                email: email,
                nombre: nombre,
                role: 'cliente',
                rut: generateRUT(),
                telefono: generatePhone(),
                activo: true,
                organization_id: '00f1d02e-84fe-4a30-95e7-f32044e85921'
            });

        if (profileError) {
            console.error(`Error actualizando perfil para ${email}:`, profileError);
        } else {
            mockClients.push(userId);
            console.log(`Cliente mock creado: ${nombre}`);
        }
    }

    if (mockClients.length === 0) {
        console.error("No se pudieron crear los clientes mock.");
        process.exit(1);
    }

    let successCount = 0;
    for (let i = 0; i < casesToProcess.length; i++) {
        const c = casesToProcess[i];
        const clientProfileId = mockClients[i % mockClients.length];

        // Create case_client mapping
        const { error: mappingError } = await supabase
            .from('case_clients')
            .insert({
                case_id: c.id,
                client_profile_id: clientProfileId,
                is_primary: true,
                created_at: c.created_at
            });

        if (mappingError) {
            console.error(`Error vinculando cliente al caso ${c.id}:`, mappingError);
        } else {
            successCount++;
        }
    }

    console.log(`¡Exito! Se crearon ${successCount}/${casesToProcess.length} clientes y se asociaron a los casos.`);
}

run();
