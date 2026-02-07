
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUsers() {
    console.log('🔍 Buscando por email/nickname "%coro%"...');
    const { data: users, error: uErr } = await supabase
        .from('users')
        .select('id, nickname, email')
        .or('nickname.ilike.%coro%,email.ilike.%coro%')
        .limit(20);

    if (uErr) console.error('❌ Error users:', uErr);
    else console.log('📋 USERS MATCH:', users);

    console.log('\n🔍 Listando Profiles (username like %coro%)...');
    const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', '%coro%')
        .limit(20);

    if (pErr) console.error('❌ Error profiles:', pErr);
    else console.log('📋 PROFILES MATCH:', profiles);
}

debugUsers();
