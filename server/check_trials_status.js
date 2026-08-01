import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkActivationSplit() {
    const { data: licenses, error } = await supabase
        .from('plugin_licenses')
        .select('*, plugin_activations(*)')
        .eq('license_type', 'trial')
        .or('plugin_name.ilike.%Easy Mix%,plugin_name.ilike.%Easy Master%')
        .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }

    const now = new Date();
    
    const unactivatedExpiring24h = [];
    const activatedExpiring24h = [];

    const unactivatedExpired48h = [];
    const activatedExpired48h = [];

    licenses.forEach(l => {
        if (!l.expires_at) return;
        const exp = new Date(l.expires_at);
        const diffHours = (exp - now) / (1000 * 60 * 60);
        const isActivated = (l.plugin_activations?.length || 0) > 0;

        const item = {
            id: l.id,
            plugin: l.plugin_name,
            serial: l.serial_key,
            created: l.created_at,
            expires: l.expires_at,
            hours: diffHours.toFixed(1)
        };

        if (diffHours >= 0 && diffHours <= 24) {
            if (isActivated) activatedExpiring24h.push(item);
            else unactivatedExpiring24h.push(item);
        } else if (diffHours < 0 && diffHours >= -48) {
            if (isActivated) activatedExpired48h.push(item);
            else unactivatedExpired48h.push(item);
        }
    });

    console.log('=== DESGLOSE EXACTO ACTIVADAS VS NO ACTIVADAS ===');
    console.log('\n--- 🟠 VENCEN HOY (<24 HORAS) ---');
    console.log(`  ❌ NO ACTIVADAS (Nunca abrieron en PC): ${unactivatedExpiring24h.length}`);
    unactivatedExpiring24h.forEach(i => console.log(`     - [${i.plugin}] ${i.serial} | Quedan: ${i.hours}h`));

    console.log(`\n  ✅ ACTIVADAS (Ya registraron equipo): ${activatedExpiring24h.length}`);
    activatedExpiring24h.forEach(i => console.log(`     - [${i.plugin}] ${i.serial} | Quedan: ${i.hours}h`));

    console.log('\n--- 🔴 VENCIERON EN LAS ÚLTIMAS 48 HORAS ---');
    console.log(`  ❌ NO ACTIVADAS (Nunca llegaron a abrir): ${unactivatedExpired48h.length}`);
    unactivatedExpired48h.forEach(i => console.log(`     - [${i.plugin}] ${i.serial} | Venció hace: ${Math.abs(i.hours)}h`));

    console.log(`\n  ✅ ACTIVADAS (Probaron y vencieron): ${activatedExpired48h.length}`);
    activatedExpired48h.forEach(i => console.log(`     - [${i.plugin}] ${i.serial} | Venció hace: ${Math.abs(i.hours)}h`));
}

checkActivationSplit();
