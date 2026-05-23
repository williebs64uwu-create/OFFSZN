import { Router } from 'express';
import { pipeline } from 'stream';
import {
    getPresignedUploadUrl,
    getPresignedDownloadUrl,
    getPublicUrl,
    deleteFromR2,
    copyFileInR2,
    existsInR2,
    getClientAndBucket
} from '../../services/r2-storage.service.js';
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { R2_BUCKET_NAME, R2_SECURE_BUCKET_NAME } from '../../../shared/config/config.js';
import { supabase } from '../../database/connection.js';
const router = Router();

// 🔥 PERFORMANCE CACHE: Stores 'requestedKey -> { version, foundKey }' to skip discovery loops.
// Max size roughly 2000 items to keep memory footprint low.
const resolveCache = new Map();
const MAX_CACHE_SIZE = 2000;

// 🔥 SLOW PATH DIAGNOSTICS: Logs files that needed the discovery loop.
// Key = originalKey, Value = { resolvedKey, resolvedVersion, timestamp, attempts }
// This data helps identify DB records with wrong paths that should be fixed.
const slowPathLog = new Map();
const MAX_SLOW_LOG = 500;

// 🔥 FILE SIZE LIMITS (server-side enforcement)
// 🔥 FILE SIZE LIMITS (server-side enforcement)
const MAX_FILE_SIZE = 1000 * 1024 * 1024; // 1GB (Increased for Stems/WAVs)
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB for images

router.get('/r2/test-hello', (req, res) => {
    res.send('Hello World');
});

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
        // 🔥 Default to current version (v3) for new uploads
        const version = req.body.version || 'v3';

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
            } catch (e) { }
        }

        // Limpiar slash inicial y bucket names accidentales (Solo nombres de bucket reales)
        if (typeof key === 'string') {
            // Solo quitar el nombre del bucket si viene al inicio (como en una URL de Supabase o R2 path)
            // No quitar folder prefixes como 'secure-products' o 'products' que son parte del key en R2.
            const realBucketNames = ['offsznlatbucket', 'offszn-storage'];
            for (const b of realBucketNames) {
                const norm = key.startsWith('/') ? key : `/${key}`;
                if (norm.startsWith(`/${b}/`)) {
                    key = norm.substring(b.length + 2);
                    break;
                }
            }
            if (key.includes('?')) key = key.split('?')[0];
            while (key.startsWith('/')) key = key.substring(1);
        }

        // Definir prefijos públicos (archivos que los invitados pueden ver/oír)
        const publicPrefixes = ['products/', 'beats/mp3/', 'avatars/', 'public/', 'banners/', 'drumkits/', 'temp-previews/', 'covers/', 'audio/'];
        const isPublic = publicPrefixes.some(prefix => key.startsWith(prefix));

        // Si NO es público, verificar si es un producto gratuito o requerir autenticación
        if (!isPublic) {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            // 🔥 GUEST FREE DOWNLOAD: If productId is provided, check if product is free
            let guestFreeAccess = false;
            if (!token && productId) {
                if (productId === 'x-flow-analyzer') {
                    guestFreeAccess = true;
                    console.log(`[R2 Download] Guest free download approved for analyzer`);
                } else {
                    try {
                        const { data: prod } = await supabase
                            .from('products')
                            .select('is_free, price_basic')
                            .eq('id', productId)
                            .maybeSingle();
                        if (prod && prod.is_free && (!prod.price_basic || Number(prod.price_basic) === 0)) {
                            guestFreeAccess = true;
                            console.log(`[R2 Download] Guest free download approved for product ${productId}`);
                        }
                    } catch (e) {
                        console.warn('[R2 Download] Free check failed:', e.message);
                    }
                }
            }

            if (!guestFreeAccess) {
                if (!token) {
                    return res.status(401).json({ error: 'Acceso denegado: Recurso privado y no hay token' });
                }

                const { data, error } = await supabase.auth.getUser(token);
                if (error || !data?.user) {
                    return res.status(403).json({ error: 'Acceso denegado: Token inválido' });
                }
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

        const publicPrefixes = ['products/', 'beats/mp3/', 'avatars/', 'public/', 'banners/', 'drumkits/', 'temp-previews/'];
        const results = {};

        // Autenticación única para el lote
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        let user = null;

        const batchPromises = items.map(async (item) => {
            const rawKey = item.key || item.path;
            try {
                let key = rawKey;
                const itemVersion = item.version || version || 'v2';

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
                    } catch (e) { }
                }

                if (typeof key === 'string') {
                    const realBucketNames = ['offsznlatbucket', 'offszn-storage'];
                    for (const b of realBucketNames) {
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

        await deleteFromR2(keys, version || null);

        res.json({ message: 'Archivos eliminados correctamente (o procesados silent).' });

    } catch (error) {
        console.error('Error en endpoint remove R2:', error);
        res.status(500).json({ error: 'Error al eliminar archivos' });
    }
});

// 🔥 FALLBACK PUBLIC ROUTE: Proxy or redirect to public R2 URL for known public prefixes
router.get(/\/r2-public\/(.*)/, async (req, res) => {
    try {
        let key = req.params[0];
        if (!key) return res.status(400).send('Key missing');

        // 🔥 FIX: Strip any trailing query parameters (eg ?v=v2)
        if (key.includes('?')) {
            key = key.split('?')[0];
        }

        // 1. Check PERFORMANCE CACHE first
        const cacheHit = resolveCache.get(key);
        if (cacheHit) {
            // Found in cache - SKIP DISCOVERY!
            const { version: foundVersion, key: foundKey } = cacheHit;
            const { client, bucket } = getClientAndBucket(foundVersion);
            const range = req.headers.range;
            const getParams = { Bucket: bucket, Key: foundKey };
            if (range) getParams.Range = range;

            const command = new GetObjectCommand(getParams);
            const { Body, ContentType, ContentLength, ContentRange } = await client.send(command);

            if (ContentType) res.setHeader('Content-Type', ContentType);
            if (ContentLength) res.setHeader('Content-Length', ContentLength);
            if (ContentRange) res.setHeader('Content-Range', ContentRange);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('Accept-Ranges', 'bytes');
            if (range) res.status(206);

            // Clean up when client closes connection to prevent connection pool leaks
            req.on('close', () => {
                if (Body && typeof Body.destroy === 'function') Body.destroy();
            });

            pipeline(Body, res, (err) => {
                if (err) {
                    console.error('[R2 Cache Stream Error]:', err.message);
                }
            });
            return;
        }

        // 2. Determinar orden de búsqueda (Prioridad segun ?v=)
        // V3 Added in preparation for future scale
        let versionsToTry = ['v2', 'v1', 'v3'];
        if (req.query.v === 'v1') versionsToTry = ['v1', 'v2', 'v3'];
        if (req.query.v === 'v3') versionsToTry = ['v3', 'v2', 'v1'];

        // 2. Limpieza agresiva del Key (Quitar buckets si vienen en el path)
        let cleanKey = key;
        const knownBuckets = ['offsznlatbucket', 'offszn-storage', 'offszn-storage/'];
        for (const bucket of knownBuckets) {
            if (cleanKey.toLowerCase().startsWith(`${bucket}/`)) {
                cleanKey = cleanKey.substring(bucket.length + 1);
            }
        }
        if (cleanKey.includes('?')) cleanKey = cleanKey.split('?')[0];

        // 3. Generar patrones de búsqueda inteligentes
        const filename = cleanKey.split('/').pop();
        const uuidMatch = cleanKey.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        const uuid = uuidMatch ? uuidMatch[0] : null;

        // Path base "puro" (solo uuid/archivo o solo archivo)
        const purePath = uuid ? `${uuid}/${filename}` : filename;

        // 🔥 FAST PATH: Try the exact key on ALL versions (v2 → v1 → v3)
        let foundVersion = null;
        let foundKey = null;

        for (const tryVersion of versionsToTry) {
            const exists = await existsInR2(cleanKey, tryVersion);
            // console.log(`   - Checking ${tryVersion}: ${cleanKey} -> ${exists ? '✅' : '❌'}`);
            if (exists) {
                foundVersion = tryVersion;
                foundKey = cleanKey;
                break;
            }
        }

        // 🔥 SLOW PATH: Only if exact key fails, run discovery loop
        let usedSlowPath = false;
        if (!foundKey) {
            usedSlowPath = true;
            const trialPrefixes = [
                '',               // Exacto como viene
                'products/',      // Pre-migración
                'audio/'          // General
            ];

            // SMART SORTING: Prioritize folders based on file type
            const ext = filename.toLowerCase().split('.').pop();
            if (['mp3', 'wav'].includes(ext)) {
                trialPrefixes.splice(1, 0, 'beats/mp3/', 'mp3_tagged/', 'products/audio/');
            } else if (['jpg', 'png', 'webp', 'jpeg'].includes(ext)) {
                trialPrefixes.splice(1, 0, 'products/covers/');
            } else {
                trialPrefixes.push('products/covers/', 'beats/mp3/', 'mp3_tagged/', 'products/audio/');
            }

            const patternsToTry = [];
            for (const prefix of trialPrefixes) {
                patternsToTry.push(`${prefix}${cleanKey}`); // Con el path tal cual
                patternsToTry.push(`${prefix}${purePath}`); // Con el path purificado
                patternsToTry.push(`${prefix}${filename}`); // Solo el archivo
            }

            const uniquePatterns = [...new Set(patternsToTry.filter(p => !!p))].map(p => {
                let pClean = p;
                while (pClean.startsWith('/')) pClean = pClean.substring(1);
                return pClean;
            })
                // Remove the exact cleanKey since we already tried it above
                .filter(p => p !== cleanKey);

            for (const version of versionsToTry) {
                for (const pattern of uniquePatterns) {
                    const exists = await existsInR2(pattern, version);
                    if (exists) {
                        foundVersion = version;
                        foundKey = pattern;
                        break;
                    }
                }
                if (foundKey) break;
            }
        }

        // Cache the result for future speed
        if (foundKey) {
            if (resolveCache.size >= MAX_CACHE_SIZE) {
                const firstKey = resolveCache.keys().next().value;
                resolveCache.delete(firstKey);
            }
            resolveCache.set(key, { version: foundVersion, key: foundKey });

            // 🔥 DIAGNOSTICS: Log slow-path discoveries (only once per unique key)
            if (usedSlowPath && !slowPathLog.has(key)) {
                if (slowPathLog.size >= MAX_SLOW_LOG) {
                    const oldest = slowPathLog.keys().next().value;
                    slowPathLog.delete(oldest);
                }
                slowPathLog.set(key, {
                    originalKey: key,
                    resolvedKey: foundKey,
                    resolvedVersion: foundVersion,
                    mismatch: key !== foundKey,
                    timestamp: new Date().toISOString()
                });
                if (key !== foundKey) {
                    console.log(`🐌 [R2 Slow Path] "${key}" → Found at "${foundKey}" (${foundVersion})`);
                }
            }
        }


        // 4. Si no se encontró en R2, 404
        if (!foundKey) {
            return res.status(404).send('Asset not found in R2 V1 or V2');
        }

        // 5. STREAMING CON SOPORTE PARA RANGE (Crucial para Audio)
        const { client, bucket } = getClientAndBucket(foundVersion);
        const range = req.headers.range;

        const getParams = { Bucket: bucket, Key: foundKey };
        if (range) {
            getParams.Range = range;
        }

        const command = new GetObjectCommand(getParams);
        const response = await client.send(command);

        const headers = {
            'Content-Type': response.ContentType || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-R2-Discovered-Version': foundVersion,
            'X-R2-Discovered-Key': foundKey,
            'Accept-Ranges': 'bytes'
        };

        if (response.ContentRange) {
            headers['Content-Range'] = response.ContentRange;
            res.status(206);
        } else {
            res.status(200);
        }

        if (response.ContentLength) {
            headers['Content-Length'] = response.ContentLength;
        }

        // Clean up when client closes connection to prevent connection pool leaks
        req.on('close', () => {
            if (response.Body && typeof response.Body.destroy === 'function') response.Body.destroy();
        });

        res.set(headers);

        pipeline(response.Body, res, (err) => {
            if (err) {
                console.error('[R2 Main Stream Error]:', err.message);
            }
        });


    } catch (error) {
        console.error('Error en Proxy R2 Público:', error);
        if (!res.headersSent) {
            res.status(500).send('Internal Storage Proxy Error');
        }
    }
});


// 🔥 ADMIN DIAGNOSTICS: View slow-path discoveries and optionally auto-fix DB
router.get('/admin/r2-diagnostics', async (req, res) => {
    // Simple auth check via query param (matches existing admin pattern)
    const secret = req.headers['x-offszn-secret'] || req.query.secret;
    if (secret !== 'offszn_keep_alive_2026_safe') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const entries = Array.from(slowPathLog.values());
    const mismatches = entries.filter(e => e.mismatch);

    res.json({
        summary: {
            totalDiscoveries: entries.length,
            mismatches: mismatches.length,
            cacheSize: resolveCache.size,
            message: mismatches.length > 0
                ? `⚠️ ${mismatches.length} archivos necesitan corrección en la BD para cargar más rápido.`
                : '✅ Todos los archivos se resuelven correctamente.'
        },
        mismatches: mismatches.map(e => ({
            dbSays: e.originalKey,
            actuallyAt: e.resolvedKey,
            version: e.resolvedVersion,
            foundAt: e.timestamp
        })),
        allDiscoveries: entries
    });
});

// 🔥 ADMIN AUTO-FIX: Update product paths in DB to match actual R2 locations
router.post('/admin/r2-fix-paths', async (req, res) => {
    const secret = req.headers['x-offszn-secret'] || req.query.secret;
    if (secret !== 'offszn_keep_alive_2026_safe') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const mismatches = Array.from(slowPathLog.values()).filter(e => e.mismatch);
    let fixed = 0;
    let errors = [];

    for (const entry of mismatches) {
        try {
            // Buscamos el nombre del archivo (la parte final de la ruta)
            const filename = entry.originalKey.split('/').pop();

            // Buscamos productos que tengan ese archivo en su audio_url o image_url
            // Usamos ILIKE %path% para que lo encuentre aunque tenga el dominio al principio
            let { data: products } = await supabase
                .from('products')
                .select('id, name, audio_url, image_url')
                .or(`audio_url.ilike.%${entry.originalKey}%,image_url.ilike.%${entry.originalKey}%`)
                .limit(5);

            // Si aún no lo encuentra por ruta completa, buscamos solo por el nombre del archivo
            if (!products || products.length === 0) {
                const { data: byFilename } = await supabase
                    .from('products')
                    .select('id, name, audio_url, image_url')
                    .or(`audio_url.ilike.%${filename}%,image_url.ilike.%${filename}%`)
                    .limit(5);
                products = byFilename;
            }

            if (products && products.length > 0) {
                for (const product of products) {
                    const updateFields = {};

                    // Verificamos cuál campo coincide para actualizarlo
                    if (product.audio_url && product.audio_url.includes(filename)) {
                        updateFields.audio_url = entry.resolvedKey;
                    }
                    if (product.image_url && product.image_url.includes(filename)) {
                        updateFields.image_url = entry.resolvedKey;
                    }
                    if (entry.resolvedVersion) {
                        updateFields.r2_version = entry.resolvedVersion;
                    }

                    if (Object.keys(updateFields).length > 0) {
                        const { error } = await supabase
                            .from('products')
                            .update(updateFields)
                            .eq('id', product.id);

                        if (error) {
                            errors.push({ id: product.id, error: error.message });
                        } else {
                            fixed++;
                            console.log(`✅ [R2 Auto-Fix] Product ${product.id} (${product.name}): Corregido a ${entry.resolvedKey}`);
                        }
                    }
                }
            } else {
                errors.push({ key: entry.originalKey, note: 'No se encontró el producto en la BD' });
            }
        } catch (e) {
            errors.push({ key: entry.originalKey, error: e.message });
        }
    }

    // 🔥 CLEANUP: Remove fixed entries from the log so diagnostics shows clean state
    if (fixed > 0) {
        for (const entry of mismatches) {
            slowPathLog.delete(entry.originalKey);
        }
        console.log(`🧹 [R2 Diagnostics] Cleared ${mismatches.length} entries from slow-path log after fixing ${fixed}.`);
    }

    res.json({
        message: `Corregidos ${fixed} de ${mismatches.length} productos.`,
        fixed,
        total: mismatches.length,
        errors: errors.length > 0 ? errors : undefined
    });
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
