import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const r2Config = {
    endpoint: process.env.R2_ENDPOINT_V2,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID_V2,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY_V2,
    },
    region: 'auto',
};

const bucketName = process.env.R2_BUCKET_NAME_V2 || 'offsznlatbucket';
const s3 = new S3Client(r2Config);
const BACKUP_ROOT = path.join(__dirname, '../storage_migration_backup');

const MIME_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.txt': 'text/plain',
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

async function uploadFile(fullPath, relativeKey) {
    const fileBuffer = fs.readFileSync(fullPath);
    const contentType = getMimeType(fullPath);

    try {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: relativeKey.replace(/\\/g, '/'),
            Body: fileBuffer,
            ContentType: contentType,
        });

        await s3.send(command);
        return true;
    } catch (error) {
        console.error(`  ❌ Error subiendo ${relativeKey}:`, error.message);
        return false;
    }
}

function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            // Avoid placeholders or system files
            if (!file.startsWith('.')) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

async function startUpload() {
    console.log(`🚀 [FASE 2] Iniciando subida masiva a Cloudflare R2 V2 (${bucketName})...\n`);

    if (!fs.existsSync(BACKUP_ROOT)) {
        console.error('❌ Error: No se encontró la carpeta storage_migration_backup/');
        process.exit(1);
    }

    const allFiles = getAllFiles(BACKUP_ROOT);
    console.log(`🔍 Encontrados ${allFiles.length} archivos locales para subir.`);

    let successCount = 0;
    for (const filePath of allFiles) {
        const relativeKey = path.relative(BACKUP_ROOT, filePath);
        
        const success = await uploadFile(filePath, relativeKey);
        if (success) successCount++;

        if (successCount % 10 === 0 && successCount > 0) {
            console.log(`  ⏳ Subidos ${successCount}/${allFiles.length}...`);
        }
    }

    console.log(`\n✨ Subida completada: ${successCount} archivos subidos con éxito a R2 V2.`);
}

startUpload();
