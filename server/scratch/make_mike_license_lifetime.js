import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Modificando la licencia MASTER-SUB-35AD7DD5-2038501D para hacerla LIFETIME (nunca expira)...');

    const { data, error } = await supabase
        .from('plugin_licenses')
        .update({
            expires_at: null,
            license_type: 'lifetime',
            max_devices: 3 // Cambiado a 3 para coincidir con licencias FULL/Lifetime
        })
        .eq('serial_key', 'MASTER-SUB-35AD7DD5-2038501D')
        .select();

    if (error) {
        console.error('Error al actualizar la licencia:', error);
        return;
    }

    console.log('Licencia actualizada correctamente en Supabase:');
    console.log(JSON.stringify(data, null, 2));
}

main();
