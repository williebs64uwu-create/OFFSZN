// Prueba de ventas: lee la base, pregunta a Brevo y arma el semáforo (reglas en shared/store/salesHealth.js).
import { supabase } from '../database/connection.js';
import { BREVO_API_KEY } from '../../shared/config/config.js';
import { sendOffsznEmail } from '../../shared/utils/mailer.js';
import { getSettings } from './financeService.js';
import { buildHealthReport, checkStarSales, checkLedger, summarizeBrevoEvents, sinceIso, HEALTH_WINDOW_DAYS } from '../../shared/store/salesHealth.js';

const ENV_KEYS = ['BREVO_API_KEY', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'SUPABASE_SERVICE_KEY', 'STORE_CRON_SECRET', 'MERCADOPAGO_ACCESS_TOKEN'];

async function brevoCheck(days) {
    if (!BREVO_API_KEY) return { error: 'No hay BREVO_API_KEY en el servidor.' };
    const headers = { accept: 'application/json', 'api-key': BREVO_API_KEY };
    try {
        const acc = await fetch('https://api.brevo.com/v3/account', { headers });
        if (!acc.ok) return { error: `Brevo respondió ${acc.status} (la llave no sirve o no tiene permiso).` };
        const account = (await acc.json().catch(() => ({}))).email || null;
        const ev = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?days=${Math.min(days, 30)}&limit=500&sort=desc`, { headers });
        if (!ev.ok) return { account, error: `Brevo no dejó leer el registro de correos (${ev.status}).` };
        const events = (await ev.json().catch(() => ({}))).events || [];
        return { account, summary: summarizeBrevoEvents(events) };
    } catch (err) {
        return { error: err.message };
    }
}

export async function salesHealth({ days = HEALTH_WINDOW_DAYS, now = Date.now() } = {}) {
    const since = sinceIso(now, days);
    const [pay, lic, subs, inc, recent] = await Promise.all([
        supabase.from('star_subscription_payments').select('sale_id,subscription_id,n,amount_usd,license_serial,paid_at').gte('paid_at', since).order('paid_at'),
        supabase.from('plugin_licenses').select('serial_key,status,expires_at,plugin_name').like('serial_key', 'STAR-%').order('created_at', { ascending: false }).limit(500),
        supabase.from('star_subscriptions').select('subscription_id,email,status,payments_count'),
        supabase.from('finance_income').select('ref,source,method,currency,fee,product,occurred_at').gte('occurred_at', since),
        supabase.from('plugin_licenses').select('plugin_name,created_at').gte('created_at', since)
    ]);
    const payments = pay.data || [];
    const [brevo] = await Promise.all([brevoCheck(days)]);
    const env = Object.fromEntries(ENV_KEYS.map((k) => [k, Boolean(String(process.env[k] || '').trim())]));
    const star = checkStarSales({ payments, licenses: lic.data || [], subscriptions: subs.data || [], income: (inc.data || []).filter((r) => r.source === 'subscription'), now });
    const ledger = checkLedger({ income: inc.data || [], now });
    const report = buildHealthReport({ env, star, ledger, brevo, licensesRecent: recent.data || [], now });
    return { ...report, days, star: { total: star.total, bad: star.bad, items: star.items.slice(-40).reverse(), cancelled: star.cancelled }, brevoFailures: brevo.summary?.failures?.slice(0, 30) || [], ledger };
}

// Manda un correo REAL por el mismo camino que usan las ventas (Brevo) a tu correo del informe semanal.
export async function sendTestEmail() {
    const { reportEmail } = await getSettings();
    if (!reportEmail) throw Object.assign(new Error('Primero guarda tu correo en Resumen → Informe semanal.'), { status: 400 });
    const t0 = Date.now();
    const sent = await sendOffsznEmail({
        to: reportEmail, fromName: 'OFFSZN',
        subject: '✅ Prueba de correos de OFFSZN',
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto"><h2>Los correos funcionan</h2><p>Este mensaje salió del servidor por Brevo, el mismo camino que usan las claves de STAR CHAIN y los plugins.</p><p style="color:#666;font-size:12px">${new Date(t0).toISOString()}</p></div>`
    });
    return { to: reportEmail, messageId: sent?.messageId || null, ms: Date.now() - t0 };
}
