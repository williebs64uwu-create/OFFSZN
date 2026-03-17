import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
    if (version === 'v1' && (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT)) {
        console.warn('[R2-Storage] Requested V1 but credentials missing. Falling back to V2.');
        return { client: s3ClientV2, bucket: R2_BUCKET_NAME_V2 || 'offsznlatbucket' };
    }

    if (version === 'v2' && (!R2_ACCESS_KEY_ID_V2 || !R2_SECRET_ACCESS_KEY_V2 || !R2_ENDPOINT_V2)) {
         console.warn('[R2-Storage] Requested V2 but credentials missing. Falling back to V1.');
         return { client: s3ClientV1, bucket: R2_BUCKET_NAME || 'offszn-storage' };
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
 */
export const getPresignedDownloadUrl = async (key, expiresIn = 3600, version = 'v1') => {
    // 💡 IMPORTANTE: El backend pasará la versión que sacó de la DB
    const { client, bucket } = getClientAndBucket(version);

    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
    });

    try {
        const signedUrl = await getSignedUrl(client, command, { expiresIn });
        return signedUrl;
    } catch (error) {
        console.error(`Error al generar URL de descarga R2 (${version}):`, error);
        throw error;
    }
};

/**
 * URL pública (Solo para V2 por ahora si está público, o V1 si tiene dominio)
 */
export const getPublicUrl = (key, version = 'v1') => {
    let cleanKey = key;
    while (cleanKey.startsWith('/')) cleanKey = cleanKey.substring(1);

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