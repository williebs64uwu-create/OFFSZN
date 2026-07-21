import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    const key = 'MASTER-SUB-35AD7DD5-2038501D';
    console.log(`Verificando clave: ${key}`);

    // 1. Obtener licencia de la tabla
    const { data: license, error: licErr } = await supabase
        .from('plugin_licenses')
        .select('*')
        .eq('serial_key', key)
        .single();

    if (licErr || !license) {
        console.error('Error al obtener la licencia:', licErr);
        return;
    }

    console.log('\n--- DETALLES DE LA LICENCIA ---');
    console.log(`ID: ${license.id}`);
    console.log(`Tipo: ${license.license_type}`);
    console.log(`Expiración: ${license.expires_at || 'Nunca Expira (NULO)'}`);
    console.log(`Estado: ${license.status}`);
    console.log(`Máximo de Dispositivos: ${license.max_devices}`);

    // 2. Obtener activaciones asociadas
    const { data: activations, error: actErr } = await supabase
        .from('plugin_activations')
        .select('*')
        .eq('license_id', license.id);

    if (actErr) {
        console.error('Error al obtener las activaciones:', actErr);
        return;
    }

    console.log('\n--- DISPOSITIVOS ACTIVOS ---');
    console.log(`Total Activados actualmente: ${activations.length}`);
    activations.forEach((act, idx) => {
        console.log(`Dispositivo ${idx + 1}: HWID=${act.hwid}, Nombre=${act.device_name || 'Desconocido'}, Activado el=${act.created_at}`);
    });

    const left = license.max_devices - activations.length;
    console.log(`\nActivaciones restantes: ${left}`);
}

main();
