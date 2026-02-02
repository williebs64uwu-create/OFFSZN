
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkProducts() {
    console.log("--- CHEQUEANDO PRODUCTOS ---");
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error:", error);
    } else if (data && data.length > 0) {
        console.log("Columnas encontradas:", Object.keys(data[0]));
        console.log("Ejemplo:", data[0]);
    } else {
        console.log("No hay productos para analizar.");
    }
}

checkProducts();
