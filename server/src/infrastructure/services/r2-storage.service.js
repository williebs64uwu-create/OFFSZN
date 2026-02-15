import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// CORRECCIÓN AQUÍ: Subimos 2 niveles para buscar en src/config/config.js
// Si tu config está en otro lado, avísame, pero esta es la ruta estándar.
import { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_SECURE_BUCKET_NAME } from '../../shared/config/config.js';

const s3Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    }
});

/**
 * Genera una URL firmada para subir un archivo directamente desde el cliente.
 * @param {string} key - La ruta/nombre del archivo en R2.
 * @param {string} contentType - El tipo de contenido del archivo (ej. audio/mpeg).
 * @param {string} bucket - (Opcional) Nombre del bucket destino.
 * @returns {Promise<string>} - La URL firmada.
 */
export const getPresignedUploadUrl = async (key, contentType, bucket = R2_BUCKET_NAME) => {
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType
    });

    try {
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hora
        return signedUrl;
    } catch (error) {
        console.error("Error al generar URL de subida R2:", error);
        throw error;
    }
};

/**
 * Genera una URL firmada para descargar o reproducir un archivo privado.
 * @param {string} key - La ruta/nombre del archivo en R2.
 * @param {number} expiresIn - Tiempo de expiración en segundos (defecto 3600).
 * @returns {Promise<string>} - La URL firmada.
 */
export const getPresignedDownloadUrl = async (key, expiresIn = 3600) => {
    const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key
    });

    try {
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
        return signedUrl;
    } catch (error) {
        console.error("Error al generar URL de descarga R2:", error);
        throw error;
    }
};

/**
 * Helper para construir la URL pública (si el bucket está configurado como público)
 * Nota: R2 puede requerir un dominio personalizado o configuración específica para accesos públicos directos.
 */
export const getPublicUrl = (key) => {
    // 🔥 KEY SANITIZATION: Remove leading slashes
    let cleanKey = key;
    while (cleanKey.startsWith('/')) cleanKey = cleanKey.substring(1);

    const baseUrl = R2_ENDPOINT.replace('https://', `https://${R2_BUCKET_NAME}.`);
    return `${baseUrl}/${cleanKey}`;
};

/**
 * Elimina múltiples archivos de R2.
 * @param {string[]} keys - Array de claves (rutas) de los archivos a eliminar.
 * @returns {Promise<void>}
 */
export const deleteFromR2 = async (keys) => {
    if (!keys || keys.length === 0) return;

    // R2/S3 requiere que el array sea de objetos { Key: 'key' }
    const objects = keys.map(key => ({ Key: key }));

    // 🔥 FIX: Borrar de AMBOS buckets (Público y Seguro)
    // Esto asegura que se eliminen tanto covers/mp3 (públicos) como wavs/stems/zips (seguros).
    const buckets = [R2_BUCKET_NAME, R2_SECURE_BUCKET_NAME];

    try {
        const deletePromises = buckets.map(async (bucketName) => {
            if (!bucketName) return; // Safety check

            const command = new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: {
                    Objects: objects,
                    Quiet: true
                }
            });

            const response = await s3Client.send(command);
            if (response.Errors && response.Errors.length > 0) {
                console.warn(`[R2] Errores parciales al eliminar del bucket ${bucketName}:`, response.Errors);
            } else {
                console.log(`[R2] Eliminación exitosa en bucket: ${bucketName}`);
            }
        });

        await Promise.all(deletePromises);
        console.log(`[R2] Proceso de eliminación completado para ${keys.length} archivos.`);

    } catch (error) {
        console.error("Error al eliminar archivos de R2 (Global):", error);
        // No lanzamos error para no romper el flujo del frontend, pero logueamos.
        // throw error; 
    }
};