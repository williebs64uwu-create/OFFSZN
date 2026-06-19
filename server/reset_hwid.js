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
    console.log("1. Borrando activación de tu HWID...");
    await supabase.from('plugin_activations').delete().ilike('hwid', '%DESKTOP-SI8EGCH%');
    
    console.log("2. Reponiendo TODAS las licencias a status='active' (activas/válidas para uso)...");
    await supabase.from('plugin_licenses').update({ status: 'active' }).neq('status', 'active');
    
    console.log("3. Generando una nueva trial fresca de 7 días...");
    const serialKey = `TRIAL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);
    const expiresAt = expiryDate.toISOString();

    const { data: newLic, error: licErr } = await supabase
        .from('plugin_licenses')
        .insert({ plugin_name: 'Easy Mix', serial_key: serialKey, license_type: 'trial', status: 'active', expires_at: expiresAt, max_devices: 1 })
        .select('*').single();
    
    if (licErr) {
        console.error("Error creating trial:", licErr);
    } else {
        console.log("NUEVA TRIAL KEY:", serialKey);
    }
}
main();
