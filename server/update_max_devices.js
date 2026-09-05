import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
    const serialKey = 'EASY-FULL-2FCE97ED-14CE818A';
    
    console.log(`🔍 Buscando licencia ${serialKey}...`);
    const { data: license, error: fetchErr } = await supabase
        .from('plugin_licenses')
        .select('*, plugin_activations(*)')
        .eq('serial_key', serialKey)
        .single();

    if (fetchErr || !license) {
        console.error("❌ Error al buscar licencia:", fetchErr);
        return;
    }

    console.log("📋 Datos actuales:", {
        id: license.id,
        serial: license.serial_key,
        plugin: license.plugin_name,
        tipo: license.license_type,
        status: license.status,
        max_devices: license.max_devices,
        activaciones_actuales: license.plugin_activations?.length || 0
    });

    const { data: updated, error: updateErr } = await supabase
        .from('plugin_licenses')
        .update({ max_devices: 7, status: 'active' })
        .eq('id', license.id)
        .select('*, plugin_activations(*)')
        .single();

    if (updateErr) {
        console.error("❌ Error al actualizar:", updateErr);
    } else {
        console.log("✅ Actualizada correctamente a 7 usos/dispositivos:");
        console.log({
            serial: updated.serial_key,
            plugin: updated.plugin_name,
            tipo: updated.license_type,
            status: updated.status,
            max_devices: updated.max_devices,
            activaciones_actuales: updated.plugin_activations?.length || 0
        });
    }
}
main();
