import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { getPresignedUploadUrl, getPresignedDownloadUrl, deleteFromR2, getPublicUrl } from '../../services/r2-storage.service.js';
import { R2_BUCKET_NAME } from '../../../shared/config/config.js';
import { supabase } from '../../database/connection.js';

const router = Router();

// 🔥 FILE SIZE LIMITS (server-side enforcement)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB general
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images

router.get('/r2/test-hello', (req, res) => res.send('Hello World'));

// Endpoint para obtener una URL de subida firmada
router.post('/r2/upload-url', authenticateTokenMiddleware, async (req, res) => {
    try {
        const { fileName, fileType, folder, fileSize } = req.body;
        const userId = req.user.userId;

        if (!fileName || !fileType) {
            return res.status(400).json({ error: 'Faltan fileName o fileType' });
        }

        // 🔥 Server-side file size validation
        if (fileSize) {
            const isImage = fileType.startsWith('image/');
            const maxAllowed = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
            const maxMB = Math.round(maxAllowed / (1024 * 1024));

            if (fileSize > maxAllowed) {
                return res.status(413).json({
                    error: `El archivo excede el límite de ${maxMB}MB`
                });
            }
        }

        // Estructura de carpetas sugerida: folder/userId/timestamp_fileName
        const timestamp = Date.now();
        // 🔥 SANITIZACIÓN AGRESIVA: Solo permitir letras, números, puntos, guiones y underscores
        const cleanFileName = fileName
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos
            .replace(/[^\w\.-]/g, '_') // Todo lo que no sea seguro -> _
            .replace(/_+/g, '_'); // Evitar múltiples underscores

        const key = `${folder || 'uploads'}/${userId}/${timestamp}_${cleanFileName}`;

        const uploadUrl = await getPresignedUploadUrl(key, fileType);

        res.json({
            uploadUrl,
            key,
            publicUrl: getPublicUrl(key)
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
        const { key, expiresIn } = req.body;

        if (!key) {
            return res.status(400).json({ error: 'Falta el key del archivo' });
        }

        // Definir prefijos públicos
        const publicPrefixes = ['products/covers/', 'beats/mp3/', 'avatars/', 'public/'];
        const isPublic = publicPrefixes.some(prefix => key.startsWith(prefix));

        // Si NO es público, requerir autenticación
        if (!isPublic) {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            if (!token) {
                return res.status(401).json({ error: 'Acceso denegado: Recurso privado y no hay token' });
            }

            // Verificar token con Supabase
            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (error || !user) {
                console.warn('R2 Download: Token inválido para recurso privado:', key);
                return res.status(403).json({ error: 'Acceso denegado: Token inválido' });
            }
        }

        const downloadUrl = await getPresignedDownloadUrl(key, expiresIn || 3600);
        res.json({ downloadUrl });
    } catch (error) {
        console.error('Error al generar R2 download URL:', error);
        res.status(500).json({ error: 'Error al generar URL de descarga' });
    }
});

router.post('/r2/delete-files', authenticateTokenMiddleware, async (req, res) => {
    try {
        const { keys } = req.body;

        if (!keys || !Array.isArray(keys) || keys.length === 0) {
            return res.status(400).json({ error: 'Se requiere un array de claves (keys).' });
        }

        console.log(`[R2 Endpoint] Solicitud de eliminación para ${keys.length} archivos por usuario ${req.user.userId}`);

        // TODO: Validar ownership si es necesario, aunque R2 es agnóstico del usuario.
        // Asumimos que si tiene token válido y conoce la key (que incluye userId), es legítimo.

        await deleteFromR2(keys);

        res.json({ message: 'Archivos eliminados correctamente (o procesados silent).' });

    } catch (error) {
        console.error('Error en endpoint remove R2:', error);
        res.status(500).json({ error: 'Error al eliminar archivos' });
    }
});

export default router;
