import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { getPresignedUploadUrl, getPresignedDownloadUrl, deleteFromR2 } from '../../services/r2-storage.service.js';

const router = Router();

// Endpoint para obtener una URL de subida firmada
router.post('/r2/upload-url', authenticateTokenMiddleware, async (req, res) => {
    try {
        const { fileName, fileType, folder } = req.body;
        const userId = req.user.userId;

        if (!fileName || !fileType) {
            return res.status(400).json({ error: 'Faltan fileName o fileType' });
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
            publicUrl: `https://${process.env.R2_BUCKET_NAME}.41d0f49121d02c88f71fdb4da54a791d.r2.cloudflarestorage.com/${key}`
        });
    } catch (error) {
        console.error('Error al generar R2 upload URL:', error);
        res.status(500).json({ error: 'Error al generar URL de subida' });
    }
});

// Endpoint para obtener una URL de descarga firmada (para archivos privados como WAV/Stems)
router.post('/r2/download-url', authenticateTokenMiddleware, async (req, res) => {
    try {
        const { key, expiresIn } = req.body;

        if (!key) {
            return res.status(400).json({ error: 'Falta el key del archivo' });
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
