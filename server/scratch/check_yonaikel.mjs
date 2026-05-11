import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// R2 clients
const cleanVal = (v) => v ? v.replace(/^[A-Z0-9_]+:\s*/, '').trim() : v;

const clients = {
    v1: {
        client: new S3Client({ region: 'auto', endpoint: cleanVal(process.env.R2_ENDPOINT), credentials: { accessKeyId: cleanVal(process.env.R2_ACCESS_KEY_ID), secretAccessKey: cleanVal(process.env.R2_SECRET_ACCESS_KEY) } }),
        bucket: cleanVal(process.env.R2_BUCKET_NAME) || 'offszn-storage'
    },
    v2: {
        client: new S3Client({ region: 'auto', endpoint: cleanVal(process.env.R2_ENDPOINT_V2), credentials: { accessKeyId: cleanVal(process.env.R2_ACCESS_KEY_ID_V2), secretAccessKey: cleanVal(process.env.R2_SECRET_ACCESS_KEY_V2) } }),
        bucket: cleanVal(process.env.R2_BUCKET_NAME_V2) || 'offsznlatbucket'
    },
    v3: process.env.R2_ENDPOINT_V3 ? {
        client: new S3Client({ region: 'auto', endpoint: cleanVal(process.env.R2_ENDPOINT_V3), credentials: { accessKeyId: cleanVal(process.env.R2_ACCESS_KEY_ID_V3), secretAccessKey: cleanVal(process.env.R2_SECRET_ACCESS_KEY_V3) } }),
        bucket: cleanVal(process.env.R2_BUCKET_NAME_V3) || 'offszn-v3'
    } : null
};

async function existsInR2(key, version) {
    const cfg = clients[version];
    if (!cfg) return false;
    try {
        let cleanKey = key;
        while (cleanKey.startsWith('/')) cleanKey = cleanKey.substring(1);
        await cfg.client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: cleanKey }));
        return true;
    } catch {
        return false;
    }
}

async function main() {
    // 1. Find the producer by nickname
    const { data: users } = await supabase
        .from('users')
        .select('id, nickname, email')
        .or('nickname.ilike.%yonaikel%,nickname.ilike.%yonaikel%,email.ilike.%yonaikel%')
        .limit(5);

    if (!users?.length) {
        console.log('❌ No se encontró usuario con "yonaikel"');
        // Try broader search
        const { data: allRecent } = await supabase
            .from('products')
            .select('id, name, producer_id, image_url, audio_url, r2_version, status, slug')
            .ilike('name', '%detroit%stay%')
            .limit(5);
        console.log('Búsqueda por nombre del beat:', allRecent);
        return;
    }

    console.log('👤 Usuarios encontrados:', users.map(u => ({ id: u.id, nickname: u.nickname, email: u.email })));

    for (const user of users) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📦 Productos de ${user.nickname} (${user.id}):`);

        const { data: products } = await supabase
            .from('products')
            .select('id, name, image_url, audio_url, r2_version, status, slug, created_at')
            .eq('producer_id', user.id)
            .order('created_at', { ascending: false });

        if (!products?.length) {
            console.log('  Sin productos');
            continue;
        }

        for (const p of products) {
            console.log(`\n  🎵 "${p.name}" (status: ${p.status})`);
            console.log(`     slug: ${p.slug}`);
            console.log(`     r2_version: ${p.r2_version}`);
            console.log(`     image_url: ${p.image_url}`);
            console.log(`     audio_url: ${p.audio_url}`);
            console.log(`     created: ${p.created_at}`);

            // Check if files exist in R2
            const ver = p.r2_version || 'v2';
            const versions = [ver, 'v3', 'v2', 'v1'].filter((v, i, a) => a.indexOf(v) === i);

            if (p.image_url && !p.image_url.startsWith('http')) {
                let found = false;
                for (const v of versions) {
                    if (await existsInR2(p.image_url, v)) {
                        console.log(`     ✅ Cover EXISTS in ${v}: ${p.image_url}`);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    // Try with products/ prefix
                    for (const v of versions) {
                        const withPrefix = `products/${p.image_url}`;
                        if (await existsInR2(withPrefix, v)) {
                            console.log(`     ✅ Cover EXISTS in ${v}: ${withPrefix} (DB needs fix to: ${withPrefix})`);
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) console.log(`     ❌ Cover NOT FOUND in any version!`);
            } else if (p.image_url) {
                console.log(`     ℹ️ Cover is external URL`);
            }

            if (p.audio_url && !p.audio_url.startsWith('http')) {
                let found = false;
                for (const v of versions) {
                    if (await existsInR2(p.audio_url, v)) {
                        console.log(`     ✅ Audio EXISTS in ${v}: ${p.audio_url}`);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    for (const v of versions) {
                        const withPrefix = `products/${p.audio_url}`;
                        if (await existsInR2(withPrefix, v)) {
                            console.log(`     ✅ Audio EXISTS in ${v}: ${withPrefix} (DB needs fix)`);
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) console.log(`     ❌ Audio NOT FOUND in any version!`);
            }
        }
    }
}

main().catch(console.error);
