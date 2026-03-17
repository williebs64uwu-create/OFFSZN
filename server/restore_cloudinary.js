
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function restoreCloudinary() {
    console.log('Restoring Cloudinary URLs (searching for "image/upload")...');
    
    const { data: products, error } = await supabase
        .from('products')
        .select('id, image_url');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    let updatedCount = 0;
    for (const p of products) {
        if (p.image_url && !p.image_url.startsWith('http') && p.image_url.includes('image/upload')) {
            let path = p.image_url;
            if (path.startsWith('/')) path = path.substring(1);
            
            const restoredUrl = `https://res.cloudinary.com/${path}`;
            
            console.log(`Restoring Product ${p.id}: ${p.image_url} -> ${restoredUrl}`);
            
            const { error: updateError } = await supabase
                .from('products')
                .update({ image_url: restoredUrl })
                .eq('id', p.id);
                
            if (updateError) {
                console.error(`Error updating product ${p.id}:`, updateError);
            } else {
                updatedCount++;
            }
        }
    }

    console.log(`Finished. Restored ${updatedCount} Cloudinary URLs.`);
}

restoreCloudinary().catch(console.error);
