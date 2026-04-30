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

const extractBucketAndPath = (url) => {
    if (!url || typeof url !== 'string' || !url.includes('supabase.co')) return null;
    
    try {
        const parts = url.split('/');
        const objectIndex = parts.indexOf('object');
        // Structure: .../object/[public|sign|authenticated]/[bucket_name]/[path]
        if (objectIndex !== -1 && parts.length > objectIndex + 3) {
            const bucket = parts[objectIndex + 2];
            const filePath = parts.slice(objectIndex + 3).join('/');
            return { bucket, filePath };
        }
    } catch (e) {
        return null;
    }
    return null;
};

async function migrate() {
    console.log('🚀 Iniciando migración de Supabase Storage a R2 V2...\n');

    const tables = ['products', 'beat_drafts', 'drumkit_drafts', 'loopkit_drafts', 'preset_drafts'];
    const fields = ['image_url', 'download_url_mp3', 'download_url_wav', 'download_url_stems', 'mp3_url', 'wav_url', 'zip_url'];

    for (const table of tables) {
        console.log(`\n--- Procesando tabla: ${table.toUpperCase()} ---`);
        
        const { data: records, error } = await supabase
            .from(table)
            .select('*');

        if (error) {
            console.error(`  ❌ Error al obtener datos de ${table}:`, error.message);
            continue;
        }

        let migratedCount = 0;

        for (const record of records) {
            const updates = {};
            let needsUpdate = false;

            for (const field of fields) {
                if (record[field] && typeof record[field] === 'string' && record[field].includes('supabase.co')) {
                    const result = extractBucketAndPath(record[field]);
                    
                    if (result) {
                        // In R2, we use a single bucket structure but keep the folder prefix
                        // so 'products' bucket items go to 'products/' folder in R2.
                        updates[field] = `${result.bucket}/${result.filePath}`;
                        needsUpdate = true;
                    }
                }
            }

            if (needsUpdate) {
                updates.storage_version = 'v1'; // Indicates R2 storage service
                updates.r2_version = 'v2';      // Indicates R2 V2 bucket (offsznlatbucket)

                const { error: updErr } = await supabase
                    .from(table)
                    .update(updates)
                    .eq('id', record.id);
                
                if (updErr) {
                    console.error(`    ❌ Error actualizando ${table} ID ${record.id}:`, updErr.message);
                } else {
                    migratedCount++;
                }
            }
        }
        console.log(`  ✅ ${migratedCount} registros migrados en ${table}.`);
    }

    console.log('\n✨ Migración completada con éxito.');
}

migrate();
