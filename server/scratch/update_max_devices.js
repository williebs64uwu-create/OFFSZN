import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Actualizando max_devices a 2 para la licencia MASTER-SUB-35AD7DD5-2038501D...');

    const { data, error } = await supabase
        .from('plugin_licenses')
        .update({
            max_devices: 2
        })
        .eq('serial_key', 'MASTER-SUB-35AD7DD5-2038501D')
        .select();

    if (error) {
        console.error('Error al actualizar:', error);
        return;
    }

    console.log('Licencia modificada con éxito:');
    console.log(JSON.stringify(data, null, 2));
}

main();
