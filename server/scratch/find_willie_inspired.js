import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    const { data: users, error } = await supabase
        .from('users')
        .select('id, email, nickname, paypal_email')
        .ilike('email', '%inspired%');

    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }

    console.log('Inspired users found:');
    console.log(users);
}
main();
