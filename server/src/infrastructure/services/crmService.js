// ─── Motor de automatizaciones del CRM de la tienda ───────────────────────────────────────────────────────────────
// Cada regla: elige a quién (funciones puras en shared/store/automations.js), reserva el envío en
// store_automation_log (índice único = nunca dos veces lo mismo), manda el correo y, si falla, libera la reserva.
import { supabase } from '../database/connection.js';
import { sendOffsznEmail } from '../../shared/utils/mailer.js';
import { getProduct } from '../../shared/store/catalog.js';
import { pickAbandonedCarts, pickNurture, pickPostPurchase, pickWinback, winbackRef } from '../../shared/store/automations.js';
import { mailShell, mailButton, esc } from './storeService.js';

const SITE = 'https://offszn.lat';
const MAX_PER_RUN = 40;

export const productUrl = (p) => {
    if (!p) return `${SITE}/willieinspired`;
    if (p.category === 'comunidad') return `${SITE}/willieinspired/comunidad/suscribirse`;
    const sub = ['artistas', 'bundle', 'expansiones'].includes(p.subcategory) ? `${p.subcategory}/` : '';
    return `${SITE}/willieinspired/${p.category}/${sub}${p.slug}`;
};

const EMAILS = {
    abandoned_cart: ({ cart }) => {
        const items = (cart.items || []).map((i) => getProduct(i.id)).filter(Boolean);
        return {
            subject: '¿Se te quedó algo en el carrito?',
            body: `<p style="font-size:20px;font-weight:800;margin:0 0 10px">Tu carrito te está esperando 🛒</p>
                <p style="margin:0 0 8px">Dejaste esto sin terminar:</p>
                <p style="margin:0 0 6px;color:#5e5c64">${items.map((p) => `• ${esc(p.title)}`).join('<br>')}</p>
                ${mailButton(`${SITE}/willieinspired/checkout?cart=${cart.id}`, 'Terminar mi compra')}
                <p style="margin:0;color:#5e5c64">Si prefieres, pruébalo antes en tu voz: respóndeme por WhatsApp y te mando el resultado.</p>`
        };
    },
    lead_nurture: ({ customer }) => {
        const lm = getProduct((customer.lead_magnets || [])[0]);
        return {
            subject: '¿Pudiste probar tu regalo? Tienes un descuento esperando',
            body: `<p style="font-size:20px;font-weight:800;margin:0 0 10px">¿Cómo te fue con tu regalo? 🎁</p>
                <p style="margin:0 0 6px">Si ya lo probaste, el siguiente paso es un preset de artista con los plugins incluidos y todo en español.</p>
                <p style="margin:0;color:#5e5c64">Tienes una oferta de bienvenida activa: míralo aquí.</p>
                ${mailButton(`${SITE}/willieinspired/oferta${lm?.slug ? `?lm=${encodeURIComponent(lm.slug)}` : ''}`, 'Ver mi oferta de bienvenida')}`
        };
    },
    post_purchase_upsell: ({ order }) => {
        const first = (order.lines || []).map((l) => getProduct(l.id)).find(Boolean);
        const next = (first?.upsells || []).map((id) => getProduct(id)).find((p) => p && p.status === 'active');
        if (!next) return null;
        return {
            subject: `Para sacarle más a tu compra: ${next.title}`,
            body: `<p style="font-size:20px;font-weight:800;margin:0 0 10px">¿Ya lo estás usando? 🎚️</p>
                <p style="margin:0 0 6px">Lo que más compran las personas después de ${esc(first.title)}:</p>
                <p style="font-weight:700;margin:0 0 6px">${esc(next.title)}</p><p style="margin:0;color:#5e5c64">${esc(next.tagline || '')}</p>
                ${mailButton(productUrl(next), 'Verlo')}`
        };
    },
    winback: () => ({
        subject: 'Te extrañamos: 2x1 en presets y plantillas',
        body: `<p style="font-size:20px;font-weight:800;margin:0 0 10px">Volvió el 2x1 🎁</p>
            <p style="margin:0 0 6px">Elige 2 productos y el de menor precio te sale gratis. Aprovecha para completar tu colección o probar una plantilla.</p>
            ${mailButton(`${SITE}/willieinspired/presets?oferta=2x1`, 'Ver presets con 2x1')}`
    })
};

const realDeps = () => ({ supabase, sendEmail: sendOffsznEmail });

async function ruleEnabled(d, key) {
    const { data, error } = await d.supabase.from('store_automation_rules').select('enabled').eq('key', key).maybeSingle();
    return error || !data ? true : Boolean(data.enabled);
}

// Reserva el envío; devuelve false si ya se mandó (o si dos procesos compiten).
async function claim(d, rule, email, ref, meta = null) {
    const { error } = await d.supabase.from('store_automation_log').insert({ rule, email: email.toLowerCase(), ref, meta });
    if (error?.code === '23505') return false;
    if (error) throw new Error(error.message);
    return true;
}
const release = (d, rule, email, ref) =>
    d.supabase.from('store_automation_log').delete().eq('rule', rule).eq('email', email.toLowerCase()).eq('ref', ref);

async function send(d, rule, email, ref, built, results) {
    if (!built) return;
    if (!(await claim(d, rule, email, ref))) { results.skipped++; return; }
    try {
        await d.sendEmail({ to: email, subject: built.subject, html: mailShell(built.body, { email }), fromName: 'Willie Inspired' });
        results.sent++;
        return true;
    } catch (e) {
        console.warn(`[CRM ${rule}] correo a ${email} falló:`, e.message);
        await release(d, rule, email, ref);
        results.failed++;
    }
}

export async function runAutomations(now = Date.now(), d = realDeps()) {
    const supabase = d.supabase;
    const out = {};
    const iso = (ms) => new Date(ms).toISOString();
    const H = 3600 * 1000;
    const D = 24 * H;
    let budget = MAX_PER_RUN;

    const run = async (rule, fetchRows, handle) => {
        const results = { sent: 0, skipped: 0, failed: 0, enabled: true };
        out[rule] = results;
        if (!(await ruleEnabled(d, rule))) { results.enabled = false; return; }
        const rows = await fetchRows();
        for (const row of rows) {
            if (budget <= 0) break;
            const before = results.sent;
            await handle(row, results);
            if (results.sent > before) budget--;
        }
    };

    await run('abandoned_cart', async () => {
        const { data } = await supabase.from('store_carts').select('*').is('reminder_sent_at', null).is('recovered_at', null)
            .gte('updated_at', iso(now - 48 * H)).lte('updated_at', iso(now - 2 * H)).limit(100);
        return pickAbandonedCarts(data, now);
    }, async (cart, r) => {
        if (await send(d, 'abandoned_cart', cart.email, cart.id + cart.updated_at, EMAILS.abandoned_cart({ cart }), r)) {
            await supabase.from('store_carts').update({ reminder_sent_at: iso(now) }).eq('id', cart.id);
        }
    });

    await run('lead_nurture', async () => {
        const { data } = await supabase.from('store_customers').select('*').eq('segment', 'FREE').eq('purchase_count', 0).eq('unsubscribed', false)
            .gte('created_at', iso(now - 14 * D)).lte('created_at', iso(now - 72 * H)).limit(200);
        return pickNurture(data, now);
    }, (customer, r) => send(d, 'lead_nurture', customer.email, '', EMAILS.lead_nurture({ customer }), r));

    await run('post_purchase_upsell', async () => {
        const { data } = await supabase.from('store_orders').select('payment_ref, email, status, created_at, lines').eq('status', 'completed')
            .gte('created_at', iso(now - 72 * H)).lte('created_at', iso(now - 24 * H)).limit(100);
        const picked = pickPostPurchase(data, now);
        // No molestar a quien ya está en una cola de baja
        if (!picked.length) return picked;
        const { data: unsub } = await supabase.from('store_customers').select('email').eq('unsubscribed', true).in('email', picked.map((o) => o.email.toLowerCase()));
        const blocked = new Set((unsub || []).map((c) => c.email));
        return picked.filter((o) => !blocked.has(o.email.toLowerCase()));
    }, (order, r) => send(d, 'post_purchase_upsell', order.email, order.payment_ref, EMAILS.post_purchase_upsell({ order }), r));

    await run('winback', async () => {
        const { data } = await supabase.from('store_customers').select('*').gte('purchase_count', 1).eq('unsubscribed', false)
            .lte('last_purchase_at', iso(now - 45 * D)).limit(200);
        return pickWinback(data, now);
    }, (customer, r) => send(d, 'winback', customer.email, winbackRef(now), EMAILS.winback(), r));

    return out;
}
