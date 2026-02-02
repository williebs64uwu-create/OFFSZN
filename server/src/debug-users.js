
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function listUsers() {
    console.log("--- LISTANDO USUARIOS (Tabla public.users) ---");
    const { data, error } = await supabase
        .from('users')
        .select('id, nickname, first_name');

    if (error) {
        console.error("Error:", error);
    } else {
        console.table(data);
        console.log(`Total encontrados: ${data.length}`);
    }
}

listUsers();
