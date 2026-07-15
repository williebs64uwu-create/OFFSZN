import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    const nowISO = new Date().toISOString();
    console.log(`📊 Consultando licencias TRIAL no vencidas (fecha posterior a ${new Date().toLocaleString()})...`);

    // 1. Fetch trials where expires_at > now
    const { data: activeTrials, error: licErr } = await supabase
        .from('plugin_licenses')
        .select(`
            id,
            serial_key,
            license_type,
            status,
            expires_at,
            user_id,
            users (
                email,
                nickname
            )
        `)
        .eq('plugin_name', 'Easy Mix')
        .eq('license_type', 'trial')
        .gt('expires_at', nowISO);

    if (licErr) {
        console.error('❌ Error fetching active trials:', licErr);
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

    const unactivated = [];
    const activated = [];

    activeTrials.forEach(lic => {
        const acts = activationMap.get(lic.id) || [];
        const hasActivated = acts.length > 0;
        
        const details = {
            key: lic.serial_key,
            email: lic.users?.email || 'Desconocido',
            nick: lic.users?.nickname || 'N/A',
            expires: new Date(lic.expires_at).toLocaleString()
        };

        if (hasActivated) {
            activated.push(details);
        } else {
            unactivated.push(details);
        }
    });

    console.log('\n==================================================');
    console.log('       ESTADO DE TRIALS NO VENCIDOS                ');
    console.log('==================================================');
    console.log(`🟢 Total de Trials vigentes:   ${activeTrials.length}`);
    console.log(`   • Activados en DAW:        ${activated.length}`);
    console.log(`   • Aún sin activar en DAW:  ${unactivated.length}`);
    console.log('==================================================');

    if (activeTrials.length > 0) {
        console.log('\n--- DETALLE DE TRIALS VIGENTES ACTIVADOS ---');
        if (activated.length > 0) {
            activated.forEach((t, i) => {
                console.log(`[${i + 1}] Email: ${t.email.padEnd(25)} | Key: ${t.key} | Expira: ${t.expires}`);
            });
        } else {
            console.log('Ninguno activado.');
        }

        console.log('\n--- DETALLE DE TRIALS VIGENTES SIN ACTIVAR ---');
        if (unactivated.length > 0) {
            unactivated.forEach((t, i) => {
                console.log(`[${i + 1}] Email: ${t.email.padEnd(25)} | Key: ${t.key} | Expira: ${t.expires}`);
            });
        } else {
            console.log('Ninguno pendiente de activar.');
        }
    } else {
        console.log('\nNo hay licencias Trial vigentes actualmente.');
    }
    console.log('==================================================');
}

main().catch(err => {
    console.error('Unhandled error:', err);
});
