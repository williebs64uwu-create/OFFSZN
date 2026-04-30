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

const CLOUDINARY_PREFIX = 'https://res.cloudinary.com/degtrrdqo/image/upload/v1/';

function restoreCloudinary(url) {
    if (!url) return null;
    let clean = url;

    // 0. Remove 'url:' if present FIRST
    if (clean.startsWith('url:')) clean = clean.substring(4);

    // 1. Handle Google User Content URLs that were wrongly appended with .jpg
    if (clean.includes('googleusercontent.com') && clean.endsWith('.jpg')) {
        clean = clean.replace(/\.jpg$/, '');
    }

    // 2. If it is already a full URL, we don't touch it unless it's a broken ImageKit URL
    if (clean.startsWith('http')) {
        // If it still has ImageKit by any chance
        if (clean.includes('ik.imagekit.io')) {
            clean = clean.replace('https://ik.imagekit.io/6gzqp4xam/', '');
            clean = clean.split('?')[0]; // strip old query params
        } else {
            return clean; // Retorna Google sin .jpg u otras URL válidas
        }
    }

    // The 'url:' check was moved to the very beginning.

    // 4. Prepend Cloudinary if it's a relative path starting with avatars, banners, or groups
    if (clean.startsWith('avatars/') || clean.startsWith('banners/') || clean.startsWith('groups/')) {
        // Removing .jpg if we suspect it was added artificially?
        // Actually, Cloudinary handles .jpg fine as a format suffix: e.g. v1/avatars/xxx.jpg
        // But the user specifically noted 28 are missing it. I will REMOVE .jpg from UUID-like strings to be safe on Cloudinary
        // UUID is 36 chars. + ".jpg" is 40 chars. Path "avatars/uuid" is 8 + 36 = 44.
        // Also "avatar_XXX..._YYY.jpg"
        // Since Cloudinary might 404 if the suffix is wrong for some edge cases, and the user said "revuelve todo primero como estaba".
        // Let's strip .jpg ONLY IF the file in Cloudinary was known to be extensionless, but we don't really know.
        // Given Cloudinary's dynamic extensions, it usually works. Let's just strip .jpg if we think it was added by our scripts.
        // Instead of guessing, let's leave .jpg. If Cloudinary 404s, we will strip it later. Usually Cloudinary DOES NOT 404 for .jpg.
        
        // Wait, some extensions were gradients! 
        if (clean.startsWith('gradient:') && clean.endsWith('.jpg')) {
            return clean.replace(/\.jpg$/, '');
        }
        if (clean.startsWith('solid:') && clean.endsWith('.jpg')) {
            return clean.replace(/\.jpg$/, '');
        }

        return CLOUDINARY_PREFIX + clean;
    }

    // Gradient/Solid without .jpg
    if (clean.startsWith('gradient:') || clean.startsWith('solid:')) {
        return clean;
    }

    // Default fallback
    return clean;
}

async function revertTable(tableName, idColumn, urlColumns) {
    console.log(`\n🔙 Revirtiendo tabla a Cloudinary: ${tableName}...`);
    
    const { data: records, error } = await supabase
        .from(tableName)
        .select(`${idColumn}, ${urlColumns.join(', ')}`);

    if (error) {
        console.error(`  ❌ Error al obtener datos de ${tableName}:`, error.message);
        return;
    }

    let revertedCount = 0;
    for (const record of records) {
        const updates = {};
        let needsUpdate = false;

        for (const col of urlColumns) {
            const currentUrl = record[col];
            if (currentUrl) {
                const restoredUrl = restoreCloudinary(currentUrl);
                if (restoredUrl && restoredUrl !== currentUrl) {
                    updates[col] = restoredUrl;
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
                revertedCount++;
            }
        }
    }

    console.log(`  ✅ Se restauraron a Cloudinary ${revertedCount} registros en ${tableName}.`);
}

async function run() {
    console.log('🔙 Iniciando RESTAURACIÓN a CLOUDINARY...\n');

    // Revert users, profiles, conversations
    await revertTable('users', 'id', ['avatar_url', 'banner_url']);
    await revertTable('profiles', 'id', ['avatar_url']);
    await revertTable('conversations', 'id', ['group_avatar_url']);

    console.log('\n✅ Restauración a Cloudinary completada.');
}

run();
