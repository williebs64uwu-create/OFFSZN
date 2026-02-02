
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fixNickname() {
    const userId = '0382a813-85c7-46c3-8d2c-61a5692adffd'; // ID de willieinspired
    const correctNickname = 'willieinspired';

    console.log(`🔧 Arreglando nickname para ID: ${userId}...`);

    const { data, error } = await supabase
        .from('users')
        .update({ nickname: correctNickname })
        .eq('id', userId)
        .select();

    if (error) {
        console.error("❌ Error al actualizar:", error);
    } else {
        console.log("✅ ÉXITO! Usuario actualizado:", data);
    }
}

fixNickname();
