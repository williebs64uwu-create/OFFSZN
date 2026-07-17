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
    // ── 1. Find the Easy Master license for this machine (Willie's PC) ──────────
    // First, let's list all Easy Master licenses to find the right one
    const { data: licenses, error: licErr } = await supabase
        .from('plugin_licenses')
        .select(`
            id,
            serial_key,
            license_type,
            status,
            expires_at,
            plugin_activations ( hwid, device_name )
        `)
        .eq('plugin_name', 'Easy Master');

    if (licErr) {
        console.error('Error fetching licenses:', licErr);
        process.exit(1);
    }

    console.log('\n========== EASY MASTER LICENSES ==========');
    licenses.forEach(lic => {
        console.log(`\nKey:  ${lic.serial_key}`);
        console.log(`Type: ${lic.license_type} | Status: ${lic.status}`);
        if (lic.expires_at) console.log(`Exp:  ${lic.expires_at}`);
        if (lic.plugin_activations?.length > 0) {
            lic.plugin_activations.forEach(act => {
                console.log(`  → Device: ${act.device_name} | HWID: ${act.hwid}`);
            });
        } else {
            console.log('  (no activations)');
        }
    });

    // ── 2. Delete ALL Easy Master activations (resets all devices) ──────────────
    const licIds = licenses.map(l => l.id);

    if (licIds.length > 0) {
        const { error: delErr } = await supabase
            .from('plugin_activations')
            .delete()
            .in('license_id', licIds);
        
        if (delErr) {
            console.error('\nError deleting activations:', delErr);
        } else {
            console.log('\n✅ All Easy Master activations deleted (all devices reset).');
        }
    }

    // ── 3. Create a fresh 3-day MASTER-TRIAL key ─────────────────────────────────
    const serialKey = `MASTER-TRIAL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 3); // 3-day trial for Easy Master
    const expiresAt = expiryDate.toISOString();

    const { data: newLic, error: newErr } = await supabase
        .from('plugin_licenses')
        .insert({
            plugin_name: 'Easy Master',
            serial_key: serialKey,
            license_type: 'trial',
            status: 'active',
            expires_at: expiresAt,
            max_devices: 1
        })
        .select('*').single();
    
    if (newErr) {
        console.error('\nError creating trial:', newErr);
    } else {
        console.log('\n🎉 NUEVA MASTER-TRIAL KEY (3 días):');
        console.log('   ' + serialKey);
        console.log('   Expira: ' + expiresAt);
        console.log('\nCopia esta clave en el plugin para ver el badge de prueba!');
    }
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
