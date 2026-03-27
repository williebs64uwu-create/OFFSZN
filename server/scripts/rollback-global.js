import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const IMAGEKIT_BASE = 'https://ik.imagekit.io/6gzqp4xam/';

async function rollbackTable(tableName, idColumn, urlColumns) {
    console.log(`\n🔙 Revirtiendo tabla ${tableName}...`);
    
    const { data: records, error } = await supabase
        .from(tableName)
        .select(`${idColumn}, ${urlColumns.join(', ')}`);

    if (error) {
        console.error(`  ❌ Error al obtener datos de ${tableName}:`, error.message);
        return;
    }

    let rolledBackCount = 0;
    for (const record of records) {
        const updates = {};
        let needsUpdate = false;

        for (const col of urlColumns) {
            const currentUrl = record[col];
            if (currentUrl && currentUrl.startsWith(IMAGEKIT_BASE)) {
                // Revert to relative path OR whatever was there
                // This is a heuristic since we lost the original full URL if it was an R2 URL
                // But for products/covers and avatars/, relative is common.
                let originalUrl = currentUrl.replace(IMAGEKIT_BASE, '');
                
                // Special case for gradients that I broke by adding .jpg
                if (originalUrl.startsWith('gradient:') && originalUrl.endsWith('.jpg')) {
                    originalUrl = originalUrl.slice(0, -4);
                }
                
                if (originalUrl !== currentUrl) {
                    updates[col] = originalUrl;
                    needsUpdate = true;
                }
            }
        }

        if (needsUpdate) {
            const { error: updErr } = await supabase
                .from(tableName)
                .update(updates)
                .eq(idColumn, record[idColumn]);
            
            if (updErr) {
                console.error(`  ❌ Error revirtiendo ${tableName} ID ${record[idColumn]}:`, updErr.message);
            } else {
                rolledBackCount++;
            }
        }
    }

    console.log(`  ✅ Se revirtieron ${rolledBackCount} registros en ${tableName}.`);
}

async function run() {
    console.log('🔙 Iniciando REVERSIÓN GLOBAL de URLs...\n');

    // We already did products in a separate script, but can repeat or skip
    // await rollbackTable('products', 'id', ['image_url']);

    // Revert users, profiles, conversations
    await rollbackTable('users', 'id', ['avatar_url', 'banner_url']);
    await rollbackTable('profiles', 'id', ['avatar_url']);
    await rollbackTable('conversations', 'id', ['group_avatar_url']);

    console.log('\n✅ Reversión global completada.');
}

run();
