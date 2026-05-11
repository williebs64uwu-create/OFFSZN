import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, CopyObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { supabase } from '../database/connection.js';

import {
    R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
    R2_ENDPOINT_V2, R2_ACCESS_KEY_ID_V2, R2_SECRET_ACCESS_KEY_V2, R2_BUCKET_NAME_V2,
    R2_ENDPOINT_V3, R2_ACCESS_KEY_ID_V3, R2_SECRET_ACCESS_KEY_V3, R2_BUCKET_NAME_V3,
    R2_CURRENT_VERSION
} from '../../shared/config/config.js';

/**
 * Checks if a key exists in R2 using a HEAD request.
 */
export const checkKeyExists = async (key, version = R2_CURRENT_VERSION) => {
    try {
        const { client, bucket } = getClientAndBucket(version);
        if (!client) return false;

        let cleanKey = key;
        while (cleanKey.startsWith('/')) cleanKey = cleanKey.substring(1);

        const command = new HeadObjectCommand({
            Bucket: bucket,
            Key: cleanKey
        });

        await client.send(command);
        return true;
    } catch (error) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            return false;
        }
        // console.warn(`[R2-Scavenger] HEAD error for ${key}:`, error.message);
        return false;
    }
};

/**
 * Scavenger Logic: Tries multiple path variations to find the correct key in R2.
 * Levels: 
 * 1. Guess direct
 * 2. Flat-UUID (Stripping middle folders to match R2 migration)
 * 3. Multi-Version (Checks V2 then V1 as backup)
 */
export const resolveScavengerKey = async (initialKey, version = R2_CURRENT_VERSION) => {
    if (!initialKey) return null;
    
    let key = initialKey.trim();
    while (key.startsWith('/')) key = key.substring(1);

    const variations = new Set();
    variations.add(key);

    let body = key;
    if (body.startsWith('products/')) body = body.replace('products/', '');
    if (body.startsWith('secure-products/')) body = body.replace('secure-products/', '');
    
    const parts = body.split('/');
    const filename = parts.pop();
    const uuid = parts.length > 0 ? parts[0] : null;

    // --- VARIATION LIST ---
    
    // 1. Common prefixes
    variations.add(body);
    variations.add(`secure-products/${body}`);
    variations.add(`products/${body}`);

    // 2. FLAT-UUID MAPPING (The Migration "Win" Logic)
    // Matches patterns like: secure-products/beats/wav/[UUID]/[FILENAME]
    if (uuid && filename && uuid.length > 30) {
        // Beats
        variations.add(`secure-products/beats/wav/${uuid}/${filename}`);
        variations.add(`secure-products/beats/mp3/${uuid}/${filename}`);
        variations.add(`secure-products/beats/stems/${uuid}/${filename}`);
        variations.add(`secure-products/beats/mp3_tagged/${uuid}/${filename}`);
        
        // Kits
        variations.add(`secure-products/kits/${uuid}/${filename}`);
        variations.add(`secure-products/drumkits/${uuid}/${filename}`);
        
        // Root UUID
        variations.add(`secure-products/${uuid}/${filename}`);
    }

    // 3. Fallback subfolder guesses
    if (body.includes('wav') || body.includes('untagged')) {
        variations.add(`secure-products/beats/wav/${body}`);
        variations.add(`secure-products/beats/wav_untagged/${body}`);
        if(uuid && filename) {
            variations.add(`secure-products/beats/wav_untagged/${uuid}/${filename}`);
            variations.add(`secure-products/beats/wav/${uuid}/${filename}`);
            variations.add(`beats/wav/${uuid}/${filename}`);
        }
    }
    
    if (filename) {
        variations.add(`secure-products/beats/wav/${filename}`);
        variations.add(`secure-products/beats/wav_untagged/${filename}`);
        variations.add(`secure-products/kits/${filename}`);
        variations.add(`beats/wav/${filename}`);
        // Super legacy fallback
        variations.add(`products/${filename}`);
    }

    // --- PROBING PHASE (V2 then V1) ---
    const versionsToTry = ['v3', 'v2', 'v1'].filter(v => v !== version);
    versionsToTry.unshift(version); 

    console.log(`[R2-Scavenger] 🧭 Probing ${variations.size} variations for: ${uuid || 'unknown'}`);

    for (const v of versionsToTry) {
        for (const variant of variations) {
            // console.log(`[R2-Scavenger] Checking ${v}: ${variant}`);
            if (await checkKeyExists(variant, v)) {
                console.log(`[R2-Scavenger] ✅ FOUND in ${v}: ${variant}`);
                return { key: variant, version: v };
            }
        }
    }

    // --- PHASE 2: UUID FOLDER LISTING (Last Resort) ---
    if (uuid && uuid.length > 30) {
        const origExt = key.split('.').pop()?.toLowerCase() || 'wav';
        const compressedExts = ['zip', 'rar', '7z'];
        const audioExts = ['wav', 'mp3', 'flac'];
        
        const isCompressed = compressedExts.includes(origExt);
        const targetExt = isCompressed ? origExt : (audioExts.includes(origExt) ? origExt : 'wav');

        const folderPrefixes = [
            `secure-products/beats/stems/${uuid}/`,
            `secure-products/beats/wav/${uuid}/`,
            `products/${uuid}/wav_untagged/`,
            `secure-products/beats/mp3/${uuid}/`,
            `products/${uuid}/mp3_tagged/`,
            `secure-products/kits/${uuid}/`,
            `products/${uuid}/stems/`,
            `secure-products/${uuid}/`,
            `products/${uuid}/`,
        ];

        console.log(`[R2-Scavenger] 🗂️ Exact file not found. Listing UUID folders (want .${targetExt})...`);

        for (const prefix of folderPrefixes) {
            for (const v of versionsToTry) {
                const { client: listClient, bucket: listBucket } = getClientAndBucket(v);
                if (!listClient) continue;

                try {
                    const listResult = await listClient.send(new ListObjectsV2Command({
                        Bucket: listBucket,
                        Prefix: prefix,
                        MaxKeys: 10
                    }));

                    if (listResult.Contents && listResult.Contents.length > 0) {
                        // Filter: prefer files matching the target extension
                        const matchingFile = listResult.Contents.find(obj => {
                            const ext = obj.Key.split('.').pop()?.toLowerCase();
                            return ext === targetExt;
                        });
                        // Fallback: any audio file (not images/covers)
                        const audioFile = matchingFile || listResult.Contents.find(obj => {
                            const ext = obj.Key.split('.').pop()?.toLowerCase();
                            if (isCompressed) {
                                return compressedExts.includes(ext);
                            }
                            return audioExts.includes(ext) && !obj.Key.includes('/covers/');
                        });

                        if (audioFile) {
                            console.log(`[R2-Scavenger] ✅ FOUND via folder listing in ${v} (prefix: ${prefix}): ${audioFile.Key}`);
                            return { key: audioFile.Key, version: v };
                        }
                    }
                } catch (listErr) {
                    // Silently continue
                }
            }
        }
    }

    console.warn(`[R2-Scavenger] ❌ No match found for: ${key}. Returning original.`);
    // Fallback: Return original key on requested version
    return { key: key, version: version };
};

// V1 Client (Old Account)
const s3ClientV1 = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    forcePathStyle: false, // 🔥 Recommended for Cloudflare R2 Virtual Host Style
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    }
});

// V2 Client (New Account - Default for new writes)
const s3ClientV2 = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT_V2,
    forcePathStyle: false, // 🔥 Recommended for Cloudflare R2 Virtual Host Style
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID_V2,
        secretAccessKey: R2_SECRET_ACCESS_KEY_V2,
    }
});

// V3 Client (Future Account / Scale)
const s3ClientV3 = (R2_ENDPOINT_V3 && R2_ACCESS_KEY_ID_V3) ? new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT_V3,
    forcePathStyle: false,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID_V3,
        secretAccessKey: R2_SECRET_ACCESS_KEY_V3,
    }
}) : null;

/**
 * Helper to get the correct client and bucket based on version.
 */
export const getClientAndBucket = (version = R2_CURRENT_VERSION) => {
    // If V1 is requested but credentials are missing, fallback to V2
    // console.log(`[R2-DEBUG] getClientAndBucket called with version: ${version}`);
    if (version === 'v3') {
        if (!s3ClientV3) console.warn('[R2 Storage] WARNING: s3ClientV3 is NULL');
        return { 
            client: s3ClientV3 || s3ClientV2, 
            bucket: R2_BUCKET_NAME_V3 || 'bucket3lat' 
        };
    }
    if (version === 'v2') {
        return { client: s3ClientV2, bucket: R2_BUCKET_NAME_V2 || 'offsznlatbucket' };
    }
    if (version === 'v1') {
        return { client: s3ClientV1, bucket: R2_BUCKET_NAME || 'offszn-storage' };
    }
    return { client: s3ClientV2, bucket: R2_BUCKET_NAME_V2 || 'offsznlatbucket' };
};

/**
 * Genera una URL firmada para subir un archivo.
 */
export const getPresignedUploadUrl = async (key, contentType, version = R2_CURRENT_VERSION) => {
    const { client, bucket } = getClientAndBucket(version);

    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType
    });

    try {
        const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
        return signedUrl;
    } catch (error) {
        console.error(`Error al generar URL de subida R2 (${version}):`, error);
        throw error;
    }
};

/**
 * Genera una URL firmada para descargar. 
 * Soporta R2 (v1, v2) y ahora Supabase Storage ('supabase').
 */
export const getPresignedDownloadUrl = async (key, expiresIn = 3600, version = R2_CURRENT_VERSION) => {
    // 🔥 STRATEGY: 100% Explicit Versioning. No guessing, no fallbacks.
    
    if (version === 'supabase') {
        try {
            // Default bucket is 'products'
            let bucketName = 'products';
            let path = key;

            // 1. Initial Sanitization
            const cleanPath = (p) => {
                let res = p.trim().replace(/^\/+/, '');
                const junk = ['/storage/v1/object/public/', 'products/', 'products/covers/', 'beats/mp3/', 'products/beats/mp3/'];
                for (const j of junk) {
                    if (res.includes(j)) {
                        const parts = res.split(j);
                        res = parts[parts.length - 1];
                    }
                }
                return res.replace(/^\/+/, '');
            };

            let normalizedPath = cleanPath(path);
            if (normalizedPath.includes('?')) {
                normalizedPath = normalizedPath.split('?')[0];
            }
            
            // Detect other buckets (avatars, banners, etc.)
            const knownBuckets = ['avatars', 'banners', 'public', 'licenses'];
            const firstPart = normalizedPath.split('/')[0];
            if (knownBuckets.includes(firstPart)) {
                bucketName = firstPart;
                normalizedPath = normalizedPath.split('/').slice(1).join('/');
            }

            // 🔥 FIX: Supabase returns 400 Bad Request for signed URLs on public buckets.
            const publicBuckets = ['avatars', 'banners', 'public'];
            const isPublicPath = publicBuckets.includes(bucketName) || 
                               (bucketName === 'products' && (normalizedPath.includes('/covers/') || normalizedPath.includes('/mp3_tagged/') || normalizedPath.includes('/audio/')));
            
            if (isPublicPath) {
                const { data } = supabase.storage.from(bucketName).getPublicUrl(normalizedPath);
                if (data?.publicUrl) return data.publicUrl;
            }

            // 2. Primary Signing Attempt
            const filenameObj = { download: normalizedPath.split('/').pop() };
            const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(normalizedPath, expiresIn, filenameObj);

            // 3. Robust Fallback (Try alternative UUID paths if it's a product)
            if (error || !data?.signedUrl) {
                const uuidMatch = normalizedPath.match(/([a-f0-9\-]{36})/i);
                if (uuidMatch && bucketName === 'products') {
                    const uuid = uuidMatch[1];
                    const filename = normalizedPath.split('/').pop();
                    const alternatives = [
                        `${uuid}/audio/${filename}`,
                        `${uuid}/mp3_tagged/${filename}`,
                        `${uuid}/covers/${filename}`
                    ];

                    for (const alt of alternatives) {
                        if (alt === normalizedPath) continue;
                        const retry = await supabase.storage.from(bucketName).createSignedUrl(alt, expiresIn, filenameObj);
                        if (retry.data?.signedUrl) return retry.data.signedUrl;
                    }
                }
                
                return null;
            }

            return data.signedUrl;
        } catch (error) {
            console.error(`Error in getPresignedDownloadUrl (Supabase):`, error);
            return null;
        }
    }

    // R2 logic (v1 or v2)
    try {
        const { client, bucket } = getClientAndBucket(version);
        if (!client) throw new Error(`R2 Client for version ${version} not found`);

        // 🔥 SCAVENGER FIX: Search for the real key across multiple path variations AND versions
        const discovery = await resolveScavengerKey(key, version);
        const finalKey = discovery.key;
        const finalVersion = discovery.version;

        const { client: finalClient, bucket: finalBucket } = getClientAndBucket(finalVersion);
        
        const filename = finalKey.split('/').pop() || 'descarga_offszn.mp3';

        const command = new GetObjectCommand({
            Bucket: finalBucket,
            Key: finalKey,
            ResponseContentDisposition: `attachment; filename="${filename}"`
        });

        const signedUrl = await getSignedUrl(finalClient, command, { expiresIn });
        return signedUrl;
    } catch (error) {
        console.error(`Error in getPresignedDownloadUrl (R2 ${version}) for ${key}:`, error.message);
        return null;
    }
};

/**
 * URL pública (Solo para V2 por ahora si está público, o V1 si tiene dominio, o Supabase)
 */
export const getPublicUrl = (key, version = R2_CURRENT_VERSION) => {
    let cleanKey = key;
    while (cleanKey.startsWith('/')) cleanKey = cleanKey.substring(1);

    if (version === 'supabase') {
        let bucket = 'products';
        let path = cleanKey;

        // 🔥 RESTORE CROSS-STORAGE NORMALIZATION FOR SUPABASE LEGACY FILES
        if (path.startsWith('beats/mp3/') || path.startsWith('products/beats/mp3/')) {
            const p = path.startsWith('products/') ? path.substring(9).split('/') : path.split('/');
            if (p.length >= 4) {
                // [products/]beats/mp3/[UUID]/[filename] -> [UUID]/mp3_tagged/[filename]
                path = `${p[2]}/mp3_tagged/${p.slice(3).join('/')}`;
                bucket = 'products';
            }
        } else if (path.startsWith('products/covers/')) {
            const p = path.split('/');
            if (p.length >= 4) {
                // products/covers/[UUID]/[filename] -> [UUID]/covers/${p.slice(3).join('/')}
                path = `${p[2]}/covers/${p.slice(3).join('/')}`;
                bucket = 'products';
            }
        } else {
            const parts = path.split('/');
            const knownBuckets = ['avatars', 'secure-products', 'licenses', 'banners', 'public'];
            
            if (parts.length > 1 && knownBuckets.includes(parts[0])) {
                bucket = parts[0];
                path = parts.slice(1).join('/');
            } else if (parts[0] === 'products') {
                bucket = 'products';
                path = parts.slice(1).join('/');
            }
        }
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    }

    const { bucket } = getClientAndBucket(version);
    let endpoint;
    if (version === 'v1') endpoint = R2_ENDPOINT;
    else if (version === 'v3') endpoint = R2_ENDPOINT_V3;
    else endpoint = R2_ENDPOINT_V2;

    const baseUrl = endpoint.replace('https://', `https://${bucket}.`);
    return `${baseUrl}/${cleanKey}`;
};

/**
 * Elimina múltiples archivos de R2.
 */
export const deleteFromR2 = async (keys, explicitVersion = null) => {
    if (!keys || keys.length === 0) return;

    // Group keys by their correct version
    const versionGroups = { v1: [], v2: [], v3: [] };

    for (const k of keys) {
        let cleanKey = k.startsWith('/') ? k.substring(1) : k;
        if (explicitVersion) {
            versionGroups[explicitVersion].push(cleanKey);
        } else {
            // Probe to find which bucket this key actually lives in
            const { key: resolvedKey, version: foundVersion } = await resolveScavengerKey(cleanKey, R2_CURRENT_VERSION);
            versionGroups[foundVersion].push(resolvedKey);
        }
    }

    // Delete from each group
    for (const v of ['v1', 'v2', 'v3']) {
        if (versionGroups[v].length === 0) continue;

        const { client, bucket } = getClientAndBucket(v);
        if (!client) continue;

        const objects = versionGroups[v].map(key => ({ Key: key }));
        console.log(`[R2 Storage] Deleting ${objects.length} from ${bucket} (${v})`);

        try {
            const command = new DeleteObjectsCommand({
                Bucket: bucket,
                Delete: { Objects: objects, Quiet: false }
            });

            const response = await client.send(command);
            console.log(`✅ [R2 Storage] Deleted items from ${v}:`, response.Deleted?.length || 0);

            if (response.Errors?.length > 0) {
                console.error(`❌ [R2 Storage] Errors in ${v}:`, response.Errors);
            }
        } catch (error) {
            console.error(`Error al eliminar de R2 (${v}):`, error);
        }
    }
};

/**
 * Copia un archivo (Solo dentro del mismo bucket por ahora).
 */
export const copyFileInR2 = async (sourceKey, destinationKey, version = 'v1') => {
    const { client, bucket } = getClientAndBucket(version);

    try {
        const src = sourceKey.startsWith('/') ? sourceKey.substring(1) : sourceKey;
        const dest = destinationKey.startsWith('/') ? destinationKey.substring(1) : destinationKey;
        const copySource = `${bucket}/${src}`;

        const command = new CopyObjectCommand({
            Bucket: bucket,
            CopySource: encodeURI(copySource),
            Key: dest
        });

        await client.send(command);
        console.log(`✅ [R2 COPY] Success in ${version}: ${dest}`);
    } catch (error) {
        console.error(`❌ [R2 COPY] Failed in ${version}:`, error);
        throw error;
    }
};

/**
 * Almacena un buffer directamente en R2 desde el servidor.
 */
export const uploadBufferToR2 = async (buffer, key, contentType, version = R2_CURRENT_VERSION) => {
    const { client, bucket } = getClientAndBucket(version);
    const sanitizedKey = key.startsWith('/') ? key.substring(1) : key;

    try {
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: sanitizedKey,
            Body: buffer,
            ContentType: contentType
        });

        await client.send(command);
        // console.log(`✅ [R2 UPLOAD] Success in ${version}: ${sanitizedKey}`);
        return getPublicUrl(sanitizedKey, version);
    } catch (error) {
        console.error(`Error al subir buffer a R2 (${version}):`, error);
        throw error;
    }
};

/**
 * Verifica si un objeto existe en R2.
 */
export const existsInR2 = async (key, version = R2_CURRENT_VERSION) => {
    const { client, bucket } = getClientAndBucket(version);
    if (!client) return false;
    
    let cleanKey = key;
    if (typeof cleanKey === 'string') {
        while (cleanKey.startsWith('/')) cleanKey = cleanKey.substring(1);
    }
    
    try {
        await client.send(new HeadObjectCommand({
            Bucket: bucket,
            Key: cleanKey
        }));
        return true;
    } catch (error) {
        return false;
    }
};