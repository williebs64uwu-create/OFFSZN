import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const now = new Date();

const { data: trials } = await supabase
    .from('plugin_licenses')
    .select('serial_key, status, expires_at, created_at')
    .eq('license_type', 'trial')
    .order('expires_at', { ascending: false });

let active = 0, expired = 0, dbExpired = 0;

console.log('🟢 TRIALS AÚN ACTIVOS (no expirados):');
trials.forEach(t => {
    const dateExpired = t.expires_at && new Date(t.expires_at) < now;
    const statusExpired = t.status === 'expired';
    if (dateExpired || statusExpired) {
        expired++;
        if (statusExpired) dbExpired++;
    } else {
        active++;
        console.log(`   ${t.serial_key} → expira ${new Date(t.expires_at).toLocaleString('es-MX', { timeZone: 'America/Guayaquil' })}`);
    }
});

console.log(`\n═══════════════════════════════════════`);
console.log(`  RESUMEN DE TRIALS`);
console.log(`═══════════════════════════════════════`);
console.log(`  Total trials:        ${trials.length}`);
console.log(`  🟢 Activos aún:      ${active}`);
console.log(`  🔴 Expirados:        ${expired}`);
console.log(`     ↳ por fecha:      ${expired - dbExpired}`);
console.log(`     ↳ forzados en BD: ${dbExpired}`);
console.log(`═══════════════════════════════════════`);
