import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { R2_ENDPOINT_V2, R2_ACCESS_KEY_ID_V2, R2_SECRET_ACCESS_KEY_V2, R2_BUCKET_NAME_V2, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } from './src/shared/config/config.js';

async function setCors(endpoint, accessKeyId, secretAccessKey, bucket) {
    if(!endpoint || !accessKeyId || !secretAccessKey || !bucket) return console.log('Missing config for', bucket);
    const client = new S3Client({
        region: 'auto',
        endpoint: endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey }
    });
    
    const params = {
        Bucket: bucket,
        CORSConfiguration: {
            CORSRules: [
                {
                    AllowedHeaders: ['*'],
                    AllowedMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
                    AllowedOrigins: ['*'],
                    ExposeHeaders: ['ETag']
                }
            ]
        }
    };
    
    try {
        const command = new PutBucketCorsCommand(params);
        await client.send(command);
        console.log('✅ CORS updated for bucket:', bucket);
    } catch(e) {
        console.error('❌ Failed for', bucket, e.message);
    }
}

async function run() {
    await setCors(R2_ENDPOINT_V2, R2_ACCESS_KEY_ID_V2, R2_SECRET_ACCESS_KEY_V2, R2_BUCKET_NAME_V2);
    await setCors(R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME);
    process.exit(0);
}

run();
