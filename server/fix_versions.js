
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

async function fixVersions() {
    // Get ALL products (not just v2)
    const { data, error } = await supabase
        .from('products')
        .select('id, image_url, audio_url, r2_version, name');
    
    if (error) { console.error(error); return; }
    
    let fixed = 0;
    
    for (const p of data) {
        // Skip if no image or cloudinary
        if (!p.image_url || p.image_url.startsWith('http')) continue;
        
        const taggedVersion = p.r2_version || 'v1';
        
        // Check if file exists in the tagged bucket
        let existsInTagged;
        if (taggedVersion === 'v2') {
            existsInTagged = await checkExists(clientV2, 'offsznlatbucket', p.image_url);
        } else {
            existsInTagged = await checkExists(clientV1, 'offszn-storage', p.image_url);
        }
        
        if (!existsInTagged) {
            // Try the other bucket
            let existsInOther;
            let correctVersion;
            if (taggedVersion === 'v2') {
                existsInOther = await checkExists(clientV1, 'offszn-storage', p.image_url);
                correctVersion = 'v1';
            } else {
                existsInOther = await checkExists(clientV2, 'offsznlatbucket', p.image_url);
                correctVersion = 'v2';
            }
            
            if (existsInOther) {
                console.log(`[${p.id}] ${p.name}: Tagged ${taggedVersion} but found in ${correctVersion}. FIXING...`);
                const { error: updErr } = await supabase
                    .from('products')
                    .update({ r2_version: correctVersion })
                    .eq('id', p.id);
                
                if (updErr) console.error(`  Failed:`, updErr.message);
                else { console.log(`  ✅ Fixed to ${correctVersion}`); fixed++; }
            } else {
                console.log(`[${p.id}] ${p.name}: ❌ NOT FOUND IN EITHER BUCKET (${p.image_url.substring(0,60)})`);
            }
        }
    }
    
    console.log(`\n✅ Done. Fixed ${fixed} version mismatches.`);
}

fixVersions().catch(console.error);
