import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Querying all licenses for Easy Mix...');
    const { data: licenses, error } = await supabase
        .from('plugin_licenses')
        .select('*');

    if (error) {
        console.error('Error querying plugin_licenses:', error);
        process.exit(1);
    }

    const easyMixLicenses = licenses.filter(lic => 
        lic.plugin_name?.toLowerCase().includes('mix')
    );

    console.log(`\n=== Easy Mix Licenses Analysis ===`);
    console.log(`Total Licenses Found: ${easyMixLicenses.length}`);

    const now = new Date();

    // Grouping by Type and Status
    const groups = {
        trial_active_not_expired: 0,
        trial_expired: 0,
        lifetime: 0,
        other: 0
    };

    easyMixLicenses.forEach(lic => {
        if (lic.license_type === 'trial') {
            const isExpired = lic.expires_at ? new Date(lic.expires_at) < now : false;
            const isStatusExpired = lic.status === 'expired';
            
            if (isExpired || isStatusExpired) {
                groups.trial_expired++;
            } else {
                groups.trial_active_not_expired++;
            }
        } else if (lic.license_type === 'lifetime' || lic.license_type === 'subscription') {
            groups.lifetime++;
        } else {
            groups.other++;
        }
    });

    console.log(`- Pruebas de 24h activas (no expiradas): ${groups.trial_active_not_expired}`);
    console.log(`- Pruebas de 24h expiradas: ${groups.trial_expired}`);
    console.log(`- Licencias de compra (Lifetime/Suscripción): ${groups.lifetime}`);
    console.log(`- Otras: ${groups.other}`);

    // Let's also check plugin activations (how many devices are actually activated/registered)
    const { data: activations, error: actError } = await supabase
        .from('plugin_activations')
        .select(`
            id,
            hwid,
            device_name,
            activated_at,
            plugin_licenses (
                plugin_name,
                license_type,
                serial_key
            )
        `);

    if (actError) {
        console.error('Error querying activations:', actError);
    } else {
        const easyMixActivations = activations.filter(act => 
            act.plugin_licenses?.plugin_name?.toLowerCase().includes('mix')
        );

        console.log(`\n=== Activaciones en Equipos (Dispositivos en uso) ===`);
        console.log(`Total de activaciones (HWIDs registrados): ${easyMixActivations.length}`);

        const actTrial = easyMixActivations.filter(a => a.plugin_licenses.license_type === 'trial');
        const actLifetime = easyMixActivations.filter(a => a.plugin_licenses.license_type !== 'trial');

        console.log(`- Activaciones con clave Trial: ${actTrial.length}`);
        console.log(`- Activaciones con clave comprada (Lifetime): ${actLifetime.length}`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
