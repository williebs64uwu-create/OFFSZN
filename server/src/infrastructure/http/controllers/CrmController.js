// ─── CRM de la tienda Willie · endpoints del panel owner (todos con x-admin-key) ─────────────────────────────────
import { supabase } from '../../database/connection.js';
import { buildOverview } from '../../../shared/store/analytics.js';
import { RULES } from '../../../shared/store/automations.js';
import { resolveRegion, quoteCart } from '../../../shared/store/pricing.js';
import { getProduct, loadCatalog } from '../../../shared/store/catalog.js';
import { fulfillOrder } from '../../services/storeService.js';
import { runAutomations } from '../../services/crmService.js';
import { buildSalesReport, buildProductPrices, summarizeCommissions } from '../../../shared/store/salesReport.js';

const clip = (v, n) => String(v ?? '').slice(0, n).trim();
const email = (v) => clip(v, 200).toLowerCase();
const STAGES = ['lead', 'prueba', 'cotizado', 'pagado', 'perdido'];
const fail = (res, error, status = 500) => res.status(status).json({ error: typeof error === 'string' ? error : error?.message || 'Error' });

// ─── GET /admin/overview?days=30
export const overview = async (req, res) => {
    const days = Math.min(180, Math.max(1, parseInt(req.query.days, 10) || 30));
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [orders, events, customers, trials, carts] = await Promise.all([
        supabase.from('store_orders').select('status, created_at, total_usd, country, payment_method, utm, offer_type, lines').gte('created_at', since).limit(5000),
        supabase.from('store_events').select('event, session_id').gte('created_at', since).in('event', ['page_view', 'add_to_cart', 'checkout_start', 'purchase']).limit(50000),
        supabase.from('store_customers').select('purchase_count, segment').limit(20000),
        supabase.from('store_trials').select('converted_at').gte('created_at', since).limit(5000),
        supabase.from('store_carts').select('recovered_at, reminder_sent_at').gte('created_at', since).limit(5000)
    ]);
    const failed = [orders, events, customers, trials, carts].find((r) => r.error);
    if (failed) return fail(res, failed.error);
    return res.json(buildOverview({ orders: orders.data, events: events.data, customers: customers.data, trials: trials.data, carts: carts.data }, days));
};

// ─── GET /admin/contacts?q=&segment=&country=&tag=
export const contacts = async (req, res) => {
    let q = supabase.from('store_customers').select('*').order('last_purchase_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(500);
    if (req.query.segment) q = q.eq('segment', clip(req.query.segment, 20));
    if (req.query.tag) q = q.contains('tags', [clip(req.query.tag, 40)]);
    if (req.query.country) { const c = clip(req.query.country, 2).toUpperCase(); q = q.or(`country.eq.${c},ip_country.eq.${c}`); }
    if (req.query.q) {
        const term = clip(req.query.q, 60).replace(/[^a-zA-Z0-9@._+-]/g, '');
        if (term) q = q.or(`email.ilike.%${term}%,username.ilike.%${term}%`);
    }
    const { data, error } = await q;
    if (error) return fail(res, error);
    return res.json({ items: data });
};

// ─── GET /admin/contacts/:email → ficha completa con línea de tiempo
export const contact = async (req, res) => {
    const e = email(req.params.email);
    if (!e) return fail(res, 'Correo requerido', 400);
    const [customer, orders, trials, deals, notes, cart, evByEmail] = await Promise.all([
        supabase.from('store_customers').select('*').eq('email', e).maybeSingle(),
        supabase.from('store_orders').select('created_at, status, payment_method, total_usd, offer_type, country, lines, delivery_token').eq('email', e).order('created_at', { ascending: false }).limit(50),
        supabase.from('store_trials').select('*').eq('email', e).order('created_at', { ascending: false }),
        supabase.from('store_deals').select('*').eq('email', e).order('created_at', { ascending: false }),
        supabase.from('store_notes').select('*').eq('email', e).order('created_at', { ascending: false }).limit(100),
        supabase.from('store_carts').select('*').eq('email', e).maybeSingle(),
        supabase.from('store_events').select('created_at, event, page, product_id, variant, session_id, meta').eq('email', e).order('created_at', { ascending: false }).limit(100)
    ]);
    // Eventos anónimos de las mismas sesiones (antes de dejar el correo)
    const sessions = [...new Set((evByEmail.data || []).map((x) => x.session_id).filter(Boolean))].slice(0, 10);
    const evBySession = sessions.length
        ? await supabase.from('store_events').select('created_at, event, page, product_id, variant, session_id, meta').in('session_id', sessions).order('created_at', { ascending: false }).limit(200)
        : { data: [] };
    const seen = new Set();
    const events = [...(evByEmail.data || []), ...(evBySession.data || [])].filter((x) => {
        const k = `${x.created_at}|${x.event}|${x.session_id}`;
        return seen.has(k) ? false : seen.add(k);
    }).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 150);

    const { data: log } = await supabase.from('store_automation_log').select('created_at, rule').eq('email', e).order('created_at', { ascending: false }).limit(30);
    return res.json({
        customer: customer.data, orders: orders.data || [], trials: trials.data || [], deals: deals.data || [],
        notes: notes.data || [], cart: cart.data, events, automations: log || []
    });
};

// ─── PATCH /admin/contacts/:email  { tags, unsubscribed, whatsapp }
export const updateContact = async (req, res) => {
    const e = email(req.params.email);
    const b = req.body || {};
    const patch = { updated_at: new Date().toISOString() };
    if (Array.isArray(b.tags)) patch.tags = [...new Set(b.tags.map((t) => clip(t, 40).toLowerCase()).filter(Boolean))].slice(0, 30);
    if (typeof b.unsubscribed === 'boolean') patch.unsubscribed = b.unsubscribed;
    if (b.whatsapp !== undefined) patch.whatsapp = clip(b.whatsapp, 30).replace(/[^\d+]/g, '') || null;
    const { data, error } = await supabase.from('store_customers').update(patch).eq('email', e).select('*').maybeSingle();
    if (error) return fail(res, error);
    if (!data) return fail(res, 'Contacto no encontrado', 404);
    return res.json({ ok: true, customer: data });
};

// ─── POST /admin/contacts/:email/notes  { body, kind: note|task, dueAt }  ·  PATCH /admin/notes/:id { done }
export const addNote = async (req, res) => {
    const b = req.body || {};
    const body = clip(b.body, 1000);
    if (!body) return fail(res, 'Escribe la nota', 400);
    const kind = b.kind === 'task' ? 'task' : 'note';
    const due = kind === 'task' && b.dueAt && !Number.isNaN(Date.parse(b.dueAt)) ? new Date(b.dueAt).toISOString() : null;
    const { data, error } = await supabase.from('store_notes').insert({ email: email(req.params.email), kind, body, due_at: due }).select('*').single();
    if (error) return fail(res, error);
    return res.json({ ok: true, note: data });
};
export const updateNote = async (req, res) => {
    const { error } = await supabase.from('store_notes').update({ done: Boolean(req.body?.done) }).eq('id', clip(req.params.id, 64));
    if (error) return fail(res, error);
    return res.json({ ok: true });
};
export const tasks = async (req, res) => {
    const { data, error } = await supabase.from('store_notes').select('*').eq('kind', 'task').eq('done', false).order('due_at', { ascending: true, nullsFirst: false }).limit(200);
    if (error) return fail(res, error);
    return res.json({ items: data });
};

// ─── Pipeline
export const deals = async (req, res) => {
    const { data, error } = await supabase.from('store_deals').select('*').order('updated_at', { ascending: false }).limit(500);
    if (error) return fail(res, error);
    return res.json({ stages: STAGES, items: data });
};
export const createDeal = async (req, res) => {
    const b = req.body || {};
    const e = email(b.email);
    const title = clip(b.title, 120);
    if (!e.includes('@') || !title) return fail(res, 'Correo y título requeridos', 400);
    const stage = STAGES.includes(b.stage) ? b.stage : 'lead';
    const value = Number(b.valueUsd);
    const { data, error } = await supabase.from('store_deals').insert({
        email: e, title, stage, value_usd: Number.isFinite(value) && value >= 0 ? value : null,
        source: clip(b.source, 80) || 'manual', notes: clip(b.notes, 1000) || null, product_id: clip(b.productId, 80) || null
    }).select('*').single();
    if (error) return fail(res, error);
    return res.json({ ok: true, deal: data });
};
export const updateDeal = async (req, res) => {
    const b = req.body || {};
    const patch = { updated_at: new Date().toISOString() };
    if (b.stage !== undefined) {
        if (!STAGES.includes(b.stage)) return fail(res, 'Etapa no válida', 400);
        patch.stage = b.stage;
        patch.closed_at = ['pagado', 'perdido'].includes(b.stage) ? new Date().toISOString() : null;
    }
    if (b.valueUsd !== undefined) { const v = Number(b.valueUsd); patch.value_usd = Number.isFinite(v) && v >= 0 ? v : null; }
    if (b.notes !== undefined) patch.notes = clip(b.notes, 1000) || null;
    if (b.lostReason !== undefined) patch.lost_reason = clip(b.lostReason, 200) || null;
    const { data, error } = await supabase.from('store_deals').update(patch).eq('id', clip(req.params.id, 64)).select('*').maybeSingle();
    if (error) return fail(res, error);
    if (!data) return fail(res, 'Venta no encontrada', 404);
    return res.json({ ok: true, deal: data });
};

// ─── Automatizaciones
export const automations = async (req, res) => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [rules, log] = await Promise.all([
        supabase.from('store_automation_rules').select('key, enabled'),
        supabase.from('store_automation_log').select('rule').gte('created_at', since).limit(20000)
    ]);
    const enabled = new Map((rules.data || []).map((r) => [r.key, r.enabled]));
    const sent = {};
    for (const l of log.data || []) sent[l.rule] = (sent[l.rule] || 0) + 1;
    return res.json({ items: RULES.map((r) => ({ ...r, enabled: enabled.has(r.key) ? enabled.get(r.key) : true, sent30d: sent[r.key] || 0 })) });
};
export const toggleAutomation = async (req, res) => {
    const rule = RULES.find((r) => r.key === req.params.key);
    if (!rule) return fail(res, 'Regla no encontrada', 404);
    const { error } = await supabase.from('store_automation_rules').upsert({ key: rule.key, name: rule.name, enabled: Boolean(req.body?.enabled), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) return fail(res, error);
    return res.json({ ok: true });
};
export const runNow = async (req, res) => {
    try { return res.json({ ok: true, results: await runAutomations() }); } catch (e) { return fail(res, e); }
};

// ─── POST /admin/manual-sale { email, items:[{id,os}], country, priceUsd?, note }
// Venta cerrada por WhatsApp: entrega archivos/licencias, manda el correo y queda en el CRM igual que una compra web.
export const manualSale = async (req, res) => {
    const b = req.body || {};
    const e = email(b.email);
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e)) return fail(res, 'Correo no válido', 400);
    const country = clip(b.country, 2).toUpperCase() || null;
    const region = resolveRegion({ declaredCountry: country });
    const quote = quoteCart({ items: (Array.isArray(b.items) ? b.items : []).slice(0, 30), getProduct, region });
    if (!quote.lines.length) return fail(res, 'Elige al menos un producto vendible', 400);

    // Precio acordado distinto al de lista (descuento por WhatsApp): se registra tal cual.
    const agreed = Number(b.priceUsd);
    if (Number.isFinite(agreed) && agreed > 0 && agreed <= quote.subtotalUsd) {
        quote.totalUsd = Math.round(agreed * 100) / 100;
        quote.discountUsd = Math.round((quote.subtotalUsd - quote.totalUsd) * 100) / 100;
        quote.offerApplied = { type: 'manual' };
    }
    try {
        const result = await fulfillOrder({
            lines: quote.lines, email: e, paymentMethod: 'whatsapp', paymentRef: `WA-${Date.now().toString(36).toUpperCase()}`,
            quote, region, tracking: { sourceUrl: 'https://offszn.lat/willieinspired' }
        });
        if (clip(b.note, 500)) await supabase.from('store_notes').insert({ email: e, kind: 'note', body: `Venta manual: ${clip(b.note, 500)}` });
        return res.json({ ok: true, totalUsd: quote.totalUsd, licenses: result.licenses.map((l) => l.name), delivery: Boolean(result.delivery) });
    } catch (err) {
        console.error('[CRM manual-sale]', err);
        return fail(res, 'No se pudo registrar la venta');
    }
};

// ─── POST /admin/verify → la pantalla de acceso del CRM comprueba la clave sin pedir datos
export const verify = (req, res) => res.json({ ok: true });

// ─── GET /admin/system → qué está conectado, qué tablas faltan y qué contenido falta subir (nunca devuelve valores secretos)
export const system = async (req, res) => {
    const has = (...names) => names.every((n) => Boolean(String(process.env[n] || '').trim()));
    const integrations = [
        { key: 'panel', name: 'Clave del panel', ok: has('OFFSZN_VARIABLE_PANEL'), fix: 'Define OFFSZN_VARIABLE_PANEL en el servidor.' },
        { key: 'single_key', name: 'Una sola clave de acceso', ok: !has('PLUGIN_ADMIN_KEY'), fix: 'Borra la variable antigua PLUGIN_ADMIN_KEY del servidor: mientras exista, es una segunda clave válida.' },
        { key: 'supabase', name: 'Base de datos (Supabase)', ok: has('SUPABASE_URL', 'SUPABASE_SERVICE_KEY'), fix: 'Define SUPABASE_URL y SUPABASE_SERVICE_KEY.' },
        { key: 'brevo', name: 'Correos (Brevo)', ok: has('BREVO_API_KEY'), fix: 'Define BREVO_API_KEY.' },
        { key: 'brevo_list', name: 'Lista de contactos en Brevo', ok: has('STORE_BREVO_LIST_ID'), fix: 'Define STORE_BREVO_LIST_ID (opcional, para sincronizar contactos).' },
        { key: 'cron', name: 'Cron de automatizaciones', ok: has('STORE_CRON_SECRET'), fix: 'Define STORE_CRON_SECRET en el servidor y el mismo valor como secret de GitHub.' },
        { key: 'paypal', name: 'PayPal', ok: has('PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'), fix: 'Define PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET.' },
        { key: 'yape', name: 'Yape (Mercado Pago)', ok: has('MERCADOPAGO_ACCESS_TOKEN'), fix: 'Define MERCADOPAGO_ACCESS_TOKEN.' },
        { key: 'meta', name: 'Meta Conversions API', ok: has('META_CAPI_ACCESS_TOKEN'), fix: 'Define META_CAPI_ACCESS_TOKEN (el Pixel del navegador ya funciona sin esto).' },
        { key: 'r2', name: 'Archivos (Cloudflare R2, bucket 4)', ok: has('R2_ENDPOINT_V4', 'R2_ACCESS_KEY_ID_V4', 'R2_SECRET_ACCESS_KEY_V4'), fix: 'Define las variables R2_*_V4.' }
    ];

    const tables = ['store_customers', 'store_orders', 'store_offers', 'store_trials', 'store_events', 'willie_orders',
        'store_carts', 'store_deals', 'store_notes', 'store_automation_rules', 'store_automation_log'];
    const checked = await Promise.all(tables.map(async (name) => {
        const { error } = await supabase.from(name).select('*', { count: 'exact', head: true }).limit(1);
        return { name, ok: !error, migration: ['store_carts', 'store_deals', 'store_notes', 'store_automation_rules', 'store_automation_log'].includes(name) ? '20261023_willie_crm.sql' : '20261022_willie_store.sql' };
    }));

    const { products } = loadCatalog();
    const active = products.filter((p) => p.status === 'active' && p.kind !== 'subscription');
    const artists = active.filter((p) => p.subcategory === 'artistas');
    return res.json({
        integrations,
        tables: checked,
        catalog: {
            products: products.length,
            active: active.length,
            withoutCover: active.filter((p) => !p.media?.cover).slice(0, 120).map((p) => ({ id: p.id, title: p.title, category: p.category })),
            withoutCoverCount: active.filter((p) => !p.media?.cover).length,
            artistsWithoutAudio: artists.filter((p) => !p.media?.audioAfter).length,
            artists: artists.length,
            withoutVideo: active.filter((p) => !p.media?.video).length
        },
        time: new Date().toISOString()
    });
};


// ─── Ventas históricas (tablas de OFFSZN: orders, order_items, products…) ────────────────────────────────────────
// Supabase devuelve máximo 1000 filas por consulta: se pide por páginas.
async function fetchAll(table, columns, { order = 'id' } = {}) {
    const out = [];
    for (let from = 0; from < 50000; from += 1000) {
        const { data, error } = await supabase.from(table).select(columns).order(order, { ascending: true }).range(from, from + 999);
        if (error) throw error;
        out.push(...data);
        if (data.length < 1000) break;
    }
    return out;
}

async function loadSalesData() {
    const [orders, items, products, transactions, clicks, referrals, subscriptions] = await Promise.all([
        fetchAll('orders', 'id, status, total_price, created_at'),
        fetchAll('order_items', 'id, order_id, product_id, quantity, price_at_purchase'),
        fetchAll('products', 'id, name, product_type, status, is_free, price_basic, price_premium'),
        fetchAll('transactions', 'id, amount, type, created_at'),
        fetchAll('manual_payment_clicks', 'id, method, product'),
        fetchAll('referrals', 'id, status', { order: 'id' }),
        fetchAll('subscriptions', 'id, plan_id, status', { order: 'id' })
    ]);
    return { orders, items, products, transactions, clicks, referrals, subscriptions };
}

// ─── GET /admin/sales
export const sales = async (req, res) => {
    try { return res.json(buildSalesReport(await loadSalesData())); } catch (e) { return fail(res, e); }
};

// ─── GET /admin/product-prices → precio de lista vs. lo cobrado + precios del catálogo de la tienda
export const productPrices = async (req, res) => {
    try {
        const d = await loadSalesData();
        const all = loadCatalog().products;
        const row = (p) => ({ id: p.id, title: p.title, category: p.category, status: p.status, baseUsd: p.price?.base ?? null, highUsd: p.price?.high ?? null, compareAtUsd: p.price?.compareAt ?? null });
        const artists = all.filter((p) => p.subcategory === 'artistas');
        const catalog = all.filter((p) => p.subcategory !== 'artistas').map(row);
        if (artists.length) catalog.unshift({ ...row(artists[0]), id: 'artistas', title: `Presets de artistas (${artists.length} productos, mismo precio)` });
        return res.json({ products: buildProductPrices(d).slice(0, 300), catalog });
    } catch (e) { return fail(res, e); }
};

// ─── Comisiones ganadas (por productos que vendieron otros)
const COMMISSION_STATUS = ['pendiente', 'cobrada'];
export const commissions = async (req, res) => {
    const { data, error } = await supabase.from('store_commissions').select('*').order('earned_at', { ascending: false }).limit(1000);
    if (error) return fail(res, error);
    return res.json({ items: data, summary: summarizeCommissions(data) });
};
export const createCommission = async (req, res) => {
    const amount = Number(req.body?.amountUsd);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return fail(res, 'El monto debe ser mayor a 0', 400);
    const row = {
        source: clip(req.body?.source, 120) || 'Otro',
        product: clip(req.body?.product, 160) || null,
        amount_usd: Math.round(amount * 100) / 100,
        earned_at: /^\d{4}-\d{2}-\d{2}$/.test(req.body?.earnedAt || '') ? req.body.earnedAt : new Date().toISOString().slice(0, 10),
        status: COMMISSION_STATUS.includes(req.body?.status) ? req.body.status : 'pendiente',
        notes: clip(req.body?.notes, 500) || null
    };
    const { data, error } = await supabase.from('store_commissions').insert(row).select().single();
    if (error) return fail(res, error);
    return res.json({ item: data });
};
export const updateCommission = async (req, res) => {
    const patch = {};
    if (COMMISSION_STATUS.includes(req.body?.status)) patch.status = req.body.status;
    if (req.body?.notes !== undefined) patch.notes = clip(req.body.notes, 500) || null;
    if (!Object.keys(patch).length) return fail(res, 'Nada que actualizar', 400);
    const { data, error } = await supabase.from('store_commissions').update(patch).eq('id', clip(req.params.id, 60)).select().single();
    if (error) return fail(res, error);
    return res.json({ item: data });
};
export const deleteCommission = async (req, res) => {
    const { error } = await supabase.from('store_commissions').delete().eq('id', clip(req.params.id, 60));
    if (error) return fail(res, error);
    return res.json({ ok: true });
};
