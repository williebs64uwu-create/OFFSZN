
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import {
    R2_ENDPOINT_V2, R2_ACCESS_KEY_ID_V2, R2_SECRET_ACCESS_KEY_V2, R2_BUCKET_NAME_V2,
    R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
} from './src/shared/config/config.js';

const s3ClientV2 = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT_V2,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID_V2,
        secretAccessKey: R2_SECRET_ACCESS_KEY_V2,
    }
});

const s3ClientV1 = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    }
});

async function listInBucket(client, bucket, label, searchTerm) {
    console.log(`\nSearching in ${label} (${bucket}) for "${searchTerm}"...`);
    let continuationToken = null;
    let found = false;

    do {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken: continuationToken
        });
        const response = await client.send(command);
        if (response.Contents) {
            response.Contents.forEach(obj => {
                if (obj.Key.toLowerCase().includes(searchTerm.toLowerCase())) {
                    console.log(`[FOUND] ${obj.Key}`);
                    found = true;
                }
            });
        }
        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    if (!found) console.log(`No matches for "${searchTerm}" in ${label}.`);
}

async function run() {
    const searchTerm = process.argv[2] || 'batalla';
    await listInBucket(s3ClientV2, R2_BUCKET_NAME_V2 || 'offsznlatbucket', 'V2', searchTerm);
    await listInBucket(s3ClientV1, R2_BUCKET_NAME || 'offszn-storage', 'V1', searchTerm);
}

run().catch(console.error);
