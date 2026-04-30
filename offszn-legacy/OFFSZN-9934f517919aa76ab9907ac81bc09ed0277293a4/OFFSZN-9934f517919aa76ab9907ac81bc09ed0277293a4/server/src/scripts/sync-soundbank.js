import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { supabase } from '../infrastructure/database/connection.js';
import {
    R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
} from '../shared/config/config.js';

// Usamos el cliente V1 que es donde está el banco de sonidos
const s3Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    }
});

const bucketName = R2_BUCKET_NAME || 'offszn-storage';

async function syncSoundbank() {
    let isTruncated = true;
    let continuationToken;
    const prefix = 'soundbank/';

    console.log(`[SYNC] Buscando archivos en R2 (Bucket: ${bucketName}, Prefix: ${prefix})...`);

    let totalProcessed = 0;

    // Limpiamos la tabla antes para hacer una "sincronización total" y evitar basura
    console.log("[SYNC] Limpiando la base de datos de sonidos actuales...");
    const { error: deleteError } = await supabase
        .from('ai_sound_bank')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // hack para borrar todo

    if (deleteError) {
        console.error("Error limpiando tabla:", deleteError.message);
    }
    
    // Almacenamos array de items a insertar para hacerlo en lote si queremos, pero de uno en uno es más seguro para logs por ahora.
    let inserts = [];

    while (isTruncated) {
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
            ContinuationToken: continuationToken,
        });

        const response = await s3Client.send(command);

        if (!response.Contents || response.Contents.length === 0) {
            console.log("No se encontraron archivos en la carpeta soundbank/.");
            break;
        }

        for (const item of response.Contents) {
            const fileKey = item.Key;
            
            // Ignorar directorios que R2 pueda devolver (terminados en /)
            if (fileKey.endsWith('/')) continue;
            
            // soundbank/TRAP/808s/808 - 1up.wav
            const parts = fileKey.split('/');
            
            if (parts.length < 4) {
                // Puede ser un nivel menos, adaptamos: soundbank / CATEGORIA / ARCHIVO
                console.log(`[WARNING] Estructura diferente: ${fileKey}`);
            }

            // Fallback por si la estructura cambia
            const genre = parts.length >= 4 ? parts[1].toUpperCase() : 'GENERAL';
            const category = parts.length >= 4 ? parts[2].toUpperCase() : (parts.length === 3 ? parts[1].toUpperCase() : 'GENERAL');
            const filename = parts.pop();
            const filenameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;

            // Codificar el fileKey para la URL pública (ej espacios %20)
            const cleanKey = fileKey.split('/').map(part => encodeURIComponent(part)).join('/');
            const publicUrl = `https://pub-41d0f49121d02c88f71fdb4da54a791d.r2.dev/${cleanKey}`;

            // Array de strings crudos para asegurar compatibilidad
            const rawTags = [
                genre.toLowerCase(), 
                category.toLowerCase(), 
                ...filenameWithoutExt.toLowerCase().split(/[\s\-_]+/)
            ].filter(Boolean); // Filtrar vacíos

            const uniqueTags = [...new Set(rawTags)];

            // Insert a Supabase
            // Intentamos insertar con un formato jsonb (string array dependiente de la bd)
            const { error: insertError } = await supabase
                .from('ai_sound_bank')
                .insert({
                    name: filenameWithoutExt,
                    category: category,
                    url: fileKey, // Ahora guardamos la KEY directamente
                    tags: uniqueTags
                });

            if (insertError) {
                // Si falla porque no existe "tags" como array, probamos como string
                const { error: fallbackError } = await supabase
                    .from('ai_sound_bank')
                    .insert({
                        name: filenameWithoutExt,
                        category: category,
                        url: fileKey, // Ahora guardamos la KEY directamente
                        tags: uniqueTags.join(', ') // Fallback string
                    });
                
                if (fallbackError) {
                    console.error(`[ERROR] No se pudo sincronizar ${filename}:`, fallbackError.message);
                } else {
                    console.log(`[SYNC] OK (Fallback Tags String): ${filename}`);
                    totalProcessed++;
                }

            } else {
                console.log(`[SYNC] OK: ${filename}`);
                totalProcessed++;
            }
        }

        isTruncated = response.IsTruncated;
        continuationToken = response.NextContinuationToken;
    }

    console.log(`¡Sincronización terminada! Total de sonidos procesados: ${totalProcessed}`);
}

syncSoundbank().catch(console.error);
