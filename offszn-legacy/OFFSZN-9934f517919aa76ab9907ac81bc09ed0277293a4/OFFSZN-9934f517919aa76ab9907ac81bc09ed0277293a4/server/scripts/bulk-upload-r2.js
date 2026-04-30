import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// import mime from 'mime'; // Removed to avoid dependency issue

// Load environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const configV1 = {
    endpoint: process.env.R2_ENDPOINT,
    region: 'auto',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
};

const configV2 = {
    endpoint: process.env.R2_ENDPOINT_V2,
    region: 'auto',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID_V2,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY_V2,
    },
};

const s3V1 = new S3Client(configV1);
const s3V2 = new S3Client(configV2);

const VERSION = process.env.R2_VERSION || 'v1'; // Default to v1
const s3 = VERSION === 'v2' ? s3V2 : s3V1;
const BUCKET_NAME = VERSION === 'v2' ? process.env.R2_BUCKET_NAME_V2 : process.env.R2_BUCKET_NAME;


// --- CONFIGURACIÓN DE LA CARGA ---
const LOCAL_ROOT = process.env.UPLOAD_SRC || "D:/!!WILLIE INSPIRED/ESSENTIALS KITS/@roos.exe - New Year's GIFT/DRUMS/CLAP";
const R2_PREFIX = process.env.UPLOAD_PREFIX || "soundbank/PLUGG/CLAP/";
const SKIP_EXISTING = true;

// --- UTILS ---
async function fileExists(key) {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        return true;
    } catch (e) {
        return false;
    }
}

function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file));
        }
    });
    return arrayOfFiles;
}

async function uploadFile(filePath) {
    // Relative path for R2 key
    const relativePath = path.relative(LOCAL_ROOT, filePath).replace(/\\/g, '/');
    const key = R2_PREFIX + relativePath;

    if (SKIP_EXISTING && await fileExists(key)) {
        console.log(`[SKIP] Already exists: ${key}`);
        return;
    }

    const fileContent = fs.readFileSync(filePath);
    let contentType = 'application/octet-stream';
    
    // Simple MIME detection
    if (key.endsWith('.wav')) contentType = 'audio/wav';
    else if (key.endsWith('.mp3')) contentType = 'audio/mpeg';
    else if (key.endsWith('.zip')) contentType = 'application/zip';
    else if (key.endsWith('.png')) contentType = 'image/png';
    else if (key.endsWith('.jpg') || key.endsWith('.jpeg')) contentType = 'image/jpeg';

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: contentType
    });

    try {
        await s3.send(command);
        console.log(`[SUCCESS] Uploaded: ${key}`);
    } catch (err) {
        console.error(`[ERROR] Failed to upload ${key}:`, err.message);
    }
}

async function startBatch() {
    console.log('🚀 Iniciando subida masiva a Cloudflare R2...');
    console.log(`📂 Origen Local: ${LOCAL_ROOT}`);
    console.log(`☁️ Destino R2: ${R2_PREFIX}`);
    console.log(`📦 Bucket: ${BUCKET_NAME}\n`);

    if (!fs.existsSync(LOCAL_ROOT)) {
        console.error(`❌ Error: La ruta local no existe: ${LOCAL_ROOT}`);
        process.exit(1);
    }

    const files = getAllFiles(LOCAL_ROOT);
    console.log(`Found ${files.length} files to process.\n`);

    // Upload in parallel with a small limit
    const CONCURRENCY = 5;
    for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(file => uploadFile(file)));
    }

    console.log('\n✨ Proceso de subida completado.');
}

startBatch();
