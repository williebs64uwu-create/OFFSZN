
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function extractKeyFromSignedUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('X-Amz-')) return url;
    
    let key = url.split('?')[0];
    
    // Convert to relative path if it's an absolute URL
    if (key.startsWith('http://') || key.startsWith('https://')) {
        try {
            const urlObj = new URL(key);
            key = urlObj.pathname;
        } catch (e) {}
    }

    // Strip bucket names
    const bucketNames = ['offsznlatbucket', 'offszn-storage', 'secure-products'];
    for (const b of bucketNames) {
        const normalizedPath = key.startsWith('/') ? key : `/${key}`;
        if (normalizedPath.startsWith(`/${b}/`)) {
            key = normalizedPath.substring(b.length + 2);
            break;
        }
    }

    while (key.startsWith('/')) key = key.substring(1);
    return key;
}

async function cleanAllDBUrls() {
    console.log('Fetching ALL products to check for X-Amz-Signature...');
    const { data: products, error } = await supabase
        .from('products')
        .select('id, image_url, audio_url');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    if (products && products.length > 0) {
        let needsCleaning = 0;
        for (const p of products) {
            let updates = {};
            let changed = false;

            if (p.image_url && typeof p.image_url === 'string' && p.image_url.includes('X-Amz-')) {
                updates.image_url = extractKeyFromSignedUrl(p.image_url);
                changed = true;
                console.log(`[${p.id}] Cleaned image_url: ${updates.image_url}`);
            }

            if (p.audio_url && typeof p.audio_url === 'string' && p.audio_url.includes('X-Amz-')) {
                updates.audio_url = extractKeyFromSignedUrl(p.audio_url);
                changed = true;
                console.log(`[${p.id}] Cleaned audio_url: ${updates.audio_url}`);
            }

            if (changed) {
                needsCleaning++;
                const { error: updErr } = await supabase
                    .from('products')
                    .update(updates)
                    .eq('id', p.id);
                if (updErr) console.error(`Failed to update ${p.id}:`, updErr.message);
                else console.log(`✅ Updated ${p.id} successfully.`);
            }
        }
        if (needsCleaning === 0) {
            console.log('No products in the entire DB had X-Amz- in their URLs! All clean.');
        } else {
            console.log(`Successfully cleaned ${needsCleaning} products in total.`);
        }
    } else {
        console.log('No products found.');
    }
}

cleanAllDBUrls();
