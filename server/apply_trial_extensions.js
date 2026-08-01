import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function applyExtensions() {
    console.log('=== APLICANDO EXTENSIONES DE TRIALS ===\n');
    const now = new Date();

    // 1. Fetch all trial licenses for Easy Mix and Easy Master
    const { data: licenses, error } = await supabase
        .from('plugin_licenses')
        .select('*, plugin_activations(*)')
        .eq('license_type', 'trial')
        .or('plugin_name.ilike.%Easy Mix%,plugin_name.ilike.%Easy Master%');

    if (error) {
        console.error('Error fetching licenses:', error);
        return;
    }

    const group1_ExpiringToday = []; // Expire in <24h -> set to NOW + 2 days
    const group2_ExpiredUnactivated48h = []; // Expired in last 48h AND unactivated -> set to NOW + 3 days

    licenses.forEach(l => {
        if (!l.expires_at) return;
        const exp = new Date(l.expires_at);
        const diffHours = (exp - now) / (1000 * 60 * 60);
        const isActivated = (l.plugin_activations?.length || 0) > 0;

        if (diffHours >= 0 && diffHours <= 24) {
            group1_ExpiringToday.push(l);
        } else if (diffHours < 0 && diffHours >= -48 && !isActivated) {
            group2_ExpiredUnactivated48h.push(l);
        }
    });

    console.log(`📌 Grupo 1 (Vencen Hoy - Activados y No Activados): ${group1_ExpiringToday.length} licencias -> Extender a 2 Días desde ahora.`);
    console.log(`📌 Grupo 2 (Vencieron en <48h y NO Activados): ${group2_ExpiredUnactivated48h.length} licencias -> Extender a 3 Días desde ahora.\n`);

    // Calculate new expiration dates
    const datePlus2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const datePlus3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // Update Group 1
    if (group1_ExpiringToday.length > 0) {
        const ids1 = group1_ExpiringToday.map(l => l.id);
        const { error: err1 } = await supabase
            .from('plugin_licenses')
            .update({ expires_at: datePlus2Days, status: 'active' })
            .in('id', ids1);

        if (err1) console.error('Error actualizando Grupo 1:', err1);
        else console.log(`✅ Grupo 1 actualizado exitosamente (${ids1.length} licencias -> Expira: ${datePlus2Days})`);
    }

    // Update Group 2
    if (group2_ExpiredUnactivated48h.length > 0) {
        const ids2 = group2_ExpiredUnactivated48h.map(l => l.id);
        const { error: err2 } = await supabase
            .from('plugin_licenses')
            .update({ expires_at: datePlus3Days, status: 'active' })
            .in('id', ids2);

        if (err2) console.error('Error actualizando Grupo 2:', err2);
        else console.log(`✅ Grupo 2 actualizado exitosamente (${ids2.length} licencias -> Expira: ${datePlus3Days})`);
    }

    console.log('\n🎉 ¡Proceso de extensión completado!');
}

applyExtensions();
