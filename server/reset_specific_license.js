import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function resetSpecificLicense() {
    const serialKey = 'EASY-FULL-D4287003-AEA6885F';
    console.log(`🔍 Buscando licencia: ${serialKey}...`);

    // 1. Fetch license
    const { data: license, error: fetchErr } = await supabase
        .from('plugin_licenses')
        .select('*, plugin_activations(*)')
        .eq('serial_key', serialKey)
        .single();

    if (fetchErr || !license) {
        console.error("❌ Licencia no encontrada:", fetchErr);
        return;
    }

    console.log("\n📋 Datos actuales de la licencia:");
    console.log(`- ID: ${license.id}`);
    console.log(`- Plugin: ${license.plugin_name}`);
    console.log(`- Tipo: ${license.license_type}`);
    console.log(`- Estado: ${license.status}`);
    console.log(`- Max Dispositivos actual: ${license.max_devices}`);
    console.log(`- Activaciones / HWIDs encontrados: ${license.plugin_activations?.length || 0}`);
    
    if (license.plugin_activations && license.plugin_activations.length > 0) {
        license.plugin_activations.forEach((act, idx) => {
            console.log(`  [${idx + 1}] Device: ${act.device_name} | HWID: ${act.hwid} | Fecha: ${act.activated_at || act.created_at || 'N/A'}`);
        });
    }

    // 2. Delete all activations
    console.log("\n🧹 Eliminando todas las activaciones/HWIDs asociadas...");
    const { data: deleted, error: delErr } = await supabase
        .from('plugin_activations')
        .delete()
        .eq('license_id', license.id)
        .select();

    if (delErr) {
        console.error("❌ Error al eliminar activaciones:", delErr);
        return;
    }

    console.log(`✅ Activaciones borradas: ${deleted ? deleted.length : 0}`);

    // 3. Update max_devices to 2 and ensure status is active
    console.log("\n🔄 Actualizando max_devices a 2 y status a 'active'...");
    const { data: updated, error: updateErr } = await supabase
        .from('plugin_licenses')
        .update({
            max_devices: 2,
            status: 'active'
        })
        .eq('id', license.id)
        .select('*, plugin_activations(*)')
        .single();

    if (updateErr) {
        console.error("❌ Error al actualizar licencia:", updateErr);
        return;
    }

    console.log("\n==========================================");
    console.log("🎉 LICENCIA RESETEADA Y LISTA PARA USAR:");
    console.log("==========================================");
    console.log(`- Serial: ${updated.serial_key}`);
    console.log(`- Plugin: ${updated.plugin_name}`);
    console.log(`- Tipo: ${updated.license_type}`);
    console.log(`- Estado: ${updated.status}`);
    console.log(`- Nuevos dispositivos permitidos (Max): ${updated.max_devices}`);
    console.log(`- Dispositivos actualmente ocupados: ${updated.plugin_activations?.length || 0}`);
    console.log("==========================================");
}

resetSpecificLicense();
