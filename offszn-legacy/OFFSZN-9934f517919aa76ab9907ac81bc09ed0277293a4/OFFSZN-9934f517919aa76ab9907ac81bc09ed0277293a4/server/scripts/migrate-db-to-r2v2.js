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

async function getTableColumns(tableName) {
    // We can use a trick: select 0 rows and check the keys of the first object (not reliable if empty)
    // Or just try to update and see if it fails.
    // Better: let's define which ones have flags.
    const flagsSupported = ['products', 'drumkit_drafts', 'preset_drafts', 'loopkit_drafts'];
    return flagsSupported.includes(tableName);
}

async function updateTableRef(tableName, columns, bucketPrefix) {
    console.log(`\n🔄 [TABLA] ${tableName} (prefix: ${bucketPrefix})`);

    const hasFlags = await getTableColumns(tableName);

    const { data: records, error: fetchError } = await supabase.from(tableName).select('*');

    if (fetchError) {
        console.error(`  ❌ Error obteniendo registros de ${tableName}:`, fetchError.message);
        return;
    }

    let updateCount = 0;
    for (const record of records) {
        let updates = {};
        if (hasFlags) {
            updates.storage_version = 'v2';
            updates.r2_version = 'v2';
        }

        let hasChanges = false;
        for (const col of columns) {
            const rawValue = record[col];
            if (rawValue && typeof rawValue === 'string') {
                let relativePath = rawValue;
                
                // 🔥 SAFETY CHECK: Never prefix if it's already an absolute URL or already prefixed
                if (relativePath.startsWith('http') || relativePath.startsWith('products/') || relativePath.startsWith('avatars/')) continue;

                // 1. Cleanup absolute URLs
                if (relativePath.includes('supabase.co')) {
                    const parts = relativePath.split('/object/public/');
                    if (parts.length > 1) {
                        relativePath = parts[1];
                    }
                }

                // 2. Add bucket prefix if missing
                if (!relativePath.startsWith(bucketPrefix + '/')) {
                     // Solo prefijamos si no parece tener ya un prefijo de bucket distinto
                     // Esto evita 'products/products/...'
                     relativePath = `${bucketPrefix}/${relativePath}`;
                }

                if (record[col] !== relativePath) {
                    updates[col] = relativePath;
                    hasChanges = true;
                }
            }
        }

        const needsFlagUpdate = hasFlags && (record.storage_version !== 'v2');
        if (hasChanges || needsFlagUpdate) {
            const { error: updateError } = await supabase
                .from(tableName)
                .update(updates)
                .eq('id', record.id);

            if (updateError) {
                console.error(`  ❌ Error en ID ${record.id}:`, updateError.message);
            } else {
                updateCount++;
            }
        }
    }

    console.log(`  ✅ ${tableName}: ${updateCount} registros procesados.`);
}

async function startMigration() {
    console.log('🚀 [FASE 3 - CORREGIDA] Actualizando Base de Datos para R2 V2...\n');

    await updateTableRef('products', [
        'image_url', 'audio_url', 'kit_url', 'audio_before_url', 
        'audio_after_url', 'mp3_url', 'wav_url', 'stems_url'
    ], 'products');

    await updateTableRef('profiles', ['avatar_url'], 'avatars');
    await updateTableRef('users', ['avatar_url', 'banner_url'], 'avatars');

    await updateTableRef('drumkit_drafts', ['cover_url', 'kit_url', 'audio_url', 'audio_after_url', 'audio_before_url'], 'drumkit_drafts');
    await updateTableRef('preset_drafts', ['cover_url', 'preset_url', 'audio_url', 'audio_after_url', 'audio_before_url'], 'preset_drafts');
    await updateTableRef('loopkit_drafts', ['cover_url', 'kit_url', 'audio_url'], 'loopkit_drafts');

    await updateTableRef('ai_sound_bank', ['url'], 'ai-sound-bank');
    await updateTableRef('studio_ai_history', ['audio_url'], 'studio-ai-history');
    await updateTableRef('purchases', ['download_url', 'license_pdf_url'], 'products');

    console.log('\n✨ Migración de Base de Datos completada con éxito.');
}

startMigration();
