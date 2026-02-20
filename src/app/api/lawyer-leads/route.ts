import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.GEIMSER2025_SUPABASE_URL;
const supabaseKey = process.env.GEIMSER2025_SUPABASE_SERVICE_KEY;

export async function POST(req: NextRequest) {
    try {
        if (!supabaseUrl || !supabaseKey) {
            console.warn("Faltan variables de entorno GEIMSER2025_SUPABASE_URL o GEIMSER2025_SUPABASE_SERVICE_KEY");
            return NextResponse.json({ error: 'Faltan configuraciones del servidor' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const body = await req.json();
        const { name, email, phone } = body;

        if (!name || (!email && !phone)) {
            return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
        }

        // Buscar tenant_id de xel
        const { data: tenantData, error: tenantError } = await supabase
            .from('tenants')
            .select('id')
            .eq('slug', 'xel')
            .single();

        if (tenantError || !tenantData?.id) {
            throw new Error('No se pudo encontrar el tenant xel en DB Geimser2025');
        }

        const leadToSave = {
            tenant_id: tenantData.id,
            nombre: name,
            correo: email || null,
            telefono: phone || null,
            mensaje: 'Interés en Xel desde geimser-lex bot',
            tipo_interes: 'Abogado - Sistema Xel',
            fuente: 'Chat Widget LexChile',
            estado: 'pendiente'
        };

        const { data: insertData, error: insertError } = await supabase
            .from('leads_comerciales')
            .insert([leadToSave])
            .select();

        if (insertError) throw insertError;

        return NextResponse.json({ success: true, lead: insertData?.[0] });

    } catch (error: any) {
        console.error('❌ [API LAWYER LEADS] Error:', error?.message || error);
        return NextResponse.json(
            { error: error.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
