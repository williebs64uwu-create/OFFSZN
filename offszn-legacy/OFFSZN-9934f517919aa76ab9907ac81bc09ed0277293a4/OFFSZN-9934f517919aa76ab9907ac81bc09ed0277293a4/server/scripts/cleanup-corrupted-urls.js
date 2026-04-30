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

async function cleanTableUrls(tableName, columns, bucketPrefix) {
    console.log(`\n🧹 [LIMPIEZA] ${tableName}`);

    const { data: records, error: fetchError } = await supabase
        .from(tableName)
        .select('*');

    if (fetchError) {
        console.error(`  ❌ Error:`, fetchError.message);
        return;
    }

    let fixCount = 0;
    for (const record of records) {
        let updates = {};
        let hasFixes = false;

        for (const col of columns) {
            const val = record[col];
            if (val && typeof val === 'string') {
                // Patrón corrupto: "bucket/https://..."
                const corruptionPattern = `${bucketPrefix}/http`;
                if (val.startsWith(corruptionPattern)) {
                    // Restauramos quitando el prefijo del bucket
                    updates[col] = val.substring(bucketPrefix.length + 1);
                    hasFixes = true;
                }
                
                // Patrón corrupto 2: "bucket/bucket/..." (doble prefijo)
                const doublePrefix = `${bucketPrefix}/${bucketPrefix}/`;
                if (val.startsWith(doublePrefix)) {
                    updates[col] = val.substring(bucketPrefix.length + 1);
                    hasFixes = true;
                }
            }
        }

        if (hasFixes) {
            const { error: updateError } = await supabase
                .from(tableName)
                .update(updates)
                .eq('id', record.id);

            if (updateError) {
                console.error(`  ❌ Error en ID ${record.id}:`, updateError.message);
            } else {
                fixCount++;
            }
        }
    }

    console.log(`  ✅ ${tableName}: ${fixCount} registros corregidos.`);
}

async function startCleanup() {
    console.log('🚀 Iniciando limpieza de URLs corruptas...\n');

    // 1. Limpiar Productos
    await cleanTableUrls('products', [
        'image_url', 'audio_url', 'kit_url', 'audio_before_url', 
        'audio_after_url', 'mp3_url', 'wav_url', 'stems_url'
    ], 'products');

    // 2. Limpiar Perfiles y Usuarios
    await cleanTableUrls('profiles', ['avatar_url'], 'avatars');
    await cleanTableUrls('users', ['avatar_url', 'banner_url'], 'avatars');

    // 3. Limpiar Drafts
    await cleanTableUrls('drumkit_drafts', ['cover_url', 'kit_url', 'audio_url'], 'drumkit_drafts');
    await cleanTableUrls('preset_drafts', ['cover_url', 'preset_url', 'audio_url'], 'preset_drafts');
    await cleanTableUrls('loopkit_drafts', ['cover_url', 'kit_url', 'audio_url'], 'loopkit_drafts');

    // 4. Otros
    await cleanTableUrls('ai_sound_bank', ['url'], 'ai-sound-bank');
    await cleanTableUrls('studio_ai_history', ['audio_url'], 'studio-ai-history');

    console.log('\n✨ Limpieza completada. Las URLs vuelven a ser válidas.');
}

startCleanup();
