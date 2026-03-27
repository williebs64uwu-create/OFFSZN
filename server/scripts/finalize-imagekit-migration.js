import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const IMAGEKIT_PREFIX = 'https://ik.imagekit.io/6gzqp4xam/';
const CLOUDINARY_PREFIX = 'https://res.cloudinary.com/degtrrdqo/image/upload/v1/';

// Paths for the backups to identify original extensions
const AVATARS_DIR = path.join(__dirname, '../../legal/avatars');
const BANNERS_DIR = path.join(__dirname, '../../legal/banners');
const GROUPS_DIR = path.join(__dirname, '../../legal/groups');

// Build maps: filename-without-extension -> exact filename with extension
const avatarMap = new Map();
const bannerMap = new Map();
const groupMap = new Map();

function buildMap(dir, map) {
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            // Remove extension to get the base UUID
            const baseName = file.includes('.') ? file.substring(0, file.lastIndexOf('.')) : file;
            map.set(baseName, file);
        }
    }
}

buildMap(AVATARS_DIR, avatarMap);
buildMap(BANNERS_DIR, bannerMap);
buildMap(GROUPS_DIR, groupMap);

function fixUrl(currentUrl, folderMap, folderName) {
    if (!currentUrl) return null;
    let clean = currentUrl;

    // 1. Remove prefixes (Cloudinary, old ImageKit, URL:)
    if (clean.startsWith('url:')) clean = clean.substring(4);
    if (clean.startsWith(CLOUDINARY_PREFIX)) clean = clean.replace(CLOUDINARY_PREFIX, '');
    if (clean.startsWith(IMAGEKIT_PREFIX)) clean = clean.replace(IMAGEKIT_PREFIX, '');

    // Skip gradients or external HTTP URLs
    if (clean.startsWith('gradient:') || clean.startsWith('solid:')) return currentUrl; // Keep original gradient (even if it had .jpg, we stripped it in revert)
    if (clean.startsWith('http')) return currentUrl;

    // Remove any incorrectly appended .jpg by previous scripts
    // But ONLY if we appended it to something that shouldn't have it.
    // To be safe, we strip .jpg, .png, etc from the end to get the pure base name, then reconstruct it.
    let baseName = path.basename(clean);
    
    // We only process if it's in the correct folder path e.g. avatars/xxx
    if (!clean.startsWith(`${folderName}/`)) {
        return IMAGEKIT_PREFIX + clean; // Fallback
    }

    const extMatch = baseName.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
    let nameWithoutExt = extMatch ? baseName.replace(extMatch[0], '') : baseName;

    // 1. ALWAYS check the local backup maps FIRST.
    // This perfectly captures all legacy files (even legacy banners which started with 'banner_')
    const realFilename = folderMap.get(nameWithoutExt);

    if (realFilename) {
        // We found it! Use the exact filename from the backup (which has the correct extension)
        return `${IMAGEKIT_PREFIX}${folderName}/${realFilename}`;
    }

    // 2. If it is NOT in the backup, it must be a NEW ImageKit upload.
    // New SDK uploads start with 'avatar_', 'banner_', etc, and they DO NOT have extensions in ImageKit.
    if (nameWithoutExt.startsWith('avatar_') || nameWithoutExt.startsWith('banner_') || nameWithoutExt.startsWith('group_')) {
        return `${IMAGEKIT_PREFIX}${folderName}/${nameWithoutExt}`;
    }

    // 3. Fallback: If not found in local backup, just append .jpg as most of them were JPGs
    return `${IMAGEKIT_PREFIX}${folderName}/${nameWithoutExt}.jpg`;
}

async function fixTable(tableName, idColumn, config) {
    console.log(`\n🛠️  Migrando y arreglando rutas para la tabla: ${tableName}...`);
    
    const urlColumns = config.map(c => c.col);
    const { data: records, error } = await supabase
        .from(tableName)
        .select(`${idColumn}, ${urlColumns.join(', ')}`);

    if (error) {
        console.error(`  ❌ Error al obtener datos de ${tableName}:`, error.message);
        return;
    }

    let updatedCount = 0;
    for (const record of records) {
        const updates = {};
        let needsUpdate = false;

        for (const { col, map, folder } of config) {
            const currentUrl = record[col];
            if (currentUrl) {
                // Ensure gradients that got broken by previous scripts are fixed too
                if ((currentUrl.startsWith('gradient:') || currentUrl.startsWith('solid:')) && currentUrl.endsWith('.jpg')) {
                    updates[col] = currentUrl.replace(/\.jpg$/, '');
                    needsUpdate = true;
                    continue;
                }

                if (currentUrl.startsWith('http') && currentUrl.includes('googleusercontent.com') && currentUrl.endsWith('.jpg')) {
                    updates[col] = currentUrl.replace(/\.jpg$/, '');
                    needsUpdate = true;
                    continue;
                }

                // Normal fix for ImageKit URLs
                const fixedUrl = fixUrl(currentUrl, map, folder);
                if (fixedUrl && fixedUrl !== currentUrl) {
                    updates[col] = fixedUrl;
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
                updatedCount++;
            }
        }
    }

    console.log(`  ✅ Se corrigieron y migraron ${updatedCount} registros a ImageKit en ${tableName}.`);
}

async function run() {
    console.log('🚀 Iniciando la Migración Definitiva e Inteligente a ImageKit...\n');

    await fixTable('users', 'id', [
        { col: 'avatar_url', map: avatarMap, folder: 'avatars' },
        { col: 'banner_url', map: bannerMap, folder: 'banners' }
    ]);

    await fixTable('profiles', 'id', [
        { col: 'avatar_url', map: avatarMap, folder: 'avatars' }
    ]);

    await fixTable('conversations', 'id', [
        { col: 'group_avatar_url', map: groupMap, folder: 'groups' }
    ]);

    console.log('\n✅ Migración Definitiva Completada. Todos los links apuntan ahora a ImageKit correctamente.');
}

run();
