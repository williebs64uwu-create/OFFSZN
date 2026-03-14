import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import config - Correct path relative to server/tmp_check_db.js
import { SUPABASE_URL, SUPABASE_KEY } from './src/shared/config/config.js'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function cleanupProducts() {
    console.log('--- DATABASE CLEANUP ---');
    const keepIds = [472, 470, 469, 463];
    
    try {
        // 1. Mark as deleted everything except the chosen ones
        const { data, error } = await supabase
            .from('products')
            .update({ status: 'deleted' })
            .not('id', 'in', `(${keepIds.join(',')})`)
            .neq('status', 'deleted');

        if (error) {
            console.error('Error during cleanup:', error);
            return;
        }

        console.log('Cleanup successful.');

        // 2. Verify remaining active products
        const { data: active, error: fetchError } = await supabase
            .from('products')
            .select('id, name, status')
            .neq('status', 'deleted');

        if (fetchError) {
            console.error('Error verifying remaining products:', fetchError);
            return;
        }

        console.log(`Found ${active.length} remaining products:`);
        active.forEach(p => {
            console.log(`ID: ${p.id} | Name: ${p.name} | Status: ${p.status}`);
        });

    } catch (e) {
        console.error('Exception:', e.message);
    }
    console.log('---------------------------');
}

cleanupProducts();
