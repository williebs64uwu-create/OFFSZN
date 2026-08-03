import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function extendJulyEasyMixTrials() {
    console.log("🔍 Buscando licencias TRIAL de Easy Mix creadas en Julio 2026...");

    const newExpirationDate = '2026-08-05T23:59:59-05:00';

    // 1. Consultar licencias trial de Easy Mix creadas en Julio
    const { data: licenses, error } = await supabase
        .from('plugin_licenses')
        .select('*')
        .eq('license_type', 'trial')
        .ilike('plugin_name', '%Easy Mix%')
        .gte('created_at', '2026-07-01T00:00:00.000Z')
        .lt('created_at', '2026-08-01T00:00:00.000Z');

    if (error) {
        console.error("❌ Error al consultar las licencias:", error);
        return;
    }

    console.log(`📊 Se encontraron ${licenses.length} licencias TRIAL de Easy Mix creadas en Julio 2026.`);

    if (licenses.length === 0) {
        console.log("ℹ️ No hay licencias trial de Julio para actualizar.");
        return;
    }

    const idsToUpdate = licenses.map(l => l.id);

    // 2. Actualizar las licencias seleccionadas para que expiren el 5 de Agosto
    const { data: updated, error: updateError } = await supabase
        .from('plugin_licenses')
        .update({ expires_at: newExpirationDate })
        .in('id', idsToUpdate)
        .select();

    if (updateError) {
        console.error("❌ Error al actualizar las licencias:", updateError);
        return;
    }

    console.log(`✅ ¡ÉXITO! Se actualizaron ${updated.length} licencias trial de Easy Mix.`);
    console.log(`📅 Nueva fecha de expiración configurada: ${newExpirationDate} (5 de Agosto)`);

    console.log("\n📋 Detalle de licencias extendidas:");
    updated.forEach((l, index) => {
        console.log(`${index + 1}. ID: ${l.id} | Serial: ${l.serial_key} | Creada: ${l.created_at} | Nueva Expiración: ${l.expires_at}`);
    });
}

extendJulyEasyMixTrials();
