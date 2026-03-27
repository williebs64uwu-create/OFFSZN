import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const IMAGEKIT_BASE = 'https://ik.imagekit.io/6gzqp4xam/';

async function rollback() {
    console.log('🔙 Revirtiendo cambios en la tabla products...\n');

    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, image_url')
        .like('image_url', `${IMAGEKIT_BASE}%`);

    if (error) {
        console.error('❌ Error al obtener productos:', error.message);
        return;
    }

    console.log(`🔍 Encontrados ${products.length} productos para revertir.`);

    let rolledBackCount = 0;

    for (const prod of products) {
        // Remove ImageKit base
        let originalUrl = prod.image_url.replace(IMAGEKIT_BASE, '');
        
        // Remove added .jpg if it was added (this is tricky because some might have had it)
        // But usually the relative paths had .jpg already in the DB according to my earlier audit
        // Wait, did they? 
        // Step 1371 showed: products/covers/.../1774298418564_cover.jpg
        // So they DID have extensions.
        // If my script added ANOTHER .jpg (e.g. .jpg.jpg), I should fix that.
        // But my regex in script 2 wouldn't have added it if it already had it.
        
        if (originalUrl !== prod.image_url) {
            const { error: updErr } = await supabase
                .from('products')
                .update({ image_url: originalUrl })
                .eq('id', prod.id);
            
            if (updErr) {
                console.error(`  ❌ Error revirtiendo ${prod.name}:`, updErr.message);
            } else {
                rolledBackCount++;
            }
        }
    }

    console.log(`\n✅ Se revirtieron ${rolledBackCount} productos.`);
}

rollback();
