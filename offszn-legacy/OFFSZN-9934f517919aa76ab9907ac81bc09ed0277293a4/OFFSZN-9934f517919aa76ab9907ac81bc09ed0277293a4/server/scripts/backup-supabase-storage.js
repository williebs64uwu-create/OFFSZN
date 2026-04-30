import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
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
const BACKUP_ROOT = path.join(__dirname, '../storage_migration_backup');

async function downloadFile(bucketId, filePath) {
    const fullLocalPath = path.join(BACKUP_ROOT, bucketId, filePath);
    const localDir = path.dirname(fullLocalPath);

    // Skip if already exists and has size > 0
    if (fs.existsSync(fullLocalPath) && fs.statSync(fullLocalPath).size > 0) {
        return 'skipped';
    }

    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }

    try {
        const { data, error } = await supabase.storage.from(bucketId).download(filePath);

        if (error) {
            console.error(`  ❌ Error descargando ${bucketId}/${filePath}:`, error.message);
            return 'error';
        }

        const buffer = Buffer.from(await data.arrayBuffer());
        fs.writeFileSync(fullLocalPath, buffer);
        return 'downloaded';
    } catch (e) {
        console.error(`  ❌ Excepción en ${bucketId}/${filePath}:`, e.message);
        return 'error';
    }
}

async function listAllFiles(bucketId, folder = '') {
    const { data: items, error } = await supabase.storage.from(bucketId).list(folder, {
        limit: 1000, // Supabase default limit is often small
    });

    if (error) {
        console.error(`  ❌ Error enlistando ${bucketId}/${folder}:`, error.message);
        return [];
    }

    let files = [];
    for (const item of items) {
        const itemPath = folder ? `${folder}/${item.name}` : item.name;

        // Folders don't have metadata or id in this version of the SDK list response usually
        if (!item.id && !item.metadata) {
            const nested = await listAllFiles(bucketId, itemPath);
            files = files.concat(nested);
        } else {
            files.push(itemPath);
        }
    }
    return files;
}

async function startBackup() {
    console.log('🚀 [REINICIO SEGURO] Iniciando backup de Supabase Storage...\n');

    if (!fs.existsSync(BACKUP_ROOT)) {
        fs.mkdirSync(BACKUP_ROOT, { recursive: true });
    }

    const { data: buckets, error: bError } = await supabase.storage.listBuckets();

    if (bError) {
        console.error('❌ Error obteniendo buckets:', bError.message);
        return;
    }

    console.log(`📦 Encontrados ${buckets.length} buckets.`);
    
    let globalStats = {
        total: 0,
        downloaded: 0,
        skipped: 0,
        errors: 0
    };

    for (const bucket of buckets) {
        console.log(`\n📂 Procesando bucket: ${bucket.name}`);
        const files = await listAllFiles(bucket.name);
        console.log(`  🔍 Encontrados ${files.length} archivos.`);

        let bucketSuccess = 0;
        for (const file of files) {
            globalStats.total++;
            const result = await downloadFile(bucket.name, file);
            
            if (result === 'downloaded') {
                globalStats.downloaded++;
                bucketSuccess++;
            } else if (result === 'skipped') {
                globalStats.skipped++;
                bucketSuccess++;
            } else {
                globalStats.errors++;
            }
            
            if (bucketSuccess % 5 === 0 && bucketSuccess > 0) {
                process.stdout.write(`\r  ⏳ Progreso ${bucket.name}: ${bucketSuccess}/${files.length}...`);
            }
        }
        console.log(`\n  ✅ Bucket ${bucket.name} procesado.`);
    }

    console.log('\n--- RESUMEN FINAL ---');
    console.log(`Total archivos: ${globalStats.total}`);
    console.log(`Descargados nuevos: ${globalStats.downloaded}`);
    console.log(`Omitidos (ya existen): ${globalStats.skipped}`);
    console.log(`Errores: ${globalStats.errors}`);
    console.log(`\n✨ Backup finalizado en: ${BACKUP_ROOT}`);
}

startBackup();
