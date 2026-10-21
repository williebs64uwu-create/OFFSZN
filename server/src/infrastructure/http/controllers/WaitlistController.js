import { supabase } from '../../database/connection.js';
import { isAdminKey } from '../../../shared/config/adminKey.js';

const LIST = 'fast-mix-beta';
const DAWS = ['fl-studio', 'ableton', 'logic', 'pro-tools', 'otro'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clip = (v, n) => String(v ?? '').slice(0, n).trim();

const countryOf = (req) => {
    const c = String(req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || '').toUpperCase();
    return /^[A-Z]{2}$/.test(c) && c !== 'XX' ? c : null;
};

// ─── GET /api/waitlist/geo ─ pais detectado para prellenar el prefijo del WhatsApp
export const geo = (req, res) => res.json({ country: countryOf(req) });

// ─── GET /api/waitlist/count ─ prueba social (solo se muestra si ya hay un numero decente)
export const count = async (req, res) => {
    const { count: n, error } = await supabase
        .from('waitlist_signups').select('id', { count: 'exact', head: true }).eq('list', LIST);
    if (error) return res.json({ count: 0 });
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res.json({ count: n || 0 });
};

// ─── POST /api/waitlist ─ solo correo. Devuelve un id (token) para completar datos opcionales despues.
export const join = async (req, res) => {
    const b = req.body || {};
    if (b.website) return res.json({ ok: true }); // honeypot: los bots llenan este campo
    const email = clip(b.email, 200).toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Ese correo no se ve bien. Revísalo.' });

    const { data: existing } = await supabase
        .from('waitlist_signups').select('id,country').eq('list', LIST).ilike('email', email).maybeSingle();
    if (existing) return res.json({ ok: true, already: true, id: existing.id, country: existing.country });

    const country = countryOf(req);
    const { data, error } = await supabase
        .from('waitlist_signups')
        .insert({ list: LIST, email, country, source: clip(b.source, 80) || null })
        .select('id')
        .single();
    if (error) return res.status(500).json({ error: 'No pudimos guardarte. Intenta otra vez.' });
    return res.json({ ok: true, id: data.id, country });
};

// ─── POST /api/waitlist/details ─ opcional: WhatsApp, DAW, plugins. Se identifica con el id devuelto por /join.
export const details = async (req, res) => {
    const b = req.body || {};
    const id = clip(b.id, 40);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Solicitud inválida' });
    const patch = { updated_at: new Date().toISOString() };
    const wa = clip(b.whatsapp, 30).replace(/[^\d+]/g, '');
    if (wa.replace(/\D/g, '').length >= 7) patch.whatsapp = wa;
    if (DAWS.includes(b.daw)) patch.daw = b.daw;
    if (b.plugins) patch.plugins = clip(b.plugins, 300);
    const { error } = await supabase.from('waitlist_signups').update(patch).eq('id', id).eq('list', LIST);
    if (error) return res.status(500).json({ error: 'No pudimos guardar eso.' });
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
