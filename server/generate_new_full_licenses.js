import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials missing in server/.env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function generateSerialKey(prefix) {
    const p1 = crypto.randomBytes(4).toString('hex').toUpperCase();
    const p2 = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}-FULL-${p1}-${p2}`;
}

async function createLicense(pluginName, prefix) {
    const serialKey = generateSerialKey(prefix);
    const { data, error } = await supabase
        .from('plugin_licenses')
        .insert({
            plugin_name: pluginName,
            serial_key: serialKey,
            license_type: 'lifetime',
            status: 'active',
            expires_at: null,
            max_devices: 3
        })
        .select('id, serial_key, plugin_name, license_type, status, max_devices, created_at')
        .single();

    if (error) {
        throw new Error(`Error insertando ${pluginName} (${serialKey}): ${error.message}`);
    }
    return data;
}

async function main() {
    try {
        console.log('🚀 Generando licencias FULL en Supabase...');

        // 1 Principal + 3 Repuesto para Easy Mix
        const easyMixMain = await createLicense('Easy Mix', 'EASY');
        const easyMixSpares = [];
        for (let i = 0; i < 3; i++) {
            easyMixSpares.push(await createLicense('Easy Mix', 'EASY'));
        }

        // 1 Principal + 3 Repuesto para Easy Master
        const easyMasterMain = await createLicense('Easy Master', 'MASTER');
        const easyMasterSpares = [];
        for (let i = 0; i < 3; i++) {
            easyMasterSpares.push(await createLicense('Easy Master', 'MASTER'));
        }

        console.log('\n======================================================');
        console.log('✅ LICENCIAS GENERADAS Y REGISTRADAS CON ÉXITO');
        console.log('======================================================\n');
        
        console.log('🎛️ EASY MIX (FULL / LIFETIME):');
        console.log(`  ▶ Principal: ${easyMixMain.serial_key}`);
        console.log('  ▶ Repuestos:');
        easyMixSpares.forEach((lic, idx) => console.log(`    [${idx + 1}] ${lic.serial_key}`));

        console.log('\n🎚️ EASY MASTER (FULL / LIFETIME):');
        console.log(`  ▶ Principal: ${easyMasterMain.serial_key}`);
        console.log('  ▶ Repuestos:');
        easyMasterSpares.forEach((lic, idx) => console.log(`    [${idx + 1}] ${lic.serial_key}`));

        console.log('\n======================================================\n');
    } catch (err) {
        console.error('❌ Error durante la generación:', err);
        process.exit(1);
    }
}

main();
