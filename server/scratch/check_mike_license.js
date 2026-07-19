import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Buscando licencia generada para la orden 1844...');
    
    const { data: licenses, error } = await supabase
        .from('plugin_licenses')
        .select('*')
        .eq('user_email', 'mikeflowrap89@hotmail.com')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error al consultar licencias:', error);
        return;
    }

    console.log(`Encontradas ${licenses.length} licencias:`);
    console.log(JSON.stringify(licenses, null, 2));
}

main();
