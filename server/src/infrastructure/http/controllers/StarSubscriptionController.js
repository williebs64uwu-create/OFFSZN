// ─── STAR CHAIN en cuotas: endpoints del checkout y del CRM ──────────────────────────────────────────────────────
import { getStarPlanId, createStarPlan, confirmStarSubscription } from '../../services/starSubscriptionService.js';
import { STAR_INSTALLMENTS, STAR_INSTALLMENT_USD, STAR_PRICE_USD } from '../../../shared/store/starPlan.js';

// GET /api/orders/star/config → el checkout decide si ofrece las cuotas (solo si el plan ya existe)
export const getStarConfig = async (req, res) => {
    try {
        return res.json({ planId: await getStarPlanId(), installments: STAR_INSTALLMENTS, installmentUsd: STAR_INSTALLMENT_USD, totalUsd: STAR_PRICE_USD });
    } catch (e) {
        return res.status(500).json({ error: 'No se pudo leer la configuración.' });
    }
};

// POST /api/orders/star/subscribe { subscriptionID, email }
export const subscribeStar = async (req, res) => {
    try {
        const subscriptionId = String(req.body?.subscriptionID || '').trim();
        if (!/^I-[A-Z0-9]{6,40}$/i.test(subscriptionId)) return res.status(400).json({ error: 'Falta el ID de la suscripción.' });
        const result = await confirmStarSubscription({ subscriptionId, email: String(req.body?.email || '').trim(), userId: req.user?.userId || null });
        return res.json(result);
    } catch (e) {
        console.error('[STAR subscribe]', e);
        return res.status(e.status || 500).json({ error: e.status ? e.message : 'No se pudo confirmar la suscripción. Si PayPal te cobró, escríbele a Willie por WhatsApp.' });
    }
};

// POST /api/store/admin/star-plan (clave del panel) → crea el producto y el plan en PayPal una sola vez
export const createPlanAdmin = async (req, res) => {
    try { return res.json({ ok: true, ...(await createStarPlan()) }); }
    catch (e) { return res.status(500).json({ error: e.message || 'No se pudo crear el plan.' }); }
};

// GET /api/store/admin/star-plan → ¿ya existe el plan?
export const starPlanStatus = async (req, res) => {
    try { return res.json({ planId: await getStarPlanId() }); }
    catch (e) { return res.status(500).json({ error: e.message }); }
};
