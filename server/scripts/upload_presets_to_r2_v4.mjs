import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const LOCAL_PRESETS_DIR = 'D:\\PRESETS COMPLETOS\\PAGO\\ARTISTAS';

const R2_ENDPOINT_V4 = process.env.R2_ENDPOINT_V4;
const R2_ACCESS_KEY_ID_V4 = process.env.R2_ACCESS_KEY_ID_V4;
const R2_SECRET_ACCESS_KEY_V4 = process.env.R2_SECRET_ACCESS_KEY_V4;
const R2_BUCKET_NAME_V4 = process.env.R2_BUCKET_NAME_V4 || 'bucket2026';

if (!R2_ENDPOINT_V4 || !R2_ACCESS_KEY_ID_V4 || !R2_SECRET_ACCESS_KEY_V4) {
    console.error('❌ Faltan credenciales de R2 V4 en .env (R2_ENDPOINT_V4, R2_ACCESS_KEY_ID_V4, R2_SECRET_ACCESS_KEY_V4)');
    process.exit(1);
}

const s3Client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT_V4,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID_V4,
        secretAccessKey: R2_SECRET_ACCESS_KEY_V4
    }
});

function slugify(text) {
    return text.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

function getContentType(ext) {
    switch (ext.toLowerCase()) {
        case '.fst': return 'application/octet-stream';
        case '.flp': return 'application/octet-stream';
        case '.rar': return 'application/x-rar-compressed';
        case '.zip': return 'application/zip';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        default: return 'application/octet-stream';
    }
}

async function uploadFile(localPath, r2Key, dryRun = false) {
    const ext = path.extname(localPath);
    const contentType = getContentType(ext);
    const stat = fs.statSync(localPath);

    if (dryRun) {
        console.log(`[DRY RUN] Subiría: ${localPath} -> ${r2Key} (${(stat.size / 1024).toFixed(1)} KB)`);
        return true;
    }

    try {
        const fileBuffer = fs.readFileSync(localPath);
        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME_V4,
            Key: r2Key,
            Body: fileBuffer,
            ContentType: contentType
        });

        await s3Client.send(command);
        console.log(`✅ [SUBIDO] ${r2Key} (${(stat.size / 1024).toFixed(1)} KB)`);
        return true;
    } catch (e) {
        console.error(`❌ [ERROR] Falló al subir ${r2Key}:`, e.message);
        return false;
    }
}

async function run() {
    const isDryRun = process.argv.includes('--dry-run');
    console.log(`=======================================================`);
    console.log(`🚀 SINCRONIZADOR DE PRESETS A CLOUDFLARE R2 BUCKET 4`);
    console.log(`Bucket destino: ${R2_BUCKET_NAME_V4}`);
    console.log(`Directorio origen: ${LOCAL_PRESETS_DIR}`);
    console.log(`Modo: ${isDryRun ? 'SIMULACIÓN (DRY RUN)' : 'SUBIDA REAL'}`);
    console.log(`=======================================================\n`);

    if (!fs.existsSync(LOCAL_PRESETS_DIR)) {
        console.error(`❌ El directorio ${LOCAL_PRESETS_DIR} no existe.`);
        process.exit(1);
    }

    const items = fs.readdirSync(LOCAL_PRESETS_DIR);
    let totalFiles = 0;
    let uploadedCount = 0;

    for (const name of items) {
        const fullPath = path.join(LOCAL_PRESETS_DIR, name);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            const slug = slugify(name);
            const files = fs.readdirSync(fullPath);

            for (const file of files) {
                const filePath = path.join(fullPath, file);
                const fileStat = fs.statSync(filePath);
                if (fileStat.isFile()) {
                    totalFiles++;
                    const r2Key = `presets/artistas/${slug}/${file}`;
                    const ok = await uploadFile(filePath, r2Key, isDryRun);
                    if (ok) uploadedCount++;
                }
            }
        } else if (stat.isFile()) {
            const ext = path.extname(name).toLowerCase();
            if (['.fst', '.flp', '.rar', '.zip'].includes(ext)) {
                totalFiles++;
                const artistName = path.parse(name).name;
                const slug = slugify(artistName);
                const r2Key = `presets/artistas/${slug}/${name}`;
                const ok = await uploadFile(fullPath, r2Key, isDryRun);
                if (ok) uploadedCount++;
            }
        }
    }

    console.log(`\n=======================================================`);
    console.log(`🏁 Sincronización completada: ${uploadedCount}/${totalFiles} archivos procesados.`);
    console.log(`=======================================================`);
}

run();
