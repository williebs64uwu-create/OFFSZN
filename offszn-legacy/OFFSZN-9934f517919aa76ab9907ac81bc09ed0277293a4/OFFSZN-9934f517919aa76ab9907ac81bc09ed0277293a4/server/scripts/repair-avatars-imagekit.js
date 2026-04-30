import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const IMAGEKIT_PREFIX = 'https://ik.imagekit.io/6gzqp4xam/avatars/';
const AVATARS_IMAGEKIT_DIR = path.join(__dirname, '../../legal/avatars image kit');

// Build map: filename-without-extension -> full-filename
const folderMap = new Map();
if (fs.existsSync(AVATARS_IMAGEKIT_DIR)) {
    const files = fs.readdirSync(AVATARS_IMAGEKIT_DIR);
    console.log(`📂 Encontrados ${files.length} archivos en 'legal/avatars image kit'`);
    for (const file of files) {
        if (file === '.DS_Store') continue;
        const extMatch = file.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
        const baseName = extMatch ? file.replace(extMatch[0], '') : file;
        folderMap.set(baseName, file);
    }
} else {
    console.error("❌ No se encontró la carpeta: ", AVATARS_IMAGEKIT_DIR);
    process.exit(1);
}

async function run() {
    console.log('\n🚀 Iniciando reparación de Avatars ImageKit...');
    
    // FETCH USERS
    const { data: users, error } = await supabase
        .from('users')
        .select('id, avatar_url');

    if (error) {
        console.error('❌ Error fetching users:', error);
        return;
    }

    let updatedCount = 0;
    
    for (const user of users) {
        if (!user.avatar_url || !user.avatar_url.includes('ik.imagekit.io')) continue;

        let currentUrl = user.avatar_url;
        let filenameObj = currentUrl.split('/').pop();
        
        // Strip out query params just in case (e.g. ?tr=w-400)
        filenameObj = filenameObj.split('?')[0];
        
        // Strip extension
        const extMatch = filenameObj.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
        const baseNameFromDb = extMatch ? filenameObj.replace(extMatch[0], '') : filenameObj;

        // Find exact match in our folder Map
        const correctFilename = folderMap.get(baseNameFromDb);
        
        if (correctFilename) {
            const newUrl = `${IMAGEKIT_PREFIX}${correctFilename}`;
            if (newUrl !== currentUrl) {
                // Update DB!
                const { error: updErr } = await supabase
                    .from('users')
                    .update({ avatar_url: newUrl })
                    .eq('id', user.id);
                
                if (updErr) {
                    console.error(`❌ Error actualizando user ${user.id}:`, updErr.message);
                } else {
                    console.log(`✅ Actualizado: ${filenameObj} -> ${correctFilename}`);
                    updatedCount++;
                }
            }
        }
    }

    console.log(`\n🎉 Avatars corregidos: ${updatedCount}`);

    console.log('\n🚀 Revisando PROFILES...');
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, avatar_url');
        
    let profUpdated = 0;
    if (!pError && profiles) {
        for (const prof of profiles) {
            if (!prof.avatar_url || !prof.avatar_url.includes('ik.imagekit.io')) continue;

            let currentUrl = prof.avatar_url;
            let filenameObj = currentUrl.split('/').pop().split('?')[0];
            const extMatch = filenameObj.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
            const baseNameFromDb = extMatch ? filenameObj.replace(extMatch[0], '') : filenameObj;
            
            const correctFilename = folderMap.get(baseNameFromDb);
            if (correctFilename) {
                const newUrl = `${IMAGEKIT_PREFIX}${correctFilename}`;
                if (newUrl !== currentUrl) {
                    await supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', prof.id);
                    profUpdated++;
                }
            }
        }
    }
    console.log(`🎉 Profiles corregidos: ${profUpdated}`);
}

run();
