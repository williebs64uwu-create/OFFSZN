import { supabase } from './src/infrastructure/database/connection.js';

async function findProducer() {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .ilike('nickname', '%taquitos%');
        
        if (error) {
            console.error('❌ Supabase Error:', error.message);
            return;
        }

        console.log('--- USERS matches "taquitos" ---');
        console.log(JSON.stringify(users, null, 2));

    } catch (e) {
        console.error(e);
    }
}
findProducer();
