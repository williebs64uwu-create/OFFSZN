// ─── /api/store · tienda Willie Inspired ──────────────────────────────────────────────────────────────────────
// Catálogo con precio por país, total del carrito, leads (lead magnets / avísame / comunidad), eventos del A/B,
// 50% de bienvenida, onboarding, pruebas de plugins con correo y el cron de "tu prueba terminó".
import crypto from 'crypto';
import { supabase } from '../../database/connection.js';
import { isAdminKey } from '../../../shared/config/adminKey.js';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';
import { checkEmail } from '../../../shared/utils/emailValidation.js';
import { priceFor, trialFollowupPrice, OFFERS } from '../../../shared/store/pricing.js';
import { loadCatalog, getProduct, publicProduct } from '../../../shared/store/catalog.js';
import { prefixForName } from '../../../shared/config/pluginRegistry.js';
import {
    regionForRequest, quoteForRequest, upsertCustomer, syncBrevoContact, getCustomerByUser, getCustomerByEmail,
    newCode, WHATSAPP
} from '../../services/storeService.js';

const SITE = 'https://offszn.lat';
const clip = (v, n) => String(v ?? '').slice(0, n).trim();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const publicRegion = (r) => ({ country: r.country, tier: r.tier, currency: r.currency.code, vpnSuspected: r.vpnSuspected });

const EVENTS = new Set(['page_view', 'popup_view', 'popup_click', 'popup_close', 'lead', 'add_to_cart', 'checkout_start',
    'upsell_view', 'upsell_click', 'trial_request', 'video_play', 'offer_click', 'onboarding_done']);
const VARIANTS = new Set(['welcome50', '2x1']);
// Países que se pueden elegir en el onboarding (el resto entra como "otro" y se usa la IP).
const COUNTRIES = new Set(['PE', 'MX', 'AR', 'CL', 'CO', 'EC', 'BO', 'VE', 'CU', 'DO', 'PR', 'US', 'ES', 'DE', 'UY', 'PY',
    'PA', 'CR', 'GT', 'SV', 'HN', 'NI', 'OTRO']);
const TRIAL_PLUGINS = { 'plugin-easy-master': 'Easy Master', 'plugin-easy-mix': 'Easy Mix' };

const mailShell = (inner) => `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:24px;background:#f3f3f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0a0a0a;font-size:16px;line-height:1.55">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;padding:28px;border:1px solid #e5e5ea">
<p style="font-weight:900;letter-spacing:-0.03em;font-size:18px;margin:0 0 18px">WILLIE INSPIRED</p>${inner}
<p style="margin:24px 0 0;color:#8e8c95;font-size:13px">¿Dudas? Respóndeme por <a href="${WHATSAPP}" style="color:#ec4899">WhatsApp</a>.</p></div></body></html>`;
const button = (href, label) => `<p style="margin:18px 0"><a href="${href}" style="display:inline-block;background:#0a0a0a;color:#ffffff;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:999px">${label}</a></p>`;

// ─── GET /api/store/catalog?tz=
export const catalog = async (req, res) => {
    const region = await regionForRequest(req, req.query.tz);
    const { products, genres, faq } = loadCatalog();
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.json({
        region: publicRegion(region),
        products: products.map((p) => ({ ...publicProduct(p), pricing: priceFor(p, region) })),
        genres,
        faq
    });
};

// ─── GET /api/store/geo?tz=
export const geo = async (req, res) => {
    const region = await regionForRequest(req, req.query.tz);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json(publicRegion(region));
};

// ─── POST /api/store/quote  { items, offer, timezone }
export const quote = async (req, res) => {
    const q = await quoteForRequest(req);
    return res.json({ ...q.quote, error: q.error || null, code: q.code || null });
};

// ─── POST /api/store/leads  { email, kind: lead_magnet|notify|comunidad, productId, source, variant, utm, timezone }
export const lead = async (req, res) => {
    const b = req.body || {};
    if (b.website) return res.json({ ok: true }); // honeypot
    const checked = await checkEmail(b.email);
    if (checked.error) return res.status(400).json({ error: checked.error });
    const { email } = checked;

    const kind = ['lead_magnet', 'notify', 'comunidad'].includes(b.kind) ? b.kind : 'lead_magnet';
    const product = getProduct(b.productId);
    if (kind === 'lead_magnet' && product?.kind !== 'lead_magnet') return res.status(400).json({ error: 'Ese regalo no existe.' });
    if (kind !== 'lead_magnet' && !product) return res.status(400).json({ error: 'Producto no encontrado.' });

    const region = await regionForRequest(req, b.timezone);
    const variant = VARIANTS.has(b.variant) ? b.variant : null;
    const tag = kind === 'lead_magnet' ? product.id : `${kind}:${product.id}`;
    const customer = await upsertCustomer(email, {
        ip_country: region.ipCountry,
        first_source: clip(b.source, 80) || tag,
        lead_magnets: [tag],
        ...(variant ? { ab_variant: variant } : {}),
        ...(b.utm && typeof b.utm === 'object' ? { utm: b.utm } : {})
    });
    await syncBrevoContact(customer);

    const offerUrl = `${SITE}/willieinspired/oferta?lm=${encodeURIComponent(product.slug)}`;
    let subject;
    let inner;
    if (kind === 'lead_magnet') {
        const download = product.media?.download;
        subject = `🎁 Tu regalo: ${product.title}`;
        inner = `<p style="font-size:20px;font-weight:800;margin:0 0 10px">Aquí está tu regalo 🎁</p>
            <p style="margin:0 0 6px">${esc(product.title)}</p>
            ${download ? button(download, 'Descargar gratis') : '<p style="color:#5e5c64">Te lo envío a este correo en unos minutos.</p>'}
            <p style="margin:18px 0 6px">Mira el video corto de cómo se usa y, si te gusta, tienes un descuento de bienvenida esperándote:</p>
            ${button(offerUrl, 'Ver cómo se usa')}`;
        if (!download) {
            sendOffsznEmail({
                to: 'willie2008garay@gmail.com', fromName: 'Willie Inspired Leads',
                subject: `📥 Lead sin archivo: enviar "${product.title}" a ${email}`,
                html: `<p>Sube el archivo en <code>media.download</code> de ${esc(product.id)} (store-catalog.json) y envíaselo a <b>${esc(email)}</b>.</p>`
            }).catch((e) => console.warn('[Store] aviso lead:', e.message));
        }
    } else if (kind === 'notify') {
        subject = `🔔 Te aviso cuando salga ${product.title}`;
        inner = `<p style="font-size:20px;font-weight:800;margin:0 0 10px">¡Listo! 🔔</p><p>Te escribo apenas salga <b>${esc(product.title)}</b>.</p>`;
    } else {
        subject = '🎧 Estás en la lista de la comunidad';
        inner = `<p style="font-size:20px;font-weight:800;margin:0 0 10px">Estás dentro de la lista 🎧</p><p>Te aviso cuando abra la comunidad (${esc(product.title)}). Los primeros entran con precio de fundador.</p>`;
    }
    try {
        await sendOffsznEmail({ to: email, subject, html: mailShell(inner), fromName: 'Willie Inspired' });
    } catch (e) {
        console.error('[Store] correo de lead falló:', e.message);
    }

    await supabase.from('store_events').insert({
        session_id: clip(b.sessionId, 64) || null, email, event: 'lead', variant, product_id: product.id,
        country: region.country, page: clip(b.page, 200) || null
    });

    return res.json({ ok: true, redirect: kind === 'lead_magnet' ? `/willieinspired/oferta?lm=${encodeURIComponent(product.slug)}` : null });
};

// ─── POST /api/store/events  { sessionId, events: [{ event, variant, page, productId, meta }] }
export const events = async (req, res) => {
    const b = req.body || {};
    const list = (Array.isArray(b.events) ? b.events : [b]).slice(0, 20);
    const sessionId = clip(b.sessionId, 64) || null;
    const country = (await regionForRequest(req, b.timezone)).country;
    const rows = list.filter((e) => EVENTS.has(e?.event)).map((e) => ({
        session_id: sessionId,
        user_id: req.user?.userId || null,
        event: e.event,
        variant: VARIANTS.has(e.variant) ? e.variant : null,
        page: clip(e.page, 200) || null,
        product_id: clip(e.productId, 80) || null,
        country,
        meta: e.meta && typeof e.meta === 'object' ? JSON.parse(JSON.stringify(e.meta).slice(0, 2000)) : null
    }));
    if (rows.length) {
        const { error } = await supabase.from('store_events').insert(rows);
        if (error) console.warn('[Store] events:', error.message);
    }
    return res.json({ ok: true, saved: rows.length });
};

// ─── POST /api/store/welcome/claim  (con cuenta) → activa el 50% de bienvenida de un solo uso
export const claimWelcome = async (req, res) => {
    const userId = req.user.userId;
    const { data: existing } = await supabase.from('store_offers').select('id, used_at')
        .eq('user_id', userId).eq('type', 'welcome50').maybeSingle();
    if (existing) return res.json({ ok: true, status: existing.used_at ? 'used' : 'available' });

    const { error } = await supabase.from('store_offers').insert({
        code: newCode('BIENVENIDA'), type: 'welcome50', user_id: userId, email: req.user.email || null,
        meta: { percent: OFFERS.welcome50.percent, max_usd: OFFERS.welcome50.maxDiscountUsd }
    });
    if (error && error.code !== '23505') return res.status(500).json({ error: 'No pudimos activar tu descuento.' });
    if (req.user.email) await upsertCustomer(req.user.email, { user_id: userId });
    return res.json({ ok: true, status: 'available' });
};

const timeLabels = (iso) => {
    if (!iso) return { hora: null, dia: null };
    const d = new Date(iso);
    const tz = 'America/Lima';
    const hora = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz });
    const dayKey = (x) => x.toLocaleDateString('en-CA', { timeZone: tz });
    const diff = Math.round((new Date(dayKey(new Date())) - new Date(dayKey(d))) / 86400000);
    const dia = diff <= 0 ? 'hoy' : diff === 1 ? 'ayer' : `hace ${diff} días`;
    return { hora, dia };
};

// ─── GET /api/store/me  (con cuenta)
export const me = async (req, res) => {
    const { userId, email } = req.user;
    const customer = (await getCustomerByUser(userId)) || (email ? await getCustomerByEmail(email) : null);
    const { data: welcome } = await supabase.from('store_offers').select('used_at').eq('user_id', userId).eq('type', 'welcome50').maybeSingle();

    let q = supabase.from('store_orders').select('created_at, payment_method, total_usd, total_pen, lines, delivery_token, offer_type')
        .eq('status', 'completed').order('created_at', { ascending: false }).limit(50);
    q = email ? q.or(`user_id.eq.${userId},email.eq.${email.toLowerCase()}`) : q.eq('user_id', userId);
    const { data: orders } = await q;

    return res.json({
        email,
        customer: customer ? {
            username: customer.username,
            country: customer.country,
            segment: customer.segment,
            purchaseCount: customer.purchase_count,
            totalSpentUsd: Number(customer.total_spent_usd || 0),
            onboardingDone: customer.onboarding_done,
            lastPurchase: timeLabels(customer.last_purchase_at)
        } : null,
        welcome: { claimed: Boolean(welcome), used: Boolean(welcome?.used_at) },
        orders: (orders || []).map((o) => ({
            createdAt: o.created_at,
            method: o.payment_method,
            totalUsd: Number(o.total_usd),
            totalPen: o.total_pen ? Number(o.total_pen) : null,
            offer: o.offer_type,
            lines: (o.lines || []).map((l) => ({ id: l.id, title: l.title, delivery: l.delivery })),
            portalUrl: o.delivery_token ? `/willieinspired/descargas.html?token=${o.delivery_token}` : null
        }))
    });
};

// ─── POST /api/store/onboarding  (con cuenta) { username, country }
export const onboarding = async (req, res) => {
    const username = clip(req.body?.username, 30).toLowerCase();
    const country = clip(req.body?.country, 4).toUpperCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) return res.status(400).json({ error: 'Usuario de 3 a 30 caracteres: letras, números, punto o guion.' });
    if (!COUNTRIES.has(country)) return res.status(400).json({ error: 'Elige tu país.' });
    if (!req.user.email) return res.status(400).json({ error: 'Tu cuenta no tiene correo.' });

    const customer = await upsertCustomer(req.user.email, {
        user_id: req.user.userId, username, country: country === 'OTRO' ? null : country, onboarding_done: true
    });
    await syncBrevoContact(customer);
    const region = await regionForRequest(req, req.body?.timezone);
    return res.json({ ok: true, region: publicRegion(region) });
};

// ─── POST /api/store/trials  { email, productId: plugin-easy-master|plugin-easy-mix, timezone, source }
// "No compro" → prueba gratis con correo. El contador de 3 días arranca al activar en el DAW.
export const requestTrial = async (req, res) => {
    const b = req.body || {};
    if (b.website) return res.json({ ok: true });
    const checked = await checkEmail(b.email);
    if (checked.error) return res.status(400).json({ error: checked.error });
    const { email } = checked;
    const productId = TRIAL_PLUGINS[b.productId] ? b.productId : 'plugin-easy-master';
    const pluginName = TRIAL_PLUGINS[productId];
    const product = getProduct(productId);
    const region = await regionForRequest(req, b.timezone);

    let { data: trial } = await supabase.from('store_trials').select('*').eq('email', email.toLowerCase()).eq('plugin_name', pluginName).maybeSingle();
    if (!trial) {
        const rand = () => crypto.randomBytes(4).toString('hex').toUpperCase();
        const serialKey = `${prefixForName(pluginName)}-TRIAL-${rand()}-${rand()}`;
        const { error: licErr } = await supabase.from('plugin_licenses').insert({
            serial_key: serialKey, license_type: 'trial', status: 'active', expires_at: null, max_devices: 1, plugin_name: pluginName
        });
        if (licErr) return res.status(500).json({ error: 'No pudimos crear tu prueba. Intenta otra vez.' });
        const ins = await supabase.from('store_trials').insert({
            email, serial_key: serialKey, plugin_name: pluginName, country: region.country, source: clip(b.source, 80) || null
        }).select('*').single();
        trial = ins.data || { serial_key: serialKey };
    }

    const customer = await upsertCustomer(email, { ip_country: region.ipCountry, first_source: clip(b.source, 80) || `trial:${productId}`, lead_magnets: [`trial:${productId}`] });
    await syncBrevoContact(customer);

    try {
        await sendOffsznEmail({
            to: email,
            fromName: 'Willie Inspired',
            subject: `🎚️ Tu prueba gratis de ${pluginName}`,
            html: mailShell(`<p style="font-size:20px;font-weight:800;margin:0 0 10px">Tu prueba de ${esc(pluginName)} 🎚️</p>
                <p style="margin:0 0 6px">Tu licencia de prueba:</p>
                <p style="font-family:monospace;font-size:18px;font-weight:800;background:#f3f3f5;border-radius:12px;padding:12px 14px;margin:0 0 12px">${esc(trial.serial_key)}</p>
                <p style="margin:0 0 6px">Tienes <b>${product?.trialDays || 3} días</b> desde que lo actives en tu DAW.</p>
                ${button(`${SITE}${product?.landingUrl || '/plugins/easy-master'}`, 'Descargar instalador')}
                <p style="margin:0">Mira cómo se usa en 2 minutos: <a href="${SITE}/willieinspired/plugins/${product?.slug || 'easy-master'}" style="color:#ec4899">ver video</a></p>`)
        });
    } catch (e) {
        console.error('[Store] correo de prueba falló:', e.message);
    }
    await supabase.from('store_events').insert({ email, event: 'trial_request', product_id: productId, country: region.country, session_id: clip(b.sessionId, 64) || null });
    return res.json({ ok: true });
};

// ─── GET /api/store/r/:code → registra el clic del correo y lleva al producto con el código aplicado
export const offerRedirect = async (req, res) => {
    const code = clip(req.params.code, 40).toUpperCase();
    const { data: offer } = await supabase.from('store_offers').select('id, product_id, clicked_at, email').eq('code', code).maybeSingle();
    if (!offer) return res.redirect(302, '/willieinspired');
    if (!offer.clicked_at) await supabase.from('store_offers').update({ clicked_at: new Date().toISOString() }).eq('id', offer.id);
    await supabase.from('store_events').insert({ email: offer.email, event: 'offer_click', product_id: offer.product_id, meta: { code } });
    const product = getProduct(offer.product_id);
    return res.redirect(302, `/willieinspired/${product?.category || 'plugins'}/${product?.slug || ''}?offer=${encodeURIComponent(code)}`);
};

// ─── Cron cada hora: "¿lo instalaste?" (48 h sin activar) y oferta cuando vence la prueba
export const cronAuth = (req, res, next) => {
    const secret = process.env.STORE_CRON_SECRET || process.env.CRON_SECRET;
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if ((secret && bearer === secret) || isAdminKey(req.headers['x-admin-key'])) return next();
    return res.status(401).json({ error: 'Unauthorized' });
};

export const trialFollowups = async (req, res) => {
    const now = new Date();
    const { data: trials, error } = await supabase.from('store_trials').select('*')
        .is('followup_sent_at', null).is('converted_at', null).order('created_at', { ascending: true }).limit(200);
    if (error) return res.status(500).json({ error: error.message });
    if (!trials?.length) return res.json({ ok: true, nudges: 0, offers: 0 });

    const { data: licenses } = await supabase.from('plugin_licenses').select('serial_key, expires_at')
        .in('serial_key', trials.map((t) => t.serial_key));
    const expiry = new Map((licenses || []).map((l) => [l.serial_key, l.expires_at]));
    const productFor = (pluginName) => getProduct(Object.keys(TRIAL_PLUGINS).find((k) => TRIAL_PLUGINS[k] === pluginName));
    let nudges = 0;
    let offers = 0;

    for (const t of trials) {
        if (nudges + offers >= 50) break;
        const exp = expiry.get(t.serial_key);
        const product = productFor(t.plugin_name);

        if (!exp && !t.nudge_sent_at && now - new Date(t.created_at) > 48 * 3600 * 1000) {
            await sendOffsznEmail({
                to: t.email, fromName: 'Willie Inspired', subject: `¿Pudiste instalar ${t.plugin_name}?`,
                html: mailShell(`<p style="font-size:20px;font-weight:800;margin:0 0 10px">¿Lo pudiste instalar? 🤔</p>
                    <p>Vi que aún no activaste tu prueba de <b>${esc(t.plugin_name)}</b>. Tus 3 días empiezan cuando lo actives, así que no has perdido nada.</p>
                    ${button(`${SITE}${product?.landingUrl || '/plugins/easy-master'}`, 'Descargar instalador')}
                    <p>Si te trabaste en algún paso, respóndeme por WhatsApp y te ayudo.</p>`)
            }).catch((e) => console.warn('[Store cron] nudge:', e.message));
            await supabase.from('store_trials').update({ nudge_sent_at: now.toISOString() }).eq('id', t.id);
            nudges++;
            continue;
        }

        if (exp && new Date(exp) < now && product) {
            const priceUsd = Math.min(trialFollowupPrice(t.country), product.price.high || product.price.base);
            const code = newCode('PRUEBA');
            const expiresAt = new Date(now.getTime() + OFFERS.trialFollowup.hoursValid * 3600 * 1000).toISOString();
            const { error: offerErr } = await supabase.from('store_offers').insert({
                code, type: 'trial_followup', email: t.email, product_id: product.id, price_usd: priceUsd,
                country: t.country, expires_at: expiresAt, sent_at: now.toISOString(), meta: { trial_id: t.id }
            });
            if (offerErr) { console.warn('[Store cron] oferta:', offerErr.message); continue; }
            await sendOffsznEmail({
                to: t.email, fromName: 'Willie Inspired', subject: `Tu prueba de ${t.plugin_name} terminó: quédatelo por $${priceUsd}`,
                html: mailShell(`<p style="font-size:20px;font-weight:800;margin:0 0 10px">Tu prueba terminó ⏳</p>
                    <p>Si ${esc(t.plugin_name)} te sirvió, quédatelo de por vida por <b>$${priceUsd} USD</b> (precio normal $${product.price.compareAt || product.price.high}).</p>
                    <p style="color:#5e5c64;margin:0">La oferta dura ${OFFERS.trialFollowup.hoursValid} horas y es solo para ti.</p>
                    ${button(`${SITE}/api/store/r/${code}`, `Quedármelo por $${priceUsd}`)}`)
            }).catch((e) => console.warn('[Store cron] oferta correo:', e.message));
            await supabase.from('store_trials').update({ followup_sent_at: now.toISOString(), followup_offer_code: code }).eq('id', t.id);
            offers++;
        }
    }
    console.log(`[Store cron] trial followups: ${nudges} recordatorios, ${offers} ofertas`);
    return res.json({ ok: true, nudges, offers });
};

// ─── Admin (x-admin-key)
export const adminAuth = (req, res, next) => {
    if (!isAdminKey(req.headers['x-admin-key'] || req.query.admin_key)) return res.status(403).json({ error: 'Unauthorized' });
    next();
};

export const adminCustomers = async (req, res) => {
    let q = supabase.from('store_customers').select('*').order('last_purchase_at', { ascending: false, nullsFirst: false }).limit(2000);
    if (req.query.segment) q = q.eq('segment', clip(req.query.segment, 20));
    if (req.query.country) q = q.or(`country.eq.${clip(req.query.country, 2).toUpperCase()},ip_country.eq.${clip(req.query.country, 2).toUpperCase()}`);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({
        items: (data || []).map((c) => ({
            email: c.email,
            username: c.username,
            pais: c.country || c.ip_country,
            vpn: c.vpn_suspected,
            segmento: c.segment,
            compras: c.purchase_count,
            dinero: Number(c.total_spent_usd || 0),
            horario: timeLabels(c.last_purchase_at),
            fuente: c.first_source,
            leadMagnets: c.lead_magnets,
            variante: c.ab_variant,
            creado: c.created_at
        }))
    });
};

export const adminAbReport = async (req, res) => {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [{ data: evs }, { data: orders }] = await Promise.all([
        supabase.from('store_events').select('event, variant').gte('created_at', since).not('variant', 'is', null).limit(50000),
        supabase.from('store_orders').select('ab_variant, total_usd, offer_type').eq('status', 'completed').gte('created_at', since).limit(10000)
    ]);
    const report = {};
    for (const v of VARIANTS) report[v] = { popup_view: 0, popup_click: 0, popup_close: 0, lead: 0, purchases: 0, revenueUsd: 0 };
    for (const e of evs || []) if (report[e.variant] && e.event in report[e.variant]) report[e.variant][e.event]++;
    for (const o of orders || []) {
        if (!report[o.ab_variant]) continue;
        report[o.ab_variant].purchases++;
        report[o.ab_variant].revenueUsd = Math.round((report[o.ab_variant].revenueUsd + Number(o.total_usd || 0)) * 100) / 100;
    }
    for (const v of Object.keys(report)) {
        const r = report[v];
        r.ctr = r.popup_view ? Math.round((r.popup_click / r.popup_view) * 1000) / 10 : 0;
        r.conversion = r.popup_view ? Math.round((r.purchases / r.popup_view) * 1000) / 10 : 0;
    }
    return res.json({ days, report });
};
