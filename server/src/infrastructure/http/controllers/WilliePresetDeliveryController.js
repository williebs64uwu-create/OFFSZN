import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getClientAndBucket } from '../../services/r2-storage.service.js';
import { supabase } from '../../database/connection.js';

import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas compatibles con Vercel Serverless (process.cwd()) y entornos locales
const rootDir = process.env.VERCEL ? process.cwd() : path.resolve(__dirname, '../../../../');
const DATA_DIR = process.env.VERCEL
    ? path.join(os.tmpdir(), 'offszn-data')
    : path.join(rootDir, 'server/data');
const DELIVERIES_FILE = path.join(DATA_DIR, 'willie_deliveries.json');
const CATALOG_PATH = path.join(rootDir, 'willieinspired/data/artist-presets-catalog.json');

// Cargar catálogo de presets en memoria
let artistCatalog = [];
function loadCatalog() {
    try {
        if (fs.existsSync(CATALOG_PATH)) {
            const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
            artistCatalog = JSON.parse(raw);
            console.log(`[WillieDelivery] Catálogo cargado: ${artistCatalog.length} artistas disponibles`);
        }
    } catch (e) {
        console.warn('[WillieDelivery] Error cargando catálogo de artistas:', e.message);
    }
}
loadCatalog();

// Almacenamiento en memoria con persistencia en disco tolerante a fallos
let inMemoryDeliveries = {};

function ensureDataDir() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (!fs.existsSync(DELIVERIES_FILE)) {
            fs.writeFileSync(DELIVERIES_FILE, JSON.stringify({}), 'utf8');
        }
    } catch (e) {
        // En Vercel o sistemas de solo lectura se ignora silenciosamente
    }
}

function readDeliveries() {
    try {
        ensureDataDir();
        if (fs.existsSync(DELIVERIES_FILE)) {
            const content = fs.readFileSync(DELIVERIES_FILE, 'utf8');
            return JSON.parse(content || '{}');
        }
    } catch (e) {
        console.warn('[WillieDelivery] Error leyendo willie_deliveries.json, usando memoria:', e.message);
    }
    return inMemoryDeliveries;
}

function writeDeliveries(data) {
    inMemoryDeliveries = data;
    try {
        ensureDataDir();
        fs.writeFileSync(DELIVERIES_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.warn('[WillieDelivery] No se pudo persistir en disco (guardado en memoria):', e.message);
    }
}

/**
 * Genera un token criptográfico seguro de 48 caracteres.
 */
function generateOrderToken() {
    return 'ord_wi_' + crypto.randomBytes(24).toString('hex');
}

/**
 * Crea o normaliza los ítems comprados a partir del catálogo
 */
export function buildDeliveryItems(cartItems) {
    if (!artistCatalog || artistCatalog.length === 0) loadCatalog();

    const items = [];
    for (const rawItem of cartItems) {
        const rawId = (rawItem.id || '').toString().toLowerCase().replace(/^preset-/, '').replace(/^bundle-/, '');
        const matched = artistCatalog.find(a => a.id === rawId || a.artist.toLowerCase() === (rawItem.name || '').toLowerCase().replace(/ vocal preset.*/i, '').trim());

        if (matched) {
            items.push({
                product_id: matched.id,
                name: matched.title,
                artist: matched.artist,
                format: matched.format,
                cover_url: matched.cover_url || rawItem.cover || '/willieimages/HERO.png',
                credits_remaining: 4,
                total_credits: 4,
                files: matched.files.map((f, idx) => ({
                    file_id: `${matched.id}-${f.type}-${idx}`,
                    filename: f.filename,
                    type: f.type,
                    format: f.format,
                    download_name: f.download_name,
                    bucket_key: f.bucket_key,
                    size_bytes: f.size_bytes
                }))
            });
        } else {
            // Producto genérico o plugin (ej: Easy Mix)
            const isPlugin = rawItem.type === 'plugin' || (rawItem.name && rawItem.name.toLowerCase().includes('plugin'));
            items.push({
                product_id: rawItem.id || `prod-${Date.now()}`,
                name: rawItem.name || 'Producto Digital Willie Inspired',
                artist: 'Willie Inspired',
                format: isPlugin ? 'VST3 / AU' : 'FST',
                cover_url: rawItem.cover || '/willieimages/HERO.png',
                credits_remaining: 4,
                total_credits: 4,
                files: [
                    {
                        file_id: `file-${Date.now()}`,
                        filename: `${rawItem.name || 'preset'}.fst`,
                        type: 'fst',
                        format: 'Preset FL Studio',
                        download_name: `${rawItem.name || 'Preset'} [Willie Inspired].fst`,
                        bucket_key: `presets/artistas/general/${rawItem.id || 'preset'}.fst`,
                        size_bytes: 35000
                    }
                ]
            });
        }
    }
    return items;
}

/**
 * GET /api/willie/delivery/:token
 * Obtiene los datos del pedido y créditos restantes para el comprador.
 */
export const getOrderDelivery = async (req, res) => {
    try {
        const { token } = req.params;
        if (!token) {
            return res.status(400).json({ error: 'TOKEN_REQUIRED', message: 'Token de pedido requerido' });
        }

        // Modo Demo / Prueba
        if (token === 'demo' || token === 'DEMO-WILLIE' || token.startsWith('demo-')) {
            if (!artistCatalog || artistCatalog.length === 0) loadCatalog();
            const demoArtist1 = artistCatalog.find(a => a.id === 'bad-bunny') || artistCatalog[0];
            const demoArtist2 = artistCatalog.find(a => a.id === 'feid') || artistCatalog[1];
            
            return res.status(200).json({
                ok: true,
                order: {
                    token: token,
                    order_id: 'ORD-DEMO-2026',
                    customer_email: 'cliente.demo@willieinspired.com',
                    created_at: new Date().toISOString(),
                    status: 'completed',
                    items: buildDeliveryItems([
                        { id: demoArtist1?.id || 'bad-bunny', name: demoArtist1?.title || 'Bad Bunny Vocal Preset' },
                        { id: demoArtist2?.id || 'feid', name: demoArtist2?.title || 'Feid Vocal Preset' }
                    ]).map(item => ({
                        ...item,
                        // No exponemos bucket_key en la consulta pública
                        files: item.files.map(f => ({
                            file_id: f.file_id,
                            filename: f.filename,
                            type: f.type,
                            format: f.format,
                            download_name: f.download_name,
                            size_bytes: f.size_bytes
                        }))
                    }))
                }
            });
        }

        const deliveries = readDeliveries();
        let order = deliveries[token];

        // Si no está en archivo local, consultar Supabase
        if (!order && supabase) {
            try {
                const { data } = await supabase
                    .from('willie_orders')
                    .select('*')
                    .eq('delivery_token', token)
                    .maybeSingle();

                if (data) {
                    order = data.order_payload;
                }
            } catch (sErr) {
                console.warn('[WillieDelivery] Error leyendo Supabase:', sErr.message);
            }
        }

        if (!order) {
            return res.status(404).json({
                error: 'ORDER_NOT_FOUND',
                message: 'No se encontró ninguna compra con este enlace. Por favor verifica tu correo o contacta a soporte.'
            });
        }

        // Sanitizar respuesta: remover bucket_key interno por seguridad
        const sanitizedItems = order.items.map(item => ({
            product_id: item.product_id,
            name: item.name,
            artist: item.artist,
            format: item.format,
            cover_url: item.cover_url,
            credits_remaining: item.credits_remaining,
            total_credits: item.total_credits,
            files: item.files.map(f => ({
                file_id: f.file_id,
                filename: f.filename,
                type: f.type,
                format: f.format,
                download_name: f.download_name,
                size_bytes: f.size_bytes
            }))
        }));

        return res.status(200).json({
            ok: true,
            order: {
                token: order.token,
                order_id: order.order_id,
                customer_email: order.customer_email,
                created_at: order.created_at,
                status: order.status,
                items: sanitizedItems
            }
        });

    } catch (err) {
        console.error('[WillieDelivery] Error en getOrderDelivery:', err);
        return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
};

/**
 * POST /api/willie/delivery/:token/download
 * Valida créditos, descuenta 1 crédito y genera URL firmada en Cloudflare R2 Bucket 4 (bucket2026).
 */
export const downloadPresetFile = async (req, res) => {
    try {
        const { token } = req.params;
        const { productId, fileId } = req.body;

        if (!token || !productId) {
            return res.status(400).json({ error: 'BAD_REQUEST', message: 'Token y ID de producto requeridos' });
        }

        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        // Manejo especial modo Demo
        if (token === 'demo' || token === 'DEMO-WILLIE' || token.startsWith('demo-')) {
            if (!artistCatalog || artistCatalog.length === 0) loadCatalog();
            const matchedArtist = artistCatalog.find(a => a.id === productId) || artistCatalog[0];
            const targetFile = matchedArtist?.files?.find(f => f.filename.includes(fileId) || fileId.includes(f.type)) || matchedArtist?.files?.[0];

            let bucketKey = targetFile?.bucket_key || `presets/artistas/${productId}/${matchedArtist?.artist}.fst`;
            let downloadFilename = targetFile?.download_name || `${matchedArtist?.artist} - Vocal Preset [Willie Inspired].fst`;

            // Generar enlace firmado real en Bucket 4
            let signedUrl = null;
            try {
                const { client, bucket } = getClientAndBucket('v4');
                if (client) {
                    const cmd = new GetObjectCommand({
                        Bucket: bucket,
                        Key: bucketKey,
                        ResponseContentDisposition: `attachment; filename="${downloadFilename}"`
                    });
                    signedUrl = await getSignedUrl(client, cmd, { expiresIn: 600 }); // 10 minutos
                }
            } catch (r2Err) {
                console.warn('[WillieDelivery] Demo signedUrl falló:', r2Err.message);
            }

            return res.status(200).json({
                ok: true,
                downloadUrl: signedUrl || `https://bucket2026.r2.cloudflarestorage.com/${bucketKey}?demo_token=active`,
                creditsRemaining: 3,
                message: 'Descarga demo autorizada (1 crédito descontado)'
            });
        }

        const deliveries = readDeliveries();
        const order = deliveries[token];

        if (!order) {
            return res.status(404).json({ error: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado' });
        }

        const item = order.items.find(i => i.product_id === productId);
        if (!item) {
            return res.status(404).json({ error: 'PRODUCT_NOT_IN_ORDER', message: 'Producto no encontrado en esta compra' });
        }

        // 1. VALIDACIÓN DE CRÉDITOS RESTANTES
        if (item.credits_remaining <= 0) {
            return res.status(403).json({
                error: 'CREDITS_EXHAUSTED',
                message: 'Has agotado el límite de 4 descargas de este producto. Si cambiaste de PC o formateaste, contáctanos por WhatsApp para reponer tus créditos.',
                creditsRemaining: 0
            });
        }

        // Buscar archivo específico
        const targetFile = (fileId && item.files.find(f => f.file_id === fileId)) || item.files[0];
        if (!targetFile) {
            return res.status(404).json({ error: 'FILE_NOT_FOUND', message: 'Archivo no encontrado para este producto' });
        }

        // 2. VENTANA DE GRACIA ANTI-DOBLE CLIC (Debounce de 45 segundos)
        const now = Date.now();
        const recentLog = (order.download_logs || []).find(log => 
            log.productId === productId && 
            log.fileId === targetFile.file_id && 
            (now - new Date(log.timestamp).getTime()) < 45000 &&
            log.ip === clientIp
        );

        let didDeductCredit = false;
        if (!recentLog) {
            item.credits_remaining = Math.max(0, item.credits_remaining - 1);
            didDeductCredit = true;
        }

        // Registrar log de auditoría
        if (!order.download_logs) order.download_logs = [];
        order.download_logs.push({
            timestamp: new Date().toISOString(),
            productId,
            fileId: targetFile.file_id,
            ip: clientIp,
            userAgent,
            creditsAfter: item.credits_remaining,
            deducted: didDeductCredit
        });

        // 3. GENERAR URL FIRMADA CON CLOUDFLARE R2 V4 (bucket2026) CON EXPIRACIÓN DE 10 MINUTOS
        let signedUrl = null;
        try {
            const { client, bucket } = getClientAndBucket('v4');
            if (!client) throw new Error('Cliente R2 V4 no disponible');

            const command = new GetObjectCommand({
                Bucket: bucket,
                Key: targetFile.bucket_key,
                ResponseContentDisposition: `attachment; filename="${targetFile.download_name}"`
            });

            signedUrl = await getSignedUrl(client, command, { expiresIn: 600 }); // 10 minutos
        } catch (r2Error) {
            console.error('[WillieDelivery] Error generando URL firmada en R2 Bucket 4:', r2Error.message);
            // Si el archivo no está aún en el bucket remoto pero existe localmente, se indica
            return res.status(500).json({
                error: 'STORAGE_UNAVAILABLE',
                message: 'Error al generar enlace seguro de descarga. Intenta nuevamente o contacta a soporte.'
            });
        }

        // Guardar estado actualizado de créditos
        deliveries[token] = order;
        writeDeliveries(deliveries);

        // Actualizar en Supabase si está disponible
        if (supabase) {
            try {
                await supabase
                    .from('willie_orders')
                    .update({ order_payload: order, updated_at: new Date().toISOString() })
                    .eq('delivery_token', token);
            } catch (e) {
                // Silencioso
            }
        }

        return res.status(200).json({
            ok: true,
            downloadUrl: signedUrl,
            creditsRemaining: item.credits_remaining,
            totalCredits: item.total_credits,
            deducted: didDeductCredit
        });

    } catch (err) {
        console.error('[WillieDelivery] Error en downloadPresetFile:', err);
        return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
};

/**
 * POST /api/willie/delivery/create-session
 * Crea un token de entrega tras un checkout exitoso (Yape, PayPal, Mercado Pago).
 */
export const createDeliverySession = async (req, res) => {
    try {
        const { email, items = [], paymentMethod = 'checkout', orderId = null } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'EMAIL_REQUIRED', message: 'El correo electrónico es obligatorio' });
        }

        const token = generateOrderToken();
        const deliveryItems = buildDeliveryItems(items);
        const resolvedOrderId = orderId || `ORD-WI-${Date.now()}`;

        const orderRecord = {
            token,
            order_id: resolvedOrderId,
            customer_email: email,
            payment_method: paymentMethod,
            created_at: new Date().toISOString(),
            status: 'completed',
            items: deliveryItems,
            download_logs: []
        };

        const deliveries = readDeliveries();
        deliveries[token] = orderRecord;
        writeDeliveries(deliveries);

        // Guardar en Supabase si la tabla existe
        if (supabase) {
            try {
                await supabase
                    .from('willie_orders')
                    .insert({
                        delivery_token: token,
                        order_id: resolvedOrderId,
                        customer_email: email,
                        order_payload: orderRecord
                    });
            } catch (sErr) {
                console.warn('[WillieDelivery] No se pudo guardar en tabla willie_orders de Supabase:', sErr.message);
            }
        }

        return res.status(200).json({
            ok: true,
            token,
            orderId: resolvedOrderId,
            portalUrl: `/willieinspired/descargas.html?token=${token}`
        });

    } catch (err) {
        console.error('[WillieDelivery] Error en createDeliverySession:', err);
        return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
};
