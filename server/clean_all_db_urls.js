
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function isR2Url(url) {
    if (!url || typeof url !== 'string') return false;
    return url.includes('r2.cloudflarestorage.com') || 
           url.includes('X-Amz-Signature') ||
           url.includes('pub-') && url.includes('.r2.dev');
}

function cleanR2Url(url) {
    let key = url;
    
    const r2Base = '.r2.cloudflarestorage.com/';
    if (key.includes(r2Base)) {
        key = key.split(r2Base)[1];
    }
    
    // Remove query string
    if (key.includes('?')) key = key.split('?')[0];
    
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

async function fixCloudinaryAndCleanR2() {
    console.log('Fetching ALL products...');
    const { data: products, error } = await supabase
        .from('products')
        .select('id, image_url, audio_url');

    if (error) { console.error(error); return; }

    let count = 0;
    for (const p of products) {
        let updates = {};
        let changed = false;

        // FIX: Restore corrupted cloudinary URLs (they were stripped of their domain)
        if (p.image_url && !p.image_url.startsWith('http') && p.image_url.includes('cloudinary')) {
            updates.image_url = `https://res.cloudinary.com/${p.image_url}`;
            changed = true;
            console.log(`[${p.id}] RESTORE cloudinary image: ${updates.image_url}`);
        }
        // Clean R2 absolute URLs
        else if (p.image_url && isR2Url(p.image_url)) {
            const cleaned = cleanR2Url(p.image_url);
            if (cleaned !== p.image_url) {
                updates.image_url = cleaned;
                changed = true;
                console.log(`[${p.id}] CLEAN R2 image: ${p.image_url.substring(0,60)}... => ${cleaned}`);
            }
        }

        if (p.audio_url && isR2Url(p.audio_url)) {
            const cleaned = cleanR2Url(p.audio_url);
            if (cleaned !== p.audio_url) {
                updates.audio_url = cleaned;
                changed = true;
                console.log(`[${p.id}] CLEAN R2 audio: ${p.audio_url.substring(0,60)}... => ${cleaned}`);
            }
        }

        if (changed) {
            count++;
            const { error: updErr } = await supabase.from('products').update(updates).eq('id', p.id);
            if (updErr) console.error(`Failed ${p.id}:`, updErr.message);
            else console.log(`✅ ${p.id} updated.`);
        }
    }
    console.log(`\n✅ Done. Fixed ${count} products.`);
}

fixCloudinaryAndCleanR2().catch(console.error);
