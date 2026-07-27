import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
    const count = parseInt(process.argv[2] || '5', 10);
    console.log(`\n🔑 Generando ${count} licencias FULL (Lifetime / No expira) para Easy Mix...\n`);
    
    const generated = [];
    for (let i = 0; i < count; i++) {
        const serialKey = `EASY-FULL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const { data, error } = await supabase
            .from('plugin_licenses')
            .insert({
                plugin_name: 'Easy Mix',
                serial_key: serialKey,
                license_type: 'lifetime',
                status: 'active',
                expires_at: null,
                max_devices: 3
            })
            .select('*')
            .single();

        if (error) {
            console.error(`❌ Error al crear la clave #${i + 1}:`, error);
        } else {
            generated.push(data);
            console.log(`  [${i + 1}] 🔑 ${data.serial_key} (Max Dispositivos: ${data.max_devices}, Expira: Nunca)`);
        }
    }
    console.log(`\n✅ Total creadas exitosamente: ${generated.length}\n`);
}

main();
