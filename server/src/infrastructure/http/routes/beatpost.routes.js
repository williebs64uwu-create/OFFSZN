// Beat Post (agente de escritorio): cobro (pago único y 2 cuotas), activación de PRO por 1 año,
// interés en funciones bloqueadas y herramientas del owner.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../../database/connection.js';
import { isAdminKey } from '../../../shared/config/adminKey.js';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { optionalAuthenticateTokenMiddleware } from '../../middlewares/optionalAuthenticateTokenMiddleware.js';
import {
    BEATPOST_PUBLIC_CONFIG, createOrder, captureOrder, confirmSubscription, claimPendingGrants, grantPro, createPlan, reconcile
} from '../../services/beatpostService.js';

const router = Router();
const FEATURES = new Set(['aplicar_orden', 'escanear_ilimitado', 'preparar_beat', 'armar_kit', 'subir', 'whatsapp']);
const PLANS = new Set(['free', 'starter', 'pro']);

const limiter = (limit, minutes = 10) => rateLimit({ windowMs: minutes * 60 * 1000, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Demasiados intentos. Prueba en unos minutos.' } });
const payLimiter = limiter(30);
const interestLimiter = limiter(60, 60);
const isOwner = (req) => isAdminKey(req.headers['x-admin-key'] || req.body?.admin_key);
const owner = (req, res, next) => (isOwner(req) ? next() : res.status(403).json({ error: 'Unauthorized' }));
const cronAuth = (req, res, next) => {
    const secret = process.env.STORE_CRON_SECRET || process.env.CRON_SECRET;
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return (secret && bearer === secret) || isOwner(req) ? next() : res.status(401).json({ error: 'Unauthorized' });
};
const sendError = (res, err, fallback) => {
    if (!err.status) console.error('[BeatPost]', err);
    return res.status(err.status || 500).json({ error: err.status ? err.message : fallback });
};
const PAID_HELP = 'No se pudo confirmar. Si PayPal te cobró, escríbele a Willie por WhatsApp y lo activa a mano.';

// ─── Checkout ─────────────────────────────────────────────────────────────────────────────────────────────────
// GET /api/beatpost/config → precios y si las cuotas ya están habilitadas (planId).
router.get('/config', payLimiter, async (req, res) => {
    try { res.setHeader('Cache-Control', 'no-store'); return res.json(await BEATPOST_PUBLIC_CONFIG()); }
    catch (err) { return sendError(res, err, 'No se pudo leer la configuración.'); }
});

// POST /api/beatpost/order → crea el pedido de PayPal (el precio lo pone el servidor).
router.post('/order', payLimiter, async (req, res) => {
    try { return res.json(await createOrder()); }
    catch (err) { return sendError(res, err, 'No se pudo crear el pedido de PayPal.'); }
});

// POST /api/beatpost/capture { orderID, email } → cobra y activa PRO 12 meses.
router.post('/capture', payLimiter, optionalAuthenticateTokenMiddleware, async (req, res) => {
    try { return res.json(await captureOrder({ orderId: String(req.body?.orderID || '').trim(), email: req.body?.email, userId: req.user?.userId || null })); }
    catch (err) { return sendError(res, err, PAID_HELP); }
});

// POST /api/beatpost/subscribe { subscriptionID, email } → confirma la cuota 1.
router.post('/subscribe', payLimiter, optionalAuthenticateTokenMiddleware, async (req, res) => {
    try {
        const subscriptionId = String(req.body?.subscriptionID || '').trim();
        if (!/^I-[A-Z0-9]{6,40}$/i.test(subscriptionId)) return res.status(400).json({ error: 'Falta el ID de la suscripción.' });
        return res.json(await confirmSubscription({ subscriptionId, email: String(req.body?.email || '').trim(), userId: req.user?.userId || null }));
    } catch (err) { return sendError(res, err, PAID_HELP); }
});

// POST /api/beatpost/claim (sesión) → la app lo llama al iniciar sesión: aplica compras hechas antes de tener cuenta.
router.post('/claim', limiter(30), authenticateTokenMiddleware, async (req, res) => {
    try { return res.json(await claimPendingGrants({ userId: req.user?.userId, email: req.user?.email })); }
    catch (err) { return sendError(res, err, 'No se pudo revisar tu compra.'); }
});

// ─── Interés (anónimo): solo función, plan y versión ──────────────────────────────────────────────────────────
router.post('/interest', interestLimiter, async (req, res) => {
    try {
        const feature = String(req.body?.feature || '');
        const plan = String(req.body?.plan || 'free');
        const version = String(req.body?.version || '').slice(0, 16);
        if (!FEATURES.has(feature) || !PLANS.has(plan)) return res.status(400).json({ error: 'Datos inválidos.' });
        await supabase.from('beatpost_interest').insert({ feature, plan, version });
        return res.status(204).end();
    } catch (err) {
        console.error('[BeatPost] interest:', err.message);
        return res.status(204).end(); // medir nunca debe molestar al cliente
    }
});

// ─── Owner (clave del panel) ──────────────────────────────────────────────────────────────────────────────────
router.get('/admin/interest', owner, async (req, res) => {
    const { data, error } = await supabase.from('beatpost_interest').select('feature, plan, created_at')
        .order('created_at', { ascending: false }).limit(5000);
    if (error) return res.status(500).json({ error: 'Error interno.' });
    const totals = {};
    for (const r of data || []) totals[r.feature] = (totals[r.feature] || 0) + 1;
    return res.json({ total: (data || []).length, por_funcion: totals });
});

// POST /api/beatpost/admin/grant { email, months = 12, note } → PRO a mano (pago por Yape, Binance, regalo...).
// Si el correo aún no tiene cuenta queda pendiente y se aplica cuando inicie sesión en Beat Post.
router.post('/admin/grant', owner, async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const months = Math.min(Math.max(parseInt(req.body?.months, 10) || 12, 1), 36);
        if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return res.status(400).json({ error: 'Falta un correo válido.' });
        const ref = `manual:${email}:${Date.now()}`;
        const r = await grantPro({ email, months, source: 'manual', ref, note: String(req.body?.note || '').slice(0, 200) || null });
        return res.json({ success: true, email: r.email, plan: 'pro', hasta: r.until, aplicado: r.applied, pendiente: !r.applied });
    } catch (err) { return sendError(res, err, 'Error interno del servidor.'); }
});

// POST /api/beatpost/admin/plan → crea una sola vez el producto y el plan de 2 cuotas en PayPal.
router.post('/admin/plan', owner, async (req, res) => {
    try { return res.json({ ok: true, ...(await createPlan()) }); }
    catch (err) { return sendError(res, err, 'No se pudo crear el plan.'); }
});

// GET/POST /api/beatpost/cron/reconcile (Bearer STORE_CRON_SECRET) → registra cuotas que PayPal cobró y faltan.
router.all('/cron/reconcile', cronAuth, async (req, res) => {
    try { return res.json({ ok: true, ...(await reconcile()) }); }
    catch (err) { console.error('[BeatPost reconcile]', err); return res.status(500).json({ ok: false, error: err.message }); }
});

export default router;
