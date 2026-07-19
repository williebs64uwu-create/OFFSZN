import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Buscando licencias para el user_id d90dc4a3-ad7f-4a5f-959b-cba16cf645fa...');
    
    const { data: licenses, error } = await supabase
        .from('plugin_licenses')
        .select('*')
        .eq('user_id', 'd90dc4a3-ad7f-4a5f-959b-cba16cf645fa')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error al consultar licencias:', error);
        return;
    }

    console.log(`Encontradas ${licenses.length} licencias:`);
    console.log(JSON.stringify(licenses, null, 2));
}

main();
