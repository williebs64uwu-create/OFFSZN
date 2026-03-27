import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('🚀 Final fix for extensionless ImageKit avatars...');
    
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
        
        // We look for avatars that have the 'avatar_UUID_SUFFIX.EXT' pattern
        // Because "avatar_" followed by "_" suffix means it was likely an SDK upload which originated extensionless
        if (currentUrl.includes('avatar_') && currentUrl.split('_').length >= 3) {
            
            const extMatch = currentUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i);
            
            if (extMatch) {
                // Let's verify if the extensionless URL actually exists
                const extensionlessUrl = currentUrl.replace(extMatch[0], '');
                
                try {
                    const res = await fetch(extensionlessUrl, { method: 'HEAD' });
                    if (res.ok) {
                        // Extensionless URL works!
                        const { error: updErr } = await supabase
                            .from('users')
                            .update({ avatar_url: extensionlessUrl })
                            .eq('id', user.id);
                        
                        if (!updErr) {
                            console.log(`✅ Stripped extension: ${extensionlessUrl.split('/').pop()}`);
                            updatedCount++;
                        }
                    } else {
                        console.log(`⚠️ Ignorado (404 en extensionless): ${extensionlessUrl}`);
                    }
                } catch(e) {
                    console.error("fetch error", e);
                }
            }
        }
    }

    console.log(`\n🎉 Avatars corregidos finalmente: ${updatedCount}`);
}

run();
