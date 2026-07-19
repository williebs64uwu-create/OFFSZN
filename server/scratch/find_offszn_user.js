import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    const { data: users, error } = await supabase
        .from('users')
        .select('id, email, nickname, is_admin, is_producer')
        .or('email.eq.willie2008garay@gmail.com,nickname.ilike.%offszn%');

    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }

    console.log('Matching users found:');
    console.log(users);
}
main();
