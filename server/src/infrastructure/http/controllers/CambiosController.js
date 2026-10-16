import { supabase } from '../../database/connection.js';
import { isAdminKey } from '../../../shared/config/adminKey.js';

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../../shared/config/config.js';

const clip = (v, n) => String(v ?? '').slice(0, n);
const pick = (v, list, def) => (list.includes(v) ? v : def);

const KINDS = ['task', 'idea', 'link', 'note'];
const FOLDERS = ['plugins', 'contenido', 'ventas', 'disenos', 'ideas', 'otro'];
const STATUSES = ['todo', 'doing', 'done'];
const PRIORITIES = ['low', 'normal', 'high'];
const PEOPLE = ['willie', 'gian'];
const COLORS = ['azul', 'verde', 'amarillo', 'rojo', 'morado'];

// Misma clave que los demas paneles owner (header x-admin-key).
export const cambiosAuth = (req, res, next) => {
    const key = req.headers['x-admin-key'] || req.query.admin_key;
    if (!isAdminKey(key)) return res.status(403).json({ error: 'Unauthorized' });
    const who = String(req.headers['x-user'] || '').toLowerCase();
    req.who = PEOPLE.includes(who) ? who : null;
    next();
};

const cleanDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);

// ─── GET /api/cambios/config ─ URL y anon key publicas para el canal Broadcast (solo avisos, sin datos)
export const getConfig = (req, res) => res.json({ url: SUPABASE_URL || null, anon: SUPABASE_ANON_KEY || null });

// ─── GET /api/cambios/state ─ todo lo que necesita la pagina en una sola llamada
export const getState = async (req, res) => {
    const [items, feed] = await Promise.all([
        supabase.from('cambios_items').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('cambios_feed').select('*').order('created_at', { ascending: false }).limit(150)
    ]);
    const error = items.error || feed.error;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: items.data, feed: feed.data, serverTime: new Date().toISOString() });
};

// ─── POST /api/cambios/items
export const createItem = async (req, res) => {
    const b = req.body || {};
    const title = clip(b.title, 200).trim();
    if (!title) return res.status(400).json({ error: 'Falta el titulo' });
    const row = {
        kind: pick(b.kind, KINDS, 'task'),
        folder: pick(b.folder, FOLDERS, 'ideas'),
        title,
        body: clip(b.body, 10000) || null,
        link: clip(b.link, 1000) || null,
        status: pick(b.status, STATUSES, 'todo'),
        assignee: pick(b.assignee, PEOPLE, null),
        priority: pick(b.priority, PRIORITIES, 'normal'),
        due_date: cleanDate(b.due_date),
        created_by: req.who,
        updated_by: req.who
    };
    const { data, error } = await supabase.from('cambios_items').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ item: data });
};

// ─── PATCH /api/cambios/items/:id
export const updateItem = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'id invalido' });
    const b = req.body || {};
    const patch = { updated_at: new Date().toISOString(), updated_by: req.who };
    if ('kind' in b) patch.kind = pick(b.kind, KINDS, 'task');
    if ('folder' in b) patch.folder = pick(b.folder, FOLDERS, 'ideas');
    if ('title' in b) {
        const t = clip(b.title, 200).trim();
        if (!t) return res.status(400).json({ error: 'Falta el titulo' });
        patch.title = t;
    }
    if ('body' in b) patch.body = clip(b.body, 10000) || null;
    if ('link' in b) patch.link = clip(b.link, 1000) || null;
    if ('status' in b) patch.status = pick(b.status, STATUSES, 'todo');
    if ('assignee' in b) patch.assignee = pick(b.assignee, PEOPLE, null);
    if ('priority' in b) patch.priority = pick(b.priority, PRIORITIES, 'normal');
    if ('due_date' in b) patch.due_date = cleanDate(b.due_date);
    const { data, error } = await supabase.from('cambios_items').update(patch).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ item: data });
};

// ─── DELETE /api/cambios/items/:id
export const deleteItem = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'id invalido' });
    const { error } = await supabase.from('cambios_items').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
};

// ─── POST /api/cambios/feed
export const postFeed = async (req, res) => {
    const b = req.body || {};
    const text = clip(b.text, 1000).trim();
    if (!text) return res.status(400).json({ error: 'Mensaje vacio' });
    if (!req.who) return res.status(400).json({ error: 'Falta quien eres (x-user)' });
    const { data, error } = await supabase
        .from('cambios_feed')
        .insert({ author: req.who, color: pick(b.color, COLORS, 'azul'), text })
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ msg: data });
};
