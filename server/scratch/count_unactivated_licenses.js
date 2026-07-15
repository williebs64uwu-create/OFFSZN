import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('📊 Analizando activaciones de licencias para Easy Mix...');

    // 1. Fetch all licenses for Easy Mix
    const { data: licenses, error: licErr } = await supabase
        .from('plugin_licenses')
        .select(`
            id,
            serial_key,
            license_type,
            status,
            user_id,
            users (
                email,
                nickname
            )
        `)
        .eq('plugin_name', 'Easy Mix');

    if (licErr) {
        console.error('❌ Error fetching licenses:', licErr);
        process.exit(1);
    }

    // 2. Fetch all activations
    const { data: activations, error: actErr } = await supabase
        .from('plugin_activations')
        .select('*');

    if (actErr) {
        console.error('❌ Error fetching activations:', actErr);
        process.exit(1);
    }

    // Map activations by license_id
    const activationMap = new Map();
    activations.forEach(act => {
        if (!activationMap.has(act.license_id)) {
            activationMap.set(act.license_id, []);
        }
        activationMap.get(act.license_id).push(act);
    });

    // Categorize
    const stats = {
        lifetime: { total: 0, unactivated: [], activated: 0 },
        trial: { total: 0, unactivated: [], activated: 0 },
        subscription: { total: 0, unactivated: [], activated: 0 }
    };

    licenses.forEach(lic => {
        const type = lic.license_type || 'lifetime';
        const acts = activationMap.get(lic.id) || [];
        const hasActivated = acts.length > 0;

        if (stats[type]) {
            stats[type].total++;
            if (hasActivated) {
                stats[type].activated++;
            } else {
                stats[type].unactivated.push({
                    key: lic.serial_key,
                    email: lic.users?.email || 'Desconocido / Sin vincular',
                    nick: lic.users?.nickname || 'N/A'
                });
            }
        }
    });

    console.log('\n==================================================');
    console.log('       RESUMEN DE LICENCIAS (EASY MIX)           ');
    console.log('==================================================');
    
    console.log(`\n💎 Licencias de Por Vida (Lifetime):`);
    console.log(`   • Total emitidas: ${stats.lifetime.total}`);
    console.log(`   • Activadas:      ${stats.lifetime.activated}`);
    console.log(`   • SIN ACTIVAR:    ${stats.lifetime.unactivated.length}`);

    console.log(`\n🎁 Licencias de Prueba (Trial):`);
    console.log(`   • Total emitidas: ${stats.trial.total}`);
    console.log(`   • Activadas:      ${stats.trial.activated}`);
    console.log(`   • SIN ACTIVAR:    ${stats.trial.unactivated.length}`);

    console.log(`\n🔄 Suscripciones:`);
    console.log(`   • Total emitidas: ${stats.subscription.total}`);
    console.log(`   • Activadas:      ${stats.subscription.activated}`);
    console.log(`   • SIN ACTIVAR:    ${stats.subscription.unactivated.length}`);

    console.log('\n==================================================');
    console.log('       DETALLE DE LIFETIME SIN ACTIVAR             ');
    console.log('==================================================');
    if (stats.lifetime.unactivated.length > 0) {
        stats.lifetime.unactivated.forEach((lic, idx) => {
            console.log(`[${idx + 1}] Email: ${lic.email.padEnd(30)} | Key: ${lic.key}`);
        });
    } else {
        console.log('¡Todas las licencias de por vida han sido activadas!');
    }
    console.log('==================================================');
}

main().catch(err => {
    console.error('Unhandled error:', err);
});
