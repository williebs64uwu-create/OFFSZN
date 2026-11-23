// Prueba aislada de checkout con Polar (no toca carrito, PayPal ni Yape).
// Variables de entorno (Vercel):
//   POLAR_ACCESS_TOKEN  (obligatoria)  token de Polar
//   POLAR_SERVER        (opcional)     "sandbox" para usar sandbox-api.polar.sh
// Los productos viven en shared/store/polarCatalog.js (sus IDs no son secretos).
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { POLAR_CATALOG, polarProduct } from '../../../shared/store/polarCatalog.js';

const router = Router();
const limiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Demasiados intentos. Prueba en unos minutos.' } });

const apiBase = () => (process.env.POLAR_SERVER === 'sandbox' ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh');

router.get('/polar-test/config', limiter, (req, res) => {
    const products = Object.entries(POLAR_CATALOG).map(([slug, p]) => ({ slug, name: p.name, priceUsd: p.priceUsd, note: p.note || '' }));
    res.json({ ready: Boolean(process.env.POLAR_ACCESS_TOKEN), sandbox: process.env.POLAR_SERVER === 'sandbox', products });
});

router.post('/polar-test/checkout', limiter, async (req, res) => {
    const token = process.env.POLAR_ACCESS_TOKEN;
    if (!token) return res.status(503).json({ error: 'Polar no está configurado en el servidor.' });
    // El navegador solo manda el slug; el ID real sale del catálogo, nunca del cliente.
    const item = polarProduct(String(req.body?.product || ''));
    if (!item) return res.status(400).json({ error: 'Producto no válido.' });
    const productId = item.productId;

    const email = typeof req.body?.email === 'string' && /^\S+@\S+\.\S+$/.test(req.body.email) ? req.body.email.trim() : undefined;
    const origin = process.env.SITE_URL || `https://${req.get('host')}`;
    try {
        const r = await fetch(`${apiBase()}/v1/checkouts/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                products: [productId],
                success_url: `${origin}/polar-test?status=success&checkout_id={CHECKOUT_ID}`,
                customer_email: email,
                metadata: { source: 'polar-test', product: String(req.body.product) }
            })
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.url) {
            console.error('[polar-test] Polar respondió', r.status, JSON.stringify(data).slice(0, 300));
            return res.status(502).json({ error: 'Polar rechazó la creación del checkout.' });
        }
        res.json({ url: data.url });
    } catch (e) {
        console.error('[polar-test] error', e.message);
        res.status(500).json({ error: 'No se pudo crear el checkout.' });
    }
});

export default router;
