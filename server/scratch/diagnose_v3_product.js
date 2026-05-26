/**
 * Diagnóstico v3: R2 real + BD + HTTP GET (proxy y firmado)
 * Uso: node scratch/diagnose_v3_product.js [productId]
 */
import { supabase } from '../src/infrastructure/database/connection.js';
import { existsInR2 } from '../src/infrastructure/services/r2-storage.service.js';

const productId = process.argv[2] || '783';
const apiBase = process.env.DIAG_API_BASE || 'http://localhost:3000';

function normalizeKey(pathOrUrl) {
    if (!pathOrUrl) return null;
    let key = String(pathOrUrl).split('?')[0];
    if (key.includes('.r2.cloudflarestorage.com/')) {
        key = key.split('.r2.cloudflarestorage.com/')[1];
    }
    while (key.startsWith('/')) key = key.substring(1);
    for (const p of ['bucket3lat/', 'offsznlatbucket/', 'offszn-storage/']) {
        if (key.toLowerCase().startsWith(p)) key = key.substring(p.length);
    }
    return key;
}

async function headUrl(label, url) {
    console.log(`\n--- ${label} ---`);
    console.log(url);
    try {
        const res = await fetch(url, { method: 'HEAD' });
        console.log(`Status: ${res.status}`);
        console.log(`Content-Type: ${res.headers.get('content-type')}`);
        console.log(`Access-Control-Allow-Origin: ${res.headers.get('access-control-allow-origin') || '(missing)'}`);
        console.log(`CORP: ${res.headers.get('cross-origin-resource-policy') || '(missing)'}`);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function run() {
    const { data: p, error } = await supabase
        .from('products')
        .select('id, name, image_url, audio_url, mp3_url, download_url_mp3, r2_version, storage_version, producer_id')
        .eq('id', productId)
        .single();

    if (error || !p) {
        console.error('Product not found:', error?.message || productId);
        process.exit(1);
    }

    console.log('Product:', p.id, p.name);
    console.log('Version:', p.r2_version, '/', p.storage_version);

    const fields = [
        ['image_url', p.image_url],
        ['audio_url', p.audio_url],
        ['mp3_url', p.mp3_url],
        ['download_url_mp3', p.download_url_mp3]
    ];

    for (const [label, raw] of fields) {
        console.log(`\n[DB] ${label}:`, raw || '(empty)');
        if (!raw) continue;

        if (raw.includes('X-Amz-Signature')) {
            console.log('  ⚠️  Signed URL in DB (should be relative key only)');
        }

        const key = normalizeKey(raw);
        console.log('  Key:', key);

        for (const v of ['v1', 'v2', 'v3']) {
            const ok = await existsInR2(key, v);
            console.log(`  R2 ${v}:`, ok ? 'FOUND' : 'not found');
        }

        const proxyUrl = `${apiBase}/api/r2-public/${key}?v=${p.r2_version || 'v3'}`;
        await headUrl(`Proxy ${label}`, proxyUrl);
    }

    console.log('\nDone.');
}

run();
