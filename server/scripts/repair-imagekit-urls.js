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

async function repair() {
    console.log('🔧 Iniciando reparación de URLs de ImageKit...\n');

    const { data: users, error } = await supabase
        .from('users')
        .select('id, nickname, avatar_url, banner_url')
        .or('avatar_url.ilike.%ik.imagekit.io%,banner_url.ilike.%ik.imagekit.io%');

    if (error) {
        console.error('❌ Error al obtener usuarios:', error.message);
        return;
    }

    let repairedCount = 0;

    for (const user of users) {
        const updates = {};
        let needsUpdate = false;

        // Repair avatar_url
        if (user.avatar_url && user.avatar_url.includes('ik.imagekit.io')) {
            let newUrl = user.avatar_url;
            
            // 1. Remove url: prefix
            if (newUrl.startsWith('url:')) newUrl = newUrl.substring(4);
            
            // 2. Remove wjyetw6g/ path segment
            if (newUrl.includes('/wjyetw6g/')) {
                newUrl = newUrl.replace('/wjyetw6g/', '/');
            }
            
            // 3. Add .jpg extension if missing and no query params
            // Usually filenames are UUIDs or prefixed UUIDs
            const urlWithoutQuery = newUrl.split('?')[0];
            if (!urlWithoutQuery.includes('.') && !newUrl.includes('.jpg') && !newUrl.includes('.png') && !newUrl.includes('.webp') && !newUrl.includes('.gif')) {
                 newUrl = urlWithoutQuery + '.jpg';
            }
            
            if (newUrl !== user.avatar_url) {
                updates.avatar_url = newUrl;
                needsUpdate = true;
            }
        }

        // Repair banner_url
        if (user.banner_url && user.banner_url.includes('ik.imagekit.io')) {
            let newUrl = user.banner_url;
            
            // 1. Remove url: prefix
            if (newUrl.startsWith('url:')) newUrl = newUrl.substring(4);
            
            // 2. Remove wjyetw6g/ path segment
            if (newUrl.includes('/wjyetw6g/')) {
                newUrl = newUrl.replace('/wjyetw6g/', '/');
            }
            
            // 3. Add .jpg extension if missing
            const urlWithoutQuery = newUrl.split('?')[0];
            if (!urlWithoutQuery.includes('.') && !newUrl.includes('.jpg') && !newUrl.includes('.png') && !newUrl.includes('.webp') && !newUrl.includes('.gif')) {
                 newUrl = urlWithoutQuery + '.jpg';
            }

            if (newUrl !== user.banner_url) {
                updates.banner_url = newUrl;
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            const { error: updErr } = await supabase
                .from('users')
                .update(updates)
                .eq('id', user.id);
            
            if (updErr) {
                console.error(`  ❌ Error actualizando ${user.nickname}:`, updErr.message);
            } else {
                repairedCount++;
            }
        }
    }

    console.log(`\n✅ Se repararon ${repairedCount} usuarios.`);
}

repair();
