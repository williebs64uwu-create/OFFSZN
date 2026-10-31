// ─── Finanzas del CRM · lectura y escritura del libro ────────────────────────────────────────────────────────────
// Regla de oro: anotar un pago NUNCA puede romper un cobro. Todo lo que se llama desde un pago pasa por funciones "seguras":
// capturan cualquier error, lo escriben en el log y devuelven un resultado; nunca lanzan.
import { supabase } from '../database/connection.js';
import { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT } from '../../shared/config/config.js';
import {
    FX_DEFAULT, START_AT_DEFAULT, EXPENSE_CATEGORIES, monthRange, summarize, normalizeManualIncome, paypalCaptureRows, mercadoPagoRow
} from '../../shared/store/finance.js';

const PAYPAL_API = PAYPAL_ENVIRONMENT === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

// ─── Ajustes ──────────────────────────────────────────────────────────────────────────────────────────────────
export async function getSettings() {
    const { data } = await supabase.from('finance_settings').select('key, value');
    const map = new Map((data || []).map((r) => [r.key, r.value]));
    const bank = map.get('bank_base') || { pen: 0, as_of: null };
    const fx = Number(map.get('fx_pen_per_usd'));
    return { bank, fx: Number.isFinite(fx) && fx > 0 ? fx : FX_DEFAULT, startAt: map.get('start_at') || START_AT_DEFAULT };
}

export async function saveBank({ pen, asOf }) {
    const amount = Number(pen);
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000000) throw Object.assign(new Error('Escribe el saldo en soles.'), { status: 400 });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(asOf)) ? asOf : new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('finance_settings').upsert({ key: 'bank_base', value: { pen: Math.round(amount * 100) / 100, as_of: date }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    return { pen: Math.round(amount * 100) / 100, as_of: date };
}

// Nombre del producto que se vendió en una orden: solo lo tuyo (producto sin productor = plugin de OFFSZN, o de tu cuenta).
const ownerIds = () => String(process.env.OFFSZN_OWNER_PRODUCER_IDS || '0382a813-85c7-46c3-8d2c-61a5692adffd').split(',').map((x) => x.trim()).filter(Boolean);
export function productLabel(cartItems = []) {
    const all = (cartItems || []).filter((i) => i?.product);
    const own = all.filter((i) => !i.product.producer_id || ownerIds().includes(String(i.product.producer_id)));
    const use = own.length ? own : all;
    return { product: use.map((i) => i.product.name).filter(Boolean).join(' + ') || null, productId: use.length === 1 && Number.isFinite(Number(use[0].product.id)) ? Number(use[0].product.id) : null };
}

// ─── Escritura segura de ingresos ─────────────────────────────────────────────────────────────────────────────
// (source, ref) es único: el mismo pago anotado dos veces (captura + webhook + reintento) queda una sola vez.
export async function recordIncome(rows) {
    const list = [].concat(rows || []).filter(Boolean);
    if (!list.length) return { ok: true, saved: 0 };
    try {
        const { data, error } = await supabase.from('finance_income').upsert(list, { onConflict: 'source,ref', ignoreDuplicates: true }).select('id');
        if (error) throw error;
        return { ok: true, saved: data?.length || 0 };
    } catch (e) {
        console.error('[Finance] No se pudo anotar el ingreso (el cobro NO se afecta):', e.message, list.map((r) => `${r.source}:${r.ref}`).join(','));
        return { ok: false, saved: 0, error: e.message };
    }
}

export const recordPayPalCaptures = (result, ctx) => {
    try { return recordIncome(paypalCaptureRows(result, ctx)); } catch (e) { console.error('[Finance] captura de PayPal ilegible:', e.message); return Promise.resolve({ ok: false, saved: 0 }); }
};
export const recordMercadoPago = (payment, ctx) => {
    try { return recordIncome(mercadoPagoRow(payment, ctx)); } catch (e) { console.error('[Finance] pago de Mercado Pago ilegible:', e.message); return Promise.resolve({ ok: false, saved: 0 }); }
};

// Despacho manual desde el panel de licencias ("Acción de Willie"). Devuelve el error de validación para mostrarlo en el panel.
export async function recordManualIncome(input) {
    const parsed = normalizeManualIncome(input);
    if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };
    const res = await recordIncome(parsed.row);
    return res.ok ? { ok: true, row: parsed.row, duplicate: res.saved === 0 } : { ok: false, error: 'No se pudo guardar el registro.', status: 500 };
}

// ─── Lectura ──────────────────────────────────────────────────────────────────────────────────────────────────
const sinceStart = (range, startAt) => ({ from: new Date(Math.max(Date.parse(range.from), Date.parse(startAt))).toISOString(), to: range.to });

export async function monthData(month) {
    const settings = await getSettings();
    const range = monthRange(month);
    const { from, to } = sinceStart(range, settings.startAt);
    const [income, spent] = await Promise.all([
        supabase.from('finance_income').select('*').gte('occurred_at', from).lt('occurred_at', to).order('occurred_at', { ascending: false }).limit(5000),
        supabase.from('finance_expenses').select('*').gte('spent_at', range.from.slice(0, 10)).lt('spent_at', range.to.slice(0, 10)).order('spent_at', { ascending: false }).limit(2000)
    ]);
    if (income.error) throw income.error;
    if (spent.error) throw spent.error;
    return { settings, month: range.month, income: income.data || [], expenses: spent.data || [], summary: summarize(income.data || [], spent.data || [], settings.fx) };
}

// Ingresos desde el inicio del conteo (los usa el Resumen del CRM).
export async function incomeSince(fromIso) {
    const settings = await getSettings();
    const from = new Date(Math.max(Date.parse(fromIso || settings.startAt), Date.parse(settings.startAt))).toISOString();
    const { data, error } = await supabase.from('finance_income').select('*').gte('occurred_at', from).order('occurred_at', { ascending: true }).limit(20000);
    if (error) throw error;
    return { rows: data || [], fx: settings.fx };
}

// ─── Gastos (siempre en soles) ────────────────────────────────────────────────────────────────────────────────
export async function addExpense({ category, amountPen, note, spentAt }) {
    const cat = String(category || '').toUpperCase();
    if (!EXPENSE_CATEGORIES.includes(cat)) throw Object.assign(new Error('Elige una categoría: Gaseosa, Comida rápida o Suscripción importante.'), { status: 400 });
    const amount = Number(amountPen);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) throw Object.assign(new Error('Escribe el monto en soles (mayor que 0).'), { status: 400 });
    const text = String(note || '').trim().slice(0, 200);
    if (cat === 'SUSCRIPCIÓN IMPORTANTE' && !text) throw Object.assign(new Error('Escribe cuál es la suscripción.'), { status: 400 });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(spentAt)) ? spentAt : new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
    const { data, error } = await supabase.from('finance_expenses').insert({ category: cat, amount_pen: Math.round(amount * 100) / 100, note: text || null, spent_at: date }).select('*').single();
    if (error) throw error;
    return data;
}

export async function deleteExpense(id) {
    const { error } = await supabase.from('finance_expenses').delete().eq('id', String(id).slice(0, 64));
    if (error) throw error;
}

// ─── Verificación contra PayPal (solo lectura) ────────────────────────────────────────────────────────────────
async function paypalToken() {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) throw new Error('PayPal no está configurado en el servidor.');
    const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
        method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials'
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('PayPal rechazó las credenciales del servidor.');
    return data.access_token;
}

// Vuelve a preguntarle a PayPal por un cobro ya anotado: confirma que existe y corrige bruto, comisión y neto si cambiaron.
export async function verifyPayPalIncome(id) {
    const { data: row, error } = await supabase.from('finance_income').select('*').eq('id', String(id).slice(0, 64)).maybeSingle();
    if (error) throw error;
    if (!row) throw Object.assign(new Error('Ese pago no existe.'), { status: 404 });
    if (row.method !== 'paypal' || row.by_willie) throw Object.assign(new Error('Solo se pueden verificar los cobros automáticos de PayPal.'), { status: 400 });
    const res = await fetch(`${PAYPAL_API}/v2/payments/captures/${encodeURIComponent(row.ref)}`, { headers: { Authorization: `Bearer ${await paypalToken()}` } });
    if (!res.ok) return { ok: false, verified: false, message: 'PayPal no reconoce este cobro.' };
    const cap = await res.json();
    const b = cap.seller_receivable_breakdown || {};
    const patch = { verified: String(cap.status).toUpperCase() === 'COMPLETED' };
    if (b.gross_amount?.value) patch.gross = Number(b.gross_amount.value);
    if (b.paypal_fee?.value) patch.fee = Number(b.paypal_fee.value);
    if (b.net_amount?.value) patch.net = Number(b.net_amount.value);
    await supabase.from('finance_income').update(patch).eq('id', row.id);
    return { ok: true, verified: patch.verified, status: cap.status, gross: patch.gross ?? row.gross, fee: patch.fee ?? row.fee, net: patch.net ?? row.net };
}

// ─── Avisos (webhook) de PayPal: registra los eventos de suscripción de STAR CHAIN sin buscarlos a mano ───────────
export const WEBHOOK_URL = 'https://offszn.lat/api/orders/paypal-webhook';
export const WEBHOOK_EVENTS = [
    'PAYMENT.SALE.COMPLETED', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED', 'BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.EXPIRED'
];

export async function setupPayPalWebhook() {
    const headers = { Authorization: `Bearer ${await paypalToken()}`, 'Content-Type': 'application/json' };
    const listRes = await fetch(`${PAYPAL_API}/v1/notifications/webhooks`, { headers });
    const list = await listRes.json();
    if (!listRes.ok) throw new Error(list.message || 'PayPal no dejó leer los webhooks de esta app.');
    const existing = (list.webhooks || []).find((w) => String(w.url).replace(/\/$/, '') === WEBHOOK_URL);
    const events = WEBHOOK_EVENTS.map((name) => ({ name }));
    if (!existing) {
        const res = await fetch(`${PAYPAL_API}/v1/notifications/webhooks`, { method: 'POST', headers, body: JSON.stringify({ url: WEBHOOK_URL, event_types: events }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'PayPal no dejó crear el webhook.');
        return { created: true, id: data.id, events: (data.event_types || []).map((e) => e.name) };
    }
    const have = new Set((existing.event_types || []).map((e) => e.name));
    const merged = [...new Set([...have, ...WEBHOOK_EVENTS])]; // se conservan los que ya tenía
    if (merged.length === have.size) return { created: false, id: existing.id, events: [...have], unchanged: true };
    const res = await fetch(`${PAYPAL_API}/v1/notifications/webhooks/${existing.id}`, {
        method: 'PATCH', headers, body: JSON.stringify([{ op: 'replace', path: '/event_types', value: merged.map((name) => ({ name })) }])
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'PayPal no dejó actualizar los eventos.');
    return { created: false, id: existing.id, events: (data.event_types || events).map((e) => e.name) };
}
