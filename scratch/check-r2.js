import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../.env') });

const cleanConfigValue = (val) => {
    if (!val || typeof val !== 'string') return val;
    return val.replace(/^[A-Z0-9_]+:\s*/, '').trim();
};

const s3ClientV1 = new S3Client({
    region: "auto",
    endpoint: cleanConfigValue(process.env.R2_ENDPOINT),
    credentials: {
        accessKeyId: cleanConfigValue(process.env.R2_ACCESS_KEY_ID),
        secretAccessKey: cleanConfigValue(process.env.R2_SECRET_ACCESS_KEY),
    }
});

const s3ClientV2 = new S3Client({
    region: "auto",
    endpoint: cleanConfigValue(process.env.R2_ENDPOINT_V2),
    credentials: {
        accessKeyId: cleanConfigValue(process.env.R2_ACCESS_KEY_ID_V2),
        secretAccessKey: cleanConfigValue(process.env.R2_SECRET_ACCESS_KEY_V2),
    }
});

const key = "products/covers/e50acec7-56c9-4329-91de-c1dc0aa205bb/1775840326410_cover.jpg";

async function check() {
    console.log(`Checking key: ${key}`);
    
    try {
        await s3ClientV1.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME || 'offszn-storage', Key: key }));
        console.log("Found in V1 (Account 1)");
    } catch (e) {
        console.log("NOT found in V1");
    }

    try {
        await s3ClientV2.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME_V2 || 'offsznlatbucket', Key: key }));
        console.log("Found in V2 (Account 2)");
    } catch (e) {
        console.log("NOT found in V2");
    }
}

check();
