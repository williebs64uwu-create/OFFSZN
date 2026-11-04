// Sube un archivo a R2.  Uso:  node server/upload_to_r2.js <archivo> <key> [sufijo_cuenta: ""|_V2|_V3|_V4]
// Lee las claves de server/.env (nunca las imprime).
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '.env') });

const clean = (v) => (typeof v === 'string' ? v.replace(/^[A-Z0-9_]+:\s*/, '').trim() : v);
const [file, key, sfx = ''] = process.argv.slice(2);
if (!file || !key) { console.log('uso: node server/upload_to_r2.js <archivo> <key> [_V2|_V3|_V4]'); process.exit(1); }

const env = (n) => clean(process.env[n + sfx]);
const bucket = env('R2_BUCKET_NAME');
const s3 = new S3Client({
    region: 'auto',
    endpoint: env('R2_ENDPOINT'),
    credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') }
});

const ext = path.extname(file).toLowerCase();
const types = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.jpg': 'image/jpeg', '.png': 'image/png' };
await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: fs.readFileSync(file),
    ContentType: types[ext] || 'application/octet-stream',
    CacheControl: 'public, max-age=31536000, immutable'
}));
const h = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
console.log(`subido a ${bucket}/${key} (${h.ContentLength} bytes)`);
