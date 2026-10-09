import rateLimit from 'express-rate-limit';
import { supabase } from '../../database/connection.js';
import { isAdminKey } from '../../../shared/config/adminKey.js';

export const paymentClickLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes.' }
});

const clip = (v, n) => String(v ?? '').slice(0, n);
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
const KNOWN_PRICES_USD = new Set([17, 25]);

// ─── POST /api/plugin/payment-click ───────────────────────────────────────────
// Registra el precio que vio el cliente al tocar un metodo de pago manual.
// Body: { ref, product, method, price_usd, price_pen, variant, page }
export const receivePaymentClick = async (req, res) => {
    try {
        const b = req.body || {};
        const ref = clip(b.ref, 12).toUpperCase();
        if (!/^[A-Z0-9]{4,12}$/.test(ref)) return res.status(400).json({ error: 'ref invalido' });

        const priceUsd = num(b.price_usd);
        const row = {
            ref,
            product: clip(b.product, 80),
            method: clip(b.method, 30),
            price_usd: priceUsd && KNOWN_PRICES_USD.has(priceUsd) ? priceUsd : null,
            price_pen: num(b.price_pen),
            variant: clip(b.variant, 30),
            page: clip(b.page, 120),
            email: null
        };

        // Si el cliente tiene sesion iniciada, el email se obtiene del token verificado (no del body).
        const token = (req.headers.authorization || '').split(' ')[1];
        if (token && token !== 'undefined' && token !== 'null') {
            try {
                const { data } = await supabase.auth.getUser(token);
                row.email = data?.user?.email || null;
            } catch (_) { /* clic anonimo */ }
        }

        const { error } = await supabase.from('manual_payment_clicks').insert(row);
        if (error) console.warn('[PaymentClick] insert error (¿tabla creada?):', error.message);
        return res.json({ ok: true });
    } catch (err) {
        console.error('[PaymentClick] error:', err);
        return res.json({ ok: true });
    }
};

// ─── GET /api/plugin/admin/payment-clicks?admin_key=...&ref=...&limit=100 ─────
export const adminListPaymentClicks = async (req, res) => {
    const key = req.query.admin_key || req.query.pin || req.headers['x-admin-key'];
    if (!isAdminKey(key)) return res.status(403).json({ error: 'Unauthorized' });

    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    let query = supabase
        .from('manual_payment_clicks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    const ref = clip(req.query.ref, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (ref) query = query.ilike('ref', `%${ref}%`);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ count: data.length, clicks: data });
};
