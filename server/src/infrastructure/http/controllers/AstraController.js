// ─── ORB · Astra en la nube (planes Pro / Max) ───────────────────────────────────────────────────────────────────
// Orb (pago único) trae Astra local, gratis e ilimitada, en el PC del usuario. Pro y Max son suscripciones que dan
// acceso a un modelo más grande en la nube, con un cupo mensual de pedidos. Este controlador:
//   1. valida la licencia de Orb y el equipo (igual que /api/plugin/validate),
//   2. averigua el plan: suscripción orb_max_* / orb_pro_* activa del dueño de la licencia, o la prueba de 3 días,
//   3. descuenta el pedido en Supabase de forma atómica (función consume_astra_quota),
//   4. llama al modelo con la clave del proveedor, que nunca sale del servidor, y anota los tokens reales.
// El plugin nunca habla con Supabase ni con el proveedor directamente.
//
// Variables de entorno:
//   ORB_LLM_BASE_URL   API compatible con OpenAI (def. https://openrouter.ai/api/v1)
//   ORB_LLM_API_KEY    clave del proveedor (obligatoria para atender pedidos)
//   ORB_PRO_MODEL / ORB_MAX_MODEL / ORB_TRIAL_MODEL   modelos por plan
//   ORB_PRO_REQUESTS / ORB_MAX_REQUESTS (por mes) · ORB_TRIAL_REQUESTS (total durante la prueba)
import rateLimit from 'express-rate-limit';
import { supabase } from '../../database/connection.js';
import { extractSerial, findPluginBySerial } from '../../../shared/config/pluginRegistry.js';
import { isAdminKey } from '../../../shared/config/adminKey.js';
import { askModel } from '../../../shared/astra/orbAstra.js';

const envInt = (name, def) => { const n = parseInt(process.env[name] || '', 10); return Number.isFinite(n) && n >= 0 ? n : def; };

export function orbTiers() {
    const base = process.env.ORB_LLM_BASE_URL || 'https://openrouter.ai/api/v1';
    return {
        trial: { label: 'Prueba', limit: envInt('ORB_TRIAL_REQUESTS', 30), model: process.env.ORB_TRIAL_MODEL || process.env.ORB_PRO_MODEL || 'qwen/qwen3-14b', baseUrl: base },
        pro:   { label: 'Pro',    limit: envInt('ORB_PRO_REQUESTS', 1000), model: process.env.ORB_PRO_MODEL || 'qwen/qwen3-14b', baseUrl: base },
        max:   { label: 'Max',    limit: envInt('ORB_MAX_REQUESTS', 3000), model: process.env.ORB_MAX_MODEL || 'qwen/qwen3-30b-a3b', baseUrl: base },
    };
}

export const astraLimiter = rateLimit({
    windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
    message: { ok: false, code: 'rate_limited', error: 'Demasiados pedidos seguidos. Espera un momento.' },
});

const deviceIdOf = (hwid) => { const s = String(hwid || ''); const i = s.lastIndexOf('_'); return (i >= 0 ? s.slice(i + 1) : s).trim(); };
function sameDevice(stored, hwid) {
    if (!stored || !hwid) return false;
    if (stored === hwid) return true;
    const a = deviceIdOf(stored), b = deviceIdOf(hwid);
    return a.length >= 8 && a === b;
}

const monthPeriod = (d = new Date()) => d.toISOString().slice(0, 7);   // 'YYYY-MM' (UTC)
const nextMonthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();

// Plan de Orb del dueño de una licencia (las suscripciones van por usuario, no por equipo)
async function orbPlanOf(license) {
    if (license.user_id) {
        const { data: subs } = await supabase.from('subscriptions').select('plan_id, status, current_period_end').eq('user_id', license.user_id);
        const now = Date.now();
        const live = (subs || []).filter((s) => ['active', 'canceled', 'trialing'].includes(s.status) && s.current_period_end && new Date(s.current_period_end).getTime() > now);
        const pick = (prefix) => live.filter((s) => String(s.plan_id || '').startsWith(prefix)).sort((a, b) => new Date(b.current_period_end) - new Date(a.current_period_end))[0];
        const max = pick('orb_max'), pro = pick('orb_pro');
        if (max) return { tier: 'max', until: max.current_period_end };
        if (pro) return { tier: 'pro', until: pro.current_period_end };
    }
    if (license.license_type === 'trial') return { tier: 'trial', until: license.expires_at || null };
    return { tier: 'local', until: null };
}

// Licencia de Orb válida para este equipo → { license, tier, cfg, period }  ·  o  { status, body } con el error
export async function resolveOrbAccess(body) {
    const rawSerial = String(body?.serial_key || '').trim();
    const hwid = String(body?.hwid || '');
    if (!rawSerial || !hwid) return { status: 400, body: { ok: false, code: 'bad_request', error: 'Faltan datos.' } };
    const serial_key = extractSerial(rawSerial);
    if (findPluginBySerial(serial_key)?.id !== 'orb') return { status: 403, body: { ok: false, code: 'wrong_product', error: 'Esta clave no es de Orb.' } };

    const { data: license } = await supabase.from('plugin_licenses').select('*').eq('serial_key', serial_key).maybeSingle();
    if (!license) return { status: 404, body: { ok: false, code: 'not_found', error: 'Licencia no encontrada.' } };
    if (['suspended', 'revoked', 'banned'].includes(license.status)) return { status: 403, body: { ok: false, code: 'revoked', error: 'Licencia suspendida o revocada.' } };
    if (license.expires_at && new Date(license.expires_at) < new Date()) return { status: 403, body: { ok: false, code: 'expired', error: 'Licencia expirada.' } };

    const { data: activations } = await supabase.from('plugin_activations').select('*').eq('license_id', license.id);
    if (!(activations || []).some((a) => sameDevice(a.hwid, hwid))) {
        return { status: 403, body: { ok: false, code: 'device_not_registered', error: 'Este equipo no está registrado para esta licencia.' } };
    }

    const plan = await orbPlanOf(license);
    const cfg = orbTiers()[plan.tier] || null;
    const period = plan.tier === 'trial' ? 'trial' : monthPeriod();
    return { license, tier: plan.tier, until: plan.until, cfg, period };
}

async function usedRequests(licenseId, period) {
    const { data } = await supabase.from('astra_usage').select('requests').eq('license_id', licenseId).eq('period', period).maybeSingle();
    return data?.requests || 0;
}

function statusBody(acc, used) {
    const limit = acc.cfg ? acc.cfg.limit : 0;
    return {
        ok: true,
        tier: acc.tier,                                   // local | trial | pro | max
        label: acc.cfg ? acc.cfg.label : 'Local',
        limit,
        remaining: Math.max(0, limit - used),
        period: acc.cfg ? acc.period : null,
        renews_at: acc.tier === 'pro' || acc.tier === 'max' ? nextMonthStart() : null,
        plan_until: acc.until,
    };
}

// ─── POST /api/plugin/astra/status ─ plan y pedidos restantes ────────────────────────────────────────────────────
export const astraStatus = async (req, res) => {
    try {
        const acc = await resolveOrbAccess(req.body);
        if (acc.status) return res.status(acc.status).json(acc.body);
        const used = acc.cfg ? await usedRequests(acc.license.id, acc.period) : 0;
        return res.json(statusBody(acc, used));
    } catch (e) {
        console.error('💥 [API /astra/status]', e);
        return res.status(500).json({ ok: false, code: 'server_error', error: 'Error interno del servidor.' });
    }
};

// ─── POST /api/plugin/astra ─ un pedido a Astra en la nube ───────────────────────────────────────────────────────
// Body: { serial_key, hwid, text, current?: {name, fam, patch}, history?: [{role, text}] }
export const astraAsk = async (req, res) => {
    let consumed = null;
    try {
        const text = String(req.body?.text || '').trim();
        if (!text) return res.status(400).json({ ok: false, code: 'bad_request', error: 'Falta el pedido.' });
        if (text.length > 600) return res.status(400).json({ ok: false, code: 'too_long', error: 'El pedido es demasiado largo.' });

        const acc = await resolveOrbAccess(req.body);
        if (acc.status) return res.status(acc.status).json(acc.body);
        if (!acc.cfg) return res.status(402).json({ ok: false, code: 'no_plan', tier: 'local', error: 'Astra en la nube es parte de Orb Pro y Orb Max.' });

        const apiKey = process.env.ORB_LLM_API_KEY;
        if (!apiKey) return res.status(503).json({ ok: false, code: 'not_configured', error: 'Astra en la nube no está disponible ahora.' });

        const { data: left, error: rpcError } = await supabase.rpc('consume_astra_quota', { p_license: acc.license.id, p_period: acc.period, p_limit: acc.cfg.limit });
        if (rpcError) throw rpcError;
        if (left === null || left === undefined) {
            return res.status(429).json({ ...statusBody(acc, acc.cfg.limit), ok: false, code: 'quota_exhausted',
                error: acc.tier === 'trial' ? 'Se acabaron los pedidos de prueba de Astra en la nube.' : `Usaste los ${acc.cfg.limit} pedidos de este mes.` });
        }
        consumed = { license: acc.license.id, period: acc.period };

        const { out, usage } = await askModel(req.body, { model: acc.cfg.model, baseUrl: acc.cfg.baseUrl, apiKey });
        await supabase.rpc('record_astra_tokens', { p_license: acc.license.id, p_period: acc.period, p_in: usage.in, p_out: usage.out });
        consumed = null;
        return res.json({ ...out, ...statusBody(acc, acc.cfg.limit - left), ok: true });
    } catch (e) {
        console.error('💥 [API /astra]', e?.status || '', e?.message || e);
        if (consumed) await supabase.rpc('refund_astra_quota', { p_license: consumed.license, p_period: consumed.period }).then(() => {}, () => {});
        return res.status(502).json({ ok: false, code: 'model_error', error: 'Astra en la nube no respondió. Inténtalo de nuevo.' });
    }
};

// ─── POST /api/plugin/admin/orb-tier ─ dar o quitar Pro/Max a mano (ventas manuales, pruebas) ──────────────────
// Body: { admin_key, serial_key, tier: 'pro' | 'max' | 'none', days?: 30 }
export const adminSetOrbTier = async (req, res) => {
    try {
        if (!isAdminKey(req.body?.admin_key || req.headers['x-admin-key'])) return res.status(403).json({ error: 'Unauthorized' });
        const tier = String(req.body?.tier || '');
        if (!['pro', 'max', 'none'].includes(tier)) return res.status(400).json({ error: "tier debe ser 'pro', 'max' o 'none'." });
        const serial_key = extractSerial(req.body?.serial_key);
        const { data: license } = await supabase.from('plugin_licenses').select('id, user_id, serial_key').eq('serial_key', serial_key).maybeSingle();
        if (!license) return res.status(404).json({ error: 'Licencia no encontrada.' });
        if (!license.user_id) return res.status(400).json({ error: 'La licencia no está asociada a un usuario: los planes van por cuenta.' });

        // Un solo plan de Orb vivo por usuario: se cierran los anteriores
        const { data: subs } = await supabase.from('subscriptions').select('id, plan_id, status').eq('user_id', license.user_id);
        for (const s of (subs || []).filter((x) => String(x.plan_id || '').startsWith('orb_') && x.status !== 'expired')) {
            await supabase.from('subscriptions').update({ status: 'expired' }).eq('id', s.id);
        }
        if (tier === 'none') return res.json({ success: true, tier: 'none' });

        const days = Math.min(Math.max(parseInt(req.body?.days, 10) || 30, 1), 3660);
        const until = new Date(Date.now() + days * 86400000).toISOString();
        const { error } = await supabase.from('subscriptions').insert({
            user_id: license.user_id, plan_id: `orb_${tier}_manual`, status: 'active',
            provider: 'manual', provider_subscription_id: `manual-orb-${license.id}-${Date.now()}`, current_period_end: until,
        });
        if (error) throw error;
        return res.json({ success: true, tier, until });
    } catch (e) {
        console.error('💥 [API /admin/orb-tier]', e);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};
