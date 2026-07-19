import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    const { data: licenses, error } = await supabase
        .from('plugin_licenses')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Estructura de la tabla plugin_licenses:');
    if (licenses.length > 0) {
        console.log(Object.keys(licenses[0]));
    } else {
        console.log('No hay licencias');
    }
}

main();
