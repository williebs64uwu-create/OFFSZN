import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { supabase } from '../database/connection.js';

import {
    R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
    R2_ENDPOINT_V2, R2_ACCESS_KEY_ID_V2, R2_SECRET_ACCESS_KEY_V2, R2_BUCKET_NAME_V2,
    R2_CURRENT_VERSION
} from '../../shared/config/config.js';

// V1 Client (Old Account)
const s3ClientV1 = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    forcePathStyle: true,
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
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID_V2,
        secretAccessKey: R2_SECRET_ACCESS_KEY_V2,
    }
});

/**
 * Helper to get the correct client and bucket based on version.
 */
const getClientAndBucket = (version = R2_CURRENT_VERSION) => {
    // If V1 is requested but credentials are missing, fallback to V2
    // console.log(`[R2-DEBUG] getClientAndBucket called with version: ${version}`);
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
export const getPresignedDownloadUrl = async (key, expiresIn = 3600, version = 'v1') => {
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
            
            // Detect other buckets (avatars, banners, etc.)
            const knownBuckets = ['avatars', 'banners', 'public', 'licenses'];
            const firstPart = normalizedPath.split('/')[0];
            if (knownBuckets.includes(firstPart)) {
                bucketName = firstPart;
                normalizedPath = normalizedPath.split('/').slice(1).join('/');
            }

            console.log(`[Supabase Storage] Requesting URL: bucket=${bucketName}, path=${normalizedPath}`);

            // 🔥 FIX: Supabase returns 400 Bad Request for signed URLs on public buckets.
            const publicBuckets = ['avatars', 'banners', 'public'];
            const isPublicPath = publicBuckets.includes(bucketName) || 
                               (bucketName === 'products' && (normalizedPath.includes('/covers/') || normalizedPath.includes('/mp3_tagged/') || normalizedPath.includes('/audio/')));
            
            if (isPublicPath) {
                const { data } = supabase.storage.from(bucketName).getPublicUrl(normalizedPath);
                if (data?.publicUrl) return data.publicUrl;
            }

            // 2. Primary Signing Attempt
            const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(normalizedPath, expiresIn);

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
                        console.log(`[Supabase Storage] Retrying alternative: ${alt}`);
                        const retry = await supabase.storage.from(bucketName).createSignedUrl(alt, expiresIn);
                        if (retry.data?.signedUrl) return retry.data.signedUrl;
                    }
                }
                
                if (error) console.warn(`[Supabase Storage] Final Sign URL failure for ${bucketName}/${normalizedPath}:`, error.message);
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

        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key
        });

        const signedUrl = await getSignedUrl(client, command, { expiresIn });
        return signedUrl;
    } catch (error) {
        console.error(`Error in getPresignedDownloadUrl (R2 ${version}) for ${key}:`, error.message);
        return null;
    }
};

/**
 * URL pública (Solo para V2 por ahora si está público, o V1 si tiene dominio, o Supabase)
 */
export const getPublicUrl = (key, version = 'v1') => {
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
    const endpoint = version === 'v1' ? R2_ENDPOINT : R2_ENDPOINT_V2;

    const baseUrl = endpoint.replace('https://', `https://${bucket}.`);
    return `${baseUrl}/${cleanKey}`;
};

/**
 * Elimina múltiples archivos de R2.
 */
export const deleteFromR2 = async (keys, version = 'v1') => {
    if (!keys || keys.length === 0) return;

    const { client, bucket } = getClientAndBucket(version);
    const sanitizedKeys = keys.map(k => k.startsWith('/') ? k.substring(1) : k);
    const objects = sanitizedKeys.map(key => ({ Key: key }));

    console.log(`[R2 Storage] Deleting ${objects.length} from ${bucket} (${version})`);

    try {
        const command = new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
                Objects: objects,
                Quiet: false
            }
        });

        const response = await client.send(command);
        console.log(`✅ [R2 Storage] Deleted items from ${version}:`, response.Deleted?.length || 0);

        if (response.Errors?.length > 0) {
            console.error(`❌ [R2 Storage] Errors in ${version}:`, response.Errors);
        }
    } catch (error) {
        console.error(`Error al eliminar de R2 (${version}):`, error);
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