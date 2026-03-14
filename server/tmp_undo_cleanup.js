import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY } from './src/shared/config/config.js'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function restoreAll() {
    console.log('--- RESTORING ALL DELETED PRODUCTS ---');
    try {
        // Find all products marked as deleted
        const { data: deletedProducts, error: fetchError } = await supabase
            .from('products')
            .select('id, name, status')
            .eq('status', 'deleted');

        if (fetchError) {
            console.error('Error fetching deleted products:', fetchError);
            return;
        }

        console.log(`Found ${deletedProducts.length} deleted products. Restoring...`);

        if (deletedProducts.length === 0) {
            console.log('No products to restore.');
            return;
        }

        // Restore them to 'approved'
        const { error: updateError } = await supabase
            .from('products')
            .update({ status: 'approved' })
            .eq('status', 'deleted');

        if (updateError) {
            console.error('Error restoring products:', updateError);
            return;
        }

        console.log('Restoration successful.');

        // Verify
        const { data: active, error: verifyError } = await supabase
            .from('products')
            .select('id, name, status')
            .neq('status', 'deleted');

        console.log(`Total active products now: ${active?.length}`);

    } catch (e) {
        console.error('Exception:', e.message);
    }
}

restoreAll();
