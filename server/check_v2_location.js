
import { createClient } from '@supabase/supabase-js';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const clientV1 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

const R2_ENDPOINT_V2 = 'https://42fc23b11a6c329b76b2babc20afcbf7.r2.cloudflarestorage.com';
const clientV2 = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT_V2,
    forcePathStyle: true,
    credentials: {
        accessKeyId: '090fc361ac3433dfeacd5b062dc37e69',
        secretAccessKey: '82e3f0be0d50bd786b61ab36cfbc0f1d9dde953e2575672f3d20b62e8571dd6f',
    }
});

async function checkExists(client, bucket, key) {
    try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
    } catch (e) {
        return false;
    }
}

async function main() {
    // Get all v2 products
    const { data, error } = await supabase
        .from('products')
        .select('id, image_url, r2_version, name')
        .eq('r2_version', 'v2');
    
    if (error) { console.error(error); return; }
    
    console.log(`Total v2 products: ${data.length}`);
    
    let inV1 = 0, inV2 = 0, inBoth = 0, inNeither = 0;
    
    // Check first 10 v2 products
    const sample = data.slice(0, 15);
    for (const p of sample) {
        if (!p.image_url || p.image_url.startsWith('http')) {
            console.log(`[${p.id}] ${p.name} - SKIP (${p.image_url?.substring(0,40)})`);
            continue;
        }
        
        const v1 = await checkExists(clientV1, 'offszn-storage', p.image_url);
        const v2 = await checkExists(clientV2, 'offsznlatbucket', p.image_url);
        
        let location = '';
        if (v1 && v2) { location = '✅ BOTH'; inBoth++; }
        else if (v1) { location = '⚠️ V1 ONLY'; inV1++; }
        else if (v2) { location = '✅ V2 ONLY'; inV2++; }
        else { location = '❌ NEITHER'; inNeither++; }
        
        console.log(`[${p.id}] ${p.name} | ${location} | ${p.image_url.substring(0,60)}`);
    }
    
    console.log(`\n--- Summary (sample of ${sample.length}) ---`);
    console.log(`V1 only: ${inV1}`);
    console.log(`V2 only: ${inV2}`);
    console.log(`Both: ${inBoth}`);
    console.log(`Neither: ${inNeither}`);
}

main().catch(console.error);
