import { createClient } from '@supabase/supabase-js';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Setup S3 Clients for R2
const makeR2Client = (endpoint, accessKey, secretKey) => new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED"
});

const v1Client = makeR2Client(process.env.R2_ENDPOINT, process.env.R2_ACCESS_KEY_ID, process.env.R2_SECRET_ACCESS_KEY);
const v2Client = makeR2Client(process.env.R2_ENDPOINT_V2, process.env.R2_ACCESS_KEY_ID_V2, process.env.R2_SECRET_ACCESS_KEY_V2);

function normalizeSupabasePath(path) {
    if (path.startsWith('http')) return null; // Can't easily normalize full URLs here
    while (path.startsWith('/')) path = path.substring(1);
    
    let bucket = 'products';
    let p = path;
    
    // Exact logic from r2-storage.service.js
    if (p.startsWith('beats/mp3/') || p.startsWith('products/beats/mp3/')) {
        const parts = p.startsWith('products/') ? p.substring(9).split('/') : p.split('/');
        if (parts.length >= 4) {
            return { bucket: 'products', path: `${parts[2]}/mp3_tagged/${parts.slice(3).join('/')}` };
        }
    } else if (p.startsWith('products/')) {
        return { bucket: 'products', path: p.substring(9) };
    } else {
        const knownBuckets = ['avatars', 'secure-products', 'licenses', 'banners', 'public'];
        const parts = p.split('/');
        if (parts.length > 1 && knownBuckets.includes(parts[0])) {
            return { bucket: parts[0], path: parts.slice(1).join('/') };
        }
    }
    return { bucket, path: p };
}

async function checkSupabase(path) {
    const norm = normalizeSupabasePath(path);
    if (!norm) return false;
    
    // We try to get a signed URL and fetch it with HEAD
    const { data } = await supabase.storage.from(norm.bucket).createSignedUrl(norm.path, 60);
    if (!data?.signedUrl) return false;
    
    try {
        const res = await fetch(data.signedUrl, { method: 'HEAD' });
        if (res.status === 200) return true;
        
        // Retry mp3_tagged as audio just in case
        if (res.status === 400 && norm.bucket === 'products' && norm.path.includes('/mp3_tagged/')) {
            const retryPath = norm.path.replace('/mp3_tagged/', '/audio/');
            const { data: retryData } = await supabase.storage.from(norm.bucket).createSignedUrl(retryPath, 60);
            if (retryData?.signedUrl) {
                const res2 = await fetch(retryData.signedUrl, { method: 'HEAD' });
                return res2.status === 200;
            }
        }
    } catch(e) { }
    return false;
}

async function checkR2(client, bucketName, originalPath) {
    try {
        let key = originalPath;
        if (key.startsWith('http')) {
            try { key = new URL(key).pathname; } catch(e){}
        }
        while (key.startsWith('/')) key = key.substring(1);
        if (key.startsWith('offsznlatbucket/')) key = key.substring(16);
        if (key.startsWith('offszn-storage/')) key = key.substring(15);
        if (key.startsWith('products/')) key = key.substring(9);
        
        await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
        return true; 
    } catch (e) {
        return false;
    }
}

async function run() {
    console.log('🔄 Iniciando verificación de productos marcados erróneamente como supabase...');
    
    // Get all products that are 'supabase'
    const { data: products, error } = await supabase.from('products').select('id, name, audio_url, image_url').eq('storage_version', 'supabase');
    if (error) {
        console.error('Error fetching products:', error);
        process.exit(1);
    }
    
    console.log(`Encontrados ${products.length} productos marcados como supabase.`);
    
    let updatedCount = 0;
    
    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        process.stdout.write(`[${i+1}/${products.length}] Evaluando [${p.id}] ${p.name}... `);
        
        const testPath = p.audio_url || p.image_url;
        if (!testPath) {
            console.log("No tiene audio ni imagen. Saltando.");
            continue;
        }

        const isSupabase = await checkSupabase(testPath);
        if (isSupabase) {
            console.log("✅ Está en Supabase. OK.");
            continue;
        }
        
        const isV2 = await checkR2(v2Client, process.env.R2_BUCKET_NAME_V2, testPath);
        if (isV2) {
            console.log("🔍 Encontrado en R2 V2! Actualizando...");
            await supabase.from('products').update({ storage_version: 'v2' }).eq('id', p.id);
            updatedCount++;
            continue;
        }
        
        const isV1 = await checkR2(v1Client, process.env.R2_BUCKET_NAME, testPath);
        if (isV1) {
            console.log("🔍 Encontrado en R2 V1! Actualizando...");
            await supabase.from('products').update({ storage_version: 'v1' }).eq('id', p.id);
            updatedCount++;
            continue;
        }
        
        if (p.image_url && p.audio_url && testPath === p.audio_url) {
            if (await checkR2(v2Client, process.env.R2_BUCKET_NAME_V2, p.image_url)) {
                 console.log("🔍 Imagen encontrada en R2 V2! Actualizando a 'v2'...");
                 await supabase.from('products').update({ storage_version: 'v2' }).eq('id', p.id);
                 updatedCount++;
                 continue;
            }
        }
        
        console.log("❌ NO ENCONTRADO EN NINGÚN LADO. Se queda en supabase por defecto.");
    }
    
    console.log(`\n🎉 Migración completada! Se corrigieron ${updatedCount} productos.`);
    process.exit(0);
}

run();
