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
        if (fileSize) {
            let maxAllowed = 50 * 1024 * 1024; // Default 50MB

            if (fileType.startsWith('image/')) {
                maxAllowed = 20 * 1024 * 1024; // 20MB
            } else if (fileType === 'audio/wav' || fileName.toLowerCase().endsWith('.wav')) {
                maxAllowed = 60 * 1024 * 1024; // 60MB for WAV
            } else if (fileType === 'application/x-rar-compressed' || fileName.toLowerCase().endsWith('.rar')) {
                maxAllowed = 50 * 1024 * 1024; // 50MB for RAR
            }
            // MP3 and others default to 50MB

            const maxMB = Math.round(maxAllowed / (1024 * 1024));

            if (fileSize > maxAllowed) {
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
        let { key, expiresIn, version } = req.body;

        if (!key) {
            return res.status(400).json({ error: 'Falta el key del archivo' });
        }

        // 🔥 Default to v1 if not specified (legacy support)
        const { R2_CURRENT_VERSION } = await import('../../../shared/config/config.js');
        const finalVersion = version || R2_CURRENT_VERSION || 'v1';

        // 🔥 KEY SANITIZATION AND VERSION DETECTION
        let detectedVersion = null;
        if (typeof key === 'string') {
            // Detectar versión desde el string antes de limpiar
            if (key.includes('offsznlatbucket') || key.includes('42fc23b11a6c329b76b2babc20afcbf7')) {
                detectedVersion = 'v2';
            } else if (key.includes('offszn-storage') || key.includes('41d0f49121d02c88f71fdb4da54a791d')) {
                detectedVersion = 'v1';
            }

            if (key.startsWith('http://') || key.startsWith('https://')) {
                try {
                    if (key.includes('?')) key = key.split('?')[0];
                    const urlObj = new URL(key);
                    key = urlObj.pathname;
                } catch (e) {}
            }

            // Eliminar nombre del bucket de la ruta si está presente (incluso si no era una URL completa)
            const bucketNames = [R2_BUCKET_NAME, R2_SECURE_BUCKET_NAME, 'offsznlatbucket', 'offszn-storage'].filter(b => b && b !== 'secure-products');
            for (const b of bucketNames) {
                const normalizedPath = key.startsWith('/') ? key : `/${key}`;
                if (normalizedPath.startsWith(`/${b}/`)) {
                    key = normalizedPath.substring(b.length + 2);
                    break;
                }
            }
            
            if (key.includes('?')) key = key.split('?')[0];
            while (key.startsWith('/')) key = key.substring(1);
        }

        const itemVersion = detectedVersion || version || R2_CURRENT_VERSION || 'v2';

        // Definir prefijos públicos
        const publicPrefixes = ['products/covers/', 'beats/mp3/', 'avatars/', 'public/', 'banners/'];
        const isPublic = publicPrefixes.some(prefix => key.startsWith(prefix));

        // Si NO es público, requerir autenticación
        if (!isPublic) {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            if (!token) {
                return res.status(401).json({ error: 'Acceso denegado: Recurso privado y no hay token' });
            }

            // Verificar token con Supabase de forma segura
            const { data, error } = await supabase.auth.getUser(token);
            const user = data?.user;

            if (error || !user) {
                console.warn('R2 Download: Token inválido para recurso privado:', key);
                return res.status(403).json({ error: 'Acceso denegado: Token inválido' });
            }
        }

        // 🔥 PUBLIC ASSETS: Increase expiry to 24h to improve caching and reduce CORS overhead
        const finalExpiresIn = isPublic ? 86400 : (expiresIn || 3600);
        const signVersion = itemVersion;
        const downloadUrl = await getPresignedDownloadUrl(key, finalExpiresIn, signVersion);
        res.json({ downloadUrl });
    } catch (error) {
        console.error('Error al generar R2 download URL:', error);
        res.status(500).json({ error: 'Error al generar URL de descarga' });
    }
});

// Endpoint para obtener múltiples URLs de descarga firmadas en una sola petición (Batch)
router.post('/r2/bulk-sign', async (req, res) => {
    try {
        const { keys, expiresIn, version } = req.body;

        if (!keys || !Array.isArray(keys)) {
            return res.status(400).json({ error: 'Se requiere un array de keys' });
        }

        const { R2_CURRENT_VERSION } = await import('../../../shared/config/config.js');
        const finalVersion = version || R2_CURRENT_VERSION || 'v1';

        const publicPrefixes = ['products/covers/', 'beats/mp3/', 'avatars/', 'public/', 'banners/'];
        const results = {};

        // Para recursos privados, verificar token una sola vez
        let isAuthenticated = false;
        let isTokenValid = false;
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        // Procesar cada key
        const batchPromises = keys.map(async (rawKey) => {
            try {
                let key = rawKey;
                let detectedVersion = null;
                
                // Sanitización y extracción de key desde URL si es necesario
                if (typeof key === 'string') {
                    // Detectar versión desde la URL o el string antes de limpiar
                    if (key.includes('offsznlatbucket') || key.includes('42fc23b11a6c329b76b2babc20afcbf7')) {
                        detectedVersion = 'v2';
                    } else if (key.includes('offszn-storage') || key.includes('41d0f49121d02c88f71fdb4da54a791d')) {
                        detectedVersion = 'v1';
                    }

                    if (key.startsWith('http://') || key.startsWith('https://')) {
                        try {
                            if (key.includes('?')) key = key.split('?')[0];
                            const urlObj = new URL(key);
                            key = urlObj.pathname;
                        } catch (e) {}
                    }

                    // Eliminar nombre del bucket de la ruta si está presente (incluso si no era una URL completa)
                    const bucketNames = [R2_BUCKET_NAME, R2_SECURE_BUCKET_NAME, 'offsznlatbucket', 'offszn-storage'].filter(b => b && b !== 'secure-products');
                    for (const b of bucketNames) {
                        const normalizedPath = key.startsWith('/') ? key : `/${key}`;
                        if (normalizedPath.startsWith(`/${b}/`)) {
                            key = normalizedPath.substring(b.length + 2);
                            break;
                        }
                    }

                    if (key.includes('?')) key = key.split('?')[0];
                    while (key.startsWith('/')) key = key.substring(1);
                }

                const itemVersion = detectedVersion || version || R2_CURRENT_VERSION || 'v2';
                const isPublic = publicPrefixes.some(prefix => key.startsWith(prefix));
                
                // Si el recurso es privado y no hemos autenticado aún, hacerlo
                if (!isPublic) {
                    if (!isAuthenticated) {
                        if (!token) {
                            results[rawKey] = { error: 'Acceso denegado: Recurso privado' };
                            return;
                        }
                        const { data, error } = await supabase.auth.getUser(token);
                        const user = data?.user;
                        if (error || !user) {
                            results[rawKey] = { error: 'Token inválido' };
                            isAuthenticated = true;
                            isTokenValid = false;
                            return;
                        }
                        isAuthenticated = true; 
                        isTokenValid = true;
                    } else if (!isTokenValid) {
                        results[rawKey] = { error: 'Acceso denegado: Token inválido' };
                        return;
                    }
                }

                const finalExpiresIn = isPublic ? 86400 : (expiresIn || 3600);
                const downloadUrl = await getPresignedDownloadUrl(key, finalExpiresIn, itemVersion);
                results[rawKey] = { downloadUrl };

            } catch (err) {
                console.error(`Error firmando key ${rawKey}:`, err);
                results[rawKey] = { error: 'Error al firmar' };
            }
        });

        await Promise.all(batchPromises);
        res.json({ results });

    } catch (error) {
        console.error('Error en R2 batch signing:', error);
        res.status(500).json({ error: 'Error interno en batch signing' });
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

        const publicPrefixes = ['products/covers/', 'beats/mp3/', 'avatars/', 'public/', 'banners/', 'drumkits/covers/'];
        const isPublicPrefix = publicPrefixes.some(prefix => key.startsWith(prefix));

        if (!isPublicPrefix) {
            return res.status(403).send('Access Denied: Resource is not public');
        }

        // Detect version from path hints or default to config
        let version = 'v2'; // Default to V2 for newer assets
        if (key.includes('offsznlatbucket') || key.includes('42fc23b11a6c329b76b2babc20afcbf7')) {
            version = 'v2';
        } else if (key.includes('offszn-storage') || key.includes('41d0f49121d02c88f71fdb4da54a791d')) {
            version = 'v1';
        }

        const publicUrl = getPublicUrl(key, version);
        
        // Redirect to the actual public URL (faster than proxying)
        // Or we could fetch and stream if we want to hide R2 URLs completely
        res.redirect(301, publicUrl);

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
