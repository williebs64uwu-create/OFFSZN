import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Buscando órdenes de hoy 19 de Julio para mikeflowrap89@hotmail.com...');
    
    // Obtener órdenes por el email
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('guest_email', 'mikeflowrap89@hotmail.com')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error al consultar órdenes:', error);
        return;
    }

    console.log(`Encontradas ${orders.length} órdenes:`);
    console.log(JSON.stringify(orders, null, 2));
}

main();
