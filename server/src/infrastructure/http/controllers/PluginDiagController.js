import rateLimit from 'express-rate-limit';
import { supabase } from '../../database/connection.js';
import { isAdminKey } from '../../../shared/config/adminKey.js';

// Limite estricto: un plugin legitimo manda pocos reportes.
export const diagLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiados reportes. Intenta mas tarde.' }
});

const clip = (v, n) => String(v ?? '').slice(0, n);

// ─── POST /api/plugin/diag ────────────────────────────────────────────────────
// Recibe diagnosticos enviados por el plugin (con consentimiento del usuario).
export const receiveDiag = async (req, res) => {
    try {
        const b = req.body || {};
        const row = {
            plugin:     clip(b.plugin || 'unknown', 60),
            version:    clip(b.version, 30),
            os:         clip(b.os, 120),
            host:       clip(b.host, 120),
            format:     clip(b.format, 20),
            sample_rate: Number(b.sampleRate) || null,
            block_size:  Number(b.blockSize) || null,
            channels:    clip(b.channels, 40),
            hwid:        clip(b.hwid, 200),
            message:     clip(b.message, 500),
            log:         clip(b.log, 60000)
        };

        console.log('[PluginDiag]', JSON.stringify({ ...row, log: row.log.slice(0, 2000) }));

        const { error } = await supabase.from('plugin_diagnostics').insert(row);
        if (error) console.warn('[PluginDiag] insert error (¿tabla creada?):', error.message);

        // Siempre 200: el plugin no debe reintentar en bucle
        return res.json({ ok: true });
    } catch (e) {
        console.error('[PluginDiag] error', e);
        return res.json({ ok: true });
    }
};

// ─── GET /api/plugin/admin/diag?admin_key=...&limit=50 ───────────────────────
export const adminListDiag = async (req, res) => {
    const key = req.query.admin_key || req.query.pin || req.headers['x-admin-key'];
    if (!isAdminKey(key)) return res.status(403).json({ error: 'Unauthorized' });

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const { data, error } = await supabase
        .from('plugin_diagnostics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ count: data.length, reports: data });
};
