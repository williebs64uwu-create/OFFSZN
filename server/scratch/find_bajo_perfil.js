import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findUser() {
    console.log("Searching for bajo perfil...");
    
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .or('nickname.ilike.%bajo perfil%,nickname.ilike.%bajoperfil%');
    
    if (error) {
        console.error("Error searching user:", error.message);
        return;
    }
    
    if (users && users.length > 0) {
        users.forEach(user => {
            console.log(JSON.stringify(user, null, 2));
        });
    } else {
        console.log("User not found.");
    }
}

findUser();
