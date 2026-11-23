// Prueba aislada de checkout con Polar (no toca carrito, PayPal ni Yape).
// Variables de entorno (Vercel):
//   POLAR_ACCESS_TOKEN  (obligatoria)  token de Polar
//   POLAR_PRODUCT_ID    (obligatoria)  id del producto de prueba (STAR CHAIN)
//   POLAR_SERVER        (opcional)     "sandbox" para usar sandbox-api.polar.sh
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

const router = Router();
const limiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Demasiados intentos. Prueba en unos minutos.' } });

const apiBase = () => (process.env.POLAR_SERVER === 'sandbox' ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh');

router.get('/polar-test/config', limiter, (req, res) => {
    res.json({ ready: Boolean(process.env.POLAR_ACCESS_TOKEN && process.env.POLAR_PRODUCT_ID), sandbox: process.env.POLAR_SERVER === 'sandbox' });
});

router.post('/polar-test/checkout', limiter, async (req, res) => {
    const token = process.env.POLAR_ACCESS_TOKEN;
    const productId = process.env.POLAR_PRODUCT_ID; // el navegador NO elige el producto
    if (!token || !productId) return res.status(503).json({ error: 'Polar no está configurado en el servidor.' });

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
                metadata: { source: 'polar-test', product: 'star-chain' }
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
