import rateLimit from 'express-rate-limit';
import { supabase } from '../../database/connection.js';
import { isAdminKey } from '../../../shared/config/adminKey.js';

// Conversaciones del chat de STAR CHAIN (solo texto, con el aviso y el interruptor del plugin).
// Sirven para ver qué pidió la gente, qué respondió STAR y qué cambió, y afinar las reglas.
export const chatLogLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiados envíos. Intenta más tarde.' }
});

const clip = (v, n) => String(v ?? '').slice(0, n);
const MAX_ITEMS = 50;

// ─── POST /api/plugin/chatlog ─────────────────────────────────────────────────
// Body: { plugin, version, hwid, license, items: [{ t, usuario, ruta, respuesta, acciones }] }
export const receiveChatLog = async (req, res) => {
    try {
        const b = req.body || {};
        const items = Array.isArray(b.items) ? b.items.slice(0, MAX_ITEMS) : [];
        const hwid = clip(b.hwid, 200);
        if (!hwid || items.length === 0) return res.json({ ok: true, saved: 0 });

        const rows = items.filter((i) => i && typeof i === 'object' && String(i.usuario ?? '').trim()).map((i) => {
            const t = new Date(i.t);
            return {
                plugin:    clip(b.plugin || 'STAR CHAIN', 60),
                version:   clip(b.version, 30),
                hwid,
                license:   clip(b.license, 20),
                said_at:   Number.isNaN(t.getTime()) ? null : t.toISOString(),
                usuario:   clip(i.usuario, 500),
                ruta:      clip(i.ruta, 30),
                respuesta: clip(i.respuesta, 600),
                acciones:  Array.isArray(i.acciones) ? i.acciones.slice(0, 12) : []
            };
        });
        if (rows.length === 0) return res.json({ ok: true, saved: 0 });

        const { error } = await supabase.from('plugin_chat_logs').insert(rows);
        if (error) {
            console.warn('[PluginChatLog] insert error (¿tabla creada?):', error.message);
            return res.json({ ok: false, saved: 0 });     // el plugin conserva sus líneas y reintenta luego
        }
        return res.json({ ok: true, saved: rows.length });
    } catch (e) {
        console.error('[PluginChatLog] error', e);
        return res.json({ ok: false, saved: 0 });
    }
};

// ─── GET /api/plugin/admin/chatlog?admin_key=...&limit=200&hwid=...&ruta=...&q=... ──
export const adminListChatLog = async (req, res) => {
    const key = req.query.admin_key || req.query.pin || req.headers['x-admin-key'];
    if (!isAdminKey(key)) return res.status(403).json({ error: 'Unauthorized' });

    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    let q = supabase.from('plugin_chat_logs').select('*').order('created_at', { ascending: false }).limit(limit);
    if (req.query.hwid) q = q.eq('hwid', String(req.query.hwid));
    if (req.query.ruta) q = q.eq('ruta', String(req.query.ruta));
    if (req.query.q) q = q.ilike('usuario', `%${String(req.query.q).replace(/[%_]/g, ' ').slice(0, 80)}%`);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ count: data.length, logs: data });
};
