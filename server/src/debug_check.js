
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// .env está en server/.env. Este script está en server/src/debug_check.js
// Entonces bajamos un nivel: ../.env
config({ path: path.resolve(__dirname, '../.env') });

console.log("URL:", process.env.SUPABASE_URL);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkUsers() {
    console.log("--- BUSCANDO 'willieinspired' ---");

    // 1. Listar TODOS los que se parezcan
    const { data, error } = await supabase
        .from('users')
        .select('id, nickname')
        .ilike('nickname', '%willie%');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Resultados:");
    data.forEach(u => {
        // Imprimir con comillas para ver espacios ' '
        console.log(`ID: ${u.id} | Nick: '${u.nickname}' | Largo: ${u.nickname.length}`);
    });
}

checkUsers();
