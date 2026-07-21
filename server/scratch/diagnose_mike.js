import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    const email = 'mikeflowrap89@hotmail.com';
    console.log(`Buscando datos en Supabase para: ${email}`);

    // 1. Buscar en la tabla de usuarios
    const { data: users, error: userErr } = await supabase
        .from('users')
        .select('*')
        .eq('email', email);

    if (userErr) {
        console.error('Error al buscar usuario:', userErr);
    }
    console.log('\n--- Usuarios encontrados ---');
    console.log(JSON.stringify(users, null, 2));

    const userId = users && users.length > 0 ? users[0].id : null;

    // 2. Buscar en la tabla de órdenes
    const { data: ordersByEmail, error: orderEmailErr } = await supabase
        .from('orders')
        .select('*')
        .eq('guest_email', email);

    console.log('\n--- Órdenes buscando por guest_email ---');
    console.log(JSON.stringify(ordersByEmail, null, 2));

    if (userId) {
        const { data: ordersByUserId, error: orderIdErr } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', userId);

        console.log('\n--- Órdenes buscando por user_id ---');
        console.log(JSON.stringify(ordersByUserId, null, 2));
    }

    // 3. Buscar en la tabla de licencias de plugins
    if (userId) {
        const { data: licenses, error: licErr } = await supabase
            .from('plugin_licenses')
            .select('*')
            .eq('user_id', userId);

        console.log('\n--- Licencias buscando por user_id ---');
        console.log(JSON.stringify(licenses, null, 2));
    }

    // También busquemos todas las licencias cuyo serial clave empiece con MASTER o EASY creadas recientemente
    const { data: allRecentLicenses, error: allLicErr } = await supabase
        .from('plugin_licenses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log('\n--- Últimas 5 licencias creadas globalmente ---');
    console.log(JSON.stringify(allRecentLicenses, null, 2));
}

main();
