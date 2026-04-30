import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
let imageKitEndpoint = process.env.IMAGEKIT_URL_ENDPOINT ? process.env.IMAGEKIT_URL_ENDPOINT.replace(/\/+$/, '') : null;
if (imageKitEndpoint) imageKitEndpoint = imageKitEndpoint + '/'; // Ensure exactly one trailing slash for safe concatenation

if (!supabaseUrl || !supabaseKey || !imageKitEndpoint) {
    console.error('❌ Error: SUPABASE_URL, SUPABASE_SERVICE_KEY and IMAGEKIT_URL_ENDPOINT must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log('🚀 Iniciando migración de links de Cloudinary a ImageKit...\n');
    console.log(`📡 ImageKit Endpoint: ${imageKitEndpoint}`);

    // --- 1. MIGRACIÓN DE USERS (Avatars y Banners) ---
    console.log('\n--- [1/2] Procesando tabla: USERS ---');
    const { data: users, error: uError } = await supabase
        .from('users')
        .select('id, nickname, avatar_url, banner_url')
        .or('avatar_url.ilike.%cloudinary%,banner_url.ilike.%cloudinary%');

    if (uError) {
        console.error('❌ Error al obtener usuarios:', uError);
    } else {
        console.log(`🔍 Se encontraron ${users.length} usuarios con links de Cloudinary.`);
        for (const user of users) {
            const updates = {};
            
            if (user.avatar_url?.includes('cloudinary')) {
                const parts = user.avatar_url.split('/');
                const filename = parts[parts.length - 1];
                const folder = parts[parts.length - 2];
                updates.avatar_url = `${imageKitEndpoint}${folder}/${filename}`;
            }

            if (user.banner_url?.includes('cloudinary')) {
                const parts = user.banner_url.split('/');
                const filename = parts[parts.length - 1];
                const folder = parts[parts.length - 2];
                // Preserve 'url:' prefix if it exists
                const prefix = user.banner_url.startsWith('url:') ? 'url:' : '';
                updates.banner_url = `${prefix}${imageKitEndpoint}${folder}/${filename}`;
            }

            if (Object.keys(updates).length > 0) {
                const { error: updErr } = await supabase
                    .from('users')
                    .update(updates)
                    .eq('id', user.id);
                
                if (updErr) console.error(`  ❌ Error actualizando usuario ${user.nickname}:`, updErr.message);
                else console.log(`  ✅ Usuario ${user.nickname} migrado.`);
            }
        }
    }

    // --- 2. MIGRACIÓN DE PRODUCTS ---
    console.log('\n--- [2/2] Procesando tabla: PRODUCTS ---');
    const { data: products, error: pError } = await supabase
        .from('products')
        .select('id, name, image_url')
        .ilike('image_url', '%cloudinary%');

    if (pError) {
        console.error('❌ Error al obtener productos:', pError);
    } else {
        console.log(`🔍 Se encontraron ${products.length} productos con links de Cloudinary.`);
        for (const product of products) {
            const parts = product.image_url.split('/');
            const filename = parts[parts.length - 1];
            const folder = parts[parts.length - 2];
            
            // Check if folder is valid (avatars, banners, etc.) or just use the last two segments
            const newUrl = `${imageKitEndpoint}${folder}/${filename}`;

            const { error: updErr } = await supabase
                .from('products')
                .update({ image_url: newUrl })
                .eq('id', product.id);
            
            if (updErr) console.error(`  ❌ Error actualizando producto ${product.name}:`, updErr.message);
            else console.log(`  ✅ Producto ${product.name} migrado.`);
        }
    }

    console.log('\n✨ Migración completada con éxito.');
}

migrate();
