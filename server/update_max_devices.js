import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
    const serialKey = 'EASY-FULL-6982C837-F511037F';
    
    const { data: updated, error } = await supabase
        .from('plugin_licenses')
        .update({ max_devices: 3 })
        .eq('serial_key', serialKey)
        .select('*');

    if (error) {
        console.error("❌ Error al actualizar:", error);
    } else {
        console.log("✅ Actualizada correctamente a 3 dispositivos:");
        console.log(updated[0]);
    }
}
main();
