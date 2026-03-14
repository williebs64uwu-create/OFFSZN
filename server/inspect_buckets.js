
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../.env') });

const clean = (val) => val ? val.replace(/^[A-Z0-9_]+:\s*/, '').trim() : val;

const v1Config = {
    endpoint: clean(process.env.R2_ENDPOINT),
    credentials: {
        accessKeyId: clean(process.env.R2_ACCESS_KEY_ID),
        secretAccessKey: clean(process.env.R2_SECRET_ACCESS_KEY),
    },
    bucket: clean(process.env.R2_BUCKET_NAME) || 'offszn-storage'
};

const v2Config = {
    endpoint: clean(process.env.R2_ENDPOINT_V2) || 'https://42fc23b11a6c329b76b2babc20afcbf7.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: clean(process.env.R2_ACCESS_KEY_ID_V2) || '090fc361ac3433dfeacd5b062dc37e69',
        secretAccessKey: clean(process.env.R2_SECRET_ACCESS_KEY_V2) || '82e3f0be0d50bd786b61ab36cfbc0f1d9dde953e2575672f3d20b62e8571dd6f',
    },
    bucket: clean(process.env.R2_BUCKET_NAME_V2) || 'offsznlatbucket'
};

async function listBucket(name, cfg) {
    console.log(`\n--- Inspecting ${name} (${cfg.bucket}) ---`);
    console.log(`Endpoint: ${cfg.endpoint}`);
    
    try {
        const client = new S3Client({
            region: "auto",
            endpoint: cfg.endpoint,
            credentials: cfg.credentials,
            forcePathStyle: true
        });

        const command = new ListObjectsV2Command({
            Bucket: cfg.bucket,
            MaxKeys: 50
        });

        const response = await client.send(command);
        console.log(`Found ${response.KeyCount} total items (limited to 10 in view).`);
        
        if (response.Contents) {
            response.Contents.forEach(obj => {
                console.log(` - ${obj.Key} (${obj.Size} bytes)`);
            });
        } else {
            console.log(" Bucket is empty or could not be listed.");
        }
    } catch (err) {
        console.error(` Error listing ${name}:`, err.message);
    }
}

async function main() {
    // await listBucket("V1", v1Config);
    await listBucket("V2", v2Config);
}

main();
