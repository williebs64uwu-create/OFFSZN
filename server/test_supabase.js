import { supabase } from './src/infrastructure/database/connection.js';

async function testSupabase() {
    try {
        console.log('Testing Supabase connection...');
        const { data, error } = await supabase.from('users_profiles').select('id').limit(1);
        if (error) {
            console.error('❌ Supabase Query Error:', error.message);
        } else {
            console.log('✅ Supabase Connection OK. Found users:', data.length);
        }
    } catch (e) {
        console.error('❌ Unexpected Error:', e.message);
    }
}

testSupabase();
