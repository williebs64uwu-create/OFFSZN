import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync('c:/Users/Willie/Desktop/OFFSZN/server/.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if(parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/['"]/g, '');
    }
});

const s3V1 = new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    }
});

const s3V2 = new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT_V2,
    credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID_V2,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY_V2,
    }
});

const tracks = [
    { name: "LOCO PECADOR", key: "beats/mp3/c6d82b6d-4e1e-4064-9782-291d854311d5/1771986943173_LOCO_PECADOR_Prod.BP_.mp3" },
    { name: "MIRAR", key: "beats/mp3/c6d82b6d-4e1e-4064-9782-291d854311d5/1771803074053_MIRAR_PROD._BP_.mp3" }
];

async function check() {
    for (const track of tracks) {
        console.log(`--- Checking ${track.name} ---`);
        
        // Check V1
        try {
            await s3V1.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME || 'offszn-storage', Key: track.key }));
            console.log(`V1: FOUND`);
        } catch (e) {
            console.log(`V1: NOT FOUND (${e.name})`);
        }
        
        // Check V2
        try {
            await s3V2.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME_V2 || 'offsznlatbucket', Key: track.key }));
            console.log(`V2: FOUND`);
        } catch (e) {
            console.log(`V2: NOT FOUND (${e.name})`);
        }
    }
}

check();
