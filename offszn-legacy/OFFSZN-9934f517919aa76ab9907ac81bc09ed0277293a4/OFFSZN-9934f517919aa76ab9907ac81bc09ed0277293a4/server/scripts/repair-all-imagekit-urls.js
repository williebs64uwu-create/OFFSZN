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

function transformUrl(url) {
    if (!url) return null;
    let newUrl = url;

    // 1. Remove url: prefix
    if (newUrl.startsWith('url:')) newUrl = newUrl.substring(4);

    // 2. Handle R2 URLs
    if (newUrl.includes('r2.cloudflarestorage.com')) {
        // Handle V2 bucket
        if (newUrl.includes('offsznlatbucket/')) {
            newUrl = newUrl.split('offsznlatbucket/')[1];
        } 
        // Handle V1 bucket or other patterns
        else if (newUrl.includes('.r2.cloudflarestorage.com/')) {
            newUrl = newUrl.split('.r2.cloudflarestorage.com/')[1];
        }
    }

    // 3. Handle relative paths that might need base prepended
    // If it doesn't start with http, assume it's a path for ImageKit
    if (!newUrl.startsWith('http')) {
        // Prepend ImageKit base
        newUrl = IMAGEKIT_BASE + newUrl;
    } else if (newUrl.includes('ik.imagekit.io')) {
        // Already ImageKit, but check for redundancy
        // Use regex to normalize the base
        newUrl = newUrl.replace(/https:\/\/ik\.imagekit\.io\/[^/]+\/(wjyetw6g\/)?/, IMAGEKIT_BASE);
    }

    // 4. Remove query parameters (especially pre-signed R2 params)
    const urlWithoutQuery = newUrl.split('?')[0];
    newUrl = urlWithoutQuery;

    // 5. Add .jpg extension if missing and no other extension present in the PATH
    const urlObj = new URL(newUrl);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    
    if (filename && !filename.includes('.') && 
        !filename.toLowerCase().endsWith('.jpg') && 
        !filename.toLowerCase().endsWith('.png') && 
        !filename.toLowerCase().endsWith('.webp') && 
        !filename.toLowerCase().endsWith('.gif') &&
        !filename.toLowerCase().endsWith('.mp3') &&
        !filename.toLowerCase().endsWith('.wav')) {
        newUrl = urlWithoutQuery + '.jpg';
    }

    return newUrl;
}

async function repairTable(tableName, idColumn, urlColumns) {
    console.log(`\n📦 Reparando tabla ${tableName}...`);
    
    // Construct OR filter for all columns
    const orFilter = urlColumns.map(col => `${col}.not.is.null`).join(',');
    
    const { data: records, error } = await supabase
        .from(tableName)
        .select(`${idColumn}, ${urlColumns.join(', ')}`);

    if (error) {
        console.error(`  ❌ Error al obtener datos de ${tableName}:`, error.message);
        return;
    }

    let repairedCount = 0;
    for (const record of records) {
        const updates = {};
        let needsUpdate = false;

        for (const col of urlColumns) {
            const currentUrl = record[col];
            if (currentUrl) {
                const newUrl = transformUrl(currentUrl);
                if (newUrl && newUrl !== currentUrl) {
                    updates[col] = newUrl;
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
                console.error(`  ❌ Error actualizando ${tableName} ID ${record[idColumn]}:`, updErr.message);
            } else {
                repairedCount++;
            }
        }
    }

    console.log(`  ✅ Se repararon ${repairedCount} registros en ${tableName}.`);
}

async function run() {
    console.log('🔧 Iniciando reparación GLOBAL de URLs de ImageKit...\n');

    // 1. Products
    await repairTable('products', 'id', ['image_url']);

    // 2. Users (Already done partially, but good to clean up leftovers and query params)
    await repairTable('users', 'id', ['avatar_url', 'banner_url']);

    // 3. Profiles
    await repairTable('profiles', 'id', ['avatar_url']);

    // 4. Drafts
    await repairTable('drumkit_drafts', 'id', ['cover_url']);
    await repairTable('loopkit_drafts', 'id', ['cover_url']);
    await repairTable('preset_drafts', 'id', ['cover_url']);

    // 5. Conversations & Messages
    await repairTable('conversations', 'id', ['group_avatar_url']);
    
    console.log('\n🚀 Reparación global completada.');
}

run();
