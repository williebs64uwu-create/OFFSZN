import { supabase } from '../../database/connection.js';
import { isAdminKey } from '../../../shared/config/adminKey.js';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';

const LIST = 'fast-mix-beta';
const WA_GROUP = 'https://chat.whatsapp.com/EvH7uNHj5gWGrKu9mvg51g?s=cl&p=a&mlu=4&ilr=4';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clip = (v, n) => String(v ?? '').slice(0, n).trim();

const countryOf = (req) => {
    const c = String(req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || '').toUpperCase();
    return /^[A-Z]{2}$/.test(c) && c !== 'XX' ? c : null;
};

const confirmationHtml = () => `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:24px;background:#ffffff;color:#1d1d1f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:16px;line-height:1.55">
<div style="max-width:480px;margin:0 auto">
<p style="font-size:20px;font-weight:700;margin:0 0 12px">¡Tu registro ha sido enviado! ✅</p>
<p style="margin:0 0 12px">Este <b>miércoles 28</b> enviaremos la invitación por el grupo de acceso anticipado, únete aquí ➡️</p>
<p style="margin:0 0 20px"><a href="${WA_GROUP.replace(/&/g, '&amp;')}" style="color:#1d1d1f;font-weight:600">${WA_GROUP.replace(/&/g, '&amp;')}</a></p>
<p style="margin:0;color:#6e6e73;font-size:14px">STAR CHAIN BETA · OFFSZN</p>
</div></body></html>`;

// ─── GET /api/waitlist/count
export const count = async (req, res) => {
    const { count: n, error } = await supabase
        .from('waitlist_signups').select('id', { count: 'exact', head: true }).eq('list', LIST);
    if (error) return res.json({ count: 0 });
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res.json({ count: n || 0 });
};

// ─── POST /api/waitlist ─ solo correo. Guarda y manda la confirmacion por Brevo (solo a registros nuevos).
export const join = async (req, res) => {
    const b = req.body || {};
    if (b.website) return res.json({ ok: true }); // honeypot: los bots llenan este campo
    const email = clip(b.email, 200).toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Ese correo no se ve bien. Revísalo.' });

    const { data: existing } = await supabase
        .from('waitlist_signups').select('id,country').eq('list', LIST).eq('email', email).maybeSingle();
    if (existing) return res.json({ ok: true, already: true });

    const country = countryOf(req);
    const { error } = await supabase
        .from('waitlist_signups')
        .insert({ list: LIST, email, country, source: clip(b.source, 80) || null });
    if (error?.code === '23505') return res.json({ ok: true, already: true }); // doble click / carrera
    if (error) return res.status(500).json({ error: 'No pudimos guardarte. Intenta otra vez.' });

    // En serverless el proceso puede morir al responder, asi que se espera el envio; si Brevo falla el registro ya quedo guardado.
    try {
        await sendOffsznEmail({
            to: email,
            subject: '¡Tu registro ha sido enviado! · STAR CHAIN BETA',
            html: confirmationHtml(),
            fromName: 'OFFSZN'
        });
    } catch (e) {
        console.error('[Waitlist] Confirmation email failed:', e?.message || e);
    }

    return res.json({ ok: true });
};

// ─── Admin (misma clave que los demas paneles owner, header x-admin-key)
export const waitlistAdminAuth = (req, res, next) => {
    const key = req.headers['x-admin-key'] || req.query.admin_key;
    if (!isAdminKey(key)) return res.status(403).json({ error: 'Unauthorized' });
    next();
};

export const adminList = async (req, res) => {
    const { data, error } = await supabase
        .from('waitlist_signups').select('*').eq('list', LIST).order('created_at', { ascending: false }).limit(5000);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data });
};

export const adminUpdate = async (req, res) => {
    const b = req.body || {};
    const patch = { updated_at: new Date().toISOString() };
    if (typeof b.contacted === 'boolean') patch.contacted = b.contacted;
    if (b.notes !== undefined) patch.notes = clip(b.notes, 1000) || null;
    const { error } = await supabase.from('waitlist_signups').update(patch).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
};

export const adminDelete = async (req, res) => {
    const { error } = await supabase.from('waitlist_signups').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
};
