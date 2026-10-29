import crypto from 'crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getClientAndBucket } from '../../services/r2-storage.service.js';
import { supabase } from '../../database/connection.js';
import { isAdminKey } from '../../../shared/config/adminKey.js';
import { getProduct, deliverablesFor, loadCatalog } from '../../../shared/store/catalog.js';

// Las entregas viven en Supabase (willie_orders). En serverless cada request puede caer en otra instancia,
// así que la memoria solo sirve de caché dentro de la misma instancia, nunca como fuente de verdad.
const cache = new Map();
const CREDITS = 4;
const isDemoToken = (t) => t === 'demo' || t === 'DEMO-WILLIE' || String(t).startsWith('demo-');

function generateOrderToken() {
    return 'ord_wi_' + crypto.randomBytes(24).toString('hex');
}

function toDeliveryItem(product) {
    return {
        product_id: product.slug,
        catalog_id: product.id,
        name: product.title,
        artist: product.artist || 'Willie Inspired',
        format: product.format || 'FST',
        cover_url: product.media?.cover || '/willieimages/HERO.png',
        credits_remaining: CREDITS,
        total_credits: CREDITS,
        files: product.files.map((f, idx) => ({
            file_id: `${product.slug}-${f.type}-${idx}`,
            filename: f.filename,
            type: f.type,
            format: f.format,
            download_name: f.download_name,
            bucket_key: f.bucket_key,
            size_bytes: f.size_bytes
        }))
    };
}

/**
 * Ítems descargables de una compra: solo productos del catálogo con archivos reales (los packs se expanden).
 * Lo que no tiene archivo (entrega manual, servicios, plugins) no entra al portal: se avisa por correo.
 */
export function buildDeliveryItems(lines) {
    const seen = new Set();
    const items = [];
    for (const line of lines || []) {
        for (const product of deliverablesFor(line.id)) {
            if (seen.has(product.id)) continue;
            seen.add(product.id);
            items.push(toDeliveryItem(product));
        }
    }
    return items;
}

async function findOrder(token) {
    if (cache.has(token)) return cache.get(token);
    const { data, error } = await supabase
        .from('willie_orders').select('order_payload').eq('delivery_token', token).maybeSingle();
    if (error) console.warn('[WillieDelivery] Error leyendo willie_orders:', error.message);
    const order = data?.order_payload || null;
    if (order) cache.set(token, order);
    return order;
}

async function saveOrder(order) {
    cache.set(order.token, order);
    const { error } = await supabase
        .from('willie_orders')
        .update({ order_payload: order, updated_at: new Date().toISOString() })
        .eq('delivery_token', order.token);
    if (error) console.warn('[WillieDelivery] No se pudo actualizar willie_orders:', error.message);
}

const publicItems = (items) => items.map((item) => ({
    product_id: item.product_id,
    name: item.name,
    artist: item.artist,
    format: item.format,
    cover_url: item.cover_url,
    credits_remaining: item.credits_remaining,
    total_credits: item.total_credits,
    files: item.files.map((f) => ({
        file_id: f.file_id,
        filename: f.filename,
        type: f.type,
        format: f.format,
        download_name: f.download_name,
        size_bytes: f.size_bytes
    }))
}));

/**
 * Crea la sesión de descargas. Solo se llama desde el servidor tras un pago verificado (PayPal capture / Yape)
 * o desde el panel owner con clave. Devuelve null si la compra no tiene nada descargable.
 */
export async function createDeliverySessionRecord({ email, lines = [], paymentMethod = 'checkout', orderId = null }) {
    const items = buildDeliveryItems(lines);
    if (!items.length) return null;

    const token = generateOrderToken();
    const resolvedOrderId = orderId || `ORD-WI-${Date.now()}`;
    const order = {
        token,
        order_id: resolvedOrderId,
        customer_email: email,
        payment_method: paymentMethod,
        created_at: new Date().toISOString(),
        status: 'completed',
        items,
        download_logs: []
    };

    const { error } = await supabase.from('willie_orders').insert({
        delivery_token: token,
        order_id: resolvedOrderId,
        customer_email: email,
        order_payload: order
    });
    if (error) throw new Error(`No se pudo guardar la entrega: ${error.message}`);
    cache.set(token, order);

    return { token, orderId: resolvedOrderId, portalUrl: `/willieinspired/descargas.html?token=${token}` };
}

// ─── GET /api/willie/delivery/:token
export const getOrderDelivery = async (req, res) => {
    try {
        const { token } = req.params;
        if (!token) return res.status(400).json({ error: 'TOKEN_REQUIRED', message: 'Token de pedido requerido' });

        if (isDemoToken(token)) {
            const demo = ['preset-bad-bunny', 'preset-duki'].map(getProduct).filter((p) => p?.files?.length);
            return res.status(200).json({
                ok: true,
                order: {
                    token,
                    order_id: 'ORD-DEMO-2026',
                    customer_email: 'cliente.demo@willieinspired.com',
                    created_at: new Date().toISOString(),
                    status: 'completed',
                    demo: true,
                    items: publicItems(demo.map(toDeliveryItem))
                }
            });
        }

        const order = await findOrder(token);
        if (!order) {
            return res.status(404).json({
                error: 'ORDER_NOT_FOUND',
                message: 'No se encontró ninguna compra con este enlace. Por favor verifica tu correo o contacta a soporte.'
            });
        }

        return res.status(200).json({
            ok: true,
            order: {
                token: order.token,
                order_id: order.order_id,
                customer_email: order.customer_email,
                created_at: order.created_at,
                status: order.status,
                items: publicItems(order.items)
            }
        });
    } catch (err) {
        console.error('[WillieDelivery] Error en getOrderDelivery:', err);
        return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno' });
    }
};

// ─── POST /api/willie/delivery/:token/download
// Valida créditos, descuenta 1 y genera una URL firmada de 10 minutos en R2 (bucket2026).
export const downloadPresetFile = async (req, res) => {
    try {
        const { token } = req.params;
        const { productId, fileId } = req.body || {};
        if (!token || !productId) {
            return res.status(400).json({ error: 'BAD_REQUEST', message: 'Token y ID de producto requeridos' });
        }

        // La demo enseña el portal, pero nunca entrega archivos pagados.
        if (isDemoToken(token)) {
            return res.status(403).json({
                error: 'DEMO_MODE',
                message: 'Esto es una demo del portal de descargas. Compra el preset para descargarlo.'
            });
        }

        const order = await findOrder(token);
        if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado' });

        const item = order.items.find((i) => i.product_id === productId);
        if (!item) return res.status(404).json({ error: 'PRODUCT_NOT_IN_ORDER', message: 'Producto no encontrado en esta compra' });

        if (item.credits_remaining <= 0) {
            return res.status(403).json({
                error: 'CREDITS_EXHAUSTED',
                message: 'Has agotado el límite de 4 descargas de este producto. Si cambiaste de PC o formateaste, contáctanos por WhatsApp para reponer tus créditos.',
                creditsRemaining: 0
            });
        }

        const targetFile = (fileId && item.files.find((f) => f.file_id === fileId)) || item.files[0];
        if (!targetFile) return res.status(404).json({ error: 'FILE_NOT_FOUND', message: 'Archivo no encontrado para este producto' });

        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        // Ventana anti doble clic: el mismo archivo desde la misma IP en 45 s no gasta otro crédito.
        const recent = (order.download_logs || []).find((log) =>
            log.productId === productId && log.fileId === targetFile.file_id && log.ip === clientIp &&
            (now - new Date(log.timestamp).getTime()) < 45000);

        let signedUrl;
        try {
            const { client, bucket } = getClientAndBucket('v4');
            if (!client) throw new Error('Cliente R2 V4 no disponible');
            signedUrl = await getSignedUrl(client, new GetObjectCommand({
                Bucket: bucket,
                Key: targetFile.bucket_key,
                ResponseContentDisposition: `attachment; filename="${targetFile.download_name}"`
            }), { expiresIn: 600 });
        } catch (r2Error) {
            console.error('[WillieDelivery] Error generando URL firmada en R2 Bucket 4:', r2Error.message);
            return res.status(500).json({
                error: 'STORAGE_UNAVAILABLE',
                message: 'Error al generar enlace seguro de descarga. Intenta nuevamente o contacta a soporte.'
            });
        }

        // El crédito se descuenta solo cuando el enlace se generó bien.
        if (!recent) item.credits_remaining = Math.max(0, item.credits_remaining - 1);
        order.download_logs = [...(order.download_logs || []), {
            timestamp: new Date().toISOString(),
            productId,
            fileId: targetFile.file_id,
            ip: clientIp,
            userAgent: req.headers['user-agent'] || 'unknown',
            creditsAfter: item.credits_remaining,
            deducted: !recent
        }];
        await saveOrder(order);

        return res.status(200).json({
            ok: true,
            downloadUrl: signedUrl,
            creditsRemaining: item.credits_remaining,
            totalCredits: item.total_credits,
            deducted: !recent
        });
    } catch (err) {
        console.error('[WillieDelivery] Error en downloadPresetFile:', err);
        return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno' });
    }
};

// ─── POST /api/willie/delivery/create-session (solo owner, header x-admin-key)
// Para ventas por WhatsApp: el pago ya se verificó a mano. Antes era público y cualquiera podía crearse descargas.
export const createDeliverySession = async (req, res) => {
    try {
        if (!isAdminKey(req.headers['x-admin-key'])) return res.status(403).json({ error: 'UNAUTHORIZED' });
        const { email, items = [], paymentMethod = 'manual', orderId = null } = req.body || {};
        if (!email) return res.status(400).json({ error: 'EMAIL_REQUIRED', message: 'El correo electrónico es obligatorio' });

        const lines = items.map((i) => getProduct(i.id || i)).filter(Boolean).map((p) => ({ id: p.id }));
        const session = await createDeliverySessionRecord({ email, lines, paymentMethod, orderId });
        if (!session) return res.status(400).json({ error: 'NOTHING_TO_DELIVER', message: 'Ningún producto con archivos descargables' });
        return res.status(200).json({ ok: true, ...session });
    } catch (err) {
        console.error('[WillieDelivery] Error en createDeliverySession:', err);
        return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno' });
    }
};

loadCatalog();
