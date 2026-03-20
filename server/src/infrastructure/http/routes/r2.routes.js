import { Router } from 'express';
import { getPresignedUploadUrl, getPresignedDownloadUrl, getPublicUrl, deleteFromR2, copyFileInR2 } from '../../services/r2-storage.service.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { R2_BUCKET_NAME, R2_SECURE_BUCKET_NAME } from '../../../shared/config/config.js';
import { supabase } from '../../database/connection.js';
const router = Router();

// 🔥 FILE SIZE LIMITS (server-side enforcement)
// 🔥 FILE SIZE LIMITS (server-side enforcement)
const MAX_FILE_SIZE = 1000 * 1024 * 1024; // 1GB (Increased for Stems/WAVs)
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB for images

router.get('/r2/test-hello', (req, res) => res.send('Hello World'));

// Endpoint para obtener una URL de subida firmada
router.post('/r2/upload-url', authenticateTokenMiddleware, async (req, res) => {
    try {
        const { fileName, fileType, folder, fileSize } = req.body;
        const userId = req.user.userId;

        if (!fileName || !fileType) {
            return res.status(400).json({ error: 'Faltan fileName o fileType' });
        }

        // 🔥 Server-side file size validation (Granular)
        if (fileSize || folder === 'temp-previews') {
            let maxAllowed = 50 * 1024 * 1024; // Default 50MB

            if (folder === 'temp-previews') {
                maxAllowed = 10 * 1024 * 1024; // 10MB for previews
                if (fileType !== 'audio/mpeg' && !(fileName && fileName.toLowerCase().endsWith('.mp3'))) {
                    return res.status(400).json({ error: 'Solo se permiten archivos MP3 para los previews.' });
                }
            } else if (fileType.startsWith('image/')) {
                maxAllowed = 20 * 1024 * 1024; // 20MB
            } else if (fileType === 'audio/wav' || fileName.toLowerCase().endsWith('.wav')) {
                maxAllowed = 60 * 1024 * 1024; // 60MB for WAV
            } else if (fileType === 'application/x-rar-compressed' || fileName.toLowerCase().endsWith('.rar')) {
                maxAllowed = 50 * 1024 * 1024; // 50MB for RAR
            }
            // MP3 and others default to 50MB

            const maxMB = Math.round(maxAllowed / (1024 * 1024));

            if (fileSize && fileSize > maxAllowed) {
                return res.status(413).json({
                    error: `El archivo excede el límite de ${maxMB}MB`
                });
            }
        }

        // 🔥 FIX: Ensure valid Content-Type for signature
        // If frontend sends empty string (common for zip/rar), default to octet-stream
        // matches frontend fallback: file.type || 'application/octet-stream'
        const finalFileType = fileType || 'application/octet-stream';

        // Estructura de carpetas sugerida: folder/userId/timestamp_fileName
        const timestamp = Date.now();
        // 🔥 SANITIZACIÓN AGRESIVA: Solo permitir letras, números, puntos, guiones y underscores
        const cleanFileName = fileName
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos
            .replace(/[^\w\.-]/g, '_') // Todo lo que no sea seguro -> _
            .replace(/_+/g, '_'); // Evitar múltiples underscores

        const keyWithPotentialDoubles = `${folder || 'uploads'}/${userId}/${timestamp}_${cleanFileName}`;
        let finalKey = keyWithPotentialDoubles.replace(/_+/g, '_');

        // 🔥 FIX: SINGLE BUCKET ARCHITECTURE
        // Todo va a 'offszn-storage'. Si es sensible, se agrega 'secure-products/' al inicio del key.
        const isSensitive = folder.includes('kits') || folder.includes('stems') || folder.includes('wav');

        if (isSensitive) {
            // Evitar duplicar el prefijo se ya viene
            if (!finalKey.startsWith('secure-products/')) {
                finalKey = `secure-products/${finalKey}`;
            }
            console.log(`[R2 Upload] Routing sensitive file to SECURE FOLDER: ${finalKey}`);
        }

        // Siempre usar el bucket principal
        const bucket = R2_BUCKET_NAME;
        // 🔥 NEW: Default to current version (v2) for new uploads
        const version = req.body.version || 'v2';

        const uploadUrl = await getPresignedUploadUrl(finalKey, finalFileType, version);

        // Si es sensible, la Public URL no servirá directamente (requiere firma)
        // Devolvemos el key final (con el prefijo secure-products si aplica)
        res.json({
            uploadUrl,
            key: finalKey,
            r2_version: version, // Return version for DB saving
            publicUrl: isSensitive ? null : getPublicUrl(finalKey, version)
        });
    } catch (error) {
        console.error('Error al generar R2 upload URL:', error);
        res.status(500).json({ error: 'Error al generar URL de subida' });
    }
});

// Endpoint para obtener una URL de descarga firmada (para archivos privados como WAV/Stems)
// MODIFICADO: Ahora permite acceso público a ciertas rutas (covers, previews) sin token.
router.post('/r2/download-url', async (req, res) => {
    try {
        let { key, expiresIn, version, productId } = req.body;

        if (!key) {
            return res.status(400).json({ error: 'Falta el key del archivo' });
        }

        // 🔥 STRATEGY: 100% Explicit Versioning.
        const { R2_CURRENT_VERSION } = await import('../../../shared/config/config.js');
        const finalVersion = version || R2_CURRENT_VERSION || 'v1';

        // Sanitización básica de la key (eliminar host si viene como URL completa)
        if (typeof key === 'string' && (key.startsWith('http://') || key.startsWith('https://'))) {
            try {
                if (key.includes('?')) key = key.split('?')[0];
                const urlObj = new URL(key);
                key = urlObj.pathname;

                // If it's a Supabase URL, extract the path after /object/[public|sign]/bucket/
                if (urlObj.hostname.includes('supabase.co')) {
                    const parts = key.split('/');
                    const objectIndex = parts.indexOf('object');
                    if (objectIndex !== -1 && parts.length > objectIndex + 2) {
                        key = parts.slice(objectIndex + 2).join('/');
                    }
                }
            } catch (e) {}
        }
        
        // Limpiar slash inicial y bucket names accidentales
        if (typeof key === 'string') {
            const bNames = [R2_BUCKET_NAME, R2_SECURE_BUCKET_NAME, 'offsznlatbucket', 'offszn-storage'];
            for (const b of bNames) {
                const norm = key.startsWith('/') ? key : `/${key}`;
                if (norm.startsWith(`/${b}/`)) {
                    key = norm.substring(b.length + 2);
                    break;
                }
            }
            if (key.includes('?')) key = key.split('?')[0];
            while (key.startsWith('/')) key = key.substring(1);
        }

        // Definir prefijos públicos
        const publicPrefixes = ['products/', 'beats/mp3/', 'avatars/', 'public/', 'banners/', 'drumkits/'];
        const isPublic = publicPrefixes.some(prefix => key.startsWith(prefix));

        // Si NO es público, requerir autenticación
        if (!isPublic) {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            if (!token) {
                return res.status(401).json({ error: 'Acceso denegado: Recurso privado y no hay token' });
            }

            const { data, error } = await supabase.auth.getUser(token);
            if (error || !data?.user) {
                return res.status(403).json({ error: 'Acceso denegado: Token inválido' });
            }
        }

        const finalExpiresIn = isPublic ? 86400 : (expiresIn || 3600);
        
        try {
            const downloadUrl = await getPresignedDownloadUrl(key, finalExpiresIn, finalVersion);
            if (!downloadUrl) {
                return res.status(404).json({ error: 'Recurso no encontrado' });
            }
            res.json({ downloadUrl });
        } catch (signErr) {
            console.error(`[R2 Download] Signing failure:`, signErr);
            res.status(500).json({ error: 'Error al firmar recurso' });
        }
    } catch (error) {
        console.error('Error al generar R2 download URL:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Endpoint para obtener múltiples URLs de descarga firmadas en una sola petición (Batch)
router.post('/r2/bulk-sign', async (req, res) => {
    try {
        const { items, expiresIn, version } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Se requiere un array de items' });
        }

        const publicPrefixes = ['products/', 'beats/mp3/', 'avatars/', 'public/', 'banners/', 'drumkits/'];
        const results = {};

        // Autenticación única para el lote
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        let user = null;

        const batchPromises = items.map(async (item) => {
            const rawKey = item.key || item.path;
            try {
                let key = rawKey;
                const itemVersion = item.version || version || 'v1';

                // Limpieza de key
                if (typeof key === 'string' && (key.startsWith('http://') || key.startsWith('https://'))) {
                    try {
                        const urlObj = new URL(key);
                        key = urlObj.pathname;
                        if (urlObj.hostname.includes('supabase.co')) {
                            const parts = key.split('/');
                            const objIdx = parts.indexOf('object');
                            if (objIdx !== -1 && parts.length > objIdx + 2) key = parts.slice(objIdx + 2).join('/');
                        }
                    } catch (e) {}
                }
                
                if (typeof key === 'string') {
                    const bNames = [R2_BUCKET_NAME, R2_SECURE_BUCKET_NAME, 'offsznlatbucket', 'offszn-storage'];
                    for (const b of bNames) {
                        const norm = key.startsWith('/') ? key : `/${key}`;
                        if (norm.startsWith(`/${b}/`)) { key = norm.substring(b.length + 2); break; }
                    }
                    if (key.includes('?')) key = key.split('?')[0];
                    while (key.startsWith('/')) key = key.substring(1);
                }

                const isPublic = publicPrefixes.some(prefix => key.startsWith(prefix));
                if (!isPublic && !user) {
                    if (!token) {
                        results[rawKey] = { error: 'Requerido token' };
                        return;
                    }
                    const { data, error } = await supabase.auth.getUser(token);
                    if (error || !data?.user) {
                        results[rawKey] = { error: 'Token inválido' };
                        return;
                    }
                    user = data.user;
                }

                const finalExpires = isPublic ? 86400 : (expiresIn || 3600);
                const downloadUrl = await getPresignedDownloadUrl(key, finalExpires, itemVersion);
                results[rawKey] = { downloadUrl };
            } catch (err) {
                results[rawKey] = { error: 'Error firmando' };
            }
        });

        await Promise.all(batchPromises);
        res.json({ results });
    } catch (error) {
        console.error('Error en R2 batch signing:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.post('/r2/delete-files', authenticateTokenMiddleware, async (req, res) => {
    try {
        const { keys, version } = req.body;

        if (!keys || !Array.isArray(keys) || keys.length === 0) {
            return res.status(400).json({ error: 'Se requiere un array de claves (keys).' });
        }

        console.log(`[R2 Endpoint] Removal request for ${keys.length} files by user ${req.user.userId} (Version: ${version || 'v1'})`);

        await deleteFromR2(keys, version || 'v1');

        res.json({ message: 'Archivos eliminados correctamente (o procesados silent).' });

    } catch (error) {
        console.error('Error en endpoint remove R2:', error);
        res.status(500).json({ error: 'Error al eliminar archivos' });
    }
});

// 🔥 FALLBACK PUBLIC ROUTE: Proxy or redirect to public R2 URL for known public prefixes
router.get(/\/r2-public\/(.*)/, async (req, res) => {
    try {
        const key = req.params[0];
        if (!key) return res.status(400).send('Key missing');

        const publicPrefixes = ['products/', 'beats/mp3/', 'avatars/', 'public/', 'banners/', 'drumkits/'];
        const isPublicPrefix = publicPrefixes.some(prefix => key.startsWith(prefix));

        if (!isPublicPrefix) {
            return res.status(403).send('Access Denied: Resource is not public');
        }

        // Smart Version Selection: Try most likely versions first
        const isUUIDPath = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(key);
        let versionsToTry = ['v2', 'supabase', 'v1'];
        
        if (isUUIDPath) {
            versionsToTry = ['v2', 'supabase']; // UUIDs are usually V2 or Supabase
        } else if (key.includes('beats/mp3/') || key.includes('drumkits/')) {
            versionsToTry = ['v1', 'v2', 'supabase'];
        }

        // Loop through versions until we find it
        for (const ver of versionsToTry) {
            const publicUrl = getPublicUrl(key, ver);
            try {
                const response = await fetch(publicUrl, { method: 'GET' }); // HEAD would be better but some services block it
                
                if (response.ok) {
                    // Found it! Proxy the content
                    res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
                    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h cache
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    
                    const body = response.body;
                    if (body) {
                        const reader = body.getReader();
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            res.write(value);
                        }
                    }
                    res.end();
                    return;
                }
            } catch (err) {
                console.warn(`[R2 Public Fallback] Try failed for ${ver} on ${key}:`, err.message);
            }
        }

        // If we reach here, nothing was found
        console.warn(`[R2 Public Fallback] Resource not found in any storage: ${key}`);
        return res.status(404).send('Resource not found');

    } catch (error) {
        console.error('Error in R2 public fallback:', error);
        res.status(500).send('Error accessory public resource');
    }
});

router.post('/r2/copy-file', authenticateTokenMiddleware, async (req, res) => {
    try {
        const { sourceKey, destinationKey, version } = req.body;

        if (!sourceKey || !destinationKey) {
            return res.status(400).json({ error: 'Faltan sourceKey o destinationKey' });
        }

        console.log(`[R2 Endpoint] Copying file for user ${req.user.userId} (Version: ${version || 'v1'})`);
        await copyFileInR2(sourceKey, destinationKey, version || 'v1');

        res.json({ message: 'Archivo copiado correctamente' });

    } catch (error) {
        console.error('Error en endpoint copy R2:', error);
        res.status(500).json({ error: 'Error al copiar archivo' });
    }
});

export default router;
